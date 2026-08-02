import os
from cat import tool
from cat import log

@tool
async def read_cached_file(file_path: str, start_line: int = 1, max_lines: int = 100) -> str:
    """Reads a chunk of lines from a cached file.
    Args:
        file_path (str): The absolute path of the cached file.
        start_line (int): The line number to start reading from (1-indexed).
        max_lines (int): The maximum number of lines to return.
    """
    try:
        if not os.path.exists(file_path):
            return f"Error: File '{file_path}' does not exist."
        
        with open(file_path, 'r', encoding='utf-8') as f:
            # We can optimize this later with linecache or islice, but simple readlines is fine for MBs.
            lines = f.readlines()
            
        total_lines = len(lines)
        if start_line > total_lines:
            return f"Error: start_line {start_line} exceeds total lines {total_lines}."
        
        end_line = min(start_line - 1 + max_lines, total_lines)
        chunk = "".join(lines[start_line - 1 : end_line])
        
        return f"Content of {file_path} (Lines {start_line}-{end_line} of {total_lines}):\n\n{chunk}"
    except Exception as e:
        log.error(f"Error reading cached file {file_path}: {e}")
        return f"Error reading file {file_path}: {str(e)}"

@tool
async def search_cached_file(query: str, file_path: str, max_results: int = 10, context_lines: int = 2) -> str:
    """Searches for a keyword inside a specific cached file.
    Args:
        query (str): The text keyword to search for.
        file_path (str): The absolute path of the cached file to search in.
        max_results (int): Maximum number of matching blocks to return.
        context_lines (int): Number of lines before and after the match to include for context.
    """
    try:
        if not os.path.exists(file_path):
            return f"Error: File '{file_path}' does not exist."
        
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        results = []
        for idx, line in enumerate(lines):
            if query.lower() in line.lower():
                start_idx = max(0, idx - context_lines)
                end_idx = min(len(lines), idx + context_lines + 1)
                block = "".join(lines[start_idx:end_idx])
                results.append(f"--- Match around Line {idx + 1} ---\n{block}")
                
                if len(results) >= max_results:
                    break
        
        if not results:
            return f"No matches found for '{query}' in {file_path}."
        
        return "\n".join(results)
    except Exception as e:
        log.error(f"Error searching cached file {file_path}: {e}")
        return f"Error searching file {file_path}: {str(e)}"

@tool
async def read_index_file(chat_id: str) -> str:
    """Reads the full content of the index.md file for a specific chat, revealing all saved tool dumps.
    Args:
        chat_id (str): The conversation ID.
    """
    try:
        index_path = os.path.join(os.getcwd(), "fs_cache", chat_id, "index.md")
        if not os.path.exists(index_path):
            return f"Error: Index file for chat {chat_id} does not exist."
        
        with open(index_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return f"Index content for {chat_id}:\n\n{content}"
    except Exception as e:
        log.error(f"Error reading index file for chat {chat_id}: {e}")
        return f"Error reading index file: {str(e)}"
