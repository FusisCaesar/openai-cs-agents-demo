from __future__ import annotations as _annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db import fetch, fetchrow, execute
from domain import RECOMMENDED_PROMPT_PREFIX
from loader import build_dynamic_registry, DynamicRegistry


class AgentCreate(BaseModel):
    name: str
    model: str
    handoff_description: Optional[str] = None
    instruction_type: str = Field(pattern="^(text|provider)$")
    instruction_value: str


class AgentUpdate(BaseModel):
    model: Optional[str] = None
    handoff_description: Optional[str] = None
    instruction_type: Optional[str] = Field(default=None, pattern="^(text|provider)$")
    instruction_value: Optional[str] = None


class ToolCreate(BaseModel):
    name: str
    code_name: str
    description: Optional[str] = None


class GuardrailCreate(BaseModel):
    name: str
    code_name: str
    model: Optional[str] = None
    instruction_value: Optional[str] = None


class AgentToolLink(BaseModel):
    agent_name: str
    tool_name: str
    sort_order: int = 0


class AgentGuardrailLink(BaseModel):
    agent_name: str
    guardrail_name: str


class HandoffCreate(BaseModel):
    source_agent: str
    target_agent: str
    on_handoff_callback: Optional[str] = None


router = APIRouter(prefix="/admin", tags=["admin"])


async def _agent_id(name: str) -> int:
    row = await fetchrow("select id from agents where name=$1", name)
    if not row:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")
    return int(row["id"])  # type: ignore


@router.get("/state")
async def state() -> dict[str, Any]:
    agents = [dict(r) for r in await fetch("select * from agents order by id")]  # type: ignore
    tools = [dict(r) for r in await fetch("select * from tools order by name")]  # type: ignore
    guardrails = [dict(r) for r in await fetch("select * from guardrails order by name")]  # type: ignore
    handoffs = [dict(r) for r in await fetch(
        """
        select s.name as source, t.name as target, h.on_handoff_callback
        from handoffs h
        join agents s on s.id=h.source_agent_id
        join agents t on t.id=h.target_agent_id
        order by s.name, t.name
        """
    )]
    agent_tools = [dict(r) for r in await fetch(
        """
        select a.name as agent, at.tool_name, at.sort_order
        from agent_tools at
        join agents a on a.id = at.agent_id
        order by a.name, at.sort_order
        """
    )]
    agent_guardrails = [dict(r) for r in await fetch(
        """
        select a.name as agent, ag.guardrail_name
        from agent_guardrails ag
        join agents a on a.id = ag.agent_id
        order by a.name, ag.guardrail_name
        """
    )]
    return {
        "agents": agents,
        "tools": tools,
        "guardrails": guardrails,
        "handoffs": handoffs,
        "agent_tools": agent_tools,
        "agent_guardrails": agent_guardrails,
    }


@router.post("/agents")
async def create_agent(body: AgentCreate) -> dict[str, Any]:
    await execute(
        "insert into agents(name, model, handoff_description, instruction_type, instruction_value) values($1,$2,$3,$4,$5)",
        body.name, body.model, body.handoff_description, body.instruction_type, body.instruction_value,
    )
    return {"ok": True}


@router.patch("/agents/{name}")
async def update_agent(name: str, body: AgentUpdate) -> dict[str, Any]:
    fields: list[str] = []
    args: list[Any] = []
    if body.model is not None:
        fields.append("model=$%d" % (len(args) + 1))
        args.append(body.model)
    if body.handoff_description is not None:
        fields.append("handoff_description=$%d" % (len(args) + 1))
        args.append(body.handoff_description)
    if body.instruction_type is not None:
        fields.append("instruction_type=$%d" % (len(args) + 1))
        args.append(body.instruction_type)
    if body.instruction_value is not None:
        fields.append("instruction_value=$%d" % (len(args) + 1))
        args.append(body.instruction_value)
    if not fields:
        return {"ok": True}
    args.append(name)
    set_sql = ", ".join(fields)
    await execute(f"update agents set {set_sql} where name=$%d" % (len(args)), *args)
    return {"ok": True}


@router.delete("/agents/{name}")
async def delete_agent(name: str) -> dict[str, Any]:
    await execute("delete from agents where name=$1", name)
    return {"ok": True}


@router.post("/tools")
async def create_tool(body: ToolCreate) -> dict[str, Any]:
    await execute(
        "insert into tools(name, code_name, description) values($1,$2,$3)",
        body.name, body.code_name, body.description,
    )
    return {"ok": True}


@router.delete("/tools/{name}")
async def delete_tool(name: str) -> dict[str, Any]:
    await execute("delete from tools where name=$1", name)
    return {"ok": True}


@router.post("/guardrails")
async def create_guardrail(body: GuardrailCreate) -> dict[str, Any]:
    await execute(
        "insert into guardrails(name, code_name, model, instruction_value) values($1,$2,$3,$4)",
        body.name, body.code_name, body.model, body.instruction_value,
    )
    return {"ok": True}


class GuardrailUpdate(BaseModel):
    model: Optional[str] = None
    instruction_value: Optional[str] = None


@router.patch("/guardrails/{name}")
async def update_guardrail(name: str, body: GuardrailUpdate) -> dict[str, Any]:
    fields: list[str] = []
    args: list[Any] = []
    if body.model is not None:
        fields.append("model=$%d" % (len(args) + 1))
        args.append(body.model)
    if body.instruction_value is not None:
        fields.append("instruction_value=$%d" % (len(args) + 1))
        args.append(body.instruction_value)
    if not fields:
        return {"ok": True}
    args.append(name)
    set_sql = ", ".join(fields)
    await execute(f"update guardrails set {set_sql} where name=$%d" % (len(args)), *args)
    return {"ok": True}


@router.delete("/guardrails/{name}")
async def delete_guardrail(name: str) -> dict[str, Any]:
    await execute("delete from guardrails where name=$1", name)
    return {"ok": True}


@router.post("/agent-tools")
async def attach_tool(body: AgentToolLink) -> dict[str, Any]:
    aid = await _agent_id(body.agent_name)
    await execute(
        "insert into agent_tools(agent_id, tool_name, sort_order) values($1,$2,$3) on conflict (agent_id, tool_name) do update set sort_order=excluded.sort_order",
        aid, body.tool_name, body.sort_order,
    )
    return {"ok": True}


@router.delete("/agent-tools")
async def detach_tool(agent_name: str, tool_name: str) -> dict[str, Any]:
    aid = await _agent_id(agent_name)
    await execute("delete from agent_tools where agent_id=$1 and tool_name=$2", aid, tool_name)
    return {"ok": True}


@router.post("/agent-guardrails")
async def attach_guardrail(body: AgentGuardrailLink) -> dict[str, Any]:
    aid = await _agent_id(body.agent_name)
    await execute(
        "insert into agent_guardrails(agent_id, guardrail_name) values($1,$2) on conflict do nothing",
        aid, body.guardrail_name,
    )
    return {"ok": True}


@router.delete("/agent-guardrails")
async def detach_guardrail(agent_name: str, guardrail_name: str) -> dict[str, Any]:
    aid = await _agent_id(agent_name)
    await execute("delete from agent_guardrails where agent_id=$1 and guardrail_name=$2", aid, guardrail_name)
    return {"ok": True}


@router.post("/handoffs")
async def create_handoff(body: HandoffCreate) -> dict[str, Any]:
    sid = await _agent_id(body.source_agent)
    tid = await _agent_id(body.target_agent)
    await execute(
        "insert into handoffs(source_agent_id, target_agent_id, on_handoff_callback) values($1,$2,$3) on conflict do nothing",
        sid, tid, body.on_handoff_callback,
    )
    return {"ok": True}


@router.delete("/handoffs")
async def delete_handoff(source_agent: str, target_agent: str) -> dict[str, Any]:
    sid = await _agent_id(source_agent)
    tid = await _agent_id(target_agent)
    await execute("delete from handoffs where source_agent_id=$1 and target_agent_id=$2", sid, tid)
    return {"ok": True}


@router.post("/reload")
async def reload_registry() -> dict[str, Any]:
    # Endpoint exists; actual registry replacement is handled in api.py via dependency on this call
    return {"ok": True}


@router.post("/migrate-instructions")
async def migrate_instructions_provider_to_text() -> dict[str, Any]:
    triage_text = (
        f"{RECOMMENDED_PROMPT_PREFIX} "
        "You are a helpful triaging agent. You can use your tools to delegate questions to other appropriate agents."
    )
    faq_text = (
        f"{RECOMMENDED_PROMPT_PREFIX}\n"
        "You are an FAQ agent. If you are speaking to a customer, you probably were transferred to from the triage agent.\n"
        "Use the following routine to support the customer.\n"
        "1. Identify the last question asked by the customer.\n"
        "2. Use the faq lookup tool to get the answer. Do not rely on your own knowledge.\n"
        "3. Respond to the customer with the answer"
    )
    seat_booking_text = (
        f"{RECOMMENDED_PROMPT_PREFIX}\n"
        "You are a seat booking agent. If you are speaking to a customer, you probably were transferred to from the triage agent.\n"
        "Use the following routine to support the customer.\n"
        "1. The customer's confirmation number is {confirmation_number}. If this is not available, ask the customer for their confirmation number. If you have it, confirm that is the confirmation number they are referencing.\n"
        "2. Ask the customer what their desired seat number is. You can also use the display_seat_map tool to show them an interactive seat map where they can click to select their preferred seat.\n"
        "3. Use the update seat tool to update the seat on the flight.\n"
        "If the customer asks a question that is not related to the routine, transfer back to the triage agent."
    )
    flight_status_text = (
        f"{RECOMMENDED_PROMPT_PREFIX}\n"
        "You are a Flight Status Agent. Use the following routine to support the customer:\n"
        "1. The customer's confirmation number is {confirmation_number} and flight number is {flight_number}.\n"
        "   If either is not available, ask the customer for the missing information. If you have both, confirm with the customer that these are correct.\n"
        "2. Use the flight_status_tool to report the status of the flight.\n"
        "If the customer asks a question that is not related to flight status, transfer back to the triage agent."
    )
    cancellation_text = (
        f"{RECOMMENDED_PROMPT_PREFIX}\n"
        "You are a Cancellation Agent. Use the following routine to support the customer:\n"
        "1. The customer's confirmation number is {confirmation_number} and flight number is {flight_number}.\n"
        "   If either is not available, ask the customer for the missing information. If you have both, confirm with the customer that these are correct.\n"
        "2. If the customer confirms, use the cancel_flight tool to cancel their flight.\n"
        "If the customer asks anything else, transfer back to the triage agent."
    )

    # Update all provider-based instructions to text templates
    await execute("update agents set instruction_type='text', instruction_value=$1 where instruction_type='provider' and instruction_value='triage'", triage_text)
    await execute("update agents set instruction_type='text', instruction_value=$1 where instruction_type='provider' and instruction_value='faq'", faq_text)
    await execute("update agents set instruction_type='text', instruction_value=$1 where instruction_type='provider' and instruction_value='seat_booking'", seat_booking_text)
    await execute("update agents set instruction_type='text', instruction_value=$1 where instruction_type='provider' and instruction_value='flight_status'", flight_status_text)
    await execute("update agents set instruction_type='text', instruction_value=$1 where instruction_type='provider' and instruction_value='cancellation'", cancellation_text)

    return {"ok": True}


