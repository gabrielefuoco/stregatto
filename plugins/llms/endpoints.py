from typing import List
from pydantic import BaseModel
from cat import endpoint

class LLMModel(BaseModel):
    id: str
    name: str
    provider: str

@endpoint.get("/llms", tags=["LLMs"])
async def list_available_models() -> List[LLMModel]:
    """Returns the list of real supported LLMs available in Stregatto."""
    return [
        LLMModel(id="gpt-4o", name="GPT-4o", provider="openai"),
        LLMModel(id="gpt-4o-mini", name="GPT-4o Mini", provider="openai"),
        LLMModel(id="claude-3-5-sonnet-20241022", name="Claude 3.5 Sonnet", provider="anthropic"),
        LLMModel(id="gemini-1.5-pro", name="Gemini 1.5 Pro", provider="gemini"),
        LLMModel(id="gemini-1.5-flash", name="Gemini 1.5 Flash", provider="gemini"),
        LLMModel(id="gemini-2.0-flash", name="Gemini 2.0 Flash", provider="gemini"),
    ]
