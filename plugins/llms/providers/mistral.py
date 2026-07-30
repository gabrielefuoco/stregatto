"""Mistral AI — state-of-the-art open and commercial models via the official API."""

import os

from pydantic import BaseModel, Field

from cat.base import OpenAICompatibleProvider


class MistralProvider(OpenAICompatibleProvider):
    """Mistral AI models."""

    slug = "mistral"
    name = "Mistral AI"
    description = "Mistral AI models via the official API."

    base_url = "https://api.mistral.ai/v1"

    class Settings(BaseModel):
        api_key: str = Field(os.getenv("MISTRAL_API_KEY", ""), title="Mistral API Key")
