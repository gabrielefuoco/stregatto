# Step 01 — Infrastruttura PTY e Trasporto WebSocket

## 1. Obiettivo
L'obiettivo di questo step è sostituire l'attuale implementazione di `bridge.py` (basata su `subprocess.Popen`, parsing NDJSON ed eventi SSE) con un PTY manager e un trasporto WebSocket bidirezionale.
Questo ci permette di eseguire la CLI di Claude Code in un vero pseudoterminale (PTY), preservando tutte le funzionalità interattive e inviando i raw ANSI escape codes direttamente al frontend. Il manager si occuperà del ciclo di vita del processo (spawn, resize, kill, tracking).

## 2. Dipendenze
Per implementare il supporto PTY cross-platform nel backend, abbiamo bisogno di:
- **Python**: `pywinpty` (per il supporto ConPTY su Windows), `pty` (integrato in Unix), `websockets` o il modulo WebSocket di `FastAPI`.
- **Frontend**: xterm.js (che verrà trattato in dettaglio nello Step 02, nessuna dipendenza npm per il backend).
- **Aggiornamento di `requirements.txt`**:
  Aggiungere `pywinpty>=1.1.2` al `requirements.txt` (o al file `requirements/base.txt`).

## 3. File: app/pty_manager.py (NEW)

Questo nuovo modulo sostituisce interamente `bridge.py`. Implementa una gestione cross-platform per gli pseudoterminali.

```python
# PTY Manager for Stregatto V3
# Manages pseudoterminal processes for Claude Code CLI sessions

import os
import sys
import asyncio
import platform
import logging
from dataclasses import dataclass
from typing import Dict, Optional, Tuple, Any

# Dipendenze OS-specifiche
if platform.system() == "Windows":
    try:
        from winpty import PtyProcess
    except ImportError:
        logging.error("pywinpty is required on Windows. Please install it.")
        sys.exit(1)
else:
    import pty
    import fcntl
    import termios
    import struct
    import subprocess

logger = logging.getLogger(__name__)

@dataclass
class PTYSession:
    session_id: str
    process: Any  # PtyProcess su Win, subprocess.Popen su Unix
    fd: int       # File descriptor per read/write
    project_id: Optional[str]
    agent_preset: dict
    created_at: float
    cols: int
    rows: int

class PTYManager:
    def __init__(self):
        self.sessions: Dict[str, PTYSession] = {}
        self.is_windows = platform.system() == "Windows"

    async def spawn(self, session_id: str, command: list[str], cwd: str, env: dict, cols: int = 80, rows: int = 24, project_id: str = None, agent_preset: dict = None) -> PTYSession:
        import time
        
        if session_id in self.sessions:
            logger.warning(f"Session {session_id} already exists.")
            return self.sessions[session_id]

        if self.is_windows:
            # Join arguments for Windows
            import subprocess
            cmd_str = subprocess.list2cmdline(command)
            
            process = PtyProcess.spawn(cmd_str, cwd=cwd, env=env, dimensions=(rows, cols))
            fd = process.fd
        else:
            # Unix openpty
            master_fd, slave_fd = pty.openpty()
            
            # Set size
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
            
            process = subprocess.Popen(
                command,
                cwd=cwd,
                env=env,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                close_fds=True,
                preexec_fn=os.setsid
            )
            os.close(slave_fd)
            fd = master_fd

        session = PTYSession(
            session_id=session_id,
            process=process,
            fd=fd,
            project_id=project_id,
            agent_preset=agent_preset or {},
            created_at=time.time(),
            cols=cols,
            rows=rows
        )
        self.sessions[session_id] = session
        return session

    async def read(self, session_id: str, max_bytes: int = 4096) -> bytes:
        session = self.get_session(session_id)
        if not session:
            return b""
            
        loop = asyncio.get_event_loop()
        try:
            if self.is_windows:
                # pywinpty read is typically a string, encoding to bytes
                def _read():
                    try:
                        data = session.process.read(max_bytes)
                        return data.encode('utf-8') if isinstance(data, str) else data
                    except Exception as e:
                        return b""
                return await loop.run_in_executor(None, _read)
            else:
                def _read():
                    try:
                        return os.read(session.fd, max_bytes)
                    except OSError:
                        return b""
                return await loop.run_in_executor(None, _read)
        except Exception as e:
            logger.error(f"Read error on {session_id}: {e}")
            return b""

    async def write(self, session_id: str, data: bytes):
        session = self.get_session(session_id)
        if not session:
            return
            
        loop = asyncio.get_event_loop()
        try:
            if self.is_windows:
                def _write():
                    session.process.write(data.decode('utf-8'))
                await loop.run_in_executor(None, _write)
            else:
                def _write():
                    os.write(session.fd, data)
                await loop.run_in_executor(None, _write)
        except Exception as e:
            logger.error(f"Write error on {session_id}: {e}")

    async def resize(self, session_id: str, cols: int, rows: int):
        session = self.get_session(session_id)
        if not session:
            return
            
        session.cols = cols
        session.rows = rows
        
        if self.is_windows:
            session.process.set_size(rows, cols)
        else:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(session.fd, termios.TIOCSWINSZ, winsize)

    async def kill(self, session_id: str):
        session = self.sessions.pop(session_id, None)
        if not session:
            return
            
        if self.is_windows:
            try:
                import subprocess
                pid = session.process.pid
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)
            except Exception as e:
                logger.error(f"Failed to kill windows process: {e}")
        else:
            import signal
            try:
                os.killpg(os.getpgid(session.process.pid), signal.SIGTERM)
                await asyncio.sleep(0.5)
                os.killpg(os.getpgid(session.process.pid), signal.SIGKILL)
            except OSError:
                pass
            try:
                os.close(session.fd)
            except OSError:
                pass

    async def kill_all(self):
        for sid in list(self.sessions.keys()):
            await self.kill(sid)

    def get_session(self, session_id: str) -> Optional[PTYSession]:
        return self.sessions.get(session_id)

    def list_sessions(self) -> list[PTYSession]:
        return list(self.sessions.values())


def build_claude_command(preset: dict, cwd: str) -> Tuple[list[str], dict]:
    """
    Costruisce il comando e l'env per Claude Code CLI in base al preset.
    Attenzione: NON usare l'output JSON o headless flags, vogliamo la CLI interattiva!
    """
    # Base command: use `claude` (which should be in PATH) or fallback to node script
    cmd = ["claude"]
    
    # Inizializziamo l'env partendo da quello di sistema
    env = os.environ.copy()
    
    # Applica configurazioni dal preset
    if preset:
        if preset.get('model'):
            cmd.extend(["--model", preset['model']])
        if preset.get('permission_mode'):
            cmd.extend(["--permission-mode", preset['permission_mode']])
        elif preset.get('dangerously_skip_permissions'):
            cmd.append("--dangerously-skip-permissions")
        if preset.get('name'):
            cmd.extend(["--name", preset['name']])
        if preset.get('allowedTools'):
            cmd.extend(["--allowedTools", preset['allowedTools']])
        if preset.get('system_prompt'):
            cmd.extend(["--system-prompt", preset['system_prompt']])
            
        # Potremmo usare le ENV vars per OpenRouter o API keys personalizzate
        if preset.get('env_vars'):
            env.update(preset['env_vars'])

    return cmd, env

# Singleton
pty_manager = PTYManager()
```

## 4. File: app/main.py (MODIFIED)

Aggiungiamo l'endpoint WebSocket al nostro `app/main.py`.

```python
import base64
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from .pty_manager import pty_manager, build_claude_command

app = FastAPI()

@app.websocket("/ws/pty/{session_id}")
async def pty_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    # NOTA: qui andrebbe estratto e verificato il token JWT 
    # per autenticare l'utente (es. tramite websocket.query_params).
    
    # Per semplicità assumiamo parametri hardcoded, ma dovrebbero 
    # arrivare via database o configurazione:
    preset = {"dangerously_skip_permissions": True}
    cwd = "." # Idealmente recuperato da un project config
    cmd, env = build_claude_command(preset, cwd)
    
    # 1. Recupera o crea la sessione PTY
    session = pty_manager.get_session(session_id)
    if not session:
        session = await pty_manager.spawn(session_id, cmd, cwd, env, cols=120, rows=40)
        
    async def read_pty():
        """Task che legge in continuazione dal PTY e invia al WebSocket."""
        try:
            while True:
                data = await pty_manager.read(session_id, 4096)
                if not data:
                    # Se non ci sono dati, assumiamo che il processo sia terminato o chiuso
                    await websocket.send_json({"type": "exit", "code": 0})
                    break
                # Invia l'output come base64 per prevenire problemi di encoding JSON
                payload = base64.b64encode(data).decode('ascii')
                await websocket.send_json({
                    "type": "output",
                    "data": payload
                })
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error reading from PTY: {e}")

    async def write_pty():
        """Task che riceve messaggi WebSocket e li instrada verso il PTY."""
        try:
            while True:
                msg_str = await websocket.receive_text()
                try:
                    msg = json.loads(msg_str)
                except json.JSONDecodeError:
                    continue
                    
                msg_type = msg.get("type")
                if msg_type == "input":
                    data = msg.get("data", "")
                    # Convert input string back to bytes
                    await pty_manager.write(session_id, data.encode('utf-8'))
                elif msg_type == "resize":
                    cols = msg.get("cols", 80)
                    rows = msg.get("rows", 24)
                    await pty_manager.resize(session_id, cols, rows)
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
        except WebSocketDisconnect:
            print(f"WebSocket disconnected per session {session_id}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error writing to PTY: {e}")

    # Eseguiamo i task concorrentemente
    read_task = asyncio.create_task(read_pty())
    write_task = asyncio.create_task(write_pty())
    
    # Attendiamo che il client si disconnetta o che il PTY termini
    done, pending = await asyncio.wait(
        [read_task, write_task],
        return_when=asyncio.FIRST_COMPLETED
    )
    
    # Cancelliamo il task rimasto
    for task in pending:
        task.cancel()
        
    # NOTA: Quando il WS si disconnette possiamo decidere se:
    # a) Uccidere il processo: await pty_manager.kill(session_id)
    # b) Mantenerlo in esecuzione per permettere il re-attach (consigliato per agent persistenti).
```

## 5. WebSocket Protocol

Il protocollo di comunicazione via WebSocket scambia messaggi JSON.

**Messaggi Client → Server:**
- **Input (tastiera/dati dal terminale):**
  ```json
  {"type": "input", "data": "ls -la\n"}
  ```
- **Resize terminale:**
  ```json
  {"type": "resize", "cols": 120, "rows": 40}
  ```
- **Ping (Keep-Alive):**
  ```json
  {"type": "ping"}
  ```
- **Attach (Opzionale, per richiedere di collegarsi a una sessione esistente):**
  ```json
  {"type": "attach", "session_id": "sess-1234", "project_id": "proj-xyz"}
  ```

**Messaggi Server → Client:**
- **Output PTY:** (I dati raw contenenti ANSI escape codes vengono inviati in formato base64 per sicurezza)
  ```json
  {"type": "output", "data": "G1sxbXJvb3RAMTkyLjE2OC4xLjEuLi4="}
  ```
- **Process Exit:**
  ```json
  {"type": "exit", "code": 0}
  ```
- **Pong:**
  ```json
  {"type": "pong"}
  ```
- **Errore:**
  ```json
  {"type": "error", "message": "Failed to spawn process"}
  ```
- **Session Info:**
  ```json
  {"type": "session_info", "session_id": "sess-1234", "pid": 1234}
  ```

## 6. Gestione Processo Claude Code
La CLI di Claude Code viene eseguita in modalità completamente interattiva (NON in modalità *headless* come avveniva con `bridge.py`).

Dettagli importanti:
- **Niente `--output-format stream-json`**: Vogliamo che la CLI generi output testuale standard colorato, formattato, e con UI a menù nativa, che `xterm.js` è in grado di decodificare.
- **Niente flag `-p`**: Non inviamo più prompt dal comando iniziale in modo asincrono; l'utente digita il prompt nel terminale o il frontend invia la stringa di input via WebSocket `{"type": "input", "data": "Fai xyz\n"}`.
- **Autorizzazioni**: È importante continuare a gestire bene i permessi tramite i flag (es. `--dangerously-skip-permissions` o `--permission-mode`), in modo che il bot non rimanga bloccato su prompt che l'utente non può facilmente gestire, o fornire configurazioni adeguate nel `AgentPreset`.
- **Ripresa di sessioni (Resume)**: Poiché Claude Code supporta sessioni persistenti, si possono usare i flag `--resume <session_id>` + `--session-id <id>` quando si avvia un nuovo PTY per riprendere il contesto di un agente.

## 7. Gestione Cross-Platform
Il `PTYManager` adotta un'astrazione forte sulle differenze OS:
- **Windows**: Utilizza `pywinpty` e la libreria subyacente `winpty/ConPTY` che è disponibile su Windows 10 (build 1809+). Assicura il corretto spawning dei thread `cmd` pseudo-console richiesti. 
- **Unix (Linux/macOS)**: Sfrutta i moduli `pty`, `fcntl` e `termios` standard per aprire file descriptor master e slave, per poi associare i canali stdin/out/err del `subprocess.Popen` allo slave PTY e agganciare la configurazione del window size.
- **Lifecycle Cleanup**: Su Windows è spesso imperativo utilizzare `taskkill /F /T /PID` per abbattere gli interi alberi dei processi derivati dal pty, in quanto un semplice `.terminate()` può lasciare orfano il comando. In Unix, l'utilizzo di `os.killpg()` assicura che tutti i sottoprocessi ricevano il `SIGTERM` e poi il `SIGKILL`.

## 8. Test e Verifica

Per verificare il corretto funzionamento dell'infrastruttura PTY:

1. Avviare il server FastAPI:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
2. Creare una semplice pagina HTML di test (`test.html`) o utilizzare uno strumento CLI come `websocat`:
   ```bash
   websocat ws://localhost:8000/ws/pty/test123
   ```
3. Digitare in `websocat`:
   ```json
   {"type": "input", "data": "ls -la\n"}
   ```
4. **Verifiche Attese:**
   - Si dovrebbe ricevere in risposta un payload JSON del tipo:
     `{"type": "output", "data": "base64-string..."}`
   - Decodificando il base64, l'output deve contenere il listato della directory formattato.
   - Provare il resize mandando `{"type": "resize", "cols": 120, "rows": 40}` e verificare che l'applicazione console (come `htop` o `claude`) risponda all'evento terminale.
   - Chiudendo la connessione Websocket, il PTY manager dovrebbe, in base alla logica scelta, lasciare il PTY persistente in background, pronto per un nuovo `websocat` attach oppure terminarlo correttamente.
