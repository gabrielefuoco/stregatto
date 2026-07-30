from cat.base import Directive
from cat import tool


class ArtifactsDirective(Directive):
    slug = "artifacts"

    async def start(self, agent) -> None:
        agent.tools.append(type(self).create_artifact.bind_to(self))
        print(f"Artifacts tool loaded! Agent now has tools: {[t.name for t in agent.tools]}")

    async def step(self, agent) -> None:
        agent.system_prompt += (
            "\n\n[SYSTEM - ARTIFACTS INSTRUCTION]\n"
            "If the user asks you to generate code, write a script, create an HTML page, "
            "or produce a long markdown document, you MUST use the `create_artifact` tool. "
            "NEVER write code blocks (```) directly in your chat response. The tool itself renders the code visually for the user."
        )

    @tool
    async def create_artifact(self, title: str, language: str, content: str) -> str:
        """
        Call this tool ONLY when you need to generate long code snippets, scripts, HTML pages, or markdown documents.
        Do not write the code directly in the chat, use this tool instead.

        Args:
            title: A short descriptive title for the artifact.
            language: The programming language or format (e.g., 'python', 'html', 'javascript', 'markdown', 'mermaid').
            content: The actual source code or document content.
        """
        return f"Artifact '{title}' created successfully in the Canvas UI. The user can now see it on their screen. DO NOT output the code block in your chat response!"
