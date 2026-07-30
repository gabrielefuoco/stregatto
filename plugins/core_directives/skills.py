import os
from cat import Directive, Agent, tool

class SkillsDirective(Directive):
    slug = "skills"
    name = "Skills Loader"
    description = "Loads external skills from the 'skills' folder and injects them as a tool."

    async def start(self, agent: Agent) -> None:
        project_path = os.getcwd()
        skills_dir = os.path.join(project_path, "skills")
        
        # 1. Check if directory exists
        if not os.path.exists(skills_dir) or not os.path.isdir(skills_dir):
            return  # Graceful degradation if folder is missing
            
        # 2. List skills and parse YAML frontmatter
        import yaml
        
        available_skills = []
        try:
            for filename in os.listdir(skills_dir):
                if filename.endswith(".md"):
                    skill_name = filename[:-3]  # remove .md
                    description = "Nessuna descrizione."
                    
                    filepath = os.path.join(skills_dir, filename)
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            content = f.read()
                            
                            # Parse YAML frontmatter
                            if content.startswith("---"):
                                parts = content.split("---", 2)
                                if len(parts) >= 3:
                                    frontmatter_str = parts[1]
                                    metadata = yaml.safe_load(frontmatter_str)
                                    if isinstance(metadata, dict):
                                        if "description" in metadata:
                                            description = metadata["description"]
                                        if "name" in metadata:
                                            skill_name = metadata["name"]
                    except Exception:
                        pass
                        
                    available_skills.append(f"- **{skill_name}**: {description}")
        except Exception as e:
            return # Graceful degradation on read error

        if not available_skills:
            return  # No skills found

        # 3. Append to system prompt
        skills_list_str = "\n".join(available_skills)
        agent.system_prompt += (
            f"\n\nYou have access to the following external skills:\n{skills_list_str}\n"
            "To use one of these skills, you MUST call the `open_skill` tool with the exact name of the skill."
        )

        # 4 & 5. Dynamically inject the open_skill tool
        @tool
        async def open_skill(skill_name: str) -> str:
            """
            Reads the instructions for a specific skill and injects it into the context.
            
            Args:
                skill_name: The name of the skill to load (without the .md extension).
                
            Returns:
                The textual content of the skill, or an error if not found.
            """
            # Secure the path to prevent directory traversal
            safe_skill_name = os.path.basename(skill_name)
            if not safe_skill_name.endswith(".md"):
                safe_skill_name += ".md"
                
            filepath = os.path.join(skills_dir, safe_skill_name)
            
            if not os.path.exists(filepath):
                return f"Error: The skill '{skill_name}' does not exist."
                
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                return f"--- SKILL LOADED: {skill_name} ---\n{content}\n--- END SKILL ---"
            except Exception as e:
                return f"Error reading skill {skill_name}: {str(e)}"
                
        # Inject the tool dynamically
        agent.tools.append(open_skill)
