# Cheshire Cat V2: Architettura e Sviluppo

Questo documento serve come riferimento tecnico per lo sviluppo e l'estensione del framework Cheshire Cat V2. Definisce le componenti fondamentali (Agenti, Direttive, Hook e Contesto Ambientale) e le relative best practice di utilizzo.

---

## 1. Il Modello Mentale (Mental Model)

Per capire il Cheshire Cat V2, è fondamentale interiorizzare questo concetto:
> **Un agente è un ciclo (loop). Le direttive si agganciano al ciclo. I tool sono le sue mani.**

Ecco come si svolge il ciclo di vita di un Agente quando gestisce una richiesta (es. un task):

```text
   ┌─────────────────────────── Agent.__call__(task) ───────────────────────────┐
   │                                                                             │
   │   start()  ──►  ┌──────────────── loop ────────────────┐  ──►  finish()     │
   │   directives    │  reset prompt                         │       directives   │
   │   .start()      │  directives .step()                   │       .finish()    │
   │                 │  llm(prompt, messages, tools)         │                    │
   │                 │  run any tool calls ──► repeat        │                    │
   │                 └───────────────────────────────────────┘                    │
   └─────────────────────────────────────────────────────────────────────────────┘
```

- **Agent**: È un'entità che viene eseguita. Viene instanziata *una nuova istanza* per ogni singola richiesta, e possiede il suo `task`, `result`, `system_prompt` e `tools`.
- **Directive**: Un middleware con tre hook del ciclo di vita (`start` / `step` / `finish`) che manipola l'agente. Concetti come "RAG", "Guardrail" e "Memoria" non sono feature speciali, ma solo direttive standard.
- **Tool**: Non esiste un "pool globale" dei tool. I tool appartengono all'agente. Vengono condivisi tramite ereditarietà o iniettati trasversalmente tramite una direttiva.

---

## 2. Agenti (`cat.services.agents.base.Agent`)

Nel framework Cheshire Cat, ogni agente è un'entità indipendente e isolata. 
Gli agenti sono classi che ereditano da `cat.Agent` e vengono instanziati per gestire le richieste in modo autonomo. Sono registrati automaticamente dal sistema in base al loro attributo `slug`.

### Invocazione Tra Agenti
Gli agenti possono richiamarsi a vicenda in modo nativo senza dover passare l'intero stato della richiesta. È sufficiente utilizzare la funzione dedicata:
```python
from cat import call_agent

# Invoca un altro agente passando il suo slug
risultato = await call_agent("altro_agente", task)
```

### Parlare con un Agente (API REST)
Per interagire con un agente specifico dall'esterno, è sufficiente inviare un messaggio alla rotta API corrispondente usando il suo `slug`:

```json
POST /agents/{slug}/message
{ "messages": [{ "role": "user", "content": "add milk and eggs, then show my list" }] }
```
L'agente principale è raggiungibile con lo slug `default`.

---

## 3. Direttive (`cat.base.Directive`)

Le Direttive sono i componenti primari per **manipolare e personalizzare gli Agenti**.

- **`start(agent)`**: Si usa per modifiche persistenti (es. iniettare un nuovo Tool nella lista `agent.tools` o fare append permanenti a `agent.system_prompt`).
- **`step(agent)`**: Si usa per modifiche dinamiche (es. manipolare il prompt a ogni singolo turno di ragionamento dell'LLM).
- **`finish(agent)`**: Si usa per eseguire azioni di pulizia o salvataggio al termine del ciclo.

Le direttive vengono specificate all'interno della classe dell'agente e risolte dinamicamente tramite il loro slug.

**Esempio di un "Workspace Agent"**
Questo agente integra competenze predefinite (skills) e consapevolezza temporale (clock), oltre a implementare la lettura sicura di file locali:
```python
import os
from cat import Agent, tool

class WorkspaceAgent(Agent):
    slug = "workspace"
    name = "Workspace Agent"
    description = "A simple assistant that can read files from the file system."
    # Agganciamo le direttive dinamicamente
    directives = ["skills", "clock"]

    system_prompt = (
        "You are a helpful Workspace Agent. You can read files from the file system "
        "to assist the user. You do not perform any destructive actions."
    )

    @tool
    async def read_file(self, filepath: str) -> str:
        """Reads the content of a file from the file system. (Docstring essenziale!)"""
        try:
            if not os.path.exists(filepath):
                return f"Error: File '{filepath}' does not exist."
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            return f"Content of {filepath}:\n\n{content}"
        except Exception as e:
            return f"Error reading file {filepath}: {str(e)}"
```

---

## 4. Hook (`cat.ambient.verbs.execute_hook`)

**Regola d'oro:** *Gli Hook manipolano i Dati, le Direttive manipolano l'Agente.*

Gli Hook sono eventi puramente guidati dai dati. Una funzione decorata con `@hook` riceve *esattamente un argomento* (il dato da elaborare) e lo modifica "in-place", senza mai ricevere l'istanza dell'agente.

### Il Catalogo degli Eventi (Lifecycle)
1. `before_cat_bootstrap`: L'applicazione si sta avviando, dopo la scoperta dei plugin.
2. `after_cat_bootstrap`: L'applicazione è pronta.
3. `after_plugins_reload`: I plugin o servizi sono stati reindicizzati.
4. `before_agent_run`: Un agente sta per essere avviato. Riceve il `Task` (il messaggio in ingresso).
5. `after_agent_run`: Un agente ha terminato. Riceve il `TaskResult` (il messaggio in uscita).

### Mutazione In-Place
```python
from cat.ambient import hook

@hook
def before_agent_run(task):
    task.messages.append(...) # Modifica in-place
```

---

## 5. Contesto Ambientale (Ambient Variables & Memoria)

La gestione dello stato e delle risorse è centralizzata in quello che viene chiamato Contesto Ambientale (`cat.ambient`). 

### Importazione Globale
Si importano direttamente le funzioni e i contesti necessari:
```python
from cat import llm, embedder, hook, user
```

### Gestione della Memoria (`user`)
Per gestire lo stato della conversazione in totale isolamento (evitando sovrascritture incrociate tra chat diverse), si utilizza la variabile di contesto `user`. Questa isola automaticamente i dati in base alla sessione attiva.

```python
from cat import user

# Salvataggio di dati nello scope dell'utente corrente
await user.save("variabile_custom", {"key": "value"})

# Recupero dei dati
dati = await user.load("variabile_custom", default={})
```

---

## 6. Pattern Avanzati e Best Practice (Lezioni dal Tutorial)

Per esempi di codice funzionanti, consulta sempre la cartella `plugins/tutorial/`. È strutturata appositamente per la didattica:

### Agenti d'Esempio (`tutorial/agents/`)
- `hello_agent.py` (Poet): Un agente basato solo sul prompt, senza strumenti.
- `tool_agent.py` (TodoAgent): Mostra come integrare `@tool` e sfruttare un database con scope utente.
- `time_aware_agent.py` (TimeAwareAgent): Mostra come agganciare una direttiva a un agente.
- `introspective_agent.py` (IntrospectiveAgent): Implementa tool sicuri tramite guardrail.
- `mcp_agent.py` (MCPAgent): Un server MCP agganciato come una direttiva.

### Direttive d'Esempio (`tutorial/directives/`)
- `clock.py`: Direttiva che inietta l'orario corrente nel prompt a ogni singolo step (`step()`).

### Plugin Fisico vs Catalogo Globale
Quando il Cat si avvia, indicizza tutte le classi esportate dai plugin. Se in un plugin definisci una Direttiva con `slug = "skills"`, essa diventa un bene pubblico residente nel catalogo globale. Qualsiasi agente in qualsiasi altra cartella può dichiarare `directives = ["skills"]`. L'architettura è plug-and-play.

### Integrazione MCP come Direttiva
Nello Stregatto V2, un server MCP non richiede configurazioni complesse nell'agente. **Un intero server MCP viene agganciato come fosse una semplice Direttiva.**
```python
directives = ["mcp"]
```
Questo basta per dire al framework: *"Connettiti ai server MCP configurati, trasforma i loro tool in tool nativi per me"*. L'agente eredita poteri enormi rimanendo stateless riguardo i dettagli di connessione.

### Sicurezza nei Tool (Il Pattern Introspective)
Se un tool interagisce con il sistema operativo (es. bash), **i guardrail devono vivere nel codice del tool**, non nel prompt.
Un tool sicuro richiede 3 livelli di difesa:
1. **Allow-list**: Validare l'input contro una lista chiusa di comandi.
2. **Sandboxing**: Prevenire directory traversal e vietare percorsi assoluti.
3. **Isolamento dell'esecutore**: Eseguire i processi isolati (es. `asyncio.create_subprocess_exec`) imponendo un rigido timeout.

---

## 7. Ricerca Documentazione per Sviluppi Futuri

Per mantenere questo progetto allineato al framework, **usa sempre il server MCP `context7`** ogniqualvolta servano dettagli architetturali o bugfix:
1. Usa il tool MCP per cercare i docs di `"Cheshire Cat"`.
2. Interroga le specifiche ufficiali.

> [!WARNING]
> Tieni a mente che questo documento è stato generato e va mantenuto in base ai file sorgente reali del progetto, come `cat/services/agents/base.py`, `cat/ambient/verbs.py` e gli esempi in `plugins/tutorial/`.
