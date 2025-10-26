"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Crown } from "lucide-react";
import { PanelSection } from "./panel-section";
import type { Agent } from "@/lib/types";

interface AgentsListProps {
  agents: Agent[];
  currentAgent: string;
}

export function AgentsList({ agents, currentAgent }: AgentsListProps) {
  const activeAgent = agents.find((a) => a.name === currentAgent);
  return (
    <PanelSection
      title="Available Agents"
      icon={<Bot className="h-4 w-4 text-blue-600" />}
    >
      <div className="grid grid-cols-3 gap-3">
        {agents.map((agent) => (
          <Card
            key={agent.name}
            className={`bg-white border-gray-200 transition-all ${
              agent.name === currentAgent ||
              activeAgent?.handoffs.includes(agent.name)
                ? ""
                : "opacity-50 filter grayscale cursor-not-allowed pointer-events-none"
            } ${
              agent.name === currentAgent ? "ring-1 ring-blue-500 shadow-md" : ""
            }`}
          >
              <CardHeader className="p-3 pb-1">
              <CardTitle className="text-sm flex items-center text-zinc-900 gap-1">
                {agent.is_triage && (
                  <span title="Triage (master)"><Crown className="h-4 w-4 text-amber-500" /></span>
                )}
                {agent.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <p className="text-xs font-light text-zinc-500">
                {agent.description}
              </p>
                {/* Tools and agent-backed indicators */}
                {Array.isArray(agent.tools) && agent.tools.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {agent.tools.map((t, idx) => {
                      const tn = typeof t === "string" ? t : t?.name;
                      const ref = typeof t === "string" ? undefined : t?.agent_ref;
                      return (
                        <Badge key={`${tn}-${idx}`} variant="secondary" className="gap-1">
                          <span>{tn}</span>
                          {ref ? (
                            <span className="ml-1 px-1 rounded bg-blue-100 text-blue-800 text-[10px]">agent: {ref}</span>
                          ) : null}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              {agent.name === currentAgent && (
                <Badge className="mt-2 bg-blue-600 hover:bg-blue-700 text-white">
                  Active
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </PanelSection>
  );
}