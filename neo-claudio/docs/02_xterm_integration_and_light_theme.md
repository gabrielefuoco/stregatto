# Step 02 — Integrazione xterm.js e Tema Chiaro con Dot Grid

## 1. Obiettivo
L'obiettivo di questo step è integrare **xterm.js v5** nella Single Page Application (SPA) in Vanilla JS, connettendo il terminale all'endpoint WebSocket PTY sviluppato nello Step 01. Inoltre, implementeremo un tema **Neo-Brutalist** chiaro, caratterizzato da:
- Sfondo bianco/chiaro con un sottile pattern a griglia di punti (dot grid).
- Bordi Neo-Brutalist netti (`border-2 border-[#1a1c1c]`) e ombre con offset duro senza sfocatura.
- Colore di accento arancione (`#FF5F1F`) per cursore, selezione e link.
- Tipografia che combina **Space Grotesk** per l'interfaccia utente e un font monospace standard per il terminale.
- Addon ufficiali xterm.js: `fit` (auto-resize), `webLinks` (URL cliccabili) e `search` per la ricerca nel buffer.

## 2. Dipendenze Frontend
Per mantenere l'approccio Vanilla JS senza build step (no npm, no Webpack/Vite), caricheremo xterm.js e i suoi addon direttamente via CDN (unpkg o jsdelivr) all'interno di `index.html`.

Dipendenze richieste:
- xterm.js core
- xterm-addon-fit
- xterm-addon-web-links
- xterm-addon-search
- xterm.css

## 3. File: `static/index.html` (MODIFIED)
Modifiche necessarie alla struttura dell'HTML principale per includere gli script CDN e preparare il container per il terminale.

```html
<!-- Aggiungere all'interno del tag <head> -->
<!-- xterm.css -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css" />

<!-- Aggiungere prima della chiusura del tag <body> -->
<!-- xterm.js core e addons -->
<script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xterm-addon-search@0.13.0/lib/xterm-addon-search.min.js"></script>

<!-- Aggiunta della struttura HTML per il container del terminale nel main content -->
<main id="main-content" class="flex flex-col h-full overflow-hidden">
  <div id="tab-bar" class="flex border-b-2 border-[#1a1c1c] bg-white">
    <!-- Tabs will be rendered here -->
  </div>
  <div id="toolbar" class="flex justify-between items-center p-2 border-b-2 border-[#1a1c1c] bg-white">
    <!-- Toolbar controls (model selector, stop, etc.) -->
  </div>
  
  <!-- Container del Terminale Neo-Brutalist -->
  <div class="terminal-wrapper flex-grow relative bg-[#f4f4f4] m-4 border-2 border-[#1a1c1c] shadow-[4px_4px_0px_0px_#1a1c1c] rounded-none overflow-hidden">
    <div id="terminal-container" class="absolute inset-0 p-4"></div>
  </div>
</main>
```

## 4. File: `static/js/terminal.js` (NEW)
Questo nuovo modulo gestirà le istanze di xterm.js e la loro connessione WebSocket al backend PTY.

```javascript
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

    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log(`[Terminal] WS connesso per sessione ${sessionId}`);
      
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
      term.write('\r\n\x1b[31m[Connessione terminata]\x1b[0m\r\n');
      
      // Implementare qui un eventuale meccanismo di reconnect backoff se necessario
    };

    ws.onerror = (error) => {
      console.error(`[Terminal] Errore WS per sessione ${sessionId}`, error);
    };

    // Wire terminal inputs to WS
    term.onData(data => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Wire terminal resizes to WS
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    // Window resize listener
    const resizeHandler = () => {
      addons.fit.fit();
    };
    window.addEventListener('resize', resizeHandler);
    
    // Salva referenze per pulizia futura
    this.connections.set(sessionId, { ws, resizeHandler });
  }

  disconnect(sessionId) {
    const conn = this.connections.get(sessionId);
    if (conn) {
      window.removeEventListener('resize', conn.resizeHandler);
      if (conn.ws.readyState === WebSocket.OPEN || conn.ws.readyState === WebSocket.CONNECTING) {
        conn.ws.close();
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
```

## 5. File: `static/css/themes.css` (MODIFIED)
Aggiunta delle regole CSS specifiche per incapsulare xterm.js in un'estetica Neo-Brutalist con dot grid.

```css
/* Stregatto V3 - Terminal & Layout Theme CSS */

/* Neo-Brutalist Terminal Container */
.terminal-wrapper {
  background-color: #ffffff;
  /* Dot Grid Pattern */
  background-image: radial-gradient(#D4D4D4 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: 0 0;
  
  /* Neo-Brutalist borders and shadow */
  border: 2px solid #1a1c1c;
  box-shadow: 4px 4px 0px 0px #1a1c1c;
  border-radius: 0;
  transition: all 0.2s ease;
}

/* xterm.js overrides for transparency and spacing */
.xterm-viewport {
  background-color: transparent !important;
}
.xterm-screen {
  padding: 8px;
}

/* Scrollbar Neo-Brutalist styling per il terminale */
.xterm-viewport::-webkit-scrollbar {
  width: 14px;
}
.xterm-viewport::-webkit-scrollbar-track {
  background: #ffffff;
  border-left: 2px solid #1a1c1c;
}
.xterm-viewport::-webkit-scrollbar-thumb {
  background: #FF5F1F;
  border: 2px solid #1a1c1c;
}
.xterm-viewport::-webkit-scrollbar-thumb:hover {
  background: #e04e15;
}

/* Tabs & Toolbar Base Styling */
#tab-bar, #toolbar {
  font-family: 'Space Grotesk', sans-serif;
  color: #1a1c1c;
}

#tab-bar .tab {
  border-right: 2px solid #1a1c1c;
  padding: 0.5rem 1rem;
  cursor: pointer;
  background-color: #f4f4f4;
  font-weight: 600;
}

#tab-bar .tab.active {
  background-color: #ffffff;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px; /* Overlap border-b of container */
  color: #FF5F1F;
}

/* Responsive Layout Utilities */
@media (max-width: 1200px) {
  #sidebar-right { display: none !important; }
}

@media (max-width: 768px) {
  #sidebar-left { display: none !important; } /* Sostituire con hamburger menu */
  .terminal-wrapper {
    margin: 0;
    border-width: 1px 0 0 0;
    box-shadow: none;
  }
}
```

## 6. File: `static/js/view_chat.js` (MODIFIED — Major changes)
Questo file subirà una riscrittura concettuale pesante.

### Cosa verrà rimosso:
- **SSE/EventSource Logic**: Qualsiasi referenza a connessioni Server-Sent Events viene eliminata.
- **NDJSON Parsing**: Le funzioni di parsing riga per riga del JSON stream (Claude) non servono più, essendo sostituite dal raw byte stream del PTY.
- **Custom DOM Rendering**: Tutto il codice che genera cards, token di thinking, box per i tool call, bottoni copia-incolla per il codice e formattazione markdown viene scartato. Il frontend ora non "comprende" i messaggi dell'agente, ma si limita a visualizzare il terminale.

### Cosa verrà introdotto:
- Inizializzazione della classe `TerminalManager`.
- Creazione del DOM per ospitare il terminale al momento della selezione/caricamento di una chat/progetto.

**Snippet concettuale del nuovo `view_chat.js`**:
```javascript
import { TerminalManager } from './terminal.js';

const termManager = new TerminalManager();
let currentSessionId = null;

export function loadChatView(sessionId) {
  currentSessionId = sessionId;
  
  // Clean up existing view
  const container = document.getElementById('terminal-container');
  container.innerHTML = '';
  
  // 1. Inizializza l'istanza xterm.js
  termManager.create(sessionId, container);
  
  // 2. Costruisci URL WebSocket
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/ws/pty/${sessionId}`;
  
  // 3. Connetti xterm.js al backend
  termManager.connect(sessionId, wsUrl);
  
  // Setup Toolbar
  setupToolbar(sessionId);
}

function setupToolbar(sessionId) {
  // Configura pulsanti come 'Attach', 'Stop Agent', e selettore modelli.
  // ...
}
```

## 7. Layout CSS Architecture
L'architettura del layout usa CSS Grid/Flexbox per strutturare la view in tre colonne principali su Desktop.

```text
+----------------+-------------------------------------+----------------+
|                |             [tab-bar]               |                |
| [sidebar-left] |-------------------------------------| [sidebar-right]|
|                |             [toolbar]               |                |
| - Projects     |-------------------------------------| - MCP Apps     |
| - Agents       |                                     | - Gallery      |
| - Settings     |      [terminal-wrapper]             | - Tools        |
|                |      (with Dot Grid bg)             |                |
|                |      +-----------------------+      |                |
|                |      |                       |      |                |
|                |      |  xterm.js viewport    |      |                |
|                |      |  (transparent)        |      |                |
|                |      |                       |      |                |
|                |      +-----------------------+      |                |
+----------------+-------------------------------------+----------------+
```

**Comportamento Responsive Breakpoints**:
- **Desktop (>1200px)**: Layout completo a 3 colonne, entrambe le sidebar (navigazione e strumenti) sono visibili.
- **Tablet (768px - 1200px)**: La sidebar di destra viene nascosta o collassata. La sidebar di sinistra rimane o diventa a scomparsa.
- **Mobile (<768px)**: Nessuna sidebar visibile a schermo fisso, il terminale copre il 100% dell'area disponibile (`flex-grow`, niente margini). Appare un hamburger menu per la navigazione.

## 8. Dot Grid Implementation Details
Il pattern a griglia (Dot Grid) è un elemento fondamentale dello stile Neo-Brutalist pulito richiesto.

### Funzionamento tecnico:
1. **Container CSS**: Viene applicato a `.terminal-wrapper` utilizzando `background-image: radial-gradient(...)`.
2. **Dimensionamento**: `background-size: 20px 20px;` crea una cella di 20x20 pixel.
3. **Disegno del Punto**: `#D4D4D4 1px, transparent 1px` istruisce il browser a riempire con un grigio chiaro un raggio di 1px dal centro della cella, lasciando trasparente il resto.
4. **Trasparenza xterm.js**: Perché la griglia sia visibile, xterm.js viene inizializzato con `allowTransparency: true` nel suo costruttore.
5. **Background Tema**: Il tema personalizzato `STREGATTO_LIGHT_THEME` definisce `background: 'rgba(255, 255, 255, 0.0)'`. In questo modo il canvas di xterm.js non copre la griglia sottostante, creando un effetto profondità.

## 9. Test e Verifica
Per confermare l'implementazione del Layer 2:
1. Aprire il browser all'indirizzo `http://localhost:8000`.
2. L'interfaccia deve presentare il layout a colonne con il terminale Neo-Brutalist al centro. La griglia di punti deve essere chiaramente (ma sottilmente) visibile dietro il cursore del terminale.
3. Selezionando del testo nel terminale, lo sfondo della selezione deve essere arancione semitrasparente (`#FF5F1F30`).
4. Digitando sulla tastiera, i caratteri devono apparire a schermo (questo conferma l'I/O circolare tramite WebSocket PTY creato nello Step 01).
5. Ridimensionando la finestra del browser, l'addon `fit` deve ricalcolare automaticamente le colonne/righe e xterm.js non deve mostrare artefatti grafici o clipping.
6. Eventuali URL stampati nel buffer dal terminale devono diventare cliccabili al passaggio del mouse grazie all'addon `webLinks`.
