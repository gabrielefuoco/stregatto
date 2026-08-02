import os
import json
import uuid
import asyncio
from datetime import datetime
from pydantic import BaseModel
from cat.base import Directive
from cat import hook, log, user
import tiktoken
from .tools import read_cached_file, search_cached_file, read_index_file
from .db_tools import search_chat_db

try:
    import spacy
    nlp = spacy.load("it_core_news_sm")
except (ImportError, OSError):
    log.warning("FSMemory: SpaCy or 'it_core_news_sm' model not found. Proceeding with basic extraction.")
    nlp = None

def count_tokens(text: str) -> int:
    try:
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))
    except Exception:
        # Fallback if tiktoken fails
        return len(text) // 4

def extract_lemmas(text: str) -> str:
    """Extracts nouns, proper nouns, and verbs from text using SpaCy."""
    if not nlp:
        return text[:150] # Fallback
    
    doc = nlp(text)
    lemmas = [token.lemma_ for token in doc if token.pos_ in ("NOUN", "PROPN", "VERB")]
    if not lemmas:
        return text[:150]
    return ", ".join(lemmas)

def ensure_cache_dir(chat_id: str) -> str:
    cache_dir = os.path.join(os.getcwd(), "fs_cache", chat_id)
    os.makedirs(cache_dir, exist_ok=True)
    return cache_dir

class FSMemoryDirective(Directive):
    slug = "fs_memory"
    
    async def start(self, agent):
        self.original_call_tool = agent.call_tool
        
        agent.tools.extend([
            read_cached_file,
            search_cached_file,
            read_index_file,
            search_chat_db
        ])
        
        async def intercepted_call_tool(tool_call, *args, **kwargs):
            from cat.protocols.model_context.type_wrappers import TextContent
            result = await self.original_call_tool(tool_call, *args, **kwargs)
            tool_name = tool_call.name
            tool_call_id = tool_call.id
            # Check token threshold for the tool output
            threshold = 500
            token_count = count_tokens(result.text)
            
            if token_count > threshold and tool_name not in ["read_cached_file", "search_cached_file", "read_index_file"]:
                chat_id = str(user.id)
                cache_dir = ensure_cache_dir(chat_id)
                file_path = os.path.join(cache_dir, f"call_{tool_call_id}.txt")
                
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(result.text)
                
                last_user_message = ""
                for msg in reversed(agent.task.messages):
                    if msg.role == "user" and msg.content:
                        # In V2, msg.content is a list of ContentBlocks
                        text_blocks = [block.text for block in msg.content if block.type == "text"]
                        last_user_message = " ".join(text_blocks)
                        if last_user_message:
                            break
                
                extracted_context = extract_lemmas(last_user_message)
                timestamp = datetime.now().strftime("%H:%M:%S")
                
                index_path = os.path.join(cache_dir, "index.md")
                index_entry = f"- [{timestamp}] User: [{extracted_context}] -> Tool: {tool_name} -> File: {file_path}\n"
                
                with open(index_path, "a", encoding="utf-8") as f:
                    f.write(index_entry)
                
                log.info(f"FSMemory: Dumped heavy tool {tool_name} to {file_path} ({token_count} tokens).")
                result.content = [TextContent(text=f"Risultato lungo salvato in {file_path}. Usa read_cached_file o search_cached_file per leggerlo.")]
                return result
            
            return result
        
        # Apply Monkey Patching
        agent.call_tool = intercepted_call_tool

    async def step(self, agent):
        chat_id = str(user.id)
        index_path = os.path.join(os.getcwd(), "fs_cache", chat_id, "index.md")
        
        if os.path.exists(index_path):
            with open(index_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            # Select lines that fit within 1000 tokens
            selected_lines = []
            current_tokens = 0
            # Read from the most recent backward
            for line in reversed(lines):
                line_tokens = count_tokens(line)
                if current_tokens + line_tokens <= 1000:
                    selected_lines.insert(0, line)
                    current_tokens += line_tokens
                else:
                    break
            
            if selected_lines:
                index_content = "".join(selected_lines)
                agent.system_prompt += f"\n\n[MEMORIA CACHE ATTIVA - RECENT TOOLS]\n{index_content}\nPuoi esplorare questi file con i tool dedicati."


@hook
async def before_agent_run(task):
    """Sliding Window: truncates old messages if token count exceeds threshold."""
    MAX_TOKENS = 64000
    
    # Calculate tokens of the entire array
    total_tokens = sum(count_tokens(str(msg.model_dump())) for msg in task.messages)
    
    if total_tokens > MAX_TOKENS:
        log.warning(f"FSMemory: Context exceeds threshold ({total_tokens} > {MAX_TOKENS}). Truncating old messages.")
        
        # Preserve System prompt (usually at the beginning) and start discarding from the oldest
        # We assume messages[0] might be system, or messages are chronological.
        # It's safer to keep the first message if it's system, but in Stregatto, system_prompt is handled separately by the agent.
        # task.messages usually contains only User, Assistant, Tool.
        
        truncated_messages = []
        accumulated_tokens = 0
        
        for msg in reversed(task.messages):
            msg_tokens = count_tokens(str(msg.model_dump()))
            if accumulated_tokens + msg_tokens <= MAX_TOKENS:
                truncated_messages.insert(0, msg)
                accumulated_tokens += msg_tokens
            else:
                break
        
        task.messages = truncated_messages
        log.info(f"FSMemory: Truncated context to {len(truncated_messages)} messages ({accumulated_tokens} tokens).")
