from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional
import uuid

from .db import AgentPresetDB, seed_default_presets
from .auth import AuthUser, get_current_user

router = APIRouter(prefix="/presets", tags=["presets"])

@router.get("")
async def list_presets(current_user: AuthUser = Depends(get_current_user)):
    # Restituisce i preset di sistema e quelli dell'utente
    system_presets = await AgentPresetDB.objects().where(AgentPresetDB.user_id == "system").order_by(AgentPresetDB.created_at)
    user_presets = await AgentPresetDB.objects().where(AgentPresetDB.user_id == current_user.id).order_by(AgentPresetDB.created_at)
    return system_presets + user_presets

@router.get("/{preset_id}")
async def get_preset(preset_id: str, current_user: AuthUser = Depends(get_current_user)):
    preset = await AgentPresetDB.objects().where(AgentPresetDB.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset non trovato")
    if preset.user_id != "system" and preset.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accesso negato")
    return preset

@router.post("")
async def create_preset(
    payload: dict = Body(...),
    current_user: AuthUser = Depends(get_current_user)
):
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Il campo 'name' è obbligatorio")

    slug = payload.get("slug", f"custom-{uuid.uuid4().hex[:8]}")
    
    new_preset = AgentPresetDB(
        user_id=current_user.id,
        slug=slug,
        name=name,
        icon=payload.get("icon", "🐱"),
        description=payload.get("description", ""),
        model=payload.get("model", "anthropic/claude-sonnet-4-20250514"),
        system_prompt=payload.get("system_prompt", None),
        permission_mode=payload.get("permission_mode", "auto"),
        allowed_tools=payload.get("allowed_tools", "[]"),
        mcp_servers=payload.get("mcp_servers", "[]"),
        env_vars=payload.get("env_vars", "{}"),
        is_default=payload.get("is_default", False)
    )
    await new_preset.save()
    return new_preset

@router.put("/{preset_id}")
async def update_preset(
    preset_id: str,
    payload: dict = Body(...),
    current_user: AuthUser = Depends(get_current_user)
):
    preset = await AgentPresetDB.objects().where(AgentPresetDB.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset non trovato")
    if preset.user_id == "system":
        raise HTTPException(status_code=403, detail="I preset di sistema non possono essere modificati")
    if preset.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accesso negato")

    for key, value in payload.items():
        if hasattr(preset, key) and key not in ["id", "user_id", "created_at"]:
            setattr(preset, key, value)
    
    await preset.save()
    return preset

@router.delete("/{preset_id}")
async def delete_preset(preset_id: str, current_user: AuthUser = Depends(get_current_user)):
    preset = await AgentPresetDB.objects().where(AgentPresetDB.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset non trovato")
    if preset.user_id == "system":
        raise HTTPException(status_code=403, detail="I preset di sistema non possono essere eliminati")
    if preset.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accesso negato")
        
    await preset.remove()
    return {"status": "success", "message": "Preset eliminato"}

@router.post("/seed")
async def seed_presets(current_user: AuthUser = Depends(get_current_user)):
    # Permettiamo di chiamarlo manualmente se necessario, usa sempre user_id = "system"
    await seed_default_presets("system")
    return {"status": "success", "message": "Preset di default creati/aggiornati"}
