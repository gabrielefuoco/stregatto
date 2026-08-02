# Specifica Fase 2: I Due Mondi dell'Esecuzione e Sincronizzazione

## 1. Obiettivo e Scope
Creare ambienti di esecuzione arbitrari (Cloud Sandbox via Bubblewrap e Local Edge via MCP) garantendo stabilità. **Inoltre, implementare una sincronizzazione fluida (Bidirezionale) tra lo spazio di lavoro Cloud e una cartella dedicata sul PC Locale, per non disperdere il lavoro.**

## 2. Cloud Sandbox (Bubblewrap)
Il "parco giochi" sicuro ospitato sul server cloud.
- Sviluppare il tool `run_sandboxed_command` basato su CLI `bwrap`.
- **Persistenza Utente (User Workspace)**: Invece di usare `/tmp/` usa-e-getta anonimi, montare per ogni utente una cartella fissa (es. `/app/workspaces/{user_id}`). Anche se il container si riavvia (essendo effimero, potremmo perdere file), i file cruciali vengono messi in sync prima della distruzione.

## 3. Local Edge (Ponte MCP)
- Server MCP locale che espone shell (PTY) e file system.
- Routing intelligente via Cloudflare Tunnels, con ping al boot.

## 4. Logica di Sincronizzazione (Sync Engine MCP)
Questa è la colla che unisce i due mondi permettendo il lavoro asincrono (da telefono e da PC).

### 4.1 La Cartella Sincronizzata
- Sul server Cloud (Workspace Utente): `/app/workspaces/{user_id}/sync_dir`
- Sul PC dell'Utente (Impostato all'avvio dell'MCP client locale): `C:\Users\Utente\StregattoWorkspace`

### 4.2 Come avviene il Trasferimento (Rsync over MCP)
- Non useremo protocolli terzi (come DropBox o Rsync nudo, perché richiederebbero porte aperte). Useremo il **Tunnel MCP esistente**.
- **Tool Custom sul Server MCP Locale**: Creare un tool Python nell'endpoint locale chiamato `sync_receive_chunk(filename, data_base64)` e `sync_send_chunk(filename)`.
- **Il Daemon di Sync (Cloud-Side)**:
  - Quando lo Stregatto finisce di operare nel Cloud Sandbox (es. dopo che ha generato 10 script o scaricato un CSV), il server zippa la cartella `sync_dir` o calcola gli hash (MD5) dei file.
  - Verifica se il Tunnel MCP è online.
  - Se ONLINE: Invoca il tool locale `sync_receive_chunk` e manda i file aggiornati al PC dell'utente, scompattandoli in `StregattoWorkspace`.
  - Se OFFLINE: Mette un flag `needs_sync = True` nel database Supabase (tabella user_settings).

### 4.3 Ripristino all'Accensione (Wake-up Sync)
- Quando il PC locale si accende, il server Cloudflare Tunnel riprende la connessione.
- Il plugin `plugins/mcp_client/` dello Stregatto intercetta la riconnessione, controlla il flag `needs_sync` su Supabase.
- Se True, avvia il download/upload dei file mancanti verso il PC, fondendo i due ambienti.

## 5. Criteri di Accettazione (DoD)
1. L'agente genera un progetto React nel Sandbox Cloud mentre il PC dell'utente è spento. All'accensione del PC locale, l'intera cartella del progetto compare in `StregattoWorkspace` in automatico.
2. L'utente modifica un file in `StregattoWorkspace` sul PC. Lo Stregatto (se interrogato dal cellulare) riflette le modifiche e ne ha conoscenza nel suo Cloud Sandbox.
