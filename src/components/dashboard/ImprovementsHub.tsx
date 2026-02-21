"use client";

import { useState, useMemo, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ImprovementCommentThread from "@/components/shared/ImprovementCommentThread";
import ImprovementTodoList from "@/components/shared/ImprovementTodoList";

type ViewMode = "table" | "kanban";
type StatusFilter = "all" | "open" | "in_progress" | "closed";
type PriorityFilter = "all" | "high" | "medium" | "low";
type SortField = "createdAt" | "priority" | "title" | "boardName" | "status";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  closed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};
const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

// Screenshot preview modal
function ScreenshotPreviewModal({
  screenshots,
  initialIndex,
  onClose,
}: {
  screenshots: { nodeId: string; label: string; imageUrl: string }[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const current = screenshots[currentIndex];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 rounded-full bg-zinc-800 p-1.5 text-white shadow-lg hover:bg-zinc-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Navigation arrows */}
        {screenshots.length > 1 && (
          <>
            <button
              onClick={() => setCurrentIndex((i) => (i > 0 ? i - 1 : screenshots.length - 1))}
              className="absolute left-[-48px] top-1/2 -translate-y-1/2 rounded-full bg-zinc-800/80 p-2 text-white hover:bg-zinc-700"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentIndex((i) => (i < screenshots.length - 1 ? i + 1 : 0))}
              className="absolute right-[-48px] top-1/2 -translate-y-1/2 rounded-full bg-zinc-800/80 p-2 text-white hover:bg-zinc-700"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </>
        )}

        {/* Image */}
        <img
          src={current.imageUrl}
          alt={current.label}
          className="max-h-[80vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
        />

        {/* Label + counter */}
        <div className="mt-3 text-center">
          <p className="text-sm font-medium text-white">{current.label}</p>
          {screenshots.length > 1 && (
            <p className="text-xs text-zinc-400 mt-0.5">
              {currentIndex + 1} of {screenshots.length}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScreenshotThumbnails({
  screenshots,
  onPreview,
}: {
  screenshots: { nodeId: string; label: string; imageUrl: string | null }[];
  onPreview?: (screenshots: { nodeId: string; label: string; imageUrl: string }[], index: number) => void;
}) {
  const withImages = screenshots.filter((s): s is { nodeId: string; label: string; imageUrl: string } => !!s.imageUrl);
  if (withImages.length === 0) return null;
  const shown = withImages.slice(0, 3);
  const overflow = withImages.length - shown.length;

  return (
    <div className="flex items-center gap-1">
      {shown.map((s, idx) => (
        <img
          key={s.nodeId}
          src={s.imageUrl}
          alt={s.label}
          title={s.label}
          className="h-6 w-8 cursor-pointer rounded border border-zinc-200 object-cover transition-transform hover:scale-110 dark:border-zinc-700"
          onClick={(e) => {
            e.stopPropagation();
            onPreview?.(withImages, idx);
          }}
        />
      ))}
      {overflow > 0 && (
        <span
          className="cursor-pointer text-[9px] text-zinc-400 hover:text-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            onPreview?.(withImages, shown.length);
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[status] || ""}`}>
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return <span className="text-[10px] text-zinc-300">—</span>;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${PRIORITY_COLORS[priority] || ""}`}>
      {priority}
    </span>
  );
}

function StatsBar({ improvements }: { improvements: any[] }) {
  const total = improvements.length;
  const open = improvements.filter((i) => i.status === "open").length;
  const inProgress = improvements.filter((i) => i.status === "in_progress").length;
  const closed = improvements.filter((i) => i.status === "closed").length;

  const closedWithTime = improvements.filter((i) => i.status === "closed" && i.closedAt && i.createdAt);
  let avgResolution = "—";
  if (closedWithTime.length > 0) {
    const totalMs = closedWithTime.reduce((sum: number, i: any) => sum + (i.closedAt - i.createdAt), 0);
    const avgMs = totalMs / closedWithTime.length;
    const avgDays = Math.round(avgMs / (1000 * 60 * 60 * 24));
    avgResolution = avgDays <= 0 ? "<1d" : `${avgDays}d`;
  }

  const stats = [
    { label: "Total", value: total, color: "text-zinc-900 dark:text-zinc-100" },
    { label: "Open", value: open, color: "text-emerald-600" },
    { label: "In Progress", value: inProgress, color: "text-blue-600" },
    { label: "Closed", value: closed, color: "text-zinc-500" },
    { label: "Avg Resolution", value: avgResolution, color: "text-violet-600" },
  ];

  return (
    <div className="flex flex-wrap gap-4">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-zinc-400">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// Kanban card component
function KanbanCard({
  imp,
  onExpand,
  isExpanded,
  onPreview,
}: {
  imp: any;
  onExpand: (id: string | null) => void;
  isExpanded: boolean;
  onPreview: (screenshots: { nodeId: string; label: string; imageUrl: string }[], index: number) => void;
}) {
  const router = useRouter();
  const impNum = String(imp.number).padStart(3, "0");
  const age = formatRelativeTime(imp.createdAt);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/improvement-id", imp._id);
        e.dataTransfer.setData("application/improvement-status", imp.status);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab rounded-lg border border-zinc-200 bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[8px] font-bold text-white">
              IMP-{impNum}
            </span>
            <PriorityBadge priority={imp.priority} />
          </div>
          <p
            className="text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer hover:text-blue-600"
            onClick={() => onExpand(isExpanded ? null : imp._id)}
          >
            {imp.title}
          </p>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-[9px] text-zinc-400">
        <span className="truncate">{imp.boardName}</span>
        {imp.assigneeName && (
          <span className="flex items-center gap-0.5">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            {imp.assigneeName}
          </span>
        )}
        {imp.commentCount > 0 && (
          <span className="flex items-center gap-0.5">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {imp.commentCount}
          </span>
        )}
        <span className="ml-auto">{age}</span>
      </div>

      <ScreenshotThumbnails screenshots={imp.connectedScreenshots || []} onPreview={onPreview} />

      <button
        onClick={() => router.push(`/board/${imp.boardId}`)}
        className="mt-1.5 text-[9px] text-blue-500 hover:text-blue-700"
      >
        Open in Canvas
      </button>
    </div>
  );
}

// Kanban column
function KanbanColumn({
  status,
  label,
  items,
  expandedId,
  onExpand,
  onDrop,
  color,
  onPreview,
}: {
  status: string;
  label: string;
  items: any[];
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  onDrop: (improvementId: string, newStatus: string) => void;
  color: string;
  onPreview: (screenshots: { nodeId: string; label: string; imageUrl: string }[], index: number) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`flex flex-col rounded-xl border ${dragOver ? "border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/20" : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50"} min-w-[280px] flex-1 transition-colors`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData("application/improvement-id");
        if (id) onDrop(id, status);
      }}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{label}</span>
        </div>
        <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
          {items.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 300px)" }}>
        {items.map((imp) => (
          <KanbanCard
            key={imp._id}
            imp={imp}
            onExpand={onExpand}
            isExpanded={expandedId === imp._id}
            onPreview={onPreview}
          />
        ))}
        {items.length === 0 && (
          <p className="py-8 text-center text-[11px] text-zinc-400">No items</p>
        )}
      </div>
    </div>
  );
}

// Detail expansion panel
function ImprovementDetail({
  imp,
  onClose,
  onPreview,
}: {
  imp: any;
  onClose: () => void;
  onPreview: (screenshots: { nodeId: string; label: string; imageUrl: string }[], index: number) => void;
}) {
  const router = useRouter();

  const displayContent = imp.content || (() => {
    const parts: string[] = [];
    if (imp.currentState) parts.push(`## Problem / Current State\n${imp.currentState}`);
    if (imp.proposedImprovement) parts.push(`## Proposed Solution\n${imp.proposedImprovement}`);
    if (imp.expectedImpact) parts.push(`## Expected Impact\n${imp.expectedImpact}`);
    return parts.join("\n\n");
  })();

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              IMP-{String(imp.number).padStart(3, "0")}
            </span>
            <StatusBadge status={imp.status} />
            <PriorityBadge priority={imp.priority} />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{imp.title}</h3>
          <p className="text-[10px] text-zinc-400">
            {imp.boardName} &middot; Created {formatRelativeTime(imp.createdAt)}
            {imp.assigneeName && <> &middot; Assigned to {imp.assigneeName}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/board/${imp.boardId}`)}
            className="rounded border border-zinc-200 px-2.5 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:border-zinc-700 dark:hover:bg-blue-900/20"
          >
            Open in Canvas
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {displayContent && (
        <div className="mb-3">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600">Analysis</p>
          <div className="prose prose-xs prose-zinc dark:prose-invert max-w-none [&_p]:text-[11px] [&_p]:leading-relaxed [&_li]:text-[11px] [&_h2]:text-[11px] [&_h2]:font-bold [&_h3]:text-[10px] [&_h3]:font-bold [&_ul]:pl-3 [&_ol]:pl-3 [&_code]:text-[10px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
          </div>
        </div>
      )}

      {imp.developerTodos && (
        <div className="mb-3 rounded-md border border-violet-200 bg-violet-50/60 p-2 dark:border-violet-800 dark:bg-violet-950/20">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-violet-600">Developer To-Do List</p>
          <div className="prose prose-xs prose-zinc dark:prose-invert max-w-none [&_p]:text-[11px] [&_li]:text-[11px] [&_h2]:text-[11px] [&_h3]:text-[10px] [&_ul]:pl-3 [&_ol]:pl-3 [&_code]:text-[10px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{imp.developerTodos}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Interactive Task Tracker */}
      <div className="mb-3 rounded-md border border-violet-200 bg-violet-50/30 p-3 dark:border-violet-800 dark:bg-violet-950/10">
        <ImprovementTodoList
          improvementId={imp._id as Id<"improvements">}
          boardId={imp.boardId as Id<"boards">}
        />
      </div>

      {/* Connected screenshots */}
      {imp.connectedScreenshots && imp.connectedScreenshots.length > 0 && (() => {
        const withImages = imp.connectedScreenshots.filter((s: any) => s.imageUrl);
        return (
          <div className="mb-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Connected Screenshots</p>
            <div className="flex flex-wrap gap-2">
              {imp.connectedScreenshots.map((s: any, idx: number) => (
                <div
                  key={s.nodeId}
                  className="group cursor-pointer"
                  onClick={() => {
                    if (s.imageUrl) {
                      const imgIdx = withImages.findIndex((w: any) => w.nodeId === s.nodeId);
                      onPreview(withImages, imgIdx >= 0 ? imgIdx : 0);
                    }
                  }}
                >
                  {s.imageUrl ? (
                    <img
                      src={s.imageUrl}
                      alt={s.label}
                      title={`${s.label} — Click to preview`}
                      className="h-16 w-24 rounded border border-zinc-200 object-cover transition-transform group-hover:scale-105 dark:border-zinc-700"
                    />
                  ) : (
                    <div className="flex h-16 w-24 items-center justify-center rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                      <span className="text-[8px] text-zinc-400 text-center px-1">{s.label}</span>
                    </div>
                  )}
                  <p className="mt-0.5 text-[8px] text-zinc-400 truncate max-w-[96px]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Status history */}
      {imp.statusHistory && imp.statusHistory.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400">Status History</p>
          <div className="space-y-1">
            {imp.statusHistory.map((h: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-zinc-500">
                <span className="text-zinc-300">{new Date(h.changedAt).toLocaleDateString()}</span>
                <span>{h.from}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{h.to}</span>
                <span className="text-zinc-400">by {h.changedByName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <ImprovementCommentThread
        improvementId={imp._id as Id<"improvements">}
        boardId={imp.boardId as Id<"boards">}
      />
    </div>
  );
}

export default function ImprovementsHub() {
  const { user } = useUser();
  const router = useRouter();
  const allImprovements = useQuery(api.improvements.listAllWithBoardInfo);
  const allUsers = useQuery(api.users.listAll);
  const changeStatus = useMutation(api.improvements.changeStatus);
  const assignImprovement = useMutation(api.improvements.assign);
  const slackNotifyStatus = useAction(api.slack.notifyStatusChange);

  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [boardFilter, setBoardFilter] = useState<string>("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<{
    screenshots: { nodeId: string; label: string; imageUrl: string }[];
    index: number;
  } | null>(null);

  const openPreview = useCallback((screenshots: { nodeId: string; label: string; imageUrl: string }[], index: number) => {
    setPreviewState({ screenshots, index });
  }, []);

  // Unique board names for filter
  const boardNames = useMemo(() => {
    if (!allImprovements) return [];
    const names = new Set(allImprovements.map((i) => i.boardName));
    return Array.from(names).sort();
  }, [allImprovements]);

  // Filter + sort
  const filtered = useMemo(() => {
    if (!allImprovements) return [];
    let result = allImprovements;

    if (!includeArchived) {
      result = result.filter((i) => !i.boardArchived);
    }
    if (statusFilter !== "all") {
      result = result.filter((i) => i.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      result = result.filter((i) => i.priority === priorityFilter);
    }
    if (boardFilter !== "all") {
      result = result.filter((i) => i.boardName === boardFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "createdAt") cmp = a.createdAt - b.createdAt;
      else if (sortField === "priority") cmp = (PRIORITY_ORDER[a.priority || "low"] ?? 2) - (PRIORITY_ORDER[b.priority || "low"] ?? 2);
      else if (sortField === "title") cmp = a.title.localeCompare(b.title);
      else if (sortField === "boardName") cmp = a.boardName.localeCompare(b.boardName);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [allImprovements, statusFilter, priorityFilter, boardFilter, includeArchived, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleKanbanDrop = useCallback(async (improvementId: string, newStatus: string) => {
    const imp = allImprovements?.find((i) => i._id === improvementId);
    if (!imp || imp.status === newStatus) return;
    await changeStatus({
      improvementId: improvementId as Id<"improvements">,
      newStatus,
      changedBy: user?.id || "unknown",
      changedByName: user?.fullName || user?.firstName || "Unknown",
    });
    slackNotifyStatus({
      improvementId: improvementId as Id<"improvements">,
      boardId: imp.boardId as Id<"boards">,
      oldStatus: imp.status,
      newStatus,
      changedByName: user?.fullName || user?.firstName || "Unknown",
    }).catch(() => {});
  }, [allImprovements, changeStatus, user, slackNotifyStatus]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline ml-0.5">
        {sortDir === "asc" ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
      </svg>
    );
  };

  if (!allImprovements) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const expandedImp = expandedId ? filtered.find((i) => i._id === expandedId) || allImprovements.find((i) => i._id === expandedId) : null;

  return (
    <div>
      {/* Screenshot preview modal */}
      {previewState && (
        <ScreenshotPreviewModal
          screenshots={previewState.screenshots}
          initialIndex={previewState.index}
          onClose={() => setPreviewState(null)}
        />
      )}

      {/* Stats bar */}
      <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <StatsBar improvements={allImprovements} />
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
          <button
            onClick={() => setViewMode("table")}
            className={`rounded px-2 py-1 text-[10px] font-medium ${viewMode === "table" ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"}`}
          >
            Table
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={`rounded px-2 py-1 text-[10px] font-medium ${viewMode === "kanban" ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"}`}
          >
            Kanban
          </button>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Board filter */}
        <select
          value={boardFilter}
          onChange={(e) => setBoardFilter(e.target.value)}
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <option value="all">All Journeys</option>
          {boardNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {/* Include archived toggle */}
        <label className="flex items-center gap-1.5 text-[10px] text-zinc-500 cursor-pointer">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="h-3 w-3 rounded border-zinc-300 text-blue-600"
          />
          Include archived
        </label>

        <span className="text-[10px] text-zinc-400">{filtered.length} results</span>
      </div>

      {/* Detail panel */}
      {expandedImp && (
        <div className="mb-4">
          <ImprovementDetail imp={expandedImp} onClose={() => setExpandedId(null)} onPreview={openPreview} />
        </div>
      )}

      {/* Table view */}
      {viewMode === "table" && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-3 py-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 cursor-pointer" onClick={() => handleSort("title")}>
                  IMP <SortIcon field="title" />
                </th>
                <th className="px-3 py-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 cursor-pointer" onClick={() => handleSort("status")}>
                  Status <SortIcon field="status" />
                </th>
                <th className="px-3 py-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 cursor-pointer" onClick={() => handleSort("priority")}>
                  Priority <SortIcon field="priority" />
                </th>
                <th className="px-3 py-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 cursor-pointer" onClick={() => handleSort("boardName")}>
                  Journey <SortIcon field="boardName" />
                </th>
                <th className="px-3 py-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Assignee</th>
                <th className="px-3 py-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Screenshots</th>
                <th className="px-3 py-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Tasks</th>
                <th className="px-3 py-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Comments</th>
                <th className="px-3 py-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 cursor-pointer" onClick={() => handleSort("createdAt")}>
                  Age <SortIcon field="createdAt" />
                </th>
                <th className="px-3 py-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((imp) => {
                const impNum = String(imp.number).padStart(3, "0");
                return (
                  <tr
                    key={imp._id}
                    className={`border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${expandedId === imp._id ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setExpandedId(expandedId === imp._id ? null : imp._id)}
                        className="text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-emerald-600 px-1 py-0.5 text-[7px] font-bold text-white">
                            IMP-{impNum}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-zinc-800 hover:text-blue-600 dark:text-zinc-200">
                          {imp.title}
                        </p>
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={imp.status} />
                    </td>
                    <td className="px-3 py-2">
                      <PriorityBadge priority={imp.priority} />
                    </td>
                    <td className="px-3 py-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                      {imp.boardName}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={imp.assigneeId || ""}
                        onChange={(e) => {
                          const selectedUser = allUsers?.find((u: any) => u.clerkId === e.target.value);
                          assignImprovement({
                            improvementId: imp._id as Id<"improvements">,
                            assigneeId: e.target.value || undefined,
                            assigneeName: selectedUser?.name || undefined,
                          });
                        }}
                        className="rounded border border-zinc-200 bg-white px-1 py-0.5 text-[9px] text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                      >
                        <option value="">—</option>
                        {allUsers?.map((u: any) => (
                          <option key={u.clerkId} value={u.clerkId}>{u.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <ScreenshotThumbnails screenshots={imp.connectedScreenshots || []} onPreview={openPreview} />
                    </td>
                    <td className="px-3 py-2">
                      {(imp.todoTotal || 0) > 0 ? (
                        <div className="flex items-center gap-1">
                          <div className="h-1 w-10 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                            <div
                              className={`h-full rounded-full ${imp.todoCompleted === imp.todoTotal ? "bg-emerald-500" : "bg-violet-400"}`}
                              style={{ width: `${Math.round(((imp.todoCompleted || 0) / imp.todoTotal) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-zinc-400">{imp.todoCompleted}/{imp.todoTotal}</span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-zinc-400">
                      {imp.commentCount || 0}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-zinc-400">
                      {formatRelativeTime(imp.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => router.push(`/board/${imp.boardId}`)}
                        className="rounded border border-zinc-200 px-2 py-0.5 text-[9px] font-medium text-blue-600 hover:bg-blue-50 dark:border-zinc-700 dark:hover:bg-blue-900/20"
                      >
                        Go to board
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="py-8 text-center text-[11px] text-zinc-400">
              No improvements match the current filters.
            </p>
          )}
        </div>
      )}

      {/* Kanban view */}
      {viewMode === "kanban" && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          <KanbanColumn
            status="open"
            label="Open"
            color="bg-emerald-400"
            items={filtered.filter((i) => i.status === "open")}
            expandedId={expandedId}
            onExpand={setExpandedId}
            onDrop={handleKanbanDrop}
            onPreview={openPreview}
          />
          <KanbanColumn
            status="in_progress"
            label="In Progress"
            color="bg-blue-500"
            items={filtered.filter((i) => i.status === "in_progress")}
            expandedId={expandedId}
            onExpand={setExpandedId}
            onDrop={handleKanbanDrop}
            onPreview={openPreview}
          />
          <KanbanColumn
            status="closed"
            label="Closed"
            color="bg-zinc-400"
            items={filtered.filter((i) => i.status === "closed")}
            expandedId={expandedId}
            onExpand={setExpandedId}
            onDrop={handleKanbanDrop}
            onPreview={openPreview}
          />
        </div>
      )}
    </div>
  );
}
