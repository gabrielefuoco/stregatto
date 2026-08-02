# Use Cases e Tool Interattivi (MCP Apps)

Una volta completata l'infrastruttura Core (Frontend Sandbox + Backend WebSocket Proxy), Stregatto potrà integrare questi server MCP interattivi. La filosofia è il "massimo risultato col minimo sforzo": usare UI già pronte o facilissime da implementare per funzioni ad altissimo valore.

## 1. Excalidraw MCP (Design & Diagramming)
*   **Obiettivo:** Creare e modificare diagrammi, architetture e mappe mentali direttamente in chat.
*   **Flusso:** L'agente genera la struttura base del diagramma. La chat renderizza l'app Excalidraw col canvas. L'utente può rifinire il diagramma a mano, spostare elementi, aggiungere testo.
*   **Vantaggio:** Elimina la frustrazione di dover descrivere a parole modifiche spaziali. Il server open-source fornisce già tutta la UI.

## 2. Plotly / D3 Dashboards (Data Science & Analytics)
*   **Obiettivo:** Renderizzare grafici interattivi (torte, barre, scatter plot) invece di tabelle markdown.
*   **Flusso:** L'agente analizza i dati e invoca un tool che restituisce `structuredContent` (dati + configurazione del grafico). Il Frontend inietta questi dati in un'App basata su Plotly.js o Recharts.
*   **Vantaggio:** L'utente può fare hover, zoomare e filtrare dinamicamente. Poche righe di codice per un risultato immenso.

## 3. Remote File System Explorer
*   **Obiettivo:** Esplorare e gestire file e cartelle su server remoti in modo visuale.
*   **Flusso:** Il tool `explore_filesystem` restituisce un'App che renderizza un albero delle directory navigabile (stile VS Code).
*   **Vantaggio:** Navigazione rapida, preview visiva e click per aprire/scaricare senza sprecare token per elencare cartelle in chat.

## 4. Tabelle Dati Avanzate (es. Ag-Grid)
*   **Obiettivo:** Gestire risultati di query SQL o file Excel massivi senza rompere il layout della chat.
*   **Flusso:** Invece del markdown, l'agente passa il JSON a una UI tabellare pre-fatta (Ag-Grid / DataTables).
*   **Vantaggio:** Ordinamento, filtraggio e ridimensionamento delle colonne avvengono lato client, senza nuovi round-trip con l'LLM.

## 5. PDF Viewer Interattivo
*   **Obiettivo:** Leggere e analizzare PDF lunghi.
*   **Flusso:** Il server spara in chat un visualizzatore PDF (stile `pdf.js`). L'agente comanda via JSON-RPC al viewer di scrollare alla pagina giusta ed evidenziare la clausola rilevante.
*   **Vantaggio:** Riferimento visivo immediato al documento originale invece di un copia-incolla fuori contesto. (Esempio ufficiale `pdf-server` già esistente nell'SDK).

## 6. Mappe Interattive (Leaflet / Mapbox)
*   **Obiettivo:** Visualizzare dati geografici (es. clienti, indirizzi estratti).
*   **Flusso:** L'agente restituisce un'App con una mappa e dei marker.
*   **Vantaggio:** Interazione nativa (pan, zoom, click sui pin). (Esempio ufficiale `map-server` già esistente nell'SDK).

## 7. Streamer di Log / Terminale
*   **Obiettivo:** Feedback visivo per operazioni lunghe (deploy, build Docker, script bash).
*   **Flusso:** Appare una finestra di terminale "finta" (es. `xterm.js`) nella chat.
*   **Vantaggio:** L'utente vede scorrere l'output live tramite il WebSocket, invece di aspettare in silenzio un blocco di testo gigante alla fine del task.
