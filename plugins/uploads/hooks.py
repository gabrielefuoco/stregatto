from cat.ambient import hook
from cat.protocols.model_context.type_wrappers import TextContent

@hook
async def before_agent_run(task):
    """
    Hooks manipulate Data. We intercept the Task in-place before the agent runs.
    If the user sent a resource_link, the LLM will ignore it in the pure text prompt.
    We append a TextContent block to explicitly tell the LLM where the file is.
    """
    if not task.messages:
        return
        
    last_message = task.messages[-1]
    
    # Iterate over a copy of the list since we might append to it
    for block in list(last_message.content):
        if getattr(block, "type", None) == "resource_link":
            # The UI sent a file upload as a ResourceLink
            uri = getattr(block, "uri", "Sconosciuto")
            name = getattr(block, "name", "allegato")
            
            # Injecting text in-place
            last_message.content.append(
                TextContent(text=f'\n[Il file "{name}" è disponibile al percorso: {uri}]')
            )
