"""
AI service — calls user-provided LLM APIs with streaming support.
"""
import json
from typing import AsyncGenerator

import httpx


async def stream_ai_response(
    system_prompt: str,
    messages: list[dict],
    provider: str,
    model: str,
    api_key: str,
    base_url: str | None = None,
) -> AsyncGenerator[str, None]:
    full_messages = [{"role": "system", "content": system_prompt}] + messages

    # Resolve endpoint by provider
    PROVIDER_ENDPOINTS = {
        # 海外
        "openai": "https://api.openai.com/v1/chat/completions",
        "anthropic": "https://api.anthropic.com/v1/messages",
        "google": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "mistral": "https://api.mistral.ai/v1/chat/completions",
        "groq": "https://api.groq.com/openai/v1/chat/completions",
        "together": "https://api.together.xyz/v1/chat/completions",
        "openrouter": "https://openrouter.ai/api/v1/chat/completions",
        # 中国
        "deepseek": "https://api.deepseek.com/v1/chat/completions",
        "zhipu": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        "moonshot": "https://api.moonshot.cn/v1/chat/completions",
        "baidu": "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions",
        "alibaba": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        "doubao": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
        "hunyuan": "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
        "baichuan": "https://api.baichuan-ai.com/v1/chat/completions",
        "yi": "https://api.01.ai/v1/chat/completions",
        "minimax": "https://api.minimax.chat/v1/text/chatcompletion_v2",
        "stepfun": "https://api.stepfun.com/v1/chat/completions",
        "spark": "https://spark-api-open.xf-yun.com/v1/chat/completions",
        "siliconflow": "https://api.siliconflow.cn/v1/chat/completions",
    }

    if provider == "custom" and base_url:
        endpoint = f"{base_url.rstrip('/')}/v1/chat/completions"
    elif provider in PROVIDER_ENDPOINTS:
        endpoint = PROVIDER_ENDPOINTS[provider]
    elif base_url:
        endpoint = f"{base_url.rstrip('/')}/v1/chat/completions"
    else:
        endpoint = f"https://api.{provider}.com/v1/chat/completions"

    headers = {"Content-Type": "application/json"}

    if provider == "anthropic":
        headers["x-api-key"] = api_key
        headers["anthropic-version"] = "2023-06-01"
        system_msg = full_messages[0]["content"] if full_messages[0]["role"] == "system" else ""
        chat_messages = [m for m in full_messages if m["role"] != "system"]
        payload = {
            "model": model,
            "system": system_msg,
            "messages": chat_messages,
            "max_tokens": 4096,
            "stream": True,
        }
    else:
        headers["Authorization"] = f"Bearer {api_key}"
        payload = {
            "model": model,
            "messages": full_messages,
            "stream": True,
            "temperature": 0.7,
        }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", endpoint, json=payload, headers=headers) as response:
            response.raise_for_status()

            if provider == "anthropic":
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            parsed = json.loads(data)
                            if parsed.get("type") == "content_block_delta":
                                delta = parsed.get("delta", {})
                                text = delta.get("text", "")
                                if text:
                                    yield text
                        except json.JSONDecodeError:
                            continue
            else:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            parsed = json.loads(data)
                            choices = parsed.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
