"""
AI Team Hub — FastAPI entry point.
Slack-style AI team collaboration platform.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database import init_db
from backend.routes import channels, teammates, apikeys, messages


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="AI Team Hub",
    version="1.0.0",
    description="Slack-style AI team collaboration — add AI teammates, create channels, solve problems together.",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
app.include_router(channels.router)
app.include_router(teammates.router)
app.include_router(apikeys.router)
app.include_router(messages.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "AI Team Hub"}


# Serve frontend in production
import os
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8910, reload=True)
