from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

from app.db import SessionDB, ProjectDB
from app.auth import get_current_user, AuthUser

router = APIRouter(prefix="/api", tags=["Sessions"])

class SessionCreate(BaseModel):
    name: Optional[str] = 'Nuova Sessione'
    preset_id: Optional[str] = None
    model: Optional[str] = None

class SessionUpdate(BaseModel):
    name: Optional[str] = None
    pinned: Optional[bool] = None
    state: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

@router.get("/projects/{project_id}/sessions")
async def list_project_sessions(project_id: str, user: AuthUser = Depends(get_current_user)):
    # Verifica accesso al progetto
    project_exists = await ProjectDB.exists().where(ProjectDB.id == project_id, ProjectDB.user_id == user.id)
    if not project_exists:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
        
    sessions = await SessionDB.select().where(SessionDB.project_id == project_id).order_by(
        SessionDB.updated_at, ascending=True
    )
    
    return sessions

@router.get("/sessions/{session_id}")
async def get_session(session_id: str, user: AuthUser = Depends(get_current_user)):
    session = await SessionDB.objects().where((SessionDB.id == session_id) & (SessionDB.user_id == user.id)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    return session

@router.post("/projects/{project_id}/sessions")
async def create_session(project_id: str, data: SessionCreate, user: AuthUser = Depends(get_current_user)):
    project_exists = await ProjectDB.exists().where(ProjectDB.id == project_id, ProjectDB.user_id == user.id)
    if not project_exists:
        raise HTTPException(status_code=404, detail="Progetto non trovato")

    session = SessionDB(
        project_id=project_id,
        user_id=user.id,
        name=data.name,
        preset_id=data.preset_id,
        model=data.model,
        state='active'
    )
    await session.save()
    # In una implementazione reale, qui si emetterebbe un evento al worker per avviare la PTY
    return session

@router.put("/sessions/{session_id}")
async def update_session(session_id: str, data: SessionUpdate, user: AuthUser = Depends(get_current_user)):
    session = await SessionDB.objects().where((SessionDB.id == session_id) & (SessionDB.user_id == user.id)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
        
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    for key, value in update_data.items():
        setattr(session, key, value)
    await session.save()
    return session

from app.pty_manager import pty_manager

@router.put("/sessions/{session_id}/suspend")
async def suspend_session(session_id: str, user: AuthUser = Depends(get_current_user)):
    session = await SessionDB.objects().where((SessionDB.id == session_id) & (SessionDB.user_id == user.id)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    
    session.state = 'suspended'
    await session.save()
    await pty_manager.kill(session_id)
    return {"status": "suspended"}

@router.put("/sessions/{session_id}/resume")
async def resume_session(session_id: str, user: AuthUser = Depends(get_current_user)):
    session = await SessionDB.objects().where((SessionDB.id == session_id) & (SessionDB.user_id == user.id)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    
    session.state = 'active'
    await session.save()
    # PTY is dynamically spawned by the WebSocket connection upon reconnecting in main.py
    return {"status": "resumed"}

@router.put("/sessions/{session_id}/archive")
async def archive_session(session_id: str, user: AuthUser = Depends(get_current_user)):
    session = await SessionDB.objects().where((SessionDB.id == session_id) & (SessionDB.user_id == user.id)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
        
    session.state = 'archived'
    session.archived_at = datetime.now()
    await session.save()
    await pty_manager.kill(session_id)
    return {"status": "archived"}

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user: AuthUser = Depends(get_current_user)):
    session = await SessionDB.objects().where((SessionDB.id == session_id) & (SessionDB.user_id == user.id)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
        
    await session.remove()
    return {"status": "deleted"}
