import asyncio
import tempfile
import os
import sys
from cat import Directive, Agent, tool

class PythonInterpreterDirective(Directive):
    slug = "python_interpreter"
    name = "Python Interpreter"
    description = "Allows the agent to execute arbitrary Python code in a safe, sandboxed subprocess."

    async def start(self, agent: Agent) -> None:
        
        @tool
        async def run_python_code(code: str) -> str:
            """
            Run Python code in an isolated subprocess and return the output.
            Use this tool to perform complex math, analyze data, create charts, or write scripts.
            CRITICAL INSTRUCTION: If the user asks you to write and run code, you MUST use this tool to execute it. Do not just output a markdown code block.
            Make sure to use 'print()' inside your code to see the results.
            The execution has a strict timeout of 15 seconds.
            """
            if not code.strip():
                return "Error: Empty Python code provided."
                
            try:
                # Sandbox: Create a temporary file to hold the code
                fd, path = tempfile.mkstemp(suffix=".py")
                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    f.write(code)
                    
                import subprocess
                
                def _run():
                    return subprocess.run(
                        [sys.executable, path],
                        capture_output=True,
                        text=True,
                        timeout=15
                    )
                
                try:
                    # Run synchronously in a worker thread to avoid asyncio event loop issues on Windows
                    proc = await asyncio.to_thread(_run)
                    output = proc.stdout + proc.stderr
                except subprocess.TimeoutExpired:
                    if os.path.exists(path):
                        os.remove(path)
                    return "Error: Execution timed out after 15 seconds. Code was terminated."
                
                if os.path.exists(path):
                    os.remove(path)
                
                if not output.strip():
                    return "Code executed successfully, but produced no output. (Did you forget to print()?)"
                    
                # Cap the output to prevent blowing up the LLM context window
                return output[:4000]
                
            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()
                from cat import log
                log.error(f"Python interpreter error: {error_trace}")
                return f"Internal error executing Python code:\n{error_trace}"
                
        # Inject the tool directly into the agent's available tools
        agent.tools.append(run_python_code)
