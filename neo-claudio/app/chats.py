import uuid
import datetime
from typing import List, Dict, Optional, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from pydantic import BaseModel, Field

from .db import ChatDB
from .auth import get_current_user, AuthUser

router = APIRouter(tags=["Chats"])


class ChatCreateUpdate(BaseModel):
    name: Optional[str] = "Nuova Chat"
    messages: List[Any] = Field(default_factory=list)
    context: Dict[str, Any] = Field(default_factory=dict)


class ChatSelect(BaseModel):
    id: str
    user_id: Optional[str] = ""
    name: str
    claude_session_id: Optional[str] = None
    messages: List[Any] = Field(default_factory=list)
    context: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None


class Page(BaseModel):
    items: List[ChatSelect]
    cursor: str = ""


@router.get("/chats", response_model=Page)
async def list_chats(
    search: Optional[str] = Query(None, description="Search query"),
    current_user: AuthUser = Depends(get_current_user)
):
    q = ChatDB.objects().where(ChatDB.user_id == current_user.id).order_by(ChatDB.updated_at, ascending=False)
    objs = await q.limit(100).run()


    if search:
        search_lower = search.lower()
        objs = [
            c for c in objs
            if search_lower in (c.name or "").lower()
        ]

    items = [
        ChatSelect(
            id=c.id,
            user_id=getattr(c, 'user_id', ''),
            name=c.name,
            created_at=c.created_at,
            updated_at=c.updated_at,
            claude_session_id=c.claude_session_id
        )
        for c in objs
    ]
    return Page(items=items, cursor="")



@router.get("/chats/{id}", response_model=ChatSelect)
async def get_chat(
    id: str,
    current_user: AuthUser = Depends(get_current_user)
):
    obj = await (
        ChatDB.objects()
        .where(ChatDB.id == id)
        .where(ChatDB.user_id == current_user.id)
        .first()
        .output(load_json=True)
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Chat non trovata.")
    return obj


@router.post("/chats", response_model=ChatSelect)
async def create_chat(
    data: ChatCreateUpdate = Body(...),
    current_user: AuthUser = Depends(get_current_user)
):
    chat_id = str(uuid.uuid4())
    now = datetime.datetime.utcnow()
    obj = ChatDB(
        id=chat_id,
        user_id=current_user.id,
        name=data.name or "Nuova Chat",
        messages=data.messages,
        context=data.context,
        created_at=now,
        updated_at=now
    )
    await obj.save()
    return await ChatDB.objects().where(ChatDB.id == chat_id).first().output(load_json=True)


@router.put("/chats/{id}", response_model=ChatSelect)
async def edit_chat(
    id: str,
    data: ChatCreateUpdate = Body(...),
    current_user: AuthUser = Depends(get_current_user)
):
    obj = await (
        ChatDB.objects()
        .where(ChatDB.id == id)
        .where(ChatDB.user_id == current_user.id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Chat non trovata.")

    if data.name:
        obj.name = data.name
    obj.messages = data.messages
    obj.context = data.context
    obj.updated_at = datetime.datetime.utcnow()
    await obj.save()

    return await ChatDB.objects().where(ChatDB.id == id).first().output(load_json=True)


@router.delete("/chats/{id}")
async def delete_chat(
    id: str,
    current_user: AuthUser = Depends(get_current_user)
):
    obj = await (
        ChatDB.objects()
        .where(ChatDB.id == id)
        .where(ChatDB.user_id == current_user.id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Chat non trovata.")
    await obj.remove()
    return {"status": "success", "id": id}
