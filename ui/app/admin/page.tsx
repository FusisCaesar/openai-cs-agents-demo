"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAdminState,
  reloadRegistry,
  createAgent,
  updateAgent,
  deleteAgent,
  createTool,
  deleteTool,
  createGuardrail,
  deleteGuardrail,
  attachTool,
  detachTool,
  attachGuardrail,
  detachGuardrail,
  createHandoff,
  deleteHandoff,
} from "@/lib/adminApi";

type AdminState = {
  agents: any[];
  tools: any[];
  guardrails: any[];
  handoffs: any[];
  agent_tools: any[];
  agent_guardrails: any[];
};

export default function AdminPage() {
  const [state, setState] = useState<AdminState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminState();
      setState(data);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const agentNames = useMemo(() => (state?.agents || []).map((a: any) => a.name), [state]);
  const toolNames = useMemo(() => (state?.tools || []).map((t: any) => t.name), [state]);
  const guardrailNames = useMemo(() => (state?.guardrails || []).map((g: any) => g.name), [state]);

  async function onReload() {
    setBusy(true);
    try {
      await reloadRegistry();
    } finally {
      setBusy(false);
    }
  }

  // Simple forms state
  const [newAgent, setNewAgent] = useState({ name: "", model: "gpt-4.1", handoff_description: "", instruction_type: "provider", instruction_value: "triage" });
  const [newTool, setNewTool] = useState({ name: "", code_name: "", description: "" });
  const [newGuardrail, setNewGuardrail] = useState({ name: "", code_name: "" });
  const [linkTool, setLinkTool] = useState({ agent_name: "", tool_name: "", sort_order: 0 });
  const [linkGuard, setLinkGuard] = useState({ agent_name: "", guardrail_name: "" });
  const [newHandoff, setNewHandoff] = useState({ source_agent: "", target_agent: "", on_handoff_callback: "" });

  if (loading) return <div className="p-6">Loading admin...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <main className="p-4 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Admin</h1>
        <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" onClick={refresh} disabled={busy}>Refresh</button>
        <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:bg-gray-300" onClick={onReload} disabled={busy}>Reload Registry</button>
      </div>

      {/* Agents */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Agents</h2>
        <div className="grid grid-cols-3 gap-3">
          {state?.agents?.map((a) => (
            <div key={a.id} className="border rounded p-3 bg-white">
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-zinc-600">{a.model}</div>
              <div className="text-xs text-zinc-500 mt-1">{a.handoff_description}</div>
              <div className="mt-2 flex gap-2">
                <button className="text-xs px-2 py-1 bg-red-600 text-white rounded" onClick={async () => { setBusy(true); try { await deleteAgent(a.name); await refresh(); } finally { setBusy(false); } }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
        <div className="border rounded p-3 bg-white">
          <div className="font-medium mb-2">Create Agent</div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="name" className="border p-2 rounded" value={newAgent.name} onChange={e => setNewAgent({ ...newAgent, name: e.target.value })} />
            <input placeholder="model" className="border p-2 rounded" value={newAgent.model} onChange={e => setNewAgent({ ...newAgent, model: e.target.value })} />
            <input placeholder="handoff_description" className="border p-2 rounded col-span-2" value={newAgent.handoff_description} onChange={e => setNewAgent({ ...newAgent, handoff_description: e.target.value })} />
            <select className="border p-2 rounded" value={newAgent.instruction_type} onChange={e => setNewAgent({ ...newAgent, instruction_type: e.target.value })}>
              <option value="provider">provider</option>
              <option value="text">text</option>
            </select>
            <input placeholder="instruction_value" className="border p-2 rounded" value={newAgent.instruction_value} onChange={e => setNewAgent({ ...newAgent, instruction_value: e.target.value })} />
          </div>
          <div className="mt-2">
            <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" disabled={!newAgent.name} onClick={async () => { setBusy(true); try { await createAgent(newAgent); await refresh(); } finally { setBusy(false); } }}>Create</button>
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tools</h2>
        <div className="grid grid-cols-3 gap-3">
          {state?.tools?.map((t) => (
            <div key={t.name} className="border rounded p-3 bg-white">
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-zinc-600">code: {t.code_name}</div>
              <div className="mt-2 flex gap-2">
                <button className="text-xs px-2 py-1 bg-red-600 text-white rounded" onClick={async () => { setBusy(true); try { await deleteTool(t.name); await refresh(); } finally { setBusy(false); } }}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <div className="border rounded p-3 bg-white">
          <div className="font-medium mb-2">Create Tool</div>
          <div className="grid grid-cols-3 gap-2">
            <input placeholder="name" className="border p-2 rounded" value={newTool.name} onChange={e => setNewTool({ ...newTool, name: e.target.value })} />
            <input placeholder="code_name" className="border p-2 rounded" value={newTool.code_name} onChange={e => setNewTool({ ...newTool, code_name: e.target.value })} />
            <input placeholder="description" className="border p-2 rounded" value={newTool.description} onChange={e => setNewTool({ ...newTool, description: e.target.value })} />
          </div>
          <div className="mt-2">
            <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" disabled={!newTool.name || !newTool.code_name} onClick={async () => { setBusy(true); try { await createTool(newTool); await refresh(); } finally { setBusy(false); } }}>Create</button>
          </div>
        </div>
      </section>

      {/* Guardrails */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Guardrails</h2>
        <div className="grid grid-cols-3 gap-3">
          {state?.guardrails?.map((g) => (
            <div key={g.name} className="border rounded p-3 bg-white">
              <div className="font-medium">{g.name}</div>
              <div className="text-xs text-zinc-600">code: {g.code_name}</div>
              <div className="mt-2 flex gap-2">
                <button className="text-xs px-2 py-1 bg-red-600 text-white rounded" onClick={async () => { setBusy(true); try { await deleteGuardrail(g.name); await refresh(); } finally { setBusy(false); } }}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <div className="border rounded p-3 bg-white">
          <div className="font-medium mb-2">Create Guardrail</div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="name" className="border p-2 rounded" value={newGuardrail.name} onChange={e => setNewGuardrail({ ...newGuardrail, name: e.target.value })} />
            <input placeholder="code_name" className="border p-2 rounded" value={newGuardrail.code_name} onChange={e => setNewGuardrail({ ...newGuardrail, code_name: e.target.value })} />
          </div>
          <div className="mt-2">
            <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" disabled={!newGuardrail.name || !newGuardrail.code_name} onClick={async () => { setBusy(true); try { await createGuardrail(newGuardrail); await refresh(); } finally { setBusy(false); } }}>Create</button>
          </div>
        </div>
      </section>

      {/* Links */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Agent Links</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded p-3 bg-white">
            <div className="font-medium mb-2">Attach Tool</div>
            <div className="grid grid-cols-3 gap-2">
              <select className="border p-2 rounded" value={linkTool.agent_name} onChange={e => setLinkTool({ ...linkTool, agent_name: e.target.value })}>
                <option value="">agent</option>
                {agentNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <select className="border p-2 rounded" value={linkTool.tool_name} onChange={e => setLinkTool({ ...linkTool, tool_name: e.target.value })}>
                <option value="">tool</option>
                {toolNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input type="number" className="border p-2 rounded" value={linkTool.sort_order} onChange={e => setLinkTool({ ...linkTool, sort_order: Number(e.target.value) })} />
            </div>
            <div className="mt-2 flex gap-2">
              <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" disabled={!linkTool.agent_name || !linkTool.tool_name} onClick={async () => { setBusy(true); try { await attachTool(linkTool); await refresh(); } finally { setBusy(false); } }}>Attach</button>
              <button className="px-3 py-1 rounded bg-red-600 text-white disabled:bg-gray-300" disabled={!linkTool.agent_name || !linkTool.tool_name} onClick={async () => { setBusy(true); try { await detachTool(linkTool.agent_name, linkTool.tool_name); await refresh(); } finally { setBusy(false); } }}>Detach</button>
            </div>
          </div>

          <div className="border rounded p-3 bg-white">
            <div className="font-medium mb-2">Attach Guardrail</div>
            <div className="grid grid-cols-2 gap-2">
              <select className="border p-2 rounded" value={linkGuard.agent_name} onChange={e => setLinkGuard({ ...linkGuard, agent_name: e.target.value })}>
                <option value="">agent</option>
                {agentNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <select className="border p-2 rounded" value={linkGuard.guardrail_name} onChange={e => setLinkGuard({ ...linkGuard, guardrail_name: e.target.value })}>
                <option value="">guardrail</option>
                {guardrailNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="mt-2 flex gap-2">
              <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" disabled={!linkGuard.agent_name || !linkGuard.guardrail_name} onClick={async () => { setBusy(true); try { await attachGuardrail(linkGuard); await refresh(); } finally { setBusy(false); } }}>Attach</button>
              <button className="px-3 py-1 rounded bg-red-600 text-white disabled:bg-gray-300" disabled={!linkGuard.agent_name || !linkGuard.guardrail_name} onClick={async () => { setBusy(true); try { await detachGuardrail(linkGuard.agent_name, linkGuard.guardrail_name); await refresh(); } finally { setBusy(false); } }}>Detach</button>
            </div>
          </div>
        </div>
      </section>

      {/* Handoffs */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Handoffs</h2>
        <div className="grid grid-cols-3 gap-3">
          {state?.handoffs?.map((h) => (
            <div key={`${h.source}-${h.target}`} className="border rounded p-3 bg-white">
              <div className="font-medium">{h.source} → {h.target}</div>
              {h.on_handoff_callback && (
                <div className="text-xs text-zinc-600">callback: {h.on_handoff_callback}</div>
              )}
              <div className="mt-2 flex gap-2">
                <button className="text-xs px-2 py-1 bg-red-600 text-white rounded" onClick={async () => { setBusy(true); try { await deleteHandoff(h.source, h.target); await refresh(); } finally { setBusy(false); } }}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <div className="border rounded p-3 bg-white">
          <div className="font-medium mb-2">Create Handoff</div>
          <div className="grid grid-cols-3 gap-2">
            <select className="border p-2 rounded" value={newHandoff.source_agent} onChange={e => setNewHandoff({ ...newHandoff, source_agent: e.target.value })}>
              <option value="">source</option>
              {agentNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select className="border p-2 rounded" value={newHandoff.target_agent} onChange={e => setNewHandoff({ ...newHandoff, target_agent: e.target.value })}>
              <option value="">target</option>
              {agentNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <input placeholder="on_handoff_callback (optional)" className="border p-2 rounded" value={newHandoff.on_handoff_callback} onChange={e => setNewHandoff({ ...newHandoff, on_handoff_callback: e.target.value })} />
          </div>
          <div className="mt-2">
            <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" disabled={!newHandoff.source_agent || !newHandoff.target_agent} onClick={async () => { setBusy(true); try { await createHandoff({ ...newHandoff, on_handoff_callback: newHandoff.on_handoff_callback || null }); await refresh(); } finally { setBusy(false); } }}>Create</button>
          </div>
        </div>
      </section>
    </main>
  );
}


