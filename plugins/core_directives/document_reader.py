import os
from cat import Directive, Agent, tool

# Global in-memory cache to store parsed documents as lists of lines
# Structure: { "file_path": ["line1", "line2", ...] }
_DOCUMENT_CACHE = {}

class DocumentReaderDirective(Directive):
    slug = "document_reader"
    name = "Document Reader"
    description = "Allows the agent to read various document formats (PDF, DOCX, XLSX, etc.) with pagination and caching."

    async def start(self, agent: Agent) -> None:
        from cat import config
        
        @tool
        async def read_document(file_path: str, start_line: int = 1, end_line: int = 500) -> str:
            """
            Extracts and reads the text content from a file (PDF, Word, Excel, PowerPoint, Text, HTML) and returns it as structured Markdown.
            You can paginate through large files by specifying `start_line` and `end_line` (default reads the first 500 lines).
            CRITICAL INSTRUCTION: If the user asks you to read, summarize, or extract text from an uploaded file, ALWAYS use this tool with the file_path provided.
            CRITICAL INSTRUCTION: If the file is a CSV or Excel spreadsheet and the user asks you to perform complex statistical calculations, math, or data manipulation, DO NOT use this tool. Instead, write and execute a Python script using the `run_python_code` tool (with pandas) for precise calculation.
            """
            # Resolve HTTP upload URLs to physical local disk paths if passed
            if file_path.startswith("http://") or file_path.startswith("https://") or "uploads/" in file_path:
                if "/uploads/" in file_path:
                    relative_path = file_path.split("/uploads/", 1)[1]
                    file_path = os.path.join(config.UPLOADS_PATH, relative_path)

            if not os.path.exists(file_path):
                return f"Error: The file {file_path} does not exist at '{file_path}'."
            
            # Ensure proper line constraints
            start_line = max(1, start_line)
            end_line = max(start_line, end_line)
            
            try:
                # Check cache first
                if file_path not in _DOCUMENT_CACHE:
                    # Import here to avoid overhead during agent initialization
                    from markitdown import MarkItDown
                    
                    md = MarkItDown()
                    result = md.convert(file_path)
                    content = result.text_content
                    
                    if not content.strip():
                        return "The document was parsed successfully, but it appears to be empty or contains only unsupported images without text layers."
                        
                    # Split by line and cache
                    _DOCUMENT_CACHE[file_path] = content.splitlines()
                
                lines = _DOCUMENT_CACHE[file_path]
                total_lines = len(lines)
                
                # Slicing the requested part (0-indexed)
                slice_start = start_line - 1
                slice_end = min(end_line, total_lines)
                
                requested_content = "\n".join(lines[slice_start:slice_end])
                
                header = f"--- [DOCUMENT] ---\n"
                header += f"File: {os.path.basename(file_path)}\n"
                header += f"Total lines: {total_lines}\n"
                header += f"Showing lines {start_line} to {slice_end}:\n"
                header += f"------------------\n\n"
                
                return header + requested_content
                
            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()
                from cat import log
                log.error(f"Error reading document {file_path}: {error_trace}")
                return f"Failed to read document {file_path}. Error: {str(e)}"
                
        # Inject the tool directly into the agent's available tools
        agent.tools.append(read_document)
