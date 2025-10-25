"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getAdminState,
  reloadRegistry,
  getContextDefaults,
  updateContextDefaults,
  createAgent,
  updateAgent,
  deleteAgent,
  createTool,
  updateTool,
  deleteTool,
  createGuardrail,
  updateGuardrail,
  deleteGuardrail,
  attachTool,
  detachTool,
  attachGuardrail,
  detachGuardrail,
  createHandoff,
  updateHandoff,
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
  const [activeTab, setActiveTab] = useState<"agents" | "tools" | "guardrails">("agents");

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

  // Build quick lookups for attachments
  const toolsByAgent = useMemo(() => {
    const map: Record<string, { tool_name: string; sort_order: number }[]> = {};
    for (const at of state?.agent_tools || []) {
      if (!map[at.agent]) map[at.agent] = [];
      map[at.agent].push({ tool_name: at.tool_name, sort_order: at.sort_order });
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.sort_order - b.sort_order || a.tool_name.localeCompare(b.tool_name));
    }
    return map;
  }, [state]);

  const guardrailsByAgent = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const ag of state?.agent_guardrails || []) {
      if (!map[ag.agent]) map[ag.agent] = [];
      map[ag.agent].push(ag.guardrail_name);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.localeCompare(b));
    }
    return map;
  }, [state]);

  // Build quick lookups for handoffs (outgoing and incoming)
  const handoffsOutByAgent = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const h of state?.handoffs || []) {
      if (!map[h.source]) map[h.source] = [];
      map[h.source].push(h.target);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.localeCompare(b));
    return map;
  }, [state]);

  const handoffsInByAgent = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const h of state?.handoffs || []) {
      if (!map[h.target]) map[h.target] = [];
      map[h.target].push(h.source);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.localeCompare(b));
    return map;
  }, [state]);

  async function onReload() {
    setBusy(true);
    try {
      await reloadRegistry();
    } finally {
      setBusy(false);
    }
  }

  // Simple forms state
  const [newAgent, setNewAgent] = useState({ name: "", model: "gpt-4.1", handoff_description: "", instruction_type: "provider", instruction_value: "triage", is_triage: false });
  const [newTool, setNewTool] = useState({ name: "", code_name: "", description: "" });
  const [newGuardrail, setNewGuardrail] = useState({ name: "", code_name: "" });
  const [linkTool, setLinkTool] = useState({ agent_name: "", tool_name: "", sort_order: 0 });
  const [linkGuard, setLinkGuard] = useState({ agent_name: "", guardrail_name: "" });
  const [newHandoff, setNewHandoff] = useState({ source_agent: "", target_agent: "", on_handoff_callback: "" });

  // Edit states
  const [editingAgent, setEditingAgent] = useState<null | { name: string; model: string; handoff_description: string; instruction_type: string; instruction_value: string }>(null);
  const [editingTool, setEditingTool] = useState<null | { name: string; code_name: string; description: string }>(null);
  const [editingGuardrail, setEditingGuardrail] = useState<null | { name: string; model: string; instruction_value: string }>(null);
  const [editingHandoff, setEditingHandoff] = useState<null | { source_agent: string; target_agent: string; on_handoff_callback: string }>(null);

  // Modal visibility
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [showCreateHandoff, setShowCreateHandoff] = useState(false);
  const [showCreateTool, setShowCreateTool] = useState(false);
  const [showCreateGuardrail, setShowCreateGuardrail] = useState(false);

  // Per-agent attach modals
  const [attachToolForAgent, setAttachToolForAgent] = useState<string | null>(null);
  const [attachToolForm, setAttachToolForm] = useState<{ tool_name: string; sort_order: number }>({ tool_name: "", sort_order: 0 });
  const [attachGuardForAgent, setAttachGuardForAgent] = useState<string | null>(null);
  const [attachGuardForm, setAttachGuardForm] = useState<{ guardrail_name: string }>({ guardrail_name: "" });
  const [editToolOrder, setEditToolOrder] = useState<null | { agent_name: string; tool_name: string; sort_order: number }>(null);

  // Context editor state
  const [showContextName, setShowContextName] = useState<string | null>(null); // "__global__" or triage agent name
  const [kvFields, setKvFields] = useState<Array<{ key: string; value: string }>>([]);

  if (loading) return <div className="p-6">Loading admin...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white h-12 px-4 flex items-center gap-3 shadow-sm sticky top-0 z-40">
        <span className="font-semibold text-sm sm:text-base lg:text-lg">Admin</span>
        <a href="/" className="text-xs underline hover:opacity-80">Home</a>
        <div className="ml-auto flex items-center gap-2">
          <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/30" onClick={refresh} disabled={busy}>Refresh</button>
          <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/30" onClick={onReload} disabled={busy}>Reload Registry</button>
          <button className="px-3 py-1 rounded bg-white text-blue-600" onClick={async () => {
            setBusy(true);
            try {
              const triage = "__global__";
              const r = await getContextDefaults(triage);
              const raw = r && r.defaults;
              let d: any = {};
              if (raw && typeof raw === "string") {
                try { d = JSON.parse(raw); } catch { d = {}; }
              } else if (raw && typeof raw === "object") {
                d = raw;
              }
              try {
                const keys = Object.keys(d || {});
                const known = new Set(["passenger_name","confirmation_number","seat_number","flight_number","account_number","ticket_number"]);
                const other = keys.filter((k) => !known.has(k));
                if (other.length > 0 && other.every((k) => /^\d+$/.test(k))) {
                  const text = other.sort((a,b)=>Number(a)-Number(b)).map((k) => String(d[k])).join("");
                  const parsed = JSON.parse(text);
                  d = parsed && typeof parsed === "object" ? parsed : {};
                }
              } catch {}
              const kv: Array<{ key: string; value: string }> = Object.entries(d as Record<string, any>)
                .map(([k, v]) => ({ key: k, value: typeof v === "string" ? v : JSON.stringify(v) }));
              setKvFields(kv);
              setShowContextName(triage);
            } finally { setBusy(false); }
          }}>Context</button>
        </div>
      </div>

      <div className="p-4 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Admin</h1>
        <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" onClick={refresh} disabled={busy}>Refresh</button>
        <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:bg-gray-300" onClick={onReload} disabled={busy}>Reload Registry</button>
        <button className="ml-auto px-3 py-1 rounded border" onClick={async () => {
          setBusy(true);
          try {
            const triage = "__global__";
            const r = await getContextDefaults(triage);
            const raw = r && r.defaults;
            let d: any = {};
            if (raw && typeof raw === "string") {
              try { d = JSON.parse(raw); } catch { d = {}; }
            } else if (raw && typeof raw === "object") {
              d = raw;
            }
            // Sanitize case where a previous bad save stored the JSON as index->char map
            try {
              const keys = Object.keys(d || {});
              const known = new Set(["passenger_name","confirmation_number","seat_number","flight_number","account_number","ticket_number"]);
              const other = keys.filter((k) => !known.has(k));
              if (other.length > 0 && other.every((k) => /^\d+$/.test(k))) {
                const text = other.sort((a,b)=>Number(a)-Number(b)).map((k) => String(d[k])).join("");
                const parsed = JSON.parse(text);
                d = parsed && typeof parsed === "object" ? parsed : {};
              }
            } catch {}
            const kv: Array<{ key: string; value: string }> = Object.entries(d as Record<string, any>)
              .map(([k, v]) => ({ key: k, value: typeof v === "string" ? v : JSON.stringify(v) }));
            setKvFields(kv);
            setShowContextName(triage);
          } finally {
            setBusy(false);
          }
        }}>Context</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          className={`px-3 py-1.5 rounded-t ${activeTab === "agents" ? "bg-black text-white" : "bg-white text-zinc-700 border border-b-0"}`}
          onClick={() => setActiveTab("agents")}
        >
          Agents
        </button>
        <button
          className={`px-3 py-1.5 rounded-t ${activeTab === "tools" ? "bg-black text-white" : "bg-white text-zinc-700 border border-b-0"}`}
          onClick={() => setActiveTab("tools")}
        >
          Tools
        </button>
        <button
          className={`px-3 py-1.5 rounded-t ${activeTab === "guardrails" ? "bg-black text-white" : "bg-white text-zinc-700 border border-b-0"}`}
          onClick={() => setActiveTab("guardrails")}
        >
          Guardrails
        </button>
      </div>

      {activeTab === "agents" && (
        <section className="space-y-6">
      {/* Agents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Agents</h2>
              <button className="px-3 py-1 rounded bg-black text-white" onClick={() => setShowCreateAgent(true)}>New Agent</button>
            </div>
        <div className="grid grid-cols-3 gap-3">
          {state?.agents?.map((a) => (
            <div key={a.id} className="border rounded p-3 bg-white">
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-zinc-600">{a.model}</div>
              <div className="text-xs text-zinc-500 mt-1">{a.handoff_description}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={!!a.is_triage} onChange={async (e) => {
                        setBusy(true);
                        try { await updateAgent(a.name, { is_triage: e.target.checked }); await refresh(); } finally { setBusy(false); }
                      }} />
                      Triage
                    </label>
                    {a.is_triage && (
                      <button className="px-2 py-0.5 border rounded" onClick={async () => {
                        setBusy(true);
                        try {
                          const r = await getContextDefaults(a.name);
                          const raw = r && r.defaults;
                          let d: any = {};
                          if (raw && typeof raw === "string") { try { d = JSON.parse(raw); } catch { d = {}; } } else if (raw && typeof raw === "object") { d = raw; }
                          const kv: Array<{ key: string; value: string }> = Object.entries(d as Record<string, any>).map(([k,v]) => ({ key:k, value: typeof v === "string" ? v : JSON.stringify(v) }));
                          setKvFields(kv);
                          setShowContextName(a.name);
                        } finally { setBusy(false); }
                      }}>Context</button>
                    )}
                  </div>
                  {/* Handoffs overview */}
                  <div className="mt-3">
                    <div className="text-xs font-medium text-zinc-700 mb-1">Handoffs</div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-zinc-500">Out</span>
                        {(handoffsOutByAgent[a.name] || []).map((t) => (
                          <Badge key={`out-${a.name}-${t}`} variant="secondary" className="gap-1">
                            <span>{a.name} → {t}</span>
                            <button className="ml-0.5 text-blue-700 hover:text-blue-900" onClick={() => setEditingHandoff({ source_agent: a.name, target_agent: t, on_handoff_callback: (state?.handoffs || []).find(h => h.source === a.name && h.target === t)?.on_handoff_callback || "" })}>✎</button>
                            <button className="ml-0.5 text-red-600 hover:text-red-700" onClick={async () => { setBusy(true); try { await deleteHandoff(a.name, t); await refresh(); } finally { setBusy(false); } }}>✕</button>
                          </Badge>
                        ))}
                        <button className="text-xs px-2 py-0.5 border rounded bg-white" onClick={() => { setShowCreateHandoff(true); setNewHandoff({ source_agent: a.name, target_agent: "", on_handoff_callback: "" }); }}>Add</button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-zinc-500">In</span>
                        {(handoffsInByAgent[a.name] || []).map((s) => (
                          <Badge key={`in-${s}-${a.name}`} variant="outline" className="gap-1">
                            <span>{s} → {a.name}</span>
                            <button className="ml-0.5 text-blue-700 hover:text-blue-900" onClick={() => setEditingHandoff({ source_agent: s, target_agent: a.name, on_handoff_callback: (state?.handoffs || []).find(h => h.source === s && h.target === a.name)?.on_handoff_callback || "" })}>✎</button>
                            <button className="ml-0.5 text-red-600 hover:text-red-700" onClick={async () => { setBusy(true); try { await deleteHandoff(s, a.name); await refresh(); } finally { setBusy(false); } }}>✕</button>
                          </Badge>
                        ))}
                        <button className="text-xs px-2 py-0.5 border rounded bg-white" onClick={() => { setShowCreateHandoff(true); setNewHandoff({ source_agent: "", target_agent: a.name, on_handoff_callback: "" }); }}>Add</button>
                      </div>
                    </div>
                  </div>
                  {/* Attached Tools */}
                  <div className="mt-3">
                    <div className="text-xs font-medium text-zinc-700 mb-1">Tools</div>
                    <div className="flex flex-wrap gap-1">
                      {(toolsByAgent[a.name] || []).map((t) => (
                        <Badge key={t.tool_name} variant="secondary" className="gap-1">
                          <span>{t.tool_name}</span>
                          <span className="opacity-70">#{t.sort_order}</span>
                          <button className="ml-1 text-blue-700 hover:text-blue-900" onClick={() => setEditToolOrder({ agent_name: a.name, tool_name: t.tool_name, sort_order: t.sort_order })}>✎</button>
                          <button className="ml-0.5 text-red-600 hover:text-red-700" onClick={async () => { setBusy(true); try { await detachTool(a.name, t.tool_name); await refresh(); } finally { setBusy(false); } }}>✕</button>
                        </Badge>
                      ))}
                      <button className="text-xs px-2 py-0.5 border rounded bg-white" onClick={() => { setAttachToolForAgent(a.name); setAttachToolForm({ tool_name: "", sort_order: ((toolsByAgent[a.name]?.[toolsByAgent[a.name].length - 1]?.sort_order ?? -1) + 1) }); }}>Attach</button>
                    </div>
                  </div>
                  {/* Attached Guardrails */}
                  <div className="mt-3">
                    <div className="text-xs font-medium text-zinc-700 mb-1">Guardrails</div>
                    <div className="flex flex-wrap gap-1">
                      {(guardrailsByAgent[a.name] || []).map((g) => (
                        <Badge key={g} variant="outline" className="gap-1">
                          <span>{g}</span>
                          <button className="ml-0.5 text-red-600 hover:text-red-700" onClick={async () => { setBusy(true); try { await detachGuardrail(a.name, g); await refresh(); } finally { setBusy(false); } }}>✕</button>
                        </Badge>
                      ))}
                      <button className="text-xs px-2 py-0.5 border rounded bg-white" onClick={() => { setAttachGuardForAgent(a.name); setAttachGuardForm({ guardrail_name: "" }); }}>Attach</button>
                    </div>
                  </div>
              <div className="mt-2 flex gap-2">
                    <button className="text-xs px-2 py-1 bg-zinc-800 text-white rounded" onClick={() => setEditingAgent({ name: a.name, model: a.model, handoff_description: a.handoff_description || "", instruction_type: a.instruction_type, instruction_value: a.instruction_value })}>Edit</button>
                <button className="text-xs px-2 py-1 bg-red-600 text-white rounded" onClick={async () => { setBusy(true); try { await deleteAgent(a.name); await refresh(); } finally { setBusy(false); } }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
            {/* Agent Create/Edit Modals are rendered below */}
          </div>

          {/* Handoffs (combined with Agents tab) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Handoffs</h2>
              <button className="px-3 py-1 rounded bg-black text-white" onClick={() => setShowCreateHandoff(true)}>New Handoff</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {state?.handoffs?.map((h) => (
                <div key={`${h.source}-${h.target}`} className="border rounded p-3 bg-white">
                  <div className="font-medium">{h.source} → {h.target}</div>
                  {h.on_handoff_callback && (
                    <div className="text-xs text-zinc-600">callback: {h.on_handoff_callback}</div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button className="text-xs px-2 py-1 bg-zinc-800 text-white rounded" onClick={() => setEditingHandoff({ source_agent: h.source, target_agent: h.target, on_handoff_callback: h.on_handoff_callback || "" })}>Edit</button>
                    <button className="text-xs px-2 py-1 bg-red-600 text-white rounded" onClick={async () => { setBusy(true); try { await deleteHandoff(h.source, h.target); await refresh(); } finally { setBusy(false); } }}>Delete</button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>
      )}

      {activeTab === "tools" && (
        <section className="space-y-6">
      {/* Tools */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Tools</h2>
              <button className="px-3 py-1 rounded bg-black text-white" onClick={() => setShowCreateTool(true)}>New Tool</button>
            </div>
        <div className="grid grid-cols-3 gap-3">
          {state?.tools?.map((t) => (
            <div key={t.name} className="border rounded p-3 bg-white">
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-zinc-600">code: {t.code_name}</div>
              <div className="mt-2 flex gap-2">
                    <button className="text-xs px-2 py-1 bg-zinc-800 text-white rounded" onClick={() => setEditingTool({ name: t.name, code_name: t.code_name, description: t.description || "" })}>Edit</button>
                <button className="text-xs px-2 py-1 bg-red-600 text-white rounded" onClick={async () => { setBusy(true); try { await deleteTool(t.name); await refresh(); } finally { setBusy(false); } }}>Delete</button>
              </div>
            </div>
          ))}
        </div>

            {/* Tool create/edit will use modal below */}
          </div>

          {/* Attach Tool (moved under Tools tab) */}
          <div className="space-y-3">
            <h2 className="text-lg font-medium">Attach Tool to Agent</h2>
          <div className="border rounded p-3 bg-white">
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
          </div>
        </section>
      )}

      {activeTab === "guardrails" && (
        <section className="space-y-6">
          {/* Guardrails */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Guardrails</h2>
              <button className="px-3 py-1 rounded bg-black text-white" onClick={() => setShowCreateGuardrail(true)}>New Guardrail</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {state?.guardrails?.map((g) => (
                <div key={g.name} className="border rounded p-3 bg-white">
                  <div className="font-medium">{g.name}</div>
                  <div className="text-xs text-zinc-600">code: {g.code_name}</div>
                  <div className="mt-2 flex gap-2">
                    <button className="text-xs px-2 py-1 bg-zinc-800 text-white rounded" onClick={() => setEditingGuardrail({ name: g.name, model: g.model || "", instruction_value: g.instruction_value || "" })}>Edit</button>
                    <button className="text-xs px-2 py-1 bg-red-600 text-white rounded" onClick={async () => { setBusy(true); try { await deleteGuardrail(g.name); await refresh(); } finally { setBusy(false); } }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Guardrail create/edit will use modal below */}
          </div>

          {/* Attach Guardrail (moved under Guardrails tab) */}
          <div className="space-y-3">
            <h2 className="text-lg font-medium">Attach Guardrail to Agent</h2>
          <div className="border rounded p-3 bg-white">
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
      )}

      {/* Modals */}
      {showContextName && (
        <Dialog open onOpenChange={(o) => !o && setShowContextName(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit Context Defaults {showContextName !== "__global__" ? `(Triage: ${showContextName})` : "(Global)"}</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Fields</h4>
                <button className="text-xs px-2 py-1 border rounded" onClick={() => setKvFields([...kvFields, { key: "", value: "" }])}>Add field</button>
              </div>
              <div className="space-y-2">
                {kvFields.map((f, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2">
                    <input className="col-span-2 border rounded p-2" placeholder="key" value={f.key} onChange={e => {
                      const arr = [...kvFields]; arr[idx] = { ...arr[idx], key: e.target.value }; setKvFields(arr);
                    }} />
                    <input className="col-span-3 border rounded p-2" placeholder="value" value={f.value} onChange={e => {
                      const arr = [...kvFields]; arr[idx] = { ...arr[idx], value: e.target.value }; setKvFields(arr);
                    }} />
                    <div className="col-span-5 text-right">
                      <button className="text-xs text-red-600" onClick={() => { const arr = [...kvFields]; arr.splice(idx, 1); setKvFields(arr); }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
            </div>
            <DialogFooter>
              <button className="px-3 py-1 rounded border" onClick={() => { setKvFields([]); }}>Clear all</button>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setShowContextName(null)}>Close</button>
              <button className="px-3 py-1 rounded bg-black text-white" onClick={async () => {
                setBusy(true);
                try {
                  const out: any = {};
                  for (const f of kvFields) {
                    if (!f.key) continue;
                    // Try to parse primitives/JSON values
                    const v = f.value;
                    let parsed: any = v;
                    if (v === "true" || v === "false") parsed = v === "true";
                    else if (v !== "" && !isNaN(Number(v))) parsed = Number(v);
                    else {
                      try { parsed = JSON.parse(v); } catch { parsed = v; }
                    }
                    out[f.key] = parsed;
                  }
                  await updateContextDefaults(Object.keys(out).length ? out : {}, showContextName || undefined);
                  setShowContextName(null);
                } finally { setBusy(false); }
              }}>Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {showCreateAgent && (
        <Dialog open onOpenChange={(o) => !o && setShowCreateAgent(false)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create Agent</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="name" className="border p-2 rounded" value={newAgent.name} onChange={e => setNewAgent({ ...newAgent, name: e.target.value })} />
              <input placeholder="model" className="border p-2 rounded" value={newAgent.model} onChange={e => setNewAgent({ ...newAgent, model: e.target.value })} />
              <input placeholder="handoff_description" className="border p-2 rounded col-span-2" value={newAgent.handoff_description} onChange={e => setNewAgent({ ...newAgent, handoff_description: e.target.value })} />
              <select className="border p-2 rounded" value={newAgent.instruction_type} onChange={e => setNewAgent({ ...newAgent, instruction_type: e.target.value })}>
                <option value="provider">provider</option>
                <option value="text">text</option>
              </select>
              <textarea placeholder="instruction_value" className="border p-2 rounded col-span-2 min-h-[220px]" value={newAgent.instruction_value} onChange={e => setNewAgent({ ...newAgent, instruction_value: e.target.value })} />
            </div>
            <DialogFooter>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setShowCreateAgent(false)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" disabled={!newAgent.name} onClick={async () => { setBusy(true); try { await createAgent(newAgent); await refresh(); setShowCreateAgent(false); } finally { setBusy(false); } }}>Create</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editingAgent && (
        <Dialog open onOpenChange={(o) => !o && setEditingAgent(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Edit Agent — {editingAgent.name}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              <input disabled className="border p-2 rounded opacity-60" value={editingAgent.name} />
              <input placeholder="model" className="border p-2 rounded" value={editingAgent.model} onChange={e => setEditingAgent({ ...editingAgent, model: e.target.value })} />
              <input placeholder="handoff_description" className="border p-2 rounded col-span-2" value={editingAgent.handoff_description} onChange={e => setEditingAgent({ ...editingAgent, handoff_description: e.target.value })} />
              <select className="border p-2 rounded" value={editingAgent.instruction_type} onChange={e => setEditingAgent({ ...editingAgent, instruction_type: e.target.value })}>
                <option value="provider">provider</option>
                <option value="text">text</option>
              </select>
              <textarea placeholder="instruction_value" className="border p-2 rounded col-span-2 min-h-[220px]" value={editingAgent.instruction_value} onChange={e => setEditingAgent({ ...editingAgent, instruction_value: e.target.value })} />
              </div>
            <DialogFooter>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setEditingAgent(null)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" onClick={async () => { if (!editingAgent) return; setBusy(true); try { await updateAgent(editingAgent.name, { model: editingAgent.model, handoff_description: editingAgent.handoff_description, instruction_type: editingAgent.instruction_type, instruction_value: editingAgent.instruction_value }); await refresh(); setEditingAgent(null); } finally { setBusy(false); } }}>Update</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showCreateHandoff && (
        <Dialog open onOpenChange={(o) => !o && setShowCreateHandoff(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Handoff</DialogTitle>
            </DialogHeader>
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
            <DialogFooter>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setShowCreateHandoff(false)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" disabled={!newHandoff.source_agent || !newHandoff.target_agent} onClick={async () => { setBusy(true); try { await createHandoff({ ...newHandoff, on_handoff_callback: newHandoff.on_handoff_callback || null }); await refresh(); setShowCreateHandoff(false); } finally { setBusy(false); } }}>Create</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editingHandoff && (
        <Dialog open onOpenChange={(o) => !o && setEditingHandoff(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Handoff</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-2">
              <input disabled className="border p-2 rounded opacity-60" value={editingHandoff.source_agent} />
              <input disabled className="border p-2 rounded opacity-60" value={editingHandoff.target_agent} />
              <input placeholder="on_handoff_callback (optional)" className="border p-2 rounded" value={editingHandoff.on_handoff_callback} onChange={e => setEditingHandoff({ ...editingHandoff, on_handoff_callback: e.target.value })} />
            </div>
            <DialogFooter>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setEditingHandoff(null)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-black text-white" onClick={async () => { if (!editingHandoff) return; setBusy(true); try { await updateHandoff({ ...editingHandoff, on_handoff_callback: editingHandoff.on_handoff_callback || null }); await refresh(); setEditingHandoff(null); } finally { setBusy(false); } }}>Update</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Tools Modals */}
      {showCreateTool && (
        <Dialog open onOpenChange={(o) => !o && setShowCreateTool(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Tool</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-2">
              <input placeholder="name" className="border p-2 rounded" value={newTool.name} onChange={e => setNewTool({ ...newTool, name: e.target.value })} />
              <input placeholder="code_name" className="border p-2 rounded" value={newTool.code_name} onChange={e => setNewTool({ ...newTool, code_name: e.target.value })} />
              <input placeholder="description" className="border p-2 rounded" value={newTool.description} onChange={e => setNewTool({ ...newTool, description: e.target.value })} />
            </div>
            <DialogFooter>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setShowCreateTool(false)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" disabled={!newTool.name || !newTool.code_name} onClick={async () => { setBusy(true); try { await createTool(newTool); await refresh(); setShowCreateTool(false); } finally { setBusy(false); } }}>Create</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editingTool && (
        <Dialog open onOpenChange={(o) => !o && setEditingTool(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tool — {editingTool.name}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-2">
              <input disabled className="border p-2 rounded opacity-60" value={editingTool.name} />
              <input placeholder="code_name" className="border p-2 rounded" value={editingTool.code_name} onChange={e => setEditingTool({ ...editingTool, code_name: e.target.value })} />
              <input placeholder="description" className="border p-2 rounded" value={editingTool.description} onChange={e => setEditingTool({ ...editingTool, description: e.target.value })} />
            </div>
            <DialogFooter>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setEditingTool(null)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-black text-white" onClick={async () => { if (!editingTool) return; setBusy(true); try { await updateTool(editingTool.name, { code_name: editingTool.code_name, description: editingTool.description }); await refresh(); setEditingTool(null); } finally { setBusy(false); } }}>Update</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Guardrails Modals */}
      {showCreateGuardrail && (
        <Dialog open onOpenChange={(o) => !o && setShowCreateGuardrail(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Guardrail</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="name" className="border p-2 rounded" value={newGuardrail.name} onChange={e => setNewGuardrail({ ...newGuardrail, name: e.target.value })} />
              <input placeholder="code_name" className="border p-2 rounded" value={newGuardrail.code_name} onChange={e => setNewGuardrail({ ...newGuardrail, code_name: e.target.value })} />
            </div>
            <DialogFooter>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setShowCreateGuardrail(false)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" disabled={!newGuardrail.name || !newGuardrail.code_name} onClick={async () => { setBusy(true); try { await createGuardrail(newGuardrail); await refresh(); setShowCreateGuardrail(false); } finally { setBusy(false); } }}>Create</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editingGuardrail && (
        <Dialog open onOpenChange={(o) => !o && setEditingGuardrail(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit Guardrail — {editingGuardrail.name}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              <input disabled className="border p-2 rounded opacity-60" value={editingGuardrail.name} />
              <input placeholder="model" className="border p-2 rounded" value={editingGuardrail.model} onChange={e => setEditingGuardrail({ ...editingGuardrail, model: e.target.value })} />
              <textarea placeholder="instruction_value" className="border p-2 rounded col-span-2 min-h-[220px]" value={editingGuardrail.instruction_value} onChange={e => setEditingGuardrail({ ...editingGuardrail, instruction_value: e.target.value })} />
            </div>
            <DialogFooter>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setEditingGuardrail(null)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-black text-white" onClick={async () => { if (!editingGuardrail) return; setBusy(true); try { await updateGuardrail(editingGuardrail.name, { model: editingGuardrail.model, instruction_value: editingGuardrail.instruction_value }); await refresh(); setEditingGuardrail(null); } finally { setBusy(false); } }}>Update</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Attach Tool to Agent Modal */}
      {attachToolForAgent && (
        <Dialog open onOpenChange={(o) => !o && setAttachToolForAgent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Attach Tool — {attachToolForAgent}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-2">
              <select className="border p-2 rounded col-span-2" value={attachToolForm.tool_name} onChange={e => setAttachToolForm({ ...attachToolForm, tool_name: e.target.value })}>
                <option value="">tool</option>
                {toolNames
                  .filter((n) => !(toolsByAgent[attachToolForAgent]?.some((t) => t.tool_name === n)))
                  .map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input type="number" className="border p-2 rounded" value={attachToolForm.sort_order} onChange={e => setAttachToolForm({ ...attachToolForm, sort_order: Number(e.target.value) })} />
            </div>
            <DialogFooter>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setAttachToolForAgent(null)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" disabled={!attachToolForm.tool_name} onClick={async () => { if (!attachToolForAgent) return; setBusy(true); try { await attachTool({ agent_name: attachToolForAgent, tool_name: attachToolForm.tool_name, sort_order: attachToolForm.sort_order }); await refresh(); setAttachToolForAgent(null); } finally { setBusy(false); } }}>Attach</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Tool Sort Order Modal */}
      {editToolOrder && (
        <Dialog open onOpenChange={(o) => !o && setEditToolOrder(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Sort — {editToolOrder.tool_name} ({editToolOrder.agent_name})</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-2">
              <input type="number" className="border p-2 rounded" value={editToolOrder.sort_order} onChange={e => setEditToolOrder({ ...editToolOrder, sort_order: Number(e.target.value) })} />
          </div>
            <DialogFooter>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setEditToolOrder(null)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-black text-white" onClick={async () => { if (!editToolOrder) return; setBusy(true); try { await attachTool({ agent_name: editToolOrder.agent_name, tool_name: editToolOrder.tool_name, sort_order: editToolOrder.sort_order }); await refresh(); setEditToolOrder(null); } finally { setBusy(false); } }}>Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Attach Guardrail to Agent Modal */}
      {attachGuardForAgent && (
        <Dialog open onOpenChange={(o) => !o && setAttachGuardForAgent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Attach Guardrail — {attachGuardForAgent}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-2">
              <select className="border p-2 rounded" value={attachGuardForm.guardrail_name} onChange={e => setAttachGuardForm({ guardrail_name: e.target.value })}>
                <option value="">guardrail</option>
                {guardrailNames
                  .filter((n) => !(guardrailsByAgent[attachGuardForAgent]?.includes(n)))
                  .map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
        </div>
            <DialogFooter>
              <button className="px-3 py-1 rounded bg-gray-200" onClick={() => setAttachGuardForAgent(null)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-black text-white disabled:bg-gray-300" disabled={!attachGuardForm.guardrail_name} onClick={async () => { if (!attachGuardForAgent) return; setBusy(true); try { await attachGuardrail({ agent_name: attachGuardForAgent, guardrail_name: attachGuardForm.guardrail_name }); await refresh(); setAttachGuardForAgent(null); } finally { setBusy(false); } }}>Attach</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </main>
  );
}


