from __future__ import annotations as _annotations

import asyncio
from typing import Any

import httpx


DUCKDUCKGO_API = "https://duckduckgo.com/"
DUCKDUCKGO_HTML = "https://html.duckduckgo.com/"


async def _ddg_token(session: httpx.AsyncClient, query: str) -> str:
    # DuckDuckGo requires a vqd token obtained from initial page load
    # Minimal parsing approach to extract vqd from HTML/JS
    resp = await session.get(DUCKDUCKGO_API, params={"q": query}, timeout=15)
    resp.raise_for_status()
    text = resp.text
    # vqd typically appears like: vqd='3-12345678901234567890123456789012'
    marker = "vqd='"
    start = text.find(marker)
    if start == -1:
        return ""
    start += len(marker)
    end = text.find("'", start)
    if end == -1:
        return ""
    return text[start:end]


async def ddg_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Perform a lightweight DuckDuckGo search and return top results.

    Returns a list of {title, url, snippet}.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": DUCKDUCKGO_API,
    }
    async with httpx.AsyncClient(headers=headers, timeout=15) as session:
        # Prefer the lite HTML endpoint to avoid token/403 issues
        html_results = await _ddg_html_results(session, query)
        if html_results:
            return html_results[:max_results]

        # Try the JSON i.js endpoint with a vqd token as a secondary option
        try:
            vqd = await _ddg_token(session, query)
            params = {
                "q": query,
                "l": "us-en",
                "o": "json",
                "kl": "us-en",
                "dl": "us-en",
                "bing_market": "en-US",
                "p": "1",
                "vqd": vqd,
            }
            resp = await session.get(DUCKDUCKGO_API + "i.js", params=params)
            results: list[dict[str, Any]] = []
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("results", []):
                    title = item.get("title") or item.get("highlight") or ""
                    url = item.get("url") or item.get("image") or ""
                    snippet = item.get("source") or item.get("description") or ""
                    if title and url:
                        results.append({"title": title, "url": url, "snippet": snippet})
                    if len(results) >= max_results:
                        break
                if not results:
                    for item in data.get("related", []):
                        title = item.get("text") or ""
                        url = item.get("first_url") or ""
                        snippet = item.get("topic") or ""
                        if title and url:
                            results.append({"title": title, "url": url, "snippet": snippet})
                        if len(results) >= max_results:
                            break
                if results:
                    return results[:max_results]
        except Exception:
            pass

        # Final fallback: Instant Answer API (related topics)
        ia_results = await _ddg_instant_answer(session, query)
        return ia_results[:max_results]


async def web_search_service(query: str, max_results: int = 5) -> str:
    """High-level service that formats search results into a concise string."""
    try:
        results = await ddg_search(query, max_results=max_results)
    except Exception:
        return "No results found."
    if not results:
        return "No results found."
    lines: list[str] = []
    for idx, r in enumerate(results, start=1):
        lines.append(f"{idx}. {r['title']} — {r['url']}")
        if r.get("snippet"):
            lines.append(f"   {r['snippet']}")
    return "\n".join(lines)


async def _ddg_html_results(session: httpx.AsyncClient, query: str) -> list[dict[str, Any]]:
    # Parse the DuckDuckGo lite HTML page for web results
    url = DUCKDUCKGO_HTML + "html/"
    resp = await session.get(url, params={"q": query, "kl": "us-en"})
    resp.raise_for_status()
    text = resp.text
    # Very lightweight parsing: anchors with result__a class
    results: list[dict[str, Any]] = []
    import re
    for m in re.finditer(r'<a[^>]*class="[^\"]*result__a[^\"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', text, re.IGNORECASE | re.DOTALL):
        href = m.group(1)
        title_raw = m.group(2)
        # Remove HTML tags from title
        title = re.sub(r"<[^>]+>", "", title_raw).strip()
        if href and title:
            results.append({"title": title, "url": href, "snippet": ""})
    return results


async def _ddg_instant_answer(session: httpx.AsyncClient, query: str) -> list[dict[str, Any]]:
    api = "https://api.duckduckgo.com/"
    resp = await session.get(api, params={
        "q": query,
        "format": "json",
        "no_html": 1,
        "skip_disambig": 1,
        "no_redirect": 1,
    })
    if resp.status_code != 200:
        return []
    data = resp.json()
    results: list[dict[str, Any]] = []
    if data.get("AbstractURL"):
        results.append({
            "title": data.get("Heading") or data.get("AbstractText") or query,
            "url": data.get("AbstractURL"),
            "snippet": data.get("AbstractText") or "",
        })
    for item in data.get("RelatedTopics", []) or []:
        if isinstance(item, dict) and item.get("FirstURL"):
            results.append({
                "title": item.get("Text") or "",
                "url": item.get("FirstURL") or "",
                "snippet": "",
            })
        if isinstance(item, dict) and item.get("Topics"):
            for t in item.get("Topics") or []:
                if t.get("FirstURL"):
                    results.append({
                        "title": t.get("Text") or "",
                        "url": t.get("FirstURL") or "",
                        "snippet": "",
                    })
    return results


