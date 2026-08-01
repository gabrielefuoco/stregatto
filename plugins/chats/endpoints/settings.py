from fastapi import Body
from pydantic import BaseModel
from cat import endpoint, user
from ..settings_db import UserSettingsDB

class SettingsUpdate(BaseModel):
    mcp_url: str | None = None
    mcp_token: str | None = None

@endpoint.get("/settings", tags=["Settings"], role="authenticated")
async def get_settings() -> SettingsUpdate:
    obj = await UserSettingsDB.objects().where(UserSettingsDB.user_id == user.id).first()
    if obj:
        return SettingsUpdate(mcp_url=obj.mcp_url, mcp_token=obj.mcp_token)
    return SettingsUpdate()

@endpoint.post("/settings", tags=["Settings"], role="authenticated")
async def update_settings(data: SettingsUpdate = Body(...)) -> SettingsUpdate:
    obj = await UserSettingsDB.objects().where(UserSettingsDB.user_id == user.id).first()
    if not obj:
        obj = UserSettingsDB(user_id=user.id)
    obj.mcp_url = data.mcp_url
    obj.mcp_token = data.mcp_token
    await obj.save()
    return data
