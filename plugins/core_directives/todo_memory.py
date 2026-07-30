from cat.base import Directive
from cat import tool, user

class TodoMemoryDirective(Directive):
    slug = "todo_memory"

    async def start(self, agent) -> None:
        agent.tools.append(type(self).list_todos.bind_to(self))
        agent.tools.append(type(self).create_todo.bind_to(self))
        agent.tools.append(type(self).update_todo.bind_to(self))
        agent.tools.append(type(self).delete_todo.bind_to(self))

    @tool
    async def list_todos(self) -> str:
        """List all of the user's todos with their id and done/not-done state."""
        
        todos = await user.load("todos", [])
        if not todos:
            return "The to-do list is empty."
        return "\n".join(
            f"[{'x' if t['done'] else ' '}] #{t['id']} {t['text']}"
            for t in todos
        )

    @tool
    async def create_todo(self, text: str) -> str:
        """Add a new todo with the given text. Returns the created item's id."""
        
        todos = await user.load("todos", [])
        new_id = max((t["id"] for t in todos), default=0) + 1
        todos.append({"id": new_id, "text": text, "done": False})
        await user.save("todos", todos)
        return f"Created todo #{new_id}: {text}"

    @tool
    async def update_todo(self, todo_id: int, text: str = "", done: bool = False) -> str:
        """Update a todo by id: change its text and/or mark it done."""

        todos = await user.load("todos", [])
        for t in todos:
            if t["id"] == todo_id:
                if text:
                    t["text"] = text
                t["done"] = done
                await user.save("todos", todos)
                return f"Updated todo #{todo_id}."
        return f"No todo with id #{todo_id}."

    @tool
    async def delete_todo(self, todo_id: int) -> str:
        """Delete a todo by id."""

        todos = await user.load("todos", [])
        kept = [t for t in todos if t["id"] != todo_id]
        if len(kept) == len(todos):
            return f"No todo with id #{todo_id}."
        await user.save("todos", kept)
        return f"Deleted todo #{todo_id}."
