"use client";

import { useEffect, useMemo, useState } from "react";
import { getAdminState } from "@/lib/adminApi";
import { AgentPanel } from "@/components/agent-panel";
import { Chat } from "@/components/chat";
import type { Agent, AgentEvent, GuardrailCheck, Message } from "@/lib/types";
import { callChatAPI } from "@/lib/api";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string>("");
  const [guardrails, setGuardrails] = useState<GuardrailCheck[]>([]);
  const [context, setContext] = useState<Record<string, any>>({});
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [triageName, setTriageName] = useState<string | null>(null);
  const [triageOptions, setTriageOptions] = useState<string[]>([]);
  // Loading state while awaiting assistant response
  const [isLoading, setIsLoading] = useState(false);

  // Boot the conversation
  useEffect(() => {
    (async () => {
      try {
        const st = await getAdminState();
        setTriageOptions(st.triage_agents || []);
        if (!triageName) {
          setTriageName((st.triage_agents && st.triage_agents[0]) || "Triage Agent");
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const data = await callChatAPI("", conversationId ?? "", triageName ?? undefined);
      setConversationId(data.conversation_id);
      setCurrentAgent(data.current_agent);
      setContext(data.context);
      const initialEvents = (data.events || []).map((e: any) => ({
        ...e,
        timestamp: e.timestamp ?? Date.now(),
      }));
      setEvents(initialEvents);
      setAgents(data.agents || []);
      setGuardrails(data.guardrails || []);
      if (Array.isArray(data.messages)) {
        setMessages(
          data.messages.map((m: any) => ({
            id: Date.now().toString() + Math.random().toString(),
            content: m.content,
            role: "assistant",
            agent: m.agent,
            timestamp: new Date(),
          }))
        );
      }
    })();
  }, [triageName]);

  // Send a user message
  const handleSendMessage = async (content: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const data = await callChatAPI(content, conversationId ?? "", triageName ?? undefined);

    if (!conversationId) setConversationId(data.conversation_id);
    setCurrentAgent(data.current_agent);
    setContext(data.context);
    if (data.events) {
      const stamped = data.events.map((e: any) => ({
        ...e,
        timestamp: e.timestamp ?? Date.now(),
      }));
      setEvents((prev) => [...prev, ...stamped]);
    }
    if (data.agents) setAgents(data.agents);
    // Update guardrails state
    if (data.guardrails) setGuardrails(data.guardrails);

    if (data.messages) {
      const responses: Message[] = data.messages.map((m: any) => ({
        id: Date.now().toString() + Math.random().toString(),
        content: m.content,
        role: "assistant",
        agent: m.agent,
        timestamp: new Date(),
      }));
      setMessages((prev) => [...prev, ...responses]);
    }

    setIsLoading(false);
  };

  const filteredAgents = useMemo(() => {
    if (!agents || agents.length === 0) return agents;
    const start = triageName || "Triage Agent";
    const nameToAgent: Record<string, Agent> = Object.fromEntries(
      agents.map((a) => [a.name, a])
    );
    if (!nameToAgent[start]) return agents;
    const visited = new Set<string>();
    const queue: string[] = [start];
    while (queue.length) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      const a = nameToAgent[curr];
      const next = (a?.handoffs || []) as string[];
      for (const n of next) if (!visited.has(n)) queue.push(n);
    }
    const reachable = agents.filter((a) => visited.has(a.name));
    // Ensure triage agent is first
    const tri = reachable.find((a) => a.name === start);
    const rest = reachable.filter((a) => a.name !== start);
    return tri ? [ { ...tri, is_triage: true }, ...rest ] : reachable;
  }, [agents, triageName]);

  return (
    <main className="flex h-screen gap-2 bg-gray-100 p-2">
      {/* Triage selector moved into AgentPanel header for better UX */}
      {/* Simple triage selector (temporary) */}
      {/* In a full implementation, fetch triage options from /admin/state */}
      <AgentPanel
        agents={filteredAgents}
        currentAgent={currentAgent}
        events={events}
        guardrails={guardrails}
        context={context}
        triageOptions={triageOptions}
        triageName={triageName}
        onChangeTriage={(name) => {
          setConversationId(null);
          setMessages([]);
          setEvents([]);
          setTriageName(name || null);
        }}
      />
      <Chat
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
    </main>
  );
}
