"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Node } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ImprovementCommentThread from "@/components/shared/ImprovementCommentThread";
import ImprovementTodoList from "@/components/shared/ImprovementTodoList";

interface ImprovementsPanelProps {
  boardId: Id<"boards">;
  nodes: Node[];
  onFocusNode: (nodeId: string) => void;
}

type FilterTab = "all" | "open" | "in_progress" | "closed";

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300" },
  medium: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  low: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
};

const STATUS_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: "open", label: "Open", color: "text-emerald-600" },
  { key: "in_progress", label: "In Progress", color: "text-blue-600" },
  { key: "closed", label: "Closed", color: "text-zinc-500" },
];

const COLLAPSED_MAX_HEIGHT = 200;

// Module-level persistent expanded state for panel sections
const panelExpandedMap = new Set<string>();

/**
 * Collapsible markdown section for the right panel with edit support.
 * Expanded state persists in module-level Set.
 */
function CollapsiblePanelMarkdown({
  content,
  fieldKey,
  label,
  labelColor,
  borderColor,
  bgColor,
  improvementId,
  updateImprovement,
  nodes,
  onFocusNode,
}: {
  content: string;
  fieldKey: string;
  label: string;
  labelColor: string;
  borderColor?: string;
  bgColor?: string;
  improvementId: Id<"improvements">;
  updateImprovement: any;
  nodes: Node[];
  onFocusNode: (nodeId: string) => void;
}) {
  const persistKey = `${improvementId}:${fieldKey}`;
  const [expanded, setExpandedState] = useState(() => panelExpandedMap.has(persistKey));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setExpanded = useCallback((value: boolean) => {
    if (value) {
      panelExpandedMap.add(persistKey);
    } else {
      panelExpandedMap.delete(persistKey);
    }
    setExpandedState(value);
  }, [persistKey]);

  useEffect(() => {
    setExpandedState(panelExpandedMap.has(persistKey));
  }, [persistKey]);

  useEffect(() => {
    setDraft(content);
  }, [content]);

  useEffect(() => {
    if (contentRef.current) {
      setNeedsCollapse(contentRef.current.scrollHeight > COLLAPSED_MAX_HEIGHT);
    }
  }, [content, expanded]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const ta = textareaRef.current;
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    setEditing(false);
    if (draft !== content) {
      updateImprovement({
        improvementId,
        [fieldKey]: draft,
      });
    }
  }, [draft, content, fieldKey, improvementId, updateImprovement]);

  // Custom strong renderer: clickable screen names
  const markdownComponents = {
    strong: ({ children, ...props }: any) => {
      const text = String(children);
      const matchedNode = nodes.find((n) => {
        const nLabel = ((n.data as any)?.label || (n.data as any)?.text || "").toLowerCase();
        return nLabel.includes(text.toLowerCase()) || text.toLowerCase().includes(nLabel);
      });
      if (matchedNode) {
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFocusNode(matchedNode.id);
            }}
            className="inline font-bold text-blue-600 underline decoration-blue-300 decoration-1 underline-offset-2 hover:text-blue-800 hover:decoration-2 dark:text-blue-400 dark:hover:text-blue-200"
          >
            {children}
          </button>
        );
      }
      return <strong {...props}>{children}</strong>;
    },
  };

  const wrapperClass = borderColor
    ? `mb-3 rounded-md border ${borderColor} ${bgColor || ""} p-2`
    : "mb-3";

  return (
    <div className={wrapperClass}>
      <div className="flex items-center gap-1">
        <p className={`text-[9px] font-bold uppercase tracking-wider ${labelColor}`}>
          {label}
        </p>
        {!editing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            title="Edit this section"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        {!editing && needsCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="ml-auto flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
            title={expanded ? "Collapse section" : "Expand section"}
          >
            {expanded ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
                Collapse
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
                Expand
              </>
            )}
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleSave();
          }}
          className="mt-1 w-full resize-none rounded border border-zinc-300 bg-white p-2 text-[11px] leading-relaxed text-zinc-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
          style={{ minHeight: "4em" }}
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      ) : (
        <div className="relative mt-1">
          <div
            ref={contentRef}
            className={`prose prose-xs prose-zinc dark:prose-invert max-w-none overflow-hidden
              [&_p]:text-[11px] [&_p]:leading-relaxed [&_p]:my-1
              [&_li]:text-[11px] [&_li]:leading-relaxed
              [&_h2]:text-[11px] [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-0.5
              [&_h3]:text-[10px] [&_h3]:font-bold [&_h3]:mt-1.5 [&_h3]:mb-0.5
              [&_ul]:my-0.5 [&_ul]:pl-3 [&_ol]:my-0.5 [&_ol]:pl-3
              [&_code]:text-[10px] [&_code]:bg-zinc-200 [&_code]:dark:bg-zinc-800 [&_code]:px-1 [&_code]:rounded`}
            style={!expanded && needsCollapse ? { maxHeight: COLLAPSED_MAX_HEIGHT } : undefined}
            onDoubleClick={() => {
              if (!expanded) {
                setExpanded(true);
              } else {
                setEditing(true);
              }
            }}
            title={!expanded && needsCollapse ? "Double-click to expand" : "Double-click to edit"}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content}
            </ReactMarkdown>
          </div>

          {/* Gradient fade overlay when collapsed */}
          {!expanded && needsCollapse && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent dark:from-zinc-900" />
          )}

          {/* Bottom expand/collapse bar */}
          {needsCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              {expanded ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                  Collapse
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                  Show more
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline editable title for the panel.
 */
function EditableTitle({
  value,
  improvementId,
  updateImprovement,
}: {
  value: string;
  improvementId: Id<"improvements">;
  updateImprovement: any;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    setEditing(false);
    if (draft !== value && draft.trim()) {
      updateImprovement({
        improvementId,
        title: draft.trim(),
      });
    }
  }, [draft, value, improvementId, updateImprovement]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") handleSave();
          e.stopPropagation();
        }}
        className="mt-1 w-full rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs font-semibold text-zinc-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
      />
    );
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
        {value}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
        title="Edit title"
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "closed") {
    return (
      <span className="flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[8px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-zinc-500">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Closed
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[8px] font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
        In Progress
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
    </span>
  );
}

export default function ImprovementsPanel({ boardId, nodes, onFocusNode }: ImprovementsPanelProps) {
  const { user } = useUser();
  const improvements = useQuery(api.improvements.getByBoard, { boardId });
  const board = useQuery(api.boards.get, { boardId });
  const allUsers = useQuery(api.users.listAll);
  const changeStatus = useMutation(api.improvements.changeStatus);
  const assignImprovement = useMutation(api.improvements.assign);
  const removeImprovement = useMutation(api.improvements.remove);
  const clearImprovementContent = useMutation(api.improvements.clearContent);
  const updateImprovement = useMutation(api.improvements.update);
  const slackNotifyStatus = useAction(api.slack.notifyStatusChange);

  const [filter, setFilter] = useState<FilterTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = improvements?.filter((imp) => {
    if (filter === "open") return imp.status === "open";
    if (filter === "in_progress") return imp.status === "in_progress";
    if (filter === "closed") return imp.status === "closed";
    return true;
  }) || [];

  const openCount = improvements?.filter((i) => i.status === "open").length || 0;
  const inProgressCount = improvements?.filter((i) => i.status === "in_progress").length || 0;
  const closedCount = improvements?.filter((i) => i.status === "closed").length || 0;

  const handleStatusChange = async (improvementId: string, newStatus: string, currentStatus: string) => {
    if (newStatus === currentStatus) return;
    await changeStatus({
      improvementId: improvementId as Id<"improvements">,
      newStatus,
      changedBy: user?.id || "unknown",
      changedByName: user?.fullName || user?.firstName || "Unknown",
    });
    // Fire-and-forget Slack notification
    slackNotifyStatus({
      improvementId: improvementId as Id<"improvements">,
      boardId,
      oldStatus: currentStatus,
      newStatus,
      changedByName: user?.fullName || user?.firstName || "Unknown",
    }).catch(() => {});
  };

  const handleAssign = async (improvementId: string, assigneeId: string | undefined, assigneeName: string | undefined) => {
    await assignImprovement({
      improvementId: improvementId as Id<"improvements">,
      assigneeId,
      assigneeName,
    });
  };

  const handleExport = () => {
    if (!improvements || improvements.length === 0) return;

    const lines: string[] = [];
    lines.push(`# Improvement Suggestions \u2014 ${board?.name || "Journey"}`);
    lines.push(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
    lines.push("");

    for (const imp of improvements) {
      const impNum = String(imp.number).padStart(3, "0");
      const statusLabel = imp.status === "in_progress" ? "In Progress" : imp.status.charAt(0).toUpperCase() + imp.status.slice(1);
      lines.push(`## IMP-${impNum}: ${imp.title}`);
      lines.push(`**Priority:** ${(imp.priority || "unset").charAt(0).toUpperCase() + (imp.priority || "unset").slice(1)} | **Status:** ${statusLabel}`);
      if ((imp as any).assigneeName) {
        lines.push(`**Assignee:** ${(imp as any).assigneeName}`);
      }

      const connectedLabels = imp.connectedNodeIds
        .map((id) => {
          const node = nodes.find((n) => n.id === id);
          return (node?.data as any)?.label || (node?.data as any)?.text || id;
        })
        .filter(Boolean);
      if (connectedLabels.length > 0) {
        lines.push(`**Connected screens:** ${connectedLabels.join(", ")}`);
      }
      lines.push("");

      const displayContent = (imp as any).content || (() => {
        const parts: string[] = [];
        if (imp.currentState) parts.push(`## Problem / Current State\n${imp.currentState}`);
        if (imp.proposedImprovement) parts.push(`## Proposed Solution\n${imp.proposedImprovement}`);
        if (imp.expectedImpact) parts.push(`## Expected Impact\n${imp.expectedImpact}`);
        return parts.join("\n\n");
      })();
      if (displayContent) {
        lines.push("### Analysis");
        lines.push(displayContent);
        lines.push("");
      }
      if ((imp as any).developerTodos) {
        lines.push("### Developer To-Do List");
        lines.push((imp as any).developerTodos);
        lines.push("");
      }
      lines.push("---");
      lines.push("");
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `improvements-${(board?.name || "journey").replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-3">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          Improvements ({improvements?.length || 0})
        </p>
        <button
          onClick={handleExport}
          disabled={!improvements || improvements.length === 0}
          className="flex items-center gap-1 rounded border border-zinc-200 px-2 py-0.5 text-[9px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Export as markdown"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Export
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-3 flex gap-1">
        {([
          { key: "all" as FilterTab, label: "All" },
          { key: "open" as FilterTab, label: `Open (${openCount})` },
          { key: "in_progress" as FilterTab, label: `In Progress (${inProgressCount})` },
          { key: "closed" as FilterTab, label: `Closed (${closedCount})` },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
              filter === tab.key
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Improvement list */}
      <div className="space-y-2">
        {filtered.map((imp) => {
          const isExpanded = expandedId === imp._id;
          const impNum = String(imp.number).padStart(3, "0");
          const prioStyle = PRIORITY_COLORS[imp.priority || ""] || PRIORITY_COLORS.low;

          return (
            <div key={imp._id} className="rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setExpandedId(isExpanded ? null : imp._id)}
                className="w-full p-2.5 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[8px] font-bold text-white">
                        IMP-{impNum}
                      </span>
                      <StatusBadge status={imp.status} />
                      {imp.generatedByAI && (
                        <span title="AI-generated" className="flex items-center gap-0.5 text-[8px] text-amber-500">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 3v1m0 16v1m-8-9H3m18 0h-1M5.6 5.6l.7.7m12.1 12.1l.7.7M5.6 18.4l.7-.7m12.1-12.1l.7-.7" />
                          </svg>
                          AI
                        </span>
                      )}
                    </div>
                    <EditableTitle
                      value={imp.title}
                      improvementId={imp._id as Id<"improvements">}
                      updateImprovement={updateImprovement}
                    />
                    {(imp as any).assigneeName && (
                      <p className="mt-0.5 flex items-center gap-1 text-[9px] text-zinc-400">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                        {(imp as any).assigneeName}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {imp.priority && (
                      <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${prioStyle.bg} ${prioStyle.text}`}>
                        {imp.priority}
                      </span>
                    )}
                    <span className="text-[9px] text-zinc-400">
                      {imp.connectedNodeIds.length}
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-0.5 inline">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>
              </button>

              {isExpanded && (() => {
                const impDisplayContent = (imp as any).content || (() => {
                  const parts: string[] = [];
                  if (imp.currentState) parts.push(`## Problem / Current State\n${imp.currentState}`);
                  if (imp.proposedImprovement) parts.push(`## Proposed Solution\n${imp.proposedImprovement}`);
                  if (imp.expectedImpact) parts.push(`## Expected Impact\n${imp.expectedImpact}`);
                  return parts.join("\n\n");
                })();
                return (
                <div className="border-t border-zinc-200 p-2.5 dark:border-zinc-700">
                  {impDisplayContent && (
                    <CollapsiblePanelMarkdown
                      content={impDisplayContent}
                      fieldKey="content"
                      label="Analysis"
                      labelColor="text-emerald-600"
                      improvementId={imp._id as Id<"improvements">}
                      updateImprovement={updateImprovement}
                      nodes={nodes}
                      onFocusNode={onFocusNode}
                    />
                  )}
                  {(imp as any).developerTodos && (
                    <CollapsiblePanelMarkdown
                      content={(imp as any).developerTodos}
                      fieldKey="developerTodos"
                      label="Developer To-Do List"
                      labelColor="text-violet-600"
                      borderColor="border-violet-200 dark:border-violet-800"
                      bgColor="bg-violet-50/60 dark:bg-violet-950/20"
                      improvementId={imp._id as Id<"improvements">}
                      updateImprovement={updateImprovement}
                      nodes={nodes}
                      onFocusNode={onFocusNode}
                    />
                  )}

                  {/* Interactive Todos */}
                  <div className="mb-2 rounded-md border border-violet-200 bg-violet-50/30 p-2 dark:border-violet-800 dark:bg-violet-950/10">
                    <ImprovementTodoList
                      improvementId={imp._id as Id<"improvements">}
                      boardId={boardId}
                      compact
                    />
                  </div>

                  {/* Connected nodes */}
                  {imp.connectedNodeIds.length > 0 && (
                    <div className="mb-2">
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Referenced Screens</p>
                      <div className="flex flex-wrap gap-1">
                        {imp.connectedNodeIds.map((nodeId) => {
                          const node = nodes.find((n) => n.id === nodeId);
                          const label = (node?.data as any)?.label || (node?.data as any)?.text || nodeId;
                          return (
                            <button
                              key={nodeId}
                              onClick={(e) => {
                                e.stopPropagation();
                                onFocusNode(nodeId);
                              }}
                              className="rounded bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              {typeof label === "string" ? label.slice(0, 40) : nodeId}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Status transition & Assignee */}
                  <div className="mb-2 flex items-center gap-2">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Status:</label>
                    <select
                      value={imp.status}
                      onChange={(e) => handleStatusChange(imp._id, e.target.value, imp.status)}
                      className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-700 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>

                    <label className="ml-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Assignee:</label>
                    <select
                      value={(imp as any).assigneeId || ""}
                      onChange={(e) => {
                        const selectedUser = allUsers?.find((u: any) => u.clerkId === e.target.value);
                        handleAssign(
                          imp._id,
                          e.target.value || undefined,
                          selectedUser?.name || undefined,
                        );
                      }}
                      className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-700 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    >
                      <option value="">Unassigned</option>
                      {allUsers?.map((u: any) => (
                        <option key={u.clerkId} value={u.clerkId}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Inline comment thread */}
                  <div className="mb-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    <ImprovementCommentThread
                      improvementId={imp._id as Id<"improvements">}
                      boardId={boardId}
                      compact
                    />
                  </div>

                  {/* Actions */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFocusNode(imp.nodeId);
                      }}
                      className="rounded border border-zinc-200 px-2 py-0.5 text-[9px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Go to node
                    </button>
                    {((imp as any).content || imp.currentState || imp.proposedImprovement || imp.expectedImpact || (imp as any).developerTodos) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Clear all content and start over?")) {
                            clearImprovementContent({ improvementId: imp._id as Id<"improvements"> });
                          }
                        }}
                        className="rounded border border-amber-200 px-2 py-0.5 text-[9px] font-medium text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this improvement?")) {
                          removeImprovement({ improvementId: imp._id as Id<"improvements"> });
                          setExpandedId(null);
                        }
                      }}
                      className="rounded border border-zinc-200 px-2 py-0.5 text-[9px] font-medium text-red-500 hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-red-900/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ); })()}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="py-6 text-center text-[11px] text-zinc-400">
          {filter === "all"
            ? "No improvements yet. Add improvement nodes to the canvas and connect them to screenshots."
            : `No ${filter === "in_progress" ? "in progress" : filter} improvements.`}
        </p>
      )}
    </div>
  );
}
