from __future__ import annotations as _annotations

import os
from typing import Any

import httpx


PPLX_API_URL = "https://api.perplexity.ai/chat/completions"


async def perplexity_web_search_service(query: str, max_results: int = 5) -> str:
    """Use Perplexity's online models to search the web and synthesize an answer.

    Requires environment variable PPLX_API_KEY to be set.
    """
    api_key = os.getenv("PPLX_API_KEY")
    if not api_key:
        return "PPLX_API_KEY is not set"

    # Instruct the model to include concise answer and sources
    system_prompt = (
        "You are a concise research assistant. Use online knowledge to answer factually. "
        "Cite reputable sources with URLs at the end under a 'Sources' list."
    )
    user_prompt = (
        f"Search the web and answer: {query}. "
        f"Keep it brief and include about {max_results} sources."
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": "sonar",
        "temperature": 0.5,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 800,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(PPLX_API_URL, headers=headers, json=payload)
        except Exception as e:
            return f"Perplexity request failed: {e}"

    if resp.status_code != 200:
        try:
            data = resp.json()
            message = data.get("error", {}).get("message") or data
        except Exception:
            message = resp.text
        return f"Perplexity error ({resp.status_code}): {message}"

    try:
        data = resp.json()
        content = (data.get("choices") or [{}])[0].get("message", {}).get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    except Exception:
        pass

    return "No results found."


