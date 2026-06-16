"""
Message & chat routes — includes streaming AI response, system messages, file uploads.
"""
import json
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Message, Channel, Teammate, APIKey
from backend.services.ai_service import stream_ai_response

router = APIRouter(prefix="/api/messages", tags=["messages"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/{channel_id}")
async def list_messages(channel_id: str, limit: int = 200, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.channel_id == channel_id)
        .order_by(Message.created_at)
        .limit(limit)
    )
    msgs = result.scalars().all()
    return [
        {
            "id": m.id,
            "channel_id": m.channel_id,
            "role": m.role,
            "author_name": m.author_name,
            "author_id": m.author_id,
            "content": m.content,
            "attachments": m.attachments or [],
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in msgs
    ]


@router.post("/{channel_id}/system")
async def send_system_message(channel_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Post a system message (e.g. 'xxx joined the channel')."""
    ch_result = await db.execute(select(Channel).where(Channel.id == channel_id))
    if not ch_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Channel not found")
    msg = Message(
        channel_id=channel_id,
        role="system",
        author_name=data.get("author_name", "System"),
        content=data.get("content", ""),
    )
    db.add(msg)
    await db.commit()
    return {"id": msg.id, "role": "system"}


@router.post("/{channel_id}/file")
async def upload_file(
    channel_id: str,
    file: UploadFile = File(...),
    author_name: str = Form("You"),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file attachment and save as a user message."""
    ch_result = await db.execute(select(Channel).where(Channel.id == channel_id))
    if not ch_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Channel not found")

    # Save file
    ext = os.path.splitext(file.filename or "file")[1] or ""
    safe_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    content_bytes = await file.read()
    with open(file_path, "wb") as f:
        f.write(content_bytes)

    attachment = {
        "filename": file.filename or "file",
        "saved_as": safe_name,
        "size": len(content_bytes),
        "mime": file.content_type or "application/octet-stream",
    }

    msg = Message(
        channel_id=channel_id,
        role="user",
        author_name=author_name,
        content=f"[Uploaded: {file.filename}]",
        attachments=[attachment],
    )
    db.add(msg)
    await db.commit()
    return {
        "id": msg.id,
        "attachment": attachment,
        "message": f"Uploaded {file.filename}",
    }


@router.post("/{channel_id}")
async def send_message(
    channel_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    ch_result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = ch_result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    content = data.get("content", "")
    teammate_id = data.get("teammate_id")
    attachments = data.get("attachments")
    skip_user_save = data.get("skip_user_save", False)

    # Save user message (skip if already saved by a previous AI in sequence)
    user_msg_id = None
    if not skip_user_save:
        user_msg = Message(
            channel_id=channel_id,
            role="user",
            author_name=data.get("author_name", "You"),
            content=content,
            attachments=attachments,
        )
        db.add(user_msg)
        await db.commit()
        user_msg_id = user_msg.id

    # If no AI teammate, just return
    if not teammate_id:
        return {"user_message_id": user_msg_id}

    # Load teammate
    t_result = await db.execute(select(Teammate).where(Teammate.id == teammate_id))
    teammate = t_result.scalar_one_or_none()
    if not teammate or not teammate.api_key_ref:
        raise HTTPException(status_code=400, detail="Teammate not found or no API key configured")

    # Load API key
    k_result = await db.execute(select(APIKey).where(APIKey.id == teammate.api_key_ref))
    apikey = k_result.scalar_one_or_none()
    if not apikey or not apikey.api_key:
        raise HTTPException(status_code=400, detail="API key not found")

    # Recent channel history
    hist_result = await db.execute(
        select(Message)
        .where(Message.channel_id == channel_id)
        .order_by(Message.created_at.desc())
        .limit(40)
    )
    recent = hist_result.scalars().all()
    recent.reverse()
    chat_history = []
    for m in recent:
        if m.role in ("user", "ai"):
            chat_history.append({"role": "assistant" if m.role == "ai" else "user", "content": m.content})

    from backend.database import async_session

    async def generate():
        full_response = ""
        try:
            async for chunk in stream_ai_response(
                system_prompt=teammate.system_prompt,
                messages=chat_history,
                provider=teammate.model_provider,
                model=teammate.model_name,
                api_key=apikey.api_key,
                base_url=apikey.base_url,
            ):
                full_response += chunk
                yield chunk
        except Exception as e:
            yield f"\n\n⚠️ AI Error: {str(e)}"
        finally:
            if full_response.strip():
                async with async_session() as sess:
                    ai_msg = Message(
                        channel_id=channel_id,
                        role="ai",
                        author_name=teammate.name,
                        author_id=teammate.id,
                        content=full_response,
                    )
                    sess.add(ai_msg)
                    await sess.commit()

    return StreamingResponse(generate(), media_type="text/plain")
