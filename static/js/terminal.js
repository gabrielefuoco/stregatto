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

    // Search UI setup
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'absolute top-2 right-2 bg-white border-2 border-black p-1.5 shadow-[4px_4px_0px_#000] z-10 hidden flex items-center gap-1.5 font-headline';
    searchWrapper.innerHTML = `
      <input type="text" class="px-2 py-1 outline-none text-xs font-headline font-bold border-2 border-black focus:border-[#FF5F1F] w-44 bg-[#f4f4f4]" placeholder="CERCA NEL TERMINALE...">
      <button class="bg-black text-white px-2 py-1 text-xs font-headline font-bold border border-black hover:bg-[#FF5F1F]">↓</button>
      <button class="bg-black text-white px-2 py-1 text-xs font-headline font-bold border border-black hover:bg-[#FF5F1F]">↑</button>
      <button class="text-black px-2 py-1 text-xs font-headline font-bold hover:bg-red-500 hover:text-white">✕</button>
    `;
    containerEl.appendChild(searchWrapper);
    const [searchInput, btnNext, btnPrev, btnClose] = searchWrapper.children;
    
    const findNext = () => searchAddon.findNext(searchInput.value, { incremental: false });
    const findPrev = () => searchAddon.findPrevious(searchInput.value, { incremental: false });
    
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.shiftKey ? findPrev() : findNext();
        } else if (e.key === 'Escape') {
            searchWrapper.classList.add('hidden');
            term.focus();
        }
    });
    btnNext.onclick = findNext;
    btnPrev.onclick = findPrev;
    btnClose.onclick = () => {
        searchWrapper.classList.add('hidden');
        term.focus();
    };

    term.attachCustomKeyEventHandler(e => {
        if (e.type === 'keydown' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            searchWrapper.classList.remove('hidden');
            searchInput.focus();
            searchInput.select();
            return false;
        }
        return true;
    });

    term.open(containerEl);
    
    // Focus terminal on click, only if not clicking search UI
    containerEl.addEventListener('click', (e) => {
      if (!searchWrapper.contains(e.target)) term.focus();
    });

    // Initial fit and focus
    setTimeout(() => {
      fitAddon.fit();
      term.focus();
    }, 50);

    // Wire terminal inputs to WS once during creation
    term.onData(data => {
      const conn = this.connections.get(sessionId);
      if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        try {
          conn.ws.send(new TextEncoder().encode(data));
        } catch (e) {
          console.error("Error encoding terminal input:", e);
        }
      }
    });

    // Wire terminal resizes to WS
    term.onResize(({ cols, rows }) => {
      const conn = this.connections.get(sessionId);
      if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

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
      const existing = this.connections.get(sessionId);
      if (existing && existing.ws) existing.ws.close();
    }

    // Helper for backoff reconnect
    let reconnectAttempts = 0;
    const maxReconnectDelay = 30000;
    
    const connectWs = () => {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log(`[Terminal] WS connesso per sessione ${sessionId}`);
        reconnectAttempts = 0;
        const { cols, rows } = term;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        term.focus();
      };

      ws.binaryType = 'arraybuffer';
      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
           term.write(new Uint8Array(event.data));
        } else if (typeof event.data === 'string') {
           try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'exit') {
                  term.write('\r\n\x1b[31m[Processo terminato]\x1b[0m\r\n');
              }
           } catch(e) {
              term.write(event.data);
           }
        } else if (event.data instanceof Blob) {
            event.data.arrayBuffer().then(buffer => {
                term.write(new Uint8Array(buffer));
            });
        }
      };

      ws.onclose = (event) => {
        console.log(`[Terminal] WS chiuso per sessione ${sessionId}`, event);
        if (event.code === 1000) {
            term.write('\r\n\x1b[31m[Connessione terminata]\x1b[0m\r\n');
        } else {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
            reconnectAttempts++;
            term.write(`\r\n\x1b[33m[Connessione persa. Riconnessione tra ${delay/1000}s...]\x1b[0m\r\n`);
            setTimeout(connectWs, delay);
        }
      };

      ws.onerror = (error) => {
        console.error(`[Terminal] Errore WS per sessione ${sessionId}`, error);
      };

      if (this.connections.has(sessionId)) {
         this.connections.get(sessionId).ws = ws;
      }
    };

    const resizeHandler = () => {
      addons.fit.fit();
    };
    window.addEventListener('resize', resizeHandler);
    
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
