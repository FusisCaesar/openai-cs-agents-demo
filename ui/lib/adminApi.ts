export async function getAdminState() {
  const res = await fetch("/admin/state", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch admin state: ${res.status}`);
  return res.json();
}

export async function getContextDefaults(triage_name?: string) {
  const url = triage_name
    ? `/admin/context?triage_name=${encodeURIComponent(triage_name)}`
    : "/admin/context";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch context defaults: ${res.status}`);
  return res.json();
}

export async function updateContextDefaults(defaults: any, triage_name?: string) {
  const res = await fetch(`/admin/context`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ triage_name: triage_name || "__global__", defaults }),
  });
  if (!res.ok) throw new Error(`Failed to update context defaults: ${res.status}`);
  return res.json();
}

export async function reloadRegistry() {
  const res = await fetch("/admin/reload", { method: "POST" });
  if (!res.ok) throw new Error(`Failed to reload: ${res.status}`);
  return res.json();
}

export async function createAgent(payload: any) {
  const res = await fetch("/admin/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create agent: ${res.status}`);
  return res.json();
}

export async function updateAgent(name: string, payload: any) {
  const res = await fetch(`/admin/agents/${encodeURIComponent(name)}` ,{
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update agent: ${res.status}`);
  return res.json();
}

export async function deleteAgent(name: string) {
  const res = await fetch(`/admin/agents/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete agent: ${res.status}`);
  return res.json();
}

export async function createTool(payload: any) {
  const res = await fetch("/admin/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create tool: ${res.status}`);
  return res.json();
}

export async function updateTool(name: string, payload: any) {
  const res = await fetch(`/admin/tools/${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update tool: ${res.status}`);
  return res.json();
}

export async function deleteTool(name: string) {
  const res = await fetch(`/admin/tools/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete tool: ${res.status}`);
  return res.json();
}

export async function testTool(payload: { tool_code_name: string; arguments?: Record<string, any> }) {
  const res = await fetch("/admin/tools/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to test tool: ${res.status}`);
  return res.json();
}

export async function createGuardrail(payload: any) {
  const res = await fetch("/admin/guardrails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create guardrail: ${res.status}`);
  return res.json();
}

export async function updateGuardrail(name: string, payload: any) {
  const res = await fetch(`/admin/guardrails/${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update guardrail: ${res.status}`);
  return res.json();
}

export async function deleteGuardrail(name: string) {
  const res = await fetch(`/admin/guardrails/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete guardrail: ${res.status}`);
  return res.json();
}

export async function attachTool(payload: { agent_name: string; tool_name: string; sort_order?: number }) {
  const res = await fetch("/admin/agent-tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to attach tool: ${res.status}`);
  return res.json();
}

export async function detachTool(agent_name: string, tool_name: string) {
  const url = `/admin/agent-tools?agent_name=${encodeURIComponent(agent_name)}&tool_name=${encodeURIComponent(tool_name)}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to detach tool: ${res.status}`);
  return res.json();
}

export async function attachGuardrail(payload: { agent_name: string; guardrail_name: string }) {
  const res = await fetch("/admin/agent-guardrails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to attach guardrail: ${res.status}`);
  return res.json();
}

export async function detachGuardrail(agent_name: string, guardrail_name: string) {
  const url = `/admin/agent-guardrails?agent_name=${encodeURIComponent(agent_name)}&guardrail_name=${encodeURIComponent(guardrail_name)}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to detach guardrail: ${res.status}`);
  return res.json();
}

export async function createHandoff(payload: { source_agent: string; target_agent: string; on_handoff_callback?: string | null }) {
  const res = await fetch("/admin/handoffs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create handoff: ${res.status}`);
  return res.json();
}

export async function updateHandoff(payload: { source_agent: string; target_agent: string; on_handoff_callback?: string | null }) {
  const res = await fetch("/admin/handoffs", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update handoff: ${res.status}`);
  return res.json();
}

export async function deleteHandoff(source_agent: string, target_agent: string) {
  const url = `/admin/handoffs?source_agent=${encodeURIComponent(source_agent)}&target_agent=${encodeURIComponent(target_agent)}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete handoff: ${res.status}`);
  return res.json();
}


