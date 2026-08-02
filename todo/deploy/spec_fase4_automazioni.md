# Specifica Fase 4: Automazioni, Eventi, Notion & RSS

## 1. La Filosofia (L'Agente come Regista)
La UI di una chat è spesso limitante per contenuti estesi. Cercare di far generare all'LLM enormi blocchi di codice Markdown o complessi componenti React direttamente nel flusso dei messaggi rende la conversazione pesante, difficile da navigare e soggetta a rotture grafiche sul mobile.
L'idea fondamentale qui è cambiare il ruolo dello Stregatto: **da semplice generatore di testo, a Regista (Executive Assistant)**.
Lo Stregatto fa il "lavoro sporco" in background (orchestra API, scarica video, analizza, fa sintesi profonda con web-search) e poi **commissiona a uno strumento dedicato (Notion)** l'impaginazione professionale del risultato. Infine, si limita a "consegnarti" in chat il documento impaginato tramite un elegante `<iframe>`. Questa separazione dei compiti garantisce UI perfette senza dover scrivere codice frontend complesso.

## 2. Remote Task Queue & Push Notifications

### 2.1 La Coda Asincrona
Se il PC dell'utente (Tunnel MCP) è spento, l'agente non fallisce ma parcheggia l'intento nel database (`ccat_tasks` in stato `PENDING`). Al riavvio del tunnel, l'agente esegue il backlog.

### 2.2 Web Push (VAPID)
Payload Python `pywebpush`:
```python
payload = {
    "title": "Stregatto Daily",
    "body": "Il tuo report giornaliero è pronto con 3 notizie e 1 video.",
    "icon": "/icons/icon-192x192.png",
    "data": { "url": "/chat" }
}
```

## 3. L'Automazione Quotidiana (Daily Digest RSS & YouTube)
Il caso d'uso principe dell'integrazione Notion. Un task in background (eseguito ogni mattina o attivabile dal comando `/daily`) dove lo Stregatto ti prepara il "Giornale Personale".

### 3.1 Il Flusso Esecutivo
1. **Raccolta**: L'agente recupera i Feed RSS e i Canali YouTube registrati dall'utente.
2. **Estrazione Leggera**: Invece di scaricare l'MP4 del video, l'agente usa `youtube-transcript-api` per catturare i sottotitoli.
3. **Analisi e Sintesi (LLM + Tavily)**:
   - L'agente estrapola i 5 bullet-points salienti dalla trascrizione del video.
   - Per le notizie RSS più importanti, effettua ricerche autonome sul web (tramite Web Search / Tavily) per arricchire la notizia con contesto aggiornato, link e traduzioni in italiano.
4. **Impaginazione (Notion API)**: L'agente genera il payload JSON per Notion.

## 4. Notion API (Generazione Notebook)

### 4.1 Creazione Pagina (POST /v1/pages)
Il payload definisce la struttura pulita, includendo nativamente i video:
```json
{
  "parent": { "database_id": "TUO_DATABASE_ID_CONDIVISO" },
  "properties": { "title": { "title": [{ "text": { "content": "Daily Digest: 31 Luglio 2026" } }] } },
  "children": [
    {
      "object": "block",
      "type": "heading_2",
      "heading_2": { "rich_text": [{ "type": "text", "text": { "content": "📰 Top News (Tavily Deep-Dive)" } }] }
    },
    {
      "object": "block",
      "type": "paragraph",
      "paragraph": { "rich_text": [{ "type": "text", "text": { "content": "<RIASSUNTO LLM>" } }] }
    },
    {
      "object": "block",
      "type": "video",
      "video": { "type": "external", "external": { "url": "https://www.youtube.com/watch?v=VIDEO_ID" } }
    }
  ]
}
```

### 4.2 Delivery in Chat (Iframe)
L'agente ti notifica e ti serve l'Iframe, che la PWA (opportunamente configurata con DOMPurify per bypassare i blocchi iframe) mostrerà fluido a schermo intero:
```markdown
Il tuo report è pronto:
<iframe src="https://notion.site/{page_id}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>
```
L'utente può leggere un report complesso, guardare i video embeddati leggendo i riassunti a fianco, senza mai uscire dallo Stregatto.
