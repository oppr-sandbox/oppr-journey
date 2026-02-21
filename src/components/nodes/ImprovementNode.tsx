"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ConnectedScreen {
  nodeId: string;
  label: string;
}

interface ImprovementNodeData {
  text: string;
  improvementNumber: number;
  status: string;
  connectedScreenshotCount: number;
  content?: string;
  currentState?: string;
  proposedImprovement?: string;
  expectedImpact?: string;
  developerTodos?: string;
  priority?: string;
  generatedByAI?: boolean;
  connectedScreens?: ConnectedScreen[];
  assigneeName?: string;
  createdByName?: string;
  onTextChange?: (text: string) => void;
  onNodeResized?: (width: number, height: number) => void;
  onGenerate?: () => void;
  onClear?: () => void;
  onUpdateField?: (field: string, value: string) => void;
  onFocusNode?: (nodeId: string) => void;
  generating?: boolean;
  [key: string]: unknown;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

const COLLAPSED_MAX_HEIGHT = 200;

// Module-level persistent state: survives re-renders, remounts, and Convex sync rebuilds.
// Key format: "nodeId:fieldKey"
const expandedSectionsMap = new Set<string>();

/**
 * Collapsible markdown section with edit support.
 * Expanded state is persisted in module-level Set so it survives React Flow re-renders.
 */
function CollapsibleMarkdown({
  nodeId,
  content,
  fieldKey,
  label,
  labelColor,
  borderColor,
  bgColor,
  onSave,
  connectedScreens,
  onFocusNode,
}: {
  nodeId: string;
  content: string;
  fieldKey: string;
  label: string;
  labelColor: string;
  borderColor?: string;
  bgColor?: string;
  onSave?: (field: string, value: string) => void;
  connectedScreens?: ConnectedScreen[];
  onFocusNode?: (nodeId: string) => void;
}) {
  const persistKey = `${nodeId}:${fieldKey}`;

  // Initialize from module-level persistent state
  const [expanded, setExpandedState] = useState(() => expandedSectionsMap.has(persistKey));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync expanded state to module-level Set on every change
  const setExpanded = useCallback((value: boolean) => {
    if (value) {
      expandedSectionsMap.add(persistKey);
    } else {
      expandedSectionsMap.delete(persistKey);
    }
    setExpandedState(value);
  }, [persistKey]);

  // Re-sync from module-level state if component remounts (e.g., after Convex sync)
  useEffect(() => {
    const shouldBeExpanded = expandedSectionsMap.has(persistKey);
    setExpandedState(shouldBeExpanded);
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
    if (draft !== content && onSave) {
      onSave(fieldKey, draft);
    }
  }, [draft, content, fieldKey, onSave]);

  // Custom strong renderer: clickable screen names
  const markdownComponents = {
    strong: ({ children, ...props }: any) => {
      const text = String(children);
      const screen = connectedScreens?.find(
        (s) =>
          s.label.toLowerCase().includes(text.toLowerCase()) ||
          text.toLowerCase().includes(s.label.toLowerCase())
      );
      if (screen && onFocusNode) {
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFocusNode(screen.nodeId);
            }}
            className="nodrag inline font-bold text-emerald-700 underline decoration-emerald-400 decoration-1 underline-offset-2 hover:text-emerald-900 hover:decoration-2 dark:text-emerald-300 dark:hover:text-emerald-100"
          >
            {children}
          </button>
        );
      }
      return <strong {...props}>{children}</strong>;
    },
  };

  const wrapperClass = borderColor
    ? `rounded-md border ${borderColor} ${bgColor || ""} p-2`
    : "";

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
            className="nodrag rounded p-0.5 text-zinc-400 hover:bg-emerald-100 hover:text-emerald-600 dark:hover:bg-emerald-900/30"
            title="Edit this section"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        {/* Expand / Collapse button — always visible when content is long */}
        {!editing && needsCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="nodrag ml-auto flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
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
            e.stopPropagation();
          }}
          className="nodrag nowheel mt-0.5 w-full resize-none rounded border border-emerald-300 bg-white/80 p-1.5 text-[11px] leading-relaxed text-emerald-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100"
          style={{ minHeight: "3em" }}
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      ) : (
        <div className="relative mt-0.5">
          <div
            ref={contentRef}
            className={`nodrag nowheel prose prose-xs prose-zinc dark:prose-invert max-w-none overflow-hidden
              [&_p]:text-[11px] [&_p]:leading-relaxed [&_p]:text-emerald-900/80 [&_p]:dark:text-emerald-100/80 [&_p]:my-1
              [&_li]:text-[11px] [&_li]:leading-relaxed [&_li]:text-emerald-900/80 [&_li]:dark:text-emerald-100/80
              [&_h2]:text-[11px] [&_h2]:font-bold [&_h2]:text-emerald-800 [&_h2]:dark:text-emerald-200 [&_h2]:mt-2 [&_h2]:mb-0.5
              [&_h3]:text-[10px] [&_h3]:font-bold [&_h3]:text-emerald-700 [&_h3]:dark:text-emerald-300 [&_h3]:mt-1.5 [&_h3]:mb-0.5
              [&_ul]:my-0.5 [&_ul]:pl-3 [&_ol]:my-0.5 [&_ol]:pl-3
              [&_code]:text-[10px] [&_code]:bg-emerald-100 [&_code]:dark:bg-emerald-900/40 [&_code]:px-1 [&_code]:rounded`}
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
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-emerald-50 to-transparent dark:from-emerald-950/30" />
          )}

          {/* Bottom expand/collapse bar */}
          {needsCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="nodrag mt-1 flex w-full items-center justify-center gap-1 rounded py-0.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-100/60 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
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

function ImprovementNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as ImprovementNodeData;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(nodeData.text || "New improvement");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isClosed = nodeData.status === "closed";
  const isInProgress = nodeData.status === "in_progress";
  const impNumber = String(nodeData.improvementNumber || 0).padStart(3, "0");
  const hasContent = nodeData.content || nodeData.currentState || nodeData.proposedImprovement || nodeData.expectedImpact || nodeData.developerTodos;

  // Derive unified display content: prefer new `content` field, fall back to legacy fields
  const displayContent = nodeData.content || (() => {
    const parts: string[] = [];
    if (nodeData.currentState) parts.push(`## Problem / Current State\n${nodeData.currentState}`);
    if (nodeData.proposedImprovement) parts.push(`## Proposed Solution\n${nodeData.proposedImprovement}`);
    if (nodeData.expectedImpact) parts.push(`## Expected Impact\n${nodeData.expectedImpact}`);
    return parts.join("\n\n");
  })();

  useEffect(() => {
    setText(nodeData.text || "New improvement");
  }, [nodeData.text]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    setEditing(false);
    if (nodeData.onTextChange) {
      nodeData.onTextChange(text);
    }
  }, [text, nodeData]);

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={240}
        minHeight={80}
        lineStyle={{ borderColor: "#10b981" }}
        handleStyle={{ backgroundColor: "#10b981", width: 8, height: 8 }}
        onResizeEnd={(_event, params) => {
          nodeData.onNodeResized?.(params.width, params.height);
        }}
      />

      <Handle type="target" position={Position.Top} id="top-target" className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Top} id="top-source" className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="target" position={Position.Left} id="left-target" className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Left} id="left-source" className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="target" position={Position.Right} id="right-target" className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-4 !h-4 !bg-emerald-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />

      <div
        className={`w-full rounded-lg border-2 bg-emerald-50 shadow-sm dark:bg-emerald-950/30 ${
          selected
            ? "border-emerald-500 ring-2 ring-emerald-400 ring-offset-2"
            : "border-emerald-400 dark:border-emerald-700"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-emerald-200 bg-emerald-100/60 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-900/40">
          <div className="flex items-center gap-2">
            <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              IMP-{impNumber}
            </span>
            {isClosed ? (
              <span className="flex items-center gap-1 rounded bg-zinc-200 px-1.5 py-0.5 text-[9px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Closed
              </span>
            ) : isInProgress ? (
              <span className="flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                In Progress
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[9px] text-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Open
              </span>
            )}
            {nodeData.priority && (
              <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${PRIORITY_STYLES[nodeData.priority] || ""}`}>
                {nodeData.priority}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasContent && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Clear all generated content and start over?")) {
                    nodeData.onClear?.();
                  }
                }}
                className="nodrag flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                title="Clear content and start over"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                <span>Clear</span>
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                nodeData.onGenerate?.();
              }}
              disabled={nodeData.generating === true}
              className="nodrag flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
              title="Generate improvement with AI"
            >
              {nodeData.generating ? (
                <>
                  <span className="block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v1m0 16v1m-8-9H3m18 0h-1M5.6 5.6l.7.7m12.1 12.1l.7.7M5.6 18.4l.7-.7m12.1-12.1l.7-.7" />
                  </svg>
                  <span>AI Generate</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="border-b border-emerald-200/50 px-3 py-2 dark:border-emerald-800/50" onDoubleClick={() => setEditing(true)}>
          <div className="flex items-start gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mt-0.5 shrink-0 text-emerald-500"
            >
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2.26C8.19 13.47 7 11.38 7 9a7 7 0 0 1 5-7z" />
            </svg>
            <div className="flex-1 min-w-0">
              {editing ? (
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onBlur={handleSave}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") handleSave();
                    e.stopPropagation();
                  }}
                  className="nodrag nowheel w-full resize-none border-none bg-transparent text-sm font-semibold text-emerald-800 outline-none dark:text-emerald-200"
                  style={{ minHeight: "1.5em" }}
                  rows={Math.max(1, Math.ceil(text.length / 40))}
                  placeholder="Describe the improvement..."
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  {text || "Double-click to edit title"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Structured Content — ReactMarkdown rendered */}
        {hasContent && (
          <div className="space-y-2 px-3 py-2">
            {displayContent && (
              <CollapsibleMarkdown
                nodeId={id}
                content={displayContent}
                fieldKey="content"
                label="Analysis"
                labelColor="text-emerald-700/80"
                onSave={nodeData.onUpdateField}
                connectedScreens={nodeData.connectedScreens}
                onFocusNode={nodeData.onFocusNode}
              />
            )}
            {nodeData.developerTodos && (
              <CollapsibleMarkdown
                nodeId={id}
                content={nodeData.developerTodos}
                fieldKey="developerTodos"
                label="Developer To-Do List"
                labelColor="text-violet-600/90"
                borderColor="border-violet-200 dark:border-violet-800"
                bgColor="bg-violet-50/60 dark:bg-violet-950/20"
                onSave={nodeData.onUpdateField}
                connectedScreens={nodeData.connectedScreens}
                onFocusNode={nodeData.onFocusNode}
              />
            )}
          </div>
        )}

        {/* Footer */}
        {(nodeData.connectedScreenshotCount > 0 || nodeData.generatedByAI || nodeData.assigneeName) && (
          <div className="flex items-center gap-2 border-t border-emerald-200 px-3 py-1.5 dark:border-emerald-800">
            {nodeData.assigneeName && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                {nodeData.assigneeName}
              </span>
            )}
            {nodeData.connectedScreenshotCount > 0 && (
              <span className="text-[9px] text-emerald-500">
                {nodeData.connectedScreenshotCount} connected screen{nodeData.connectedScreenshotCount !== 1 ? "s" : ""}
              </span>
            )}
            {nodeData.generatedByAI && (
              <span className="flex items-center gap-0.5 text-[9px] text-amber-500">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v1m0 16v1m-8-9H3m18 0h-1M5.6 5.6l.7.7m12.1 12.1l.7.7M5.6 18.4l.7-.7m12.1-12.1l.7-.7" />
                </svg>
                AI generated
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default memo(ImprovementNode);
