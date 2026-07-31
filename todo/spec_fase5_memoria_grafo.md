# Specifica Fase 5: La LLM-Wiki (Memoria Markdown Persistente)

## 1. La Filosofia (L'Idea Fondamentale)
La maggior parte dei sistemi IA (come il classico RAG) tratta la memoria in modo passivo: tu carichi documenti, e quando fai una domanda l'IA pesca frammenti ("chunk") per generare una risposta al volo. Il problema? **L'IA riscopre la conoscenza da zero a ogni singola domanda**. Non c'è accumulo. Se fai una domanda complessa che richiede di sintetizzare 5 documenti, l'IA deve ri-incollare i frammenti ogni volta. 

L'idea rivoluzionaria dell'**LLM-Wiki** (ispirata dal pattern di A. Karpathy) ribalta il paradigma: invece di pescare frammenti al volo, l'agente costruisce e mantiene attivamente una vera e propria **Base di Conoscenza Strutturata** sul tuo File System, composta da decine di file Markdown interconnessi. 
La Wiki è un "artefatto composto". I collegamenti tra le pagine sono già stati pensati. Le contraddizioni tra vecchie e nuove fonti sono già state risolte. L'agente lavora come un bibliotecario instancabile: compila la conoscenza una volta sola, e la mantiene aggiornata. Tu non scrivi quasi mai la wiki: tu curi le fonti, fai le domande, l'agente fa il lavoro sporco di sintesi e catalogazione.

## 2. Il Confine Epimero/Permanente (Regola d'Oro)
Affinché la Wiki funzioni, il segnale deve essere puro. L'ingestione nella Wiki avviene **solo** tramite due percorsi espliciti (Comando Chat o Inserimento in `/raw/`). Qualsiasi altra chat o file inviato al volo rimane epimero.

## 3. Struttura del Vault (File System Locale)
Il "cervello" risiede sul PC dell'utente, accessibile da editor come Obsidian tramite il Tunnel MCP.

### 3.1 I 3 Layer Architetturali
- **`/raw/` (Le Fonti)**: I documenti sorgente immutabili (PDF, articoli). La sorgente della verità.
- **`/wiki/` (La Conoscenza Compilata)**: Le pagine Markdown scritte dall'agente.
- **`SCHEMA.md` (Il Sistema Nervoso)**: File che l'agente legge sempre per sapere *come* operare.
  ```markdown
  # Wiki Rules per l'Agente
  1. Tassonomia: Ogni file in `/wiki/` deve avere tag in frontmatter YAML.
  2. Cross-linking: Non menzionare mai un'entità senza usare `[[nome_pagina]]`.
  3. Indexing: Non dimenticare MAI di aggiungere la nuova pagina in `index.md`.
  ```

### 3.2 File Speciali (Bootstrapping Cognitivo)
- **`index.md` (Catalogo)**: Il punto d'accesso. Un file piatto che l'agente scorre velocemente per capire cosa sa.
- **`log.md` (Audit Trail)**: Traccia cronologica per capire le decisioni dell'agente.
  ```markdown
  ## [2026-07-31 15:30] ingest | Articolo_NextJS.md
  - Creato `Routing_AppRouter.md`
  - Aggiornato `NextJS_Best_Practices.md` per contraddire il vecchio claim sull'uso di getStaticProps.
  - 3 Link aggiunti all'indice.
  ```

## 4. Le 3 Operazioni Core (Cicli dell'Agente)

### 4.1 Ingest (Acquisizione)
1. L'agente legge `SCHEMA.md` e poi legge la nuova fonte (`/raw/documento.pdf`).
2. Fa una ricerca nell'indice per capire a quali concetti pre-esistenti agganciarsi.
3. Sintetizza la fonte modificando o creando pagine in `/wiki/`, inserendo i `[[wikilinks]]`.
4. Aggiorna `index.md` e registra il tutto in `log.md`. Il sapere è consolidato.

### 4.2 Query (Consultazione)
Invece di affidarsi a un Vector DB (che spesso fa cilecca per limiti semantici), l'agente:
- Legge l'indice `index.md` (es. `- [[Docker_Setup]]: Come buildare i container.`).
- Capisce esattamente quale file gli serve, usa il tool per aprire **solo** quel file, e risponde in modo perfetto, avendo a disposizione l'intera pagina compilata e non un frammento mozzato.

### 4.3 Lint (Manutenzione del Grafo)
Un processo periodico in cui l'agente scansiona la wiki per trovare:
- Pagine orfane (scollegate).
- Reclami obsoleti o contraddittori tra due file diversi.
- Link rotti.

## 5. Tool Esatti (Local MCP Toolset)
Per fare tutto questo, l'agente non ha bisogno di RAG. Usa tool di manipolazione file:
- `read_local_file(filepath: str)`
- `write_local_file(filepath: str, content: str, mode: str = "w|a")`
- `list_wiki_pages()`
- `regex_search_wiki(pattern: str)` (es. per il linting).
