import os
import json
import asyncio
import subprocess
import logging
from typing import AsyncGenerator, Dict, Any, List

logger = logging.getLogger("stregatto_v3.bridge")

# Registratore in-memory dei processi attivi
ACTIVE_PROCESSES: Dict[str, subprocess.Popen] = {}


def register_process(key: str, process: subprocess.Popen):
    if key:
        ACTIVE_PROCESSES[key] = process


def unregister_process(key: str):
    if key:
        ACTIVE_PROCESSES.pop(key, None)


async def cancel_session_process(session_id: str | None = None, chat_id: str | None = None) -> bool:
    """Termina il processo CLI attivo associato a session_id o chat_id."""
    proc = None
    keys_to_clean = []

    if session_id and session_id in ACTIVE_PROCESSES:
        proc = ACTIVE_PROCESSES[session_id]
        keys_to_clean.append(session_id)
    elif chat_id and chat_id in ACTIVE_PROCESSES:
        proc = ACTIVE_PROCESSES[chat_id]
        keys_to_clean.append(chat_id)

    if not proc:
        # Fallback: search values
        for k, p in list(ACTIVE_PROCESSES.items()):
            if (session_id and k == session_id) or (chat_id and k == chat_id):
                proc = p
                keys_to_clean.append(k)

    if proc and proc.poll() is None:
        logger.info(f"Cancellazione processo CLI (PID: {proc.pid}) per session_id={session_id}, chat_id={chat_id}")
        try:
            if os.name == "nt":
                def kill_windows_tree(pid: int):
                    try:
                        subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)
                    except Exception as err:
                        logger.warning(f"Error executing taskkill: {err}")
                await asyncio.to_thread(kill_windows_tree, proc.pid)
            else:
                proc.terminate()
                try:
                    await asyncio.to_thread(proc.wait, timeout=2.0)
                except subprocess.TimeoutExpired:
                    proc.kill()
        except Exception as e:
            logger.warning(f"Errore durante l'interruzione del processo: {e}")

        # Clean all keys pointing to this process
        to_del = [k for k, p in ACTIVE_PROCESSES.items() if p == proc]
        for k in to_del:
            unregister_process(k)
        return True

    return False


import shutil
import glob


def get_claude_command_prefix(prompt: str) -> list[str]:
    """
    Trova l'eseguibile di claude più veloce (locale o in npx-cache)
    per evitare la latenza di avvio (4-5 secondi) di npx.cmd -y.
    """
    claude_bin = shutil.which("claude") or shutil.which("claude.exe") or shutil.which("claude.cmd")
    if not claude_bin and os.name == "nt":
        npx_cache = os.path.join(os.environ.get("LOCALAPPDATA", ""), "npm-cache", "_npx")
        if os.path.exists(npx_cache):
            matches = glob.glob(os.path.join(npx_cache, "*", "node_modules", ".bin", "claude*"))
            if matches:
                claude_bin = matches[0]

    if claude_bin:
        return [
            claude_bin, "-p", prompt,
            "--output-format", "stream-json",
            "--include-partial-messages",
            "--verbose",
            "--dangerously-skip-permissions"
        ]
    else:
        cli_bin = "npx.cmd" if os.name == "nt" else "claude"
        cmd = [cli_bin]
        if cli_bin == "npx.cmd":
            cmd.extend(["-y", "@anthropic-ai/claude-code"])
        cmd.extend([
            "-p", prompt,
            "--output-format", "stream-json",
            "--include-partial-messages",
            "--verbose",
            "--dangerously-skip-permissions"
        ])
        return cmd


async def run_claude_stream(
    prompt: str,
    session_id: str | None = None,
    openrouter_key: str | None = None,
    model: str | None = None,
    cwd: str | None = None,
    chat_id: str | None = None
) -> AsyncGenerator[str, None]:
    """
    Esegue `claude -p` in modalità headless (--output-format stream-json),
    legge l'output NDJSON riga per riga e lo converte nel formato SSE atteso da Canvas UI.
    """

    cmd = get_claude_command_prefix(prompt)

    if model:
        cmd.extend(["--model", model])

    env = os.environ.copy()
    if openrouter_key:
        env["ANTHROPIC_BASE_URL"] = "https://openrouter.ai/api"
        env["ANTHROPIC_AUTH_TOKEN"] = openrouter_key
        env["ANTHROPIC_API_KEY"] = ""
        env["ANTHROPIC_MAX_TOKENS"] = "8000"
        env["CLAUDE_CODE_MAX_OUTPUT_TOKENS"] = "8000"
        env["MAX_TOKENS"] = "8000"

    work_dir = cwd or os.getcwd()
    logger.info(f"Avvio Claude CLI: {' '.join(cmd)} in {work_dir}")

    process = None
    detected_session_id = session_id

    try:
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=work_dir,
            env=env,
            bufsize=1,
            universal_newlines=True,
            encoding='utf-8',
            errors='replace'
        )

        if process.stdin:
            try:
                process.stdin.close()
            except Exception:
                pass

        if chat_id:
            register_process(chat_id, process)
        if session_id:
            register_process(session_id, process)

        has_streamed_text = False
        thinking_tokens_count = 0

        while True:
            line = await asyncio.to_thread(process.stdout.readline)
            if not line:
                break

            line = line.strip()
            if not line:
                continue

            try:
                event = json.loads(line)
                event_type = event.get("type")

                # -1. Flusso in tempo reale con --include-partial-messages
                if event_type == "stream_event":
                    sub_evt = event.get("event", {})
                    if sub_evt.get("type") == "content_block_delta":
                        delta = sub_evt.get("delta", {})
                        if delta.get("type") == "text_delta":
                            text_chunk = delta.get("text", "")
                            if text_chunk:
                                has_streamed_text = True
                                yield f"data: {json.dumps({'type': 'TEXT_MESSAGE_CONTENT', 'delta': text_chunk})}\n\n"
                        elif delta.get("type") == "thinking_delta":
                            thinking_tokens_count += 1
                            if thinking_tokens_count % 3 == 1:
                                yield f"data: {json.dumps({'type': 'THINKING_TOKENS', 'tokens': thinking_tokens_count})}\n\n"
                    continue

                # 0. Ragionamento del modello (Thinking tokens in tempo reale)
                if event_type == "system" and event.get("subtype") == "thinking_tokens":
                    tokens = event.get("estimated_tokens", 0)
                    yield f"data: {json.dumps({'type': 'THINKING_TOKENS', 'tokens': tokens})}\n\n"

                # 1. Evento di Inizializzazione (salva session_id)
                elif event_type == "system" and event.get("subtype") == "init":
                    detected_session_id = event.get("session_id")
                    if detected_session_id:
                        register_process(detected_session_id, process)
                        logger.info(f"Claude Session ID: {detected_session_id}")

                # 2. Risposta dell'Assistente (testo, flusso di pensiero o tool call)
                elif event_type == "assistant":
                    message = event.get("message", {})
                    content_blocks = message.get("content", [])

                    for block in content_blocks:
                        b_type = block.get("type")

                        if b_type == "text" and not has_streamed_text:
                            text = block.get("text", "")
                            if text:
                                yield f"data: {json.dumps({'type': 'TEXT_MESSAGE_CONTENT', 'delta': text})}\n\n"

                        elif b_type == "thinking":
                            thinking_text = block.get("thinking", "")
                            if thinking_text:
                                formatted_thinking = f"\n> 🧠 *Ragionamento:*\n> {thinking_text.replace(chr(10), chr(10) + '> ')}\n\n"
                                yield f"data: {json.dumps({'type': 'TEXT_MESSAGE_CONTENT', 'delta': formatted_thinking})}\n\n"

                        elif b_type == "tool_use":
                            tool_id = block.get("id")
                            tool_name = block.get("name")
                            tool_input = block.get("input", {})

                            yield f"data: {json.dumps({'type': 'TOOL_CALL_START', 'tool_call_id': tool_id, 'tool_call_name': tool_name})}\n\n"
                            yield f"data: {json.dumps({'type': 'TOOL_CALL_ARGS', 'tool_call_id': tool_id, 'delta': json.dumps(tool_input, indent=2)})}\n\n"
                            yield f"data: {json.dumps({'type': 'TOOL_CALL_END', 'tool_call_id': tool_id})}\n\n"

                # 3. Risultati dei Tool
                elif event_type == "user":
                    message = event.get("message", {})
                    content_blocks = message.get("content", [])
                    for block in content_blocks:
                        if block.get("type") == "tool_result":
                            tool_id = block.get("tool_use_id")
                            content = block.get("content", "")
                            if isinstance(content, list):
                                content_str = "\n".join([c.get("text", "") for c in content if c.get("type") == "text"])
                            else:
                                content_str = str(content)
                            
                            if tool_id and content_str:
                                yield f"data: {json.dumps({'type': 'TOOL_CALL_ARGS', 'tool_call_id': tool_id, 'delta': f'\n\n--- Output ---\n{content_str[:3000]}'})}\n\n"

                # 4. Avanzamento in tempo reale dei tool
                elif event_type == "tool_progress":
                    tool_id = event.get("tool_use_id")
                    output = event.get("output", "") or event.get("progress", "")
                    if tool_id and output:
                        yield f"data: {json.dumps({'type': 'TOOL_CALL_ARGS', 'tool_call_id': tool_id, 'delta': f'\n{output}'})}\n\n"

                # 5. Esito Finale
                elif event_type == "result":
                    subtype = event.get("subtype")
                    is_error = event.get("is_error", False)
                    if subtype == "success" and not is_error:
                        result_text = event.get("result", "")
                        usage = event.get("usage", {})
                        yield f"data: {json.dumps({'type': 'RUN_FINISHED', 'result': {'output': result_text}, 'session_id': detected_session_id, 'usage': usage})}\n\n"
                    else:
                        error_msg = event.get("error") or event.get("result") or str(event)
                        yield f"data: {json.dumps({'type': 'RUN_ERROR', 'message': str(error_msg)})}\n\n"

            except json.JSONDecodeError:
                logger.warning(f"Riga non-JSON dallo stdout di Claude: {line}")
                continue

        try:
            await asyncio.wait_for(asyncio.to_thread(process.wait), timeout=2.0)
        except (asyncio.TimeoutError, Exception):
            try:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(process.pid)], capture_output=True)
                else:
                    process.terminate()
            except Exception:
                pass
        
        stderr_str = ""
        if process.stderr:
            try:
                stderr_str = process.stderr.read().strip()
            except Exception:
                pass
        if stderr_str:
            logger.error(f"Claude CLI stderr (returncode={process.returncode}): {stderr_str}")
            if process.returncode is not None and process.returncode != 0:
                yield f"data: {json.dumps({'type': 'RUN_ERROR', 'message': stderr_str})}\n\n"

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Errore bridge Claude CLI ({type(e).__name__}): {tb}")
        err_msg = str(e) or f"Errore {type(e).__name__} nel bridge Claude CLI"
        yield f"data: {json.dumps({'type': 'RUN_ERROR', 'message': err_msg})}\n\n"
    finally:
        if chat_id:
            unregister_process(chat_id)
        if session_id:
            unregister_process(session_id)
        if detected_session_id:
            unregister_process(detected_session_id)
        if process and process.poll() is None:
            try:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(process.pid)], capture_output=True)
                else:
                    process.terminate()
            except Exception:
                pass
