from cat.base import Directive
from cat import tool, user, Agent

class IsolatedMemoryDirective(Directive):
    slug = "isolated_memory"
    
    async def start(self, agent: Agent) -> None:
        agent.tools.append(type(self).save_private_note.bind_to(self))
        """
        Runs once per request. We store the agent's slug here so the tools
        can know which namespace they belong to.
        """
        self.current_agent_slug = agent.slug
        
    async def step(self, agent: Agent) -> None:
        """
        Runs before every LLM turn. The system prompt is reset by the loop
        before this hook, so we inject the fresh memory here.
        """
        memories = await user.load(f"memory_{agent.slug}", [])
        if memories:
            formatted_memories = "\n".join([f"- {m}" for m in memories])
            agent.system_prompt += f"\n\nPrivate Memory (Read-Only):\n{formatted_memories}"

    @tool
    async def save_private_note(self, note: str) -> str:
        """Save a private note exclusively into this agent's memory."""
        # Use the slug stored during start()
        key = f"memory_{self.current_agent_slug}"
        memories = await user.load(key, [])
        memories.append(note)
        await user.save(key, memories)
        return f"Successfully saved private note: {note}"


class GlobalMemoryDirective(Directive):
    slug = "global_memory"

    async def start(self, agent: Agent) -> None:
        agent.tools.append(type(self).save_agent_note.bind_to(self))
        agent.tools.append(type(self).read_agent_memory.bind_to(self))

    @tool
    async def save_agent_note(self, note: str, target_agent_slug: str) -> str:
        """Save a note into any specified agent's memory namespace."""
        key = f"memory_{target_agent_slug}"
        memories = await user.load(key, [])
        memories.append(note)
        await user.save(key, memories)
        return f"Successfully saved note for agent '{target_agent_slug}'."

    @tool
    async def read_agent_memory(self, target_agent_slug: str) -> str:
        """Read the memory namespace of a specified agent."""
        key = f"memory_{target_agent_slug}"
        memories = await user.load(key, [])
        if not memories:
            return f"No memories found for agent '{target_agent_slug}'."
        return "\n".join([f"- {m}" for m in memories])
