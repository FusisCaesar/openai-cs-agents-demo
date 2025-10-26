from __future__ import annotations as _annotations

import os
from typing import Any, Optional

import asyncpg


_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.getenv("DATABASE_URL")
        if not dsn:
            raise RuntimeError("DATABASE_URL env var is required for Postgres connection")
        _pool = await asyncpg.create_pool(dsn)
    return _pool


async def init_schema() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Agents and supporting entities
        await conn.execute(
            """
            create table if not exists agents (
                id serial primary key,
                name text unique not null,
                model text not null,
                handoff_description text,
                instruction_type text not null check (instruction_type in ('text','provider')),
                instruction_value text not null,
                is_triage boolean not null default false
            );

            create table if not exists tools (
                name text primary key,
                code_name text not null,
                description text,
                test_arguments text
            );

            create table if not exists agent_tools (
                agent_id integer not null references agents(id) on delete cascade,
                tool_name text not null references tools(name) on delete cascade,
                sort_order integer not null default 0,
                primary key (agent_id, tool_name)
            );

            create table if not exists guardrails (
                name text primary key,
                code_name text not null
            );

            create table if not exists agent_guardrails (
                agent_id integer not null references agents(id) on delete cascade,
                guardrail_name text not null references guardrails(name) on delete cascade,
                primary key (agent_id, guardrail_name)
            );

            create table if not exists handoffs (
                source_agent_id integer not null references agents(id) on delete cascade,
                target_agent_id integer not null references agents(id) on delete cascade,
                on_handoff_callback text,
                primary key (source_agent_id, target_agent_id)
            );

            create table if not exists app_contexts (
                triage_name text primary key,
                defaults text
            );
            """
        )
        # Evolve schema for guardrails config
        await conn.execute(
            """
            alter table guardrails add column if not exists model text;
            alter table guardrails add column if not exists instruction_value text;
            alter table tools add column if not exists agent_ref_name text;
            """
        )


async def fetchrow(query: str, *args: Any) -> Optional[asyncpg.Record]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchrow(query, *args)


async def fetch(query: str, *args: Any) -> list[asyncpg.Record]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *args)
        return list(rows)


async def execute(query: str, *args: Any) -> str:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)


