"""
Teammate CRUD routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Teammate

router = APIRouter(prefix="/api/teammates", tags=["teammates"])


@router.get("")
async def list_teammates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Teammate).order_by(Teammate.created_at))
    teammates = result.scalars().all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "role": t.role,
            "avatar_emoji": t.avatar_emoji,
            "system_prompt": t.system_prompt,
            "model_provider": t.model_provider,
            "model_name": t.model_name,
            "api_key_ref": t.api_key_ref,
        }
        for t in teammates
    ]


@router.post("")
async def create_teammate(data: dict, db: AsyncSession = Depends(get_db)):
    teammate = Teammate(
        name=data["name"],
        role=data.get("role", "assistant"),
        avatar_emoji=data.get("avatar_emoji", "🤖"),
        system_prompt=data.get("system_prompt", "You are a helpful AI assistant."),
        model_provider=data["model_provider"],
        model_name=data["model_name"],
        api_key_ref=data.get("api_key_ref"),
    )
    db.add(teammate)
    await db.commit()
    await db.refresh(teammate)
    return {"id": teammate.id, "name": teammate.name}


@router.get("/{teammate_id}")
async def get_teammate(teammate_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Teammate).where(Teammate.id == teammate_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Teammate not found")
    return {
        "id": t.id, "name": t.name, "role": t.role,
        "avatar_emoji": t.avatar_emoji, "system_prompt": t.system_prompt,
        "model_provider": t.model_provider, "model_name": t.model_name,
        "api_key_ref": t.api_key_ref,
    }


@router.patch("/{teammate_id}")
async def update_teammate(teammate_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Teammate).where(Teammate.id == teammate_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Teammate not found")
    for field in ("name", "role", "avatar_emoji", "system_prompt", "model_provider", "model_name", "api_key_ref"):
        if field in data:
            setattr(t, field, data[field])
    await db.commit()
    return {"ok": True}


@router.delete("/{teammate_id}")
async def delete_teammate(teammate_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Teammate).where(Teammate.id == teammate_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Teammate not found")
    await db.delete(t)
    await db.commit()
    return {"ok": True}
