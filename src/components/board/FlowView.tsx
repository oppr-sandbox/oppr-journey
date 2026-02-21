"use client";

import { useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatRelativeTime } from "@/lib/utils";

interface FlowViewProps {
  nodes: Node[];
  edges: Edge[];
  onFocusNode: (nodeId: string) => void;
  boardId: Id<"boards">;
}

const PLATFORM_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  desktop: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", label: "Desktop" },
  mobile: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", label: "Mobile" },
  admin: { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300", label: "Admin" },
};

const PLATFORM_BORDER: Record<string, string> = {
  desktop: "border-blue-400 dark:border-blue-600",
  mobile: "border-green-400 dark:border-green-600",
  admin: "border-purple-400 dark:border-purple-600",
};

export default function FlowView({ nodes, edges, onFocusNode, boardId }: FlowViewProps) {
  const comments = useQuery(api.comments.getByBoard, { boardId });

  // Build comment map: nodeId -> comments (unresolved only)
  const nodeCommentsMap = useMemo(() => {
    const map = new Map<string, { authorName: string; text: string; createdAt: number }[]>();
    if (!comments) return map;
    for (const c of comments) {
      if (c.nodeId && !c.resolved) {
        const existing = map.get(c.nodeId) || [];
        existing.push({ authorName: c.authorName, text: c.text, createdAt: c.createdAt });
        map.set(c.nodeId, existing);
      }
    }
    return map;
  }, [comments]);

  // Show screenshot and attention nodes in the flow view
  const screenshotNodes = useMemo(
    () => nodes.filter((n) => n.type === "screenshot"),
    [nodes]
  );

  const attentionNodes = useMemo(
    () => nodes.filter((n) => n.type === "attention"),
    [nodes]
  );

  // Build adjacency: for each node, which nodes it connects to (via edges)
  const adjacency = useMemo(() => {
    const adj: Record<string, { targetId: string; label: string }[]> = {};
    for (const edge of edges) {
      if (!adj[edge.source]) adj[edge.source] = [];
      adj[edge.source].push({
        targetId: edge.target,
        label: (edge.label as string) || "",
      });
    }
    return adj;
  }, [edges]);

  // Topological sort: find root nodes (no incoming edges from flow nodes)
  const orderedNodes = useMemo(() => {
    const flowNodes = [...screenshotNodes, ...attentionNodes];
    const flowIds = new Set(flowNodes.map((n) => n.id));
    const incomingCount: Record<string, number> = {};
    for (const n of flowNodes) incomingCount[n.id] = 0;

    for (const edge of edges) {
      if (flowIds.has(edge.source) && flowIds.has(edge.target)) {
        incomingCount[edge.target] = (incomingCount[edge.target] || 0) + 1;
      }
    }

    // BFS from roots
    const roots = flowNodes.filter((n) => (incomingCount[n.id] || 0) === 0);
    const visited = new Set<string>();
    const result: Node[] = [];
    const queue = [...roots];

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      result.push(node);

      const targets = adjacency[node.id] || [];
      for (const { targetId } of targets) {
        if (flowIds.has(targetId) && !visited.has(targetId)) {
          queue.push(flowNodes.find((n) => n.id === targetId)!);
        }
      }
    }

    // Add any unvisited nodes at the end
    for (const n of flowNodes) {
      if (!visited.has(n.id)) result.push(n);
    }

    return result;
  }, [screenshotNodes, attentionNodes, edges, adjacency]);

  if (screenshotNodes.length === 0 && attentionNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 text-zinc-300">
          <path d="M3 3h18v18H3zM9 3v18M3 9h18" />
        </svg>
        <p className="text-xs text-zinc-400">
          No screenshot nodes on canvas yet.
          <br />
          Drag screenshots from the library to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-1">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        Journey Flow ({screenshotNodes.length} screens{attentionNodes.length > 0 ? `, ${attentionNodes.length} flags` : ""})
      </p>
      {orderedNodes.map((node, idx) => {
        const data = node.data as any;
        const isAttention = node.type === "attention";
        const platform = data.platform || "";
        const platformStyle = !isAttention ? PLATFORM_COLORS[platform] : null;
        const borderStyle = isAttention
          ? "border-red-400 dark:border-red-700"
          : (PLATFORM_BORDER[platform] || "border-zinc-300 dark:border-zinc-600");

        // Find outgoing edges from this node to other flow nodes
        const outgoing = (adjacency[node.id] || []).filter((t) =>
          orderedNodes.some((n) => n.id === t.targetId)
        );

        // Comments for this node
        const nodeComments = nodeCommentsMap.get(node.id) || [];
        const commentCount = nodeComments.length;
        const previewComments = nodeComments.slice(0, 2);
        const remainingCount = commentCount - previewComments.length;

        return (
          <div key={node.id}>
            {/* Node box */}
            <button
              onClick={() => onFocusNode(node.id)}
              className={`w-full rounded-lg border-2 ${borderStyle} ${
                isAttention ? "bg-red-50 dark:bg-red-950/30" : "bg-white dark:bg-zinc-800"
              } p-2.5 text-left transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between gap-2">
                {isAttention && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-red-500">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
                <p className={`flex-1 text-xs font-medium leading-tight ${
                  isAttention ? "text-red-800 dark:text-red-200" : "text-zinc-800 dark:text-zinc-200"
                }`}>
                  {isAttention ? (data.text || "Attention") : (data.label || node.id)}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  {commentCount > 0 && (
                    <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {commentCount}
                    </span>
                  )}
                  {platformStyle && (
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${platformStyle.bg} ${platformStyle.text}`}>
                      {platformStyle.label}
                    </span>
                  )}
                  {isAttention && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-medium text-red-600 dark:bg-red-900/40 dark:text-red-300">
                      Flag
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Inline comment previews */}
            {previewComments.length > 0 && (
              <div className="ml-3 mt-1 mb-0.5 space-y-0.5">
                {previewComments.map((c, ci) => (
                  <div key={ci} className="flex items-baseline gap-1.5 text-[10px]">
                    <span className="shrink-0 font-medium text-zinc-500 dark:text-zinc-400">
                      {c.authorName}
                    </span>
                    <span className="truncate text-zinc-400 dark:text-zinc-500">
                      {c.text.length > 60 ? c.text.slice(0, 60) + "..." : c.text}
                    </span>
                  </div>
                ))}
                {remainingCount > 0 && (
                  <p className="text-[9px] text-zinc-400">
                    + {remainingCount} more
                  </p>
                )}
              </div>
            )}

            {/* Arrows to next nodes */}
            {outgoing.length > 0 && idx < orderedNodes.length - 1 && (
              <div className="flex flex-col items-center py-0.5">
                {outgoing.map((conn, ci) => (
                  <div key={ci} className="flex flex-col items-center">
                    <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-600" />
                    {conn.label && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {conn.label}
                      </span>
                    )}
                    <svg width="10" height="8" viewBox="0 0 10 8" className="text-zinc-400">
                      <path d="M5 8L0 0h10z" fill="currentColor" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
