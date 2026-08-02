# Specifica Fase 3: PWA e UX in Streaming

## 1. Obiettivo e Scope
Elevare l'interfaccia `canvas_ui` a livello di una Progressive Web App nativa. Fornire un rendering fluido per lo streaming e facilitare l'interazione multi-modale.

## 2. PWA e Service Worker (Gestione Offline)

### 2.1 App Manifest (`public/manifest.json`)
```json
{
  "name": "Stregatto OS",
  "short_name": "Stregatto",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "background_color": "#121212",
  "theme_color": "#121212",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

### 2.2 Service Worker Strategy (`public/sw.js`)
L'obiettivo è caricare la UI istantaneamente, bypassando la rete, per poi sincronizzare i dati.
```javascript
const CACHE_NAME = 'stregatto-ui-v1';
const ASSETS = ['/', '/css/style.css', '/js/main.js'];

self.addEventListener('fetch', (event) => {
  // Stale-while-revalidate per gli asset statici
  if (event.request.method === 'GET' && !event.request.url.includes('/api/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      })
    );
  }
});
```

## 3. Rendering Avanzato e Iframe Injection

### 3.1 Gestione Sicura dell'Iframe (Notion)
Quando il backend invia un iframe Notion nel Markdown, `marked.js` per default lo elimina (se sanitizzato).
- Configurazione `DOMPurify`:
  ```javascript
  DOMPurify.sanitize(markedText, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling']
  });
  ```
- CSS per Iframe Responsive:
  ```css
  .chat-message iframe {
      width: 100%;
      height: 65vh; /* 65% dello schermo del telefono */
      border-radius: 12px;
      border: 1px solid #333;
  }
  ```

## 4. UX Multimodale (Integrazione API)

### 4.1 Registrazione Audio (Whisper)
Logica JS per invio chunked:
```javascript
// mediaRecorder.ondataavailable
const formData = new FormData();
formData.append('file', audioBlob, 'voice.webm');
fetch('/api/voice/transcribe', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${supabaseToken}` },
    body: formData
}).then(res => res.json())
  .then(data => document.getElementById('chat-input').value += data.text);
```
- **Backend (FastAPI)**: Usa `tempfile.NamedTemporaryFile` per salvare il WEBM, esegue `ffmpeg` (se necessario per convertire in MP3/M4A), poi chiama `openai.audio.transcriptions.create(model="whisper-1", file=f)`.
