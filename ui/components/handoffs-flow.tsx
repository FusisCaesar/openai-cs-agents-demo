"use client";

import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import ReactFlow, { Background, Controls, MiniMap, Node, Edge, MarkerType, applyNodeChanges, OnNodesChange, SimpleBezierEdge, SmoothStepEdge, StraightEdge } from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import type { Agent } from "@/lib/types";
import { PanelSection } from "./panel-section";
import { Network } from "lucide-react";

const nodeWidth = 180;
const nodeHeight = 54;

// Stable edge types mapping to avoid re-creation on each render
const edgeTypes = {
  simplebezier: SimpleBezierEdge,
  smoothstep: SmoothStepEdge,
  straight: StraightEdge,
} as const;

function layout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 100 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: nodeWidth, height: nodeHeight }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  const laidNodes = nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - nodeWidth / 2, y: pos.y - nodeHeight / 2 } };
  });
  return { nodes: laidNodes, edges };
}

interface HandoffsFlowProps {
  agents: Agent[];
}

export function HandoffsFlow({ agents }: HandoffsFlowProps) {
  const { nodes, edges, toolPairs } = useMemo(() => {
    const palette = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"]; // blue, green, amber, red, violet, cyan, lime
    const colorFor = (name: string) => palette[name.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length];
    const nodes: Node[] = agents.map((a) => ({
      id: a.name,
      data: { label: a.name },
      position: { x: 0, y: 0 },
      style: {
        width: nodeWidth,
        height: nodeHeight,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: a.is_triage ? "#eff6ff" : "#fff",
        boxShadow: a.is_triage ? "0 0 0 1px #3b82f6 inset" : undefined,
        fontSize: 12,
      },
    }));
    const edges: Edge[] = [];
    const toolPairs: Array<{ source: string; target: string; tool: string }> = [];
    const names = new Set(agents.map((a) => a.name));
    for (const a of agents) {
      for (const t of a.handoffs || []) {
        if (names.has(t)) {
          const color = colorFor(a.name);
          edges.push({
            id: `${a.name}->${t}`,
            source: a.name,
            target: t,
            type: "simplebezier",
            style: { stroke: color, strokeWidth: 1.8 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
          });
        }
      }
      // Agent-as-tool edges (manager pattern)
      const tools = (a.tools as any[]) || [];
      for (const tool of tools) {
        const ref = typeof tool === "string" ? undefined : tool?.agent_ref as string | undefined;
        if (ref && names.has(ref)) {
          const color = "#0ea5e9"; // cyan for tools
          edges.push({
            id: `tool:${a.name}->${ref}:${typeof tool === "string" ? tool : tool?.name}`,
            source: a.name,
            target: ref,
            type: "simplebezier",
            style: { stroke: color, strokeDasharray: "6 4", strokeWidth: 2.5 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
          });
          toolPairs.push({ source: a.name, target: ref, tool: (typeof tool === "string" ? tool : tool?.name) || "" });
        }
      }
    }
    const laid = layout(nodes, edges);
    return { ...laid, toolPairs };
  }, [agents]);

  // Local node state so user can drag nodes temporarily for clarity
  const [rfNodes, setRfNodes] = useState<Node[]>(nodes);
  const [rfEdges, setRfEdges] = useState<Edge[]>(edges);
  useEffect(() => { setRfNodes(nodes); setRfEdges(edges); }, [nodes, edges]);
  const onNodesChange: OnNodesChange = useCallback((changes) => setRfNodes((nds) => applyNodeChanges(changes, nds)), []);

  // Resizable container
  const [height, setHeight] = useState<number>(600);
  const dragRef = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = e.clientY - startY.current;
      setHeight(Math.max(280, Math.min(1400, startH.current + dy)));
    };
    const onUp = () => { dragRef.current = false; };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return;
      const touchY = e.touches && e.touches[0] ? e.touches[0].clientY : 0;
      const dy = touchY - startY.current;
      setHeight(Math.max(280, Math.min(1400, startH.current + dy)));
    };
    const onTouchEnd = () => { dragRef.current = false; };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseup", onUp, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <PanelSection title="Handoff Graph" icon={<Network className="h-4 w-4 text-blue-600" /> }>
      <div className="bg-white border rounded relative" style={{ height }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable
          nodesConnectable={false}
        >
          <Background />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
        <div
          role="slider"
          aria-label="Resize graph"
          className="absolute right-1 bottom-1 w-3 h-3 bg-zinc-300 rounded-sm cursor-se-resize"
          onMouseDown={(e) => { dragRef.current = true; startY.current = e.clientY; startH.current = height; }}
          onTouchStart={(e) => { dragRef.current = true; startY.current = (e.touches && e.touches[0] ? e.touches[0].clientY : 0); startH.current = height; }}
          title="Drag to resize"
          style={{ touchAction: "none" }}
        />
      </div>
      <div className="mt-2 text-[11px] text-zinc-600 flex items-center gap-4">
        <div className="flex items-center gap-1"><span className="inline-block w-6 h-[2px] bg-zinc-400" /> Handoff</div>
        <div className="flex items-center gap-1"><span className="inline-block w-6 h-[2px] bg-cyan-500" style={{ borderBottom: "2px dashed #06b6d4" }} /> Agent as Tool</div>
      </div>
      {toolPairs.length > 0 && (
        <div className="mt-1 text-[12px] text-zinc-700">
          Manager links: {toolPairs.map((p, i) => (
            <span key={`${p.source}-${p.tool}-${p.target}-${i}`} className="mr-2">
              {p.source} — {p.tool} → {p.target}
            </span>
          ))}
        </div>
      )}
    </PanelSection>
  );
}


