# Masterplan: Architettura Distribuita "Stregatto"

Questo documento costituisce la *source of truth* architetturale per trasformare Stregatto in un **Sistema Operativo Personale basato su AI**. Il sistema adotta un'architettura ibrida e asincrona che disaccoppia il motore cognitivo (Cloud Stateless) dagli ambienti operativi fisici e isolati (Local Edge e Cloud Sandbox).

## 1. Topologia del Sistema

Il sistema si compone di quattro pilastri fondamentali:
1. **Il Cervello (Cloud Backend Stateless)**: Cheshire Cat V2 (FastAPI) su container effimeri.
2. **La Memoria Transazionale (State Management)**: Supabase (PostgreSQL + Auth) per chat history e task queue.
3. **Le Braccia (Ambienti di Esecuzione)**:
   - **Local Edge**: MCP Tunnel per operare sul PC dell'utente (qui risiede la LLM-Wiki).
   - **Cloud Sandbox**: Ambiente Linux isolato (Bubblewrap) con sincronizzazione verso il locale.
4. **L'Interfaccia (PWA Client)**: HTML/Vanilla JS per interagire, visualizzare streaming, inviare audio e renderizzare UI incapsulate.

## 2. Fasi di Rilascio Strategico
Il progetto è diviso in 5 fasi rigorose, che si sovrappongono partendo dall'infrastruttura base fino ad arrivare alla generazione documentale avanzata.

1. **Fase 1: Infrastruttura e Stateless Backend**
   Migrazione a Supabase (PostgreSQL + Auth) per permettere un deploy sicuro e Multi-Tenant.
2. **Fase 2: I Due Mondi dell'Esecuzione (Local MCP & Cloud Sandbox)**
   Tunnel Cloudflare per l'accesso locale, Sandbox in Bubblewrap per calcoli distruttivi, e Sync Engine Bidirezionale per non perdere mai i file creati in cloud.
3. **Fase 3: Progressive Web App e UX in Streaming**
   Installabilità mobile, parsing Markdown, Whisper STT e fotocamera.
4. **Fase 4: Automazioni, Eventi, Notion & RSS**
   Coda remota per task differiti (PC spenti), Notifiche Push, Webhooks. **Integrazione totale con Notion (via MCP)** per creare documenti strutturati al volo e renderizzarli nella UI (Iframe). Sviluppo del ciclo quotidiano "Giornale Personale" (lettura RSS, trascrizioni YouTube, approfondimento via Tavily e delivery su Notion).
5. **Fase 5: La LLM-Wiki (Memoria Persistente su File System)**
   Adozione del Pattern LLM-Wiki (Karpathy) sul PC dell'utente tramite MCP: gestione puramente Markdown su File System locale, cartelle `/raw/` e `/wiki/`, per creare una mappa concettuale sfogliabile con Obsidian, scevra da rumore generico.
