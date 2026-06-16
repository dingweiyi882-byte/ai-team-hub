"""
Channel CRUD routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from backend.database import get_db
from backend.models import Channel

router = APIRouter(prefix="/api/channels", tags=["channels"])


@router.get("")
async def list_channels(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).order_by(Channel.created_at))
    channels = result.scalars().all()
    return [
        {
            "id": ch.id,
            "name": ch.name,
            "description": ch.description,
            "teammate_ids": ch.teammate_ids or [],
            "created_at": ch.created_at.isoformat() if ch.created_at else None,
        }
        for ch in channels
    ]


@router.post("")
async def create_channel(data: dict, db: AsyncSession = Depends(get_db)):
    channel = Channel(
        name=data["name"],
        description=data.get("description", ""),
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return {"id": channel.id, "name": channel.name, "description": channel.description}


@router.get("/{channel_id}")
async def get_channel(channel_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    ch = result.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    return {
        "id": ch.id,
        "name": ch.name,
        "description": ch.description,
        "teammate_ids": ch.teammate_ids or [],
        "created_at": ch.created_at.isoformat() if ch.created_at else None,
    }


@router.patch("/{channel_id}")
async def update_channel(channel_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    ch = result.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    if "name" in data:
        ch.name = data["name"]
    if "description" in data:
        ch.description = data["description"]
    await db.commit()
    return {"ok": True}


@router.delete("/{channel_id}")
async def delete_channel(channel_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    ch = result.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    await db.delete(ch)
    await db.commit()
    return {"ok": True}


@router.post("/{channel_id}/teammates/{teammate_id}")
async def add_teammate_to_channel(channel_id: str, teammate_id: str, db: AsyncSession = Depends(get_db)):
    """Add an AI teammate to a channel."""
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    ch = result.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    ids = list(ch.teammate_ids or [])
    if teammate_id not in ids:
        ids.append(teammate_id)
    ch.teammate_ids = ids
    flag_modified(ch, "teammate_ids")
    await db.commit()
    return {"ok": True, "teammate_ids": ids}


@router.delete("/{channel_id}/teammates/{teammate_id}")
async def remove_teammate_from_channel(channel_id: str, teammate_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    ch = result.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    ids = list(ch.teammate_ids or [])
    if teammate_id in ids:
        ids.remove(teammate_id)
    ch.teammate_ids = ids
    flag_modified(ch, "teammate_ids")
    await db.commit()
    return {"ok": True, "teammate_ids": ids}
