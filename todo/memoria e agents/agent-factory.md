# Brainstorming: Agent Factory (UI-Driven Agent Creation)

L'obiettivo è permettere agli utenti di creare e configurare nuovi agenti (Master e Slave/Curatore) direttamente dalla UI (Agent Gallery), specificando prompt e direttive. 

## Architettura: Template Dinamico basato su Database
Il framework possiederà una singola classe generica (es. `DynamicAgent(Agent)`). La UI salva la configurazione su **Supabase** (tabella `ccat_agents`). Quando un utente invoca lo slug `coach_powerlifting`, Stregatto legge il DB e "veste" il template al volo.

**Perché questa è la soluzione definitiva**:
- **Sicurezza Totale e Cloud-Native**: Nessun codice Python viene generato o eseguito. Si tratta solo di stringhe passate a variabili (`self.system_prompt = row.prompt`). Zero rischi di RCE, nessun riavvio richiesto.
- **Integrazione con lo Slave (LLM Wiki)**: Nel DB puoi salvare sia il `master_prompt` che lo `slave_prompt` sulla stessa riga, mantenendo il legame indissolubile tra l'Esecutore e il suo Curatore di Memoria.

---

## Struttura del Database (Tabella `ccat_agents`)

Ecco come appare il cuore pulsante della Agent Factory su Supabase:

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| `slug` | string | ID univoco (es. "powerlifting_coach") |
| `name` | string | Nome visualizzato nella Agent Gallery |
| `description` | string | Descrizione breve per la UI |
| `avatar_url` | string | Icona o immagine dell'agente |
| `master_prompt` | text | Il system prompt dell'agente principale |
| `slave_prompt` | text | Il prompt per la sintesi notturna della memoria |
| `directives` | json | Elenco degli slug delle direttive (es. `["fs_memory", "tavily_search"]`) |
| `directive_config` | json | (Nuovo!) Parametri extra per le direttive (es. chiavi API) |
| `is_global` | bool | Se true, appare nella gallery di tutti. Se false, solo al creatore. |
| `user_id` | uuid | Il creatore dell'agente |

### Spunti Avanzati per l'Ecosistema

1. **Il Vero Scopo del `directive_config`**:
   Hai perfettamente ragione, l'Approccio A (Prompt Injection) è rindondante (basterebbe scriverlo nel System Prompt) e l'Approccio B (Monkey Patching) è troppo fragile e rischioso. 
   La soluzione più pulita e sicura è questa:
   - **Vincoli Comportamentali**: Li deleghiamo al 100% al `master_prompt`. È inutile inventarsi forzature a codice quando l'utente sta *già* scrivendo un prompt custom per quell'agente (es. scriverà lui stesso *"Usa il tool di ricerca solo su pubmed"*). L'LLM moderno sa obbedire.
   - **Uso Reale del Config (Secrets/Envs)**: Il `directive_config` serve **solo per configurazioni tecniche/chiavi API**. Ad esempio, se l'utente aggiunge la direttiva "GitHub Repo", il `directive_config` conterrà `{"github_token": "ghp_12345"}`. La direttiva legge questo dizionario in `start(agent)` e lo usa per autenticare le sue chiamate HTTP, senza alterare tool o prompt. Un approccio ultra-safe stile variabili d'ambiente "scopate" per agente.

2. **Ereditarietà e "Forking" (Clonazione Utente)**:
   Essendo a database, puoi introdurre la logica del Forking (stile GitHub). Un utente vede un agente `is_global = true` nella Gallery, preme "Clona e Modifica", e il sistema crea un record identico ma con `user_id` assegnato a lui. Può così modificarsi il prompt senza intaccare l'agente originale.

3. **Il "Motore" Python Dinamico**:
   Nello Stregatto, modificheremo il resolver della classe Base:
   1. "Cerca questo slug tra gli agenti hard-codati nel codice (quelli di sistema)".
   2. "Se non c'è, fai una SELECT su Supabase in base allo slug e allo `user_id`".
   3. "Se lo trovi, istanzia `DynamicAgent(db_row)` e iniettagli prompt, config e direttive".
