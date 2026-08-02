import json
import os
import sys
sys.path.append(os.getcwd())

from cat import tool
from cat import log
# Import ChatDB from chats plugin
from plugins.chats.db import ChatDB

@tool
def search_chat_db(query: str, chat_id: str = None, max_results: int = 5) -> str:
    """Searches the entire historical chat database for a specific keyword or phrase.
    Args:
        query (str): The text keyword to search for in past messages.
        chat_id (str): Optional. The conversation ID to search in. If not provided, searches globally (or current chat).
        max_results (int): Maximum number of results to return.
    """
    try:
        # Piccolo ORM query
        # Since messages is a JSON column, we can do a text search on the JSON string representation
        # Or just fetch and filter in python if SQLite doesn't support JSON operators well.
        # Given we want ILIKE, we can cast JSON to TEXT in Postgres, or just use Python filtering for now since the DB might be small.
        
        # We will use Piccolo's string methods if possible, but safely fallback to python side filtering
        # because the DB might be SQLite locally and Postgres in prod.
        
        # If chat_id is provided, we can filter by user_id. In Stregatto user_id often matches chat_id.
        # Let's just fetch all rows (or filtered by user_id if we assume user_id == chat_id)
        
        db_query = ChatDB.select()
        if chat_id:
            db_query = db_query.where(ChatDB.user_id == chat_id)
            
        chats = db_query.run_sync()
        
        results = []
        for chat in chats:
            messages = chat.get('messages', [])
            if isinstance(messages, str):
                messages = json.loads(messages)
            
            for msg in messages:
                content = msg.get("content", "")
                if content and query.lower() in content.lower():
                    # Check if it's a tool output we want to exclude, or just include everything
                    if msg.get("role") != "tool" or "Risultato lungo salvato in" in content:
                        results.append(f"[{msg.get('role', 'unknown').upper()}]: {content}")
                        if len(results) >= max_results:
                            break
            if len(results) >= max_results:
                break
                
        if not results:
            return f"No messages found containing '{query}'."
            
        return "Historic Chat Matches:\n\n" + "\n---\n".join(results)
    except Exception as e:
        log.error(f"Error searching ChatDB: {e}")
        return f"Error searching chat database: {str(e)}"
