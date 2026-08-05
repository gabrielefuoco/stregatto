/**
 * Terminal Manager for Stregatto V3
 * Manages xterm.js instances connected to PTY WebSocket sessions
 */

const STREGATTO_LIGHT_THEME = {
  background: 'rgba(255, 255, 255, 0.0)', // Trasparente per mostrare il dot grid
  foreground: '#1A1C1C',
  cursor: '#FF5F1F',
  cursorAccent: '#FFFFFF',
  selectionBackground: 'rgba(255, 95, 31, 0.3)', // #FF5F1F30
  selectionForeground: '#1A1C1C',
  
  // ANSI Colors mapped to a readable light theme / Neo-Brutalist palette
  black: '#1A1C1C',
  red: '#E03131',
  green: '#2F9E44',
  yellow: '#F08C00',
  blue: '#1971C2',
  magenta: '#9C36B5',
  cyan: '#0C8599',
  white: '#F8F9FA',
  
  brightBlack: '#868E96',
  brightRed: '#FF6B6B',
  brightGreen: '#51CF66',
  brightYellow: '#FCC419',
  brightBlue: '#339AF0',
  brightMagenta: '#FCC2D7',
  brightCyan: '#22B8CF',
  brightWhite: '#FFFFFF'
};

export class TerminalManager {
  constructor() {
    this.terminals = new Map();
    this.connections = new Map();
    this.addons = new Map();
  }

  /**
   * Creates a new xterm.js instance with the light theme and loads addons
   */
  create(sessionId, containerEl, options = {}) {
    if (this.terminals.has(sessionId)) {
      return this.terminals.get(sessionId);
    }

    const term = new Terminal({
      theme: STREGATTO_LIGHT_THEME,
      allowTransparency: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      ...options
    });

    // Initialize Addons
    const fitAddon = new FitAddon.FitAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    const searchAddon = new SearchAddon.SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    term.open(containerEl);
    
    // Initial fit
    setTimeout(() => fitAddon.fit(), 50);

    this.terminals.set(sessionId, term);
    this.addons.set(sessionId, { fit: fitAddon, webLinks: webLinksAddon, search: searchAddon });

    return term;
  }

  /**
   * Connects the terminal to the WebSocket PTY endpoint
   */
  connect(sessionId, wsUrl) {
    const term = this.terminals.get(sessionId);
    const addons = this.addons.get(sessionId);
    if (!term || !addons) throw new Error("Terminal non inizializzato");

    // Close existing connection if any
    if (this.connections.has(sessionId)) {
      this.connections.get(sessionId).close();
    }

    // Helper for backoff reconnect
    let reconnectAttempts = 0;
    const maxReconnectDelay = 30000;
    
    const connectWs = () => {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log(`[Terminal] WS connesso per sessione ${sessionId}`);
        reconnectAttempts = 0; // Reset attempts on successful connection
        
        // Trigger un resize iniziale per informare il backend delle dimensioni corrette
        const { cols, rows } = term;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'output') {
            // Decodifica base64 dal backend PTY
            const text = atob(msg.data);
            term.write(text);
          }
        } catch (e) {
          // Fallback per messaggi non-JSON o plain text
          if (event.data instanceof Blob) {
            const text = await event.data.text();
            term.write(text);
          } else {
            term.write(event.data);
          }
        }
      };

      ws.onclose = (event) => {
        console.log(`[Terminal] WS chiuso per sessione ${sessionId}`, event);
        if (event.code === 1000) {
            term.write('\r\n\x1b[31m[Connessione terminata]\x1b[0m\r\n');
        } else {
            // Backoff riconnessione esponenziale: 1s, 2s, 4s, 8s, max 30s
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
            reconnectAttempts++;
            term.write(`\r\n\x1b[33m[Connessione persa. Riconnessione tra ${delay/1000}s...]\x1b[0m\r\n`);
            setTimeout(connectWs, delay);
        }
      };

      ws.onerror = (error) => {
        console.error(`[Terminal] Errore WS per sessione ${sessionId}`, error);
      };

      // Store WS reference
      if (this.connections.has(sessionId)) {
         this.connections.get(sessionId).ws = ws;
      }
    };
    
    // Wire terminal inputs to WS
    term.onData(data => {
      const conn = this.connections.get(sessionId);
      if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        // Encoding base64 come richiesto per l'input? No, le docs dicono type: input, data
        // Ma wait, "Gestire l'encoding base64 per i dati del terminale (in e out)"
        // Vediamo lo step 1 se diceva base64 per l'input.
        // No, step 1: {"type": "input", "data": "echo hello\n"} (in realtà text).
        // Ma per sicurezza base64 encode input se richiesto, però nello step 01 diceva JSON parse, ma nello step 02 dice "Gestire l'encoding base64 (in e out)".
        // Usiamo btoa per i data
        conn.ws.send(JSON.stringify({ type: 'input', data: btoa(data) }));
      }
    });

    // Wire terminal resizes to WS
    term.onResize(({ cols, rows }) => {
      const conn = this.connections.get(sessionId);
      if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    // Window resize listener
    const resizeHandler = () => {
      addons.fit.fit();
    };
    window.addEventListener('resize', resizeHandler);
    
    // Initialize connection
    this.connections.set(sessionId, { ws: null, resizeHandler });
    connectWs();
  }

  disconnect(sessionId) {
    const conn = this.connections.get(sessionId);
    if (conn) {
      window.removeEventListener('resize', conn.resizeHandler);
      if (conn.ws && (conn.ws.readyState === WebSocket.OPEN || conn.ws.readyState === WebSocket.CONNECTING)) {
        conn.ws.close(1000); // 1000 = normal closure to avoid reconnect
      }
      this.connections.delete(sessionId);
    }
  }

  destroy(sessionId) {
    this.disconnect(sessionId);
    const term = this.terminals.get(sessionId);
    if (term) {
      term.dispose();
      this.terminals.delete(sessionId);
      this.addons.delete(sessionId);
    }
  }

  resize(sessionId) {
    const addons = this.addons.get(sessionId);
    if (addons && addons.fit) {
      addons.fit.fit();
    }
  }

  getTerminal(sessionId) {
    return this.terminals.get(sessionId);
  }
}
