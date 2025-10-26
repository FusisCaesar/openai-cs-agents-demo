from __future__ import annotations as _annotations

import os
from typing import Any, List, Dict

from openai import OpenAI


def _client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    return OpenAI(api_key=api_key)


async def openai_web_search_service(query: str, max_results: int = 5) -> str:
    """Use OpenAI's responses with web search to produce a synthesized answer with citations."""
    client = _client()
    # The Python SDK performs I/O; use run_in_thread to avoid blocking if needed by your runtime
    from asyncio import get_running_loop
    loop = get_running_loop()

    def _call() -> str:
        result = client.responses.create(
            model="gpt-5",
            input=(
                f"Search the web and answer: {query}. "
                f"Include sources (URLs) inline and limit to about {max_results}. "
                "Return a concise, factual answer."
            ),
            tools=[{"type": "web_search"}],
        )
        # Prefer SDK convenience property if available
        text = getattr(result, "output_text", None)
        if isinstance(text, str) and text.strip():
            return text.strip()
        # Fallback: assemble from output items
        out = []
        for item in getattr(result, "output", []) or []:
            try:
                if getattr(item, "type", "") == "output_text" and getattr(item, "text", None):
                    out.append(item.text)
            except Exception:
                continue
        final = "\n".join(out).strip()
        return final or "No results found."

    return await loop.run_in_executor(None, _call)


