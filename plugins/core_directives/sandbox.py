import os
import shutil
import asyncio
import shlex
from pathlib import Path
from cat.base import Directive
from cat import tool
from cat import user

class SandboxDirective(Directive):
    slug = "sandbox"
    name = "Cloud Sandbox"
    description = "Fornisce esecuzione sicura e isolata di comandi tramite Bubblewrap o fallback locale."

    async def start(self, agent) -> None:
        agent.tools.append(type(self).run_sandboxed_command.bind_to(self))

    @tool
    async def run_sandboxed_command(self, command: str) -> str:
        """
        Runs an arbitrary shell script or command inside a secure multi-tenant sandbox.
        All files created here will be stored in your isolated user workspace.
        """
        # 1. Recupero dell'utente e creazione workspace isolato
        user_id = getattr(user, "id", "anonymous")
        
        # Percorsi base
        # Su Windows fallback o Linux, il mount sarà diverso. Usiamo la cartella locale /data come root sicura
        base_workspaces_dir = Path(os.getcwd()) / "data" / "workspaces"
        user_workspace = base_workspaces_dir / str(user_id)
        
        # Assicuriamoci che la cartella utente esista
        user_workspace.mkdir(parents=True, exist_ok=True)
        
        parts = shlex.split(command)
        if not parts:
            return "Comando vuoto."

        bwrap_path = shutil.which("bwrap")
        
        if bwrap_path:
            # Siamo in un container Linux con Bubblewrap installato
            # Isolamento ferreo: / in sola lettura, /workspace montato in lettura/scrittura
            sandbox_command = [
                bwrap_path,
                "--unshare-all",
                "--ro-bind", "/", "/",
                "--dev", "/dev",
                "--proc", "/proc",
                "--bind", str(user_workspace), "/workspace",
                "--chdir", "/workspace",
                "--"
            ] + parts
            cwd = None # bwrap gestisce il chdir interno
        else:
            # Fallback per sviluppo su Windows o sistemi senza bwrap
            # Eseguiamo il comando nativamente ma confinato alla cartella dell'utente
            # Attenzione: non c'è isolamento di sistema (no chroot), solo cwd isolato
            sandbox_command = parts
            cwd = str(user_workspace)

        try:
            proc = await asyncio.create_subprocess_exec(
                *sandbox_command,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            
            output = stdout.decode()
            err_output = stderr.decode()
            
            result = ""
            if not bwrap_path:
                result += "[WARNING] Esecuzione in fallback (No Bubblewrap). Ambiente NON isolato.\n"
                
            if output:
                result += f"STDOUT:\n{output}\n"
            if err_output:
                result += f"STDERR:\n{err_output}\n"
                
            if not result:
                result = "(Comando completato senza output)"
                
            return result[:4000] # Trunk limits
            
        except asyncio.TimeoutError:
            proc.kill()
            return f"Errore: Il comando '{command}' ha superato il timeout di 30 secondi ed è stato ucciso."
        except Exception as e:
            return f"Errore di esecuzione: {str(e)}"
