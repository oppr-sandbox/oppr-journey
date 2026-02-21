"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import FlowView from "./FlowView";
import PersonaPanel from "./PersonaPanel";
import CommentsPanel from "./CommentsPanel";
import AIChat from "./AIChat";
import ImprovementsPanel from "./ImprovementsPanel";
import ReportsPanel from "./ReportsPanel";
import NodeDetailPanel from "./NodeDetailPanel";

type RightTab = "flow" | "ai" | "comments" | "personas" | "improvements" | "reports";

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 360;

interface RightPanelProps {
  boardId: Id<"boards">;
  nodes: Node[];
  edges: Edge[];
  onFocusNode: (nodeId: string) => void;
  openCommentsForNode?: string | null;
  onClearOpenComments?: () => void;
  activePersonaId: string | null;
  onSetActivePersonaId: (id: string | null) => void;
  selectedNodeId: string | null;
  onDeselectNode: () => void;
}

export default function RightPanel({
  boardId,
  nodes,
  edges,
  onFocusNode,
  openCommentsForNode,
  onClearOpenComments,
  activePersonaId,
  onSetActivePersonaId,
  selectedNodeId,
  onDeselectNode,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightTab>("flow");
  const [commentFilterNodeId, setCommentFilterNodeId] = useState<string | null>(null);

  // Switch to comments tab when a node comment badge is clicked
  useEffect(() => {
    if (openCommentsForNode) {
      setActiveTab("comments");
      setCommentFilterNodeId(openCommentsForNode);
      setCollapsed(false);
      onClearOpenComments?.();
    }
  }, [openCommentsForNode, onClearOpenComments]);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const resizing = useRef(false);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizing.current = true;
      const startX = e.clientX;
      const startWidth = width;

      const onMouseMove = (ev: MouseEvent) => {
        if (!resizing.current) return;
        const newWidth = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth - (ev.clientX - startX))
        );
        setWidth(newWidth);
      };

      const onMouseUp = () => {
        resizing.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [width]
  );

  // Find the selected node from the nodes array
  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  if (collapsed) {
    return (
      <div className="flex h-full shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          title="Expand panel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>
    );
  }

  // Node Detail mode: when a node is selected, show NodeDetailPanel instead of tabs
  if (selectedNode) {
    return (
      <div
        className="relative flex h-full shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
        style={{ width }}
      >
        {/* Resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 z-10 w-1 cursor-col-resize bg-transparent hover:bg-blue-400/50 active:bg-blue-500/50"
          onMouseDown={onResizeStart}
        />

        <NodeDetailPanel
          boardId={boardId}
          node={selectedNode}
          onBack={onDeselectNode}
          onFocusNode={onFocusNode}
        />
      </div>
    );
  }

  // Journey Overview mode: show tabs
  const tabs: { key: RightTab; label: string; icon: React.ReactNode }[] = [
    {
      key: "flow",
      label: "Flow View",
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="5" cy="12" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="19" r="2" />
          <path d="M7 12h10M17 7l-2 3.5M17 17l-2-3.5" />
        </svg>
      ),
    },
    {
      key: "ai",
      label: "AI Chat",
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M12 8v1m0 2v.01M8 8v.01M16 8v.01" />
        </svg>
      ),
    },
    {
      key: "comments",
      label: "Comments",
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      key: "personas",
      label: "Personas",
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      key: "improvements",
      label: "Improve",
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2.26C8.19 13.47 7 11.38 7 9a7 7 0 0 1 5-7z" />
        </svg>
      ),
    },
    {
      key: "reports",
      label: "Reports",
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="relative flex h-full shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 z-10 w-1 cursor-col-resize bg-transparent hover:bg-blue-400/50 active:bg-blue-500/50"
        onMouseDown={onResizeStart}
      />

      {/* Header with tabs */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1 whitespace-nowrap px-2.5 py-2 text-[11px] font-medium transition-colors",
                activeTab === tab.key
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              )}
              title={tab.label}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          title="Collapse panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "flow" && (
          <FlowView nodes={nodes} edges={edges} onFocusNode={onFocusNode} boardId={boardId} />
        )}
        {activeTab === "ai" && (
          <AIChat boardId={boardId} />
        )}
        {activeTab === "comments" && (
          <CommentsPanel
            boardId={boardId}
            nodes={nodes}
            onFocusNode={onFocusNode}
            filterNodeId={commentFilterNodeId}
            onClearFilter={() => setCommentFilterNodeId(null)}
          />
        )}
        {activeTab === "personas" && (
          <PersonaPanel
            boardId={boardId}
            activePersonaId={activePersonaId}
            onSetActivePersonaId={onSetActivePersonaId}
            nodes={nodes}
          />
        )}
        {activeTab === "improvements" && (
          <ImprovementsPanel
            boardId={boardId}
            nodes={nodes}
            onFocusNode={onFocusNode}
          />
        )}
        {activeTab === "reports" && (
          <ReportsPanel
            boardId={boardId}
            onFocusNode={onFocusNode}
          />
        )}
      </div>
    </div>
  );
}
