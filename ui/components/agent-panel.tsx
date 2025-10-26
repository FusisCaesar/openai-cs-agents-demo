"use client";

import { Bot } from "lucide-react";
import type { Agent, AgentEvent, GuardrailCheck } from "@/lib/types";
import { AgentsList } from "./agents-list";
import { Guardrails } from "./guardrails";
import { ConversationContext } from "./conversation-context";
import { RunnerOutput } from "./runner-output";
import { HandoffsFlow } from "./handoffs-flow";

interface AgentPanelProps {
  agents: Agent[];
  currentAgent: string;
  events: AgentEvent[];
  guardrails: GuardrailCheck[];
  context: {
    passenger_name?: string;
    confirmation_number?: string;
    seat_number?: string;
    flight_number?: string;
    account_number?: string;
  };
  triageOptions?: string[];
  triageName?: string | null;
  onChangeTriage?: (name: string) => void;
}

export function AgentPanel({
  agents,
  currentAgent,
  events,
  guardrails,
  context,
  triageOptions = [],
  triageName,
  onChangeTriage,
}: AgentPanelProps) {
  const activeAgent = agents.find((a) => a.name === currentAgent);
  const runnerEvents = events.filter((e) => e.type !== "message");

  return (
    <div className="w-3/5 h-full flex flex-col border-r border-gray-200 bg-white rounded-xl shadow-sm">
      <div className="bg-blue-600 text-white h-12 px-4 flex items-center gap-3 shadow-sm rounded-t-xl">
        <Bot className="h-5 w-5" />
        <h1 className="font-semibold text-sm sm:text-base lg:text-lg">Agent View</h1>
        {/* Triage selector */}
        {onChangeTriage && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs opacity-80">Triage</span>
            <select
              className="text-xs bg-white/10 hover:bg-white/20 border border-white/30 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-white/40"
              value={triageName ?? ""}
              onChange={(e) => onChangeTriage(e.target.value)}
            >
              {(triageOptions.length ? triageOptions : ["Triage Agent"]).map((t) => (
                <option key={t} value={t} className="text-black">{t}</option>
              ))}
            </select>
          </div>
        )}
        <a href="/admin" className="ml-3 text-xs underline hover:opacity-80">Admin</a>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
        <AgentsList agents={agents} currentAgent={currentAgent} />
        <HandoffsFlow agents={agents} />
        <Guardrails
          guardrails={guardrails}
          inputGuardrails={activeAgent?.input_guardrails ?? []}
        />
        <ConversationContext context={context} />
        <RunnerOutput runnerEvents={runnerEvents} />
      </div>
    </div>
  );
}