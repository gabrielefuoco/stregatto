import asyncio
import shlex
from pathlib import Path
from cat.base import Directive
from cat import tool

class ShellDirective(Directive):
    slug = "shell"

    async def start(self, agent) -> None:
        agent.tools.append(type(self).bash.bind_to(self))

    def __init__(self, allowed_commands: set = None, root_dir: str = "."):
        super().__init__()
        # Se non vengono specificati, usiamo il set di comandi sicuri di default
        self.allowed_commands = allowed_commands or {"grep", "cat", "head", "tail", "ls", "find", "wc"}
        self.root_dir = Path(root_dir).resolve()

    @tool
    async def bash(self, command: str) -> str:
        """
        Run a single shell command and return its output. 
        Pipes are not supported — run one command at a time.
        """
        parts = shlex.split(command)
        if not parts:
            return "Empty command."

        program = parts[0]
        if program not in self.allowed_commands:
            allowed = ", ".join(sorted(self.allowed_commands))
            return f"'{program}' is not allowed. Permitted commands only: {allowed}."

        # Sandbox: stay inside the root_dir tree — no absolute paths, no `..`.
        if any(arg.startswith("/") or ".." in arg.split("/") for arg in parts[1:]):
            return f"Paths must stay inside the working directory (no '/' or '..')."

        proc = await asyncio.create_subprocess_exec(
            *parts,
            cwd=self.root_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
        except asyncio.TimeoutError:
            proc.kill()
            return "Command timed out."

        output = stdout.decode() or stderr.decode() or "(no output)"
        return output[:4000]
