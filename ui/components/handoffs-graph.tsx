"use client";

import { ArrowRight, Network } from "lucide-react";
import { PanelSection } from "./panel-section";
import type { Agent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface HandoffsGraphProps {
  agents: Agent[];
}

export function HandoffsGraph({ agents }: HandoffsGraphProps) {
  const edges: Array<{ source: string; target: string }> = [];
  const names = new Set(agents.map((a) => a.name));
  for (const a of agents) {
    for (const t of a.handoffs || []) {
      if (names.has(t)) edges.push({ source: a.name, target: t });
    }
  }

  return (
    <PanelSection title="Handoff Paths" icon={<Network className="h-4 w-4 text-blue-600" /> }>
      {edges.length === 0 ? (
        <div className="text-xs text-zinc-500">No handoffs configured.</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {edges.map(({ source, target }, idx) => (
            <div key={`${source}->${target}-${idx}`} className="flex items-center gap-2 bg-white border rounded px-2 py-1">
              <Badge variant="secondary" className="text-[11px]">{source}</Badge>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-700" />
              <Badge variant="outline" className="text-[11px]">{target}</Badge>
            </div>
          ))}
        </div>
      )}
    </PanelSection>
  );
}


