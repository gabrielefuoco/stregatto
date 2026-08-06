import os
import sys
import time
import subprocess
import asyncio
import platform
import logging
from dataclasses import dataclass
from typing import Dict, Optional, Tuple, Any

# OS-specific dependencies
if platform.system() == "Windows":
    try:
        from winpty import PtyProcess
    except ImportError:
        logging.error("pywinpty is required on Windows. Please install it.")
        # We don't sys.exit(1) here for syntax validation
else:
    import pty
    import fcntl
    import termios
    import struct

logger = logging.getLogger(__name__)

@dataclass
class PTYSession:
    session_id: str
    process: Any  # PtyProcess on Win, subprocess.Popen on Unix
    fd: int       # File descriptor for read/write
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
        if session_id in self.sessions:
            logger.warning(f"Session {session_id} already exists.")
            return self.sessions[session_id]

        if self.is_windows:
            # Join arguments for Windows
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
        session = self.sessions.get(session_id)
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
        session = self.sessions.get(session_id)
        if not session:
            return
            
        loop = asyncio.get_event_loop()
        try:
            if self.is_windows:
                def _write():
                    session.process.write(data.decode('utf-8', errors='replace'))
                await loop.run_in_executor(None, _write)
            else:
                def _write():
                    os.write(session.fd, data)
                await loop.run_in_executor(None, _write)
        except Exception as e:
            logger.error(f"Write error on {session_id}: {e}")

    async def resize(self, session_id: str, cols: int, rows: int):
        session = self.sessions.get(session_id)
        if not session:
            return
            
        session.cols = cols
        session.rows = rows
        
        if self.is_windows:
            try:
                if hasattr(session.process, 'setwinsize'):
                    session.process.setwinsize(rows, cols)
                elif hasattr(session.process, 'set_size'):
                    session.process.set_size(rows, cols)
            except Exception as e:
                logger.error(f"Error resizing winpty process: {e}")
        else:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(session.fd, termios.TIOCSWINSZ, winsize)

    async def kill(self, session_id: str):
        session = self.sessions.pop(session_id, None)
        if not session:
            return
            
        if self.is_windows:
            try:
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

    def list_sessions(self) -> list[PTYSession]:
        return list(self.sessions.values())


def build_claude_command(preset: dict, cwd: str) -> Tuple[list[str], dict]:
    """
    Costruisce il comando e l'env per Claude Code CLI in base al preset.
    """
    cmd = ["claude"]
    
    env = os.environ.copy()
    
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
            tools = preset['allowedTools']
            if isinstance(tools, list):
                tools = ",".join(tools)
            cmd.extend(["--allowedTools", tools])
        if preset.get('system_prompt'):
            cmd.extend(["--system-prompt", preset['system_prompt']])
        if preset.get('resume_id'):
            cmd.extend(["--resume", preset['resume_id']])
        elif preset.get('session_id'):
            cmd.extend(["--session-id", preset['session_id']])
            
        if preset.get('env_vars'):
            env.update(preset['env_vars'])

    return cmd, env

# Singleton
pty_manager = PTYManager()
