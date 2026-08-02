# Brainstorming: LLM Wiki (Long-Term Memory)

Seguendo il paradigma di Karpathy (e l'implementazione di `lucasastorian`), la memoria di un LLM deve essere stratificata. Attualmente abbiamo coperto il primo strato (Raw Data) e il secondo (Chronological Log). Ecco come potremmo progettare l'evoluzione verso la **Long-Term Memory Condivisa**.

## La Mappatura Attuale (Working Memory)
1. **Raw Sources**: I nostri JSON da 30MB salvati in `fs_cache/` e la cronologia grezza su Supabase. Sono dati immutabili.
2. **Chronological Log**: Il nostro `index.md` basato su timestamp e lemmi SpaCy. Utile per orientarsi nel "qui e ora", ma orientato al *tempo*, non al *contenuto*.

## L'Evoluzione (Long-Term Memory)
Mancano due livelli fondamentali che trasformano i dati grezzi in Conoscenza: il **Wiki** (i concetti) e l'**Index** (la mappa dei concetti).

### 1. Il Wiki (Content-Oriented Knowledge Base su Supabase)
Il Wiki non risiederà sul filesystem, ma sarà interamente gestito tramite tabelle su Supabase (es. una tabella `ccat_wiki_nodes`). Questo permette query velocissime, Full-Text Search nativo (Postgres FTS) e aggiornamenti concorrenti sicuri.

#### La Gerarchia ad Albero (Multi-Depth)
Al posto di un piattume di file, sfruttiamo il database per creare un vero e proprio albero della conoscenza a profondità infinita (tramite una colonna `parent_id`):
- **Le Foglie (Raw Data)**: I nodi più bassi sono i puntatori ai file crudi (es. i dump su `fs_cache/` o vecchi ID di chat).
- **Livelli Intermedi (Sintesi)**: Risalendo l'albero, i nodi sono sintesi generate dallo Slave che raggruppano le foglie (es. nodo "Sessioni Allenamento Gambe").
- **Radici (Dominio)**: I rami principali (es. "Powerlifting").
Lo Slave in background naviga l'albero dal basso verso l'alto: legge le nuove foglie grezze, aggiorna i nodi intermedi, e propaga i riassunti fino alla radice.

#### Gli Hyperlink nel Database (Wiki-Style)
Anche se il testo è in un DB, la colonna `content` è pur sempre **Markdown**.
- **Scrittura**: Quando lo Slave genera la sintesi, può usare una sintassi wiki come `[[Alimentazione]]` o `[Vedi Scheda](wiki:uuid-del-record)`.
- **Navigazione per l'LLM**: Se l'agente legge un record e vede `[[Alimentazione]]`, sa che può chiamare il tool `read_wiki_db("Alimentazione")` per "cliccare" il link.
- **Navigazione per l'Utente**: La UI frontend (es. Canvas UI) prende il Markdown dal DB, fa il parsing di `[[...]]` e lo trasforma in link cliccabili che aprono il relativo record Supabase, creando un'esperienza identica a Notion o Obsidian.


#### Il Sub-Agente di Sintesi (Background Slave)
L'aggiornamento del Wiki è un processo massiccio in lettura. Farlo sincrono a ogni messaggio sarebbe lentissimo ed economicamente disastroso.
- **Economia dei Modelli**: Lo *Slave* può girare su un modello più economico (es. Claude Haiku o GPT-4o-mini), che ha costi di input irrisori per digerire centinaia di migliaia di token.
- **Trigger Intelligenti**: Invece di girare a ogni risposta, lo Slave entra in una coda in background e si attiva solo a due condizioni:
  1. La chat ha accumulato un delta di **100k token** dall'ultima sintesi.
  2. La chat è rimasta **inattiva per 1 ora** (fine naturale della sessione).
- **Prompting Domain-Specific**: Lo Slave non è un freddo bot di archivio, ma **eredita l'anima dell'agente Master**. Il suo prompt cambia in base al ruolo:
  - *Se il Master è un Educatore*: "Mappa i concetti chiave, i progressi e le difficoltà per ogni studente."
  - *Se il Master è un Coach di Bodybuilding*: "Concentrati sui PR dei Big 3, infortuni e target muscolari."
- **Il Ciclo Decisionale**: Lo Slave viene svegliato e gli viene chiesto: *"Alla luce di questa cronologia, c'è qualcosa di nuovo o rilevante da salvare nel Wiki?"* Se sì, usa tool come `upsert_wiki_page(topic, content)` per sovrascrivere o aggiornare i record direttamente su Supabase.

### 2. Il Content-Index (La Mappa per l'LLM)
Avendo tutto a database, l'Indice non è più un file statico da rigenerare faticosamente.
- **L'Indice Globale (Dinamico)**: Possiamo fare una semplice `SELECT topic, summary FROM ccat_wiki_pages` per generare on-the-fly l'Albero dei Concetti.
- Esempio di proiezione testuale dell'Indice:
  ```markdown
  - Tecnologie/Supabase (Auth JWT, Policy, Piccolo ORM)
  - Frontend/Tailwind (Configurazione v4, Plugin Canvas)
  - Utente/Preferenze (Design premium, niente conferme distruttive)
  ```
- **Iniezione nel System Prompt**: Al posto (o insieme) al log cronologico, nel System Prompt dell'agente principale iniettiamo questo Albero dei Concetti. È denso, pesa pochi token, ma dice all'LLM *esattamente* quale conoscenza possiede l'organizzazione.

### 3. I Nuovi Tool per l'Agente
L'agente principale, vedendo l'Albero dei Concetti nel suo System Prompt, userà nuovi tool per interrogare il DB:
- `read_wiki_db(topic="Frontend/Tailwind")`: Legge il contenuto del record.
- `search_wiki_db(keyword="JWT")`: Sfrutta la Full-Text Search di Postgres per trovare informazioni istantaneamente tra centinaia di argomenti.
- `add_margin_note(topic, note)`: Permette all'agente di eseguire un UPDATE atomico sul DB per appuntare un'idea lampo senza aspettare lo Slave notturno.

## Sfide Architetturali da Discutere
1. **Condivisione vs Scopo Utente**: Questi record DB saranno globali per l'intera organizzazione (tutti gli agenti attingono alla stessa saggezza aziendale) o filtrati per `user_id`?
2. **Postgres FTS vs Vector**: Attualmente usiamo la ricerca testuale, ma avendo i dati su Supabase, in futuro basterebbe abilitare `pgvector` per fare ricerca semantica sul Wiki (se mai ne avessimo bisogno).

Cosa ne pensi di questa divisione dei ruoli tra **Agente Principale (esecutore veloce)** e **Sub-Agente (sintetizzatore notturno/asincrono)**?
