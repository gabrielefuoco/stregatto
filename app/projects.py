from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import os

from app.db import ProjectDB, SessionDB
from app.auth import get_current_user, AuthUser

router = APIRouter(prefix="/api/projects", tags=["Projects"])

class ProjectCreate(BaseModel):
    name: str
    path: str
    mode: str = 'local'
    icon: str = '📁'
    default_preset_id: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    mode: Optional[str] = None
    default_preset_id: Optional[str] = None
    pinned: Optional[bool] = None

@router.get("/")
async def list_projects(user: AuthUser = Depends(get_current_user)):
    projects = await ProjectDB.select().where(ProjectDB.user_id == user.id).order_by(
        ProjectDB.pinned, ascending=False
    ).order_by(ProjectDB.updated_at, ascending=False)
    return projects

@router.get("/{project_id}")
async def get_project(project_id: str, user: AuthUser = Depends(get_current_user)):
    project = await ProjectDB.objects().get(ProjectDB.id == project_id, ProjectDB.user_id == user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    
    # Conta le sessioni attive
    session_count = await SessionDB.count().where(SessionDB.project_id == project_id)
    project_dict = project.__dict__.copy()
    project_dict["session_count"] = session_count
    return project_dict

@router.post("/")
async def create_project(data: ProjectCreate, user: AuthUser = Depends(get_current_user)):
    if data.mode == 'local' and not os.path.isabs(data.path):
         raise HTTPException(status_code=400, detail="Il path deve essere assoluto per i progetti locali")
    
    project = ProjectDB(
        user_id=user.id,
        name=data.name,
        path=data.path,
        mode=data.mode,
        icon=data.icon,
        default_preset_id=data.default_preset_id
    )
    await project.save()
    return project

@router.put("/{project_id}")
async def update_project(project_id: str, data: ProjectUpdate, user: AuthUser = Depends(get_current_user)):
    project = await ProjectDB.objects().get(ProjectDB.id == project_id, ProjectDB.user_id == user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        for key, value in update_data.items():
            setattr(project, key, value)
        await project.save()
    
    return project

@router.delete("/{project_id}")
async def delete_project(project_id: str, user: AuthUser = Depends(get_current_user)):
    project = await ProjectDB.objects().get(ProjectDB.id == project_id, ProjectDB.user_id == user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    
    # Elimina a cascata tutte le sessioni del progetto
    await SessionDB.delete().where(SessionDB.project_id == project_id)
    await project.remove()
    return {"status": "success", "message": "Progetto eliminato"}
