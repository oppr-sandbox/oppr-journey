"use client";

import { useState, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useFlowStore } from "@/store/flowStore";
import Link from "next/link";
import VersionSelector from "./VersionSelector";

type ImprovementFilter = "all" | "open" | "in_progress" | "closed" | "hidden";

interface ToolbarProps {
  boardId: Id<"boards">;
  boardName: string;
  onAddText: () => void;
  onAddAttention: () => void;
  onAddImprovement: () => void;
  onAddDivider: () => void;
  onAddSection: () => void;
  onFitView: () => void;
  currentVersion?: string;
  improvementFilter: ImprovementFilter;
  onSetImprovementFilter: (filter: ImprovementFilter) => void;
  boardToolIds?: string[];
  onUpdateTools?: (toolIds: string[]) => void;
}

export default function Toolbar({
  boardId,
  boardName,
  onAddText,
  onAddAttention,
  onAddImprovement,
  onAddDivider,
  onAddSection,
  onFitView,
  currentVersion,
  improvementFilter,
  onSetImprovementFilter,
  boardToolIds,
  onUpdateTools,
}: ToolbarProps) {
  const { zoomIn, zoomOut } = useReactFlow();
  const updateBoard = useMutation(api.boards.update);
  const allTools = useQuery(api.tools.getAll);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(boardName);
  const [copied, setCopied] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);

  const handleNameSave = useCallback(() => {
    setEditingName(false);
    if (name.trim() && name !== boardName) {
      updateBoard({ boardId, name: name.trim() });
    }
  }, [name, boardName, boardId, updateBoard]);

  const handleUndo = useCallback(() => {
    useFlowStore.temporal.getState().undo();
  }, []);

  const handleRedo = useCallback(() => {
    useFlowStore.temporal.getState().redo();
  }, []);

  const handleShare = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const temporal = useFlowStore.temporal.getState();

  const FILTER_OPTIONS: { key: ImprovementFilter; label: string }[] = [
    { key: "all", label: "Show All" },
    { key: "open", label: "Open Only" },
    { key: "in_progress", label: "In Progress Only" },
    { key: "closed", label: "Closed Only" },
    { key: "hidden", label: "Hide Improvements" },
  ];

  return (
    <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
      {/* Left: Back + Board name */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          title="Back to dashboard"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        {editingName ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSave();
              if (e.key === "Escape") {
                setName(boardName);
                setEditingName(false);
              }
            }}
            className="rounded border border-blue-400 bg-transparent px-2 py-0.5 text-sm font-medium text-zinc-900 outline-none focus:ring-1 focus:ring-blue-400 dark:text-zinc-100"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="rounded px-2 py-0.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
            title="Click to rename"
          >
            {boardName}
          </button>
        )}
        <VersionSelector boardId={boardId} currentVersion={currentVersion} />
      </div>

      {/* Center: Actions */}
      <div className="flex items-center gap-1">
        {/* Add text */}
        <button
          onClick={onAddText}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Add text annotation"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Text
        </button>

        {/* Add attention */}
        <button
          onClick={onAddAttention}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          title="Add attention block"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Attention
        </button>

        {/* Add improvement */}
        <button
          onClick={onAddImprovement}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
          title="Add improvement suggestion"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2.26C8.19 13.47 7 11.38 7 9a7 7 0 0 1 5-7z" />
          </svg>
          Improve
        </button>

        {/* Add divider */}
        <button
          onClick={onAddDivider}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Add divider line"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="2" y1="12" x2="22" y2="12" strokeDasharray="4 3" />
          </svg>
          Divider
        </button>

        {/* Add section */}
        <button
          onClick={onAddSection}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          title="Add section zone"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3">
            <rect x="3" y="3" width="18" height="18" rx="3" />
          </svg>
          Section
        </button>

        {/* Improvement filter */}
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className={`rounded-md p-1.5 text-xs ${
              improvementFilter !== "all"
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            title="Filter improvements"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>
          {showFilterMenu && (
            <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    onSetImprovementFilter(opt.key);
                    setShowFilterMenu(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[11px] ${
                    improvementFilter === opt.key
                      ? "bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tools selector */}
        {allTools && allTools.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowToolsMenu(!showToolsMenu)}
              className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs ${
                boardToolIds && boardToolIds.length > 0
                  ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                  : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
              title="Select related tools"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              {boardToolIds && boardToolIds.length > 0 && (
                <span className="text-[10px] font-bold">{boardToolIds.length}</span>
              )}
            </button>
            {showToolsMenu && (
              <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Related Tools
                </div>
                {(allTools as any[]).map((tool) => {
                  const isSelected = boardToolIds?.includes(tool._id) ?? false;
                  return (
                    <button
                      key={tool._id}
                      onClick={() => {
                        if (!onUpdateTools) return;
                        const current = boardToolIds || [];
                        const next = isSelected
                          ? current.filter((id) => id !== tool._id)
                          : [...current, tool._id];
                        onUpdateTools(next);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    >
                      <div className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500 text-white"
                          : "border-zinc-300 dark:border-zinc-600"
                      }`}>
                        {isSelected && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                      <span className={isSelected ? "font-medium text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"}>
                        {tool.name}
                      </span>
                      {tool.category && (
                        <span className="ml-auto text-[9px] text-zinc-400">{tool.category}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Undo */}
        <button
          onClick={handleUndo}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Undo (Ctrl+Z)"
          disabled={temporal.pastStates.length === 0}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6M3 13a9 9 0 0 1 15.36-6.36" />
          </svg>
        </button>

        {/* Redo */}
        <button
          onClick={handleRedo}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Redo (Ctrl+Shift+Z)"
          disabled={temporal.futureStates.length === 0}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 7v6h-6M21 13a9 9 0 0 0-15.36-6.36" />
          </svg>
        </button>

        <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Zoom controls */}
        <button
          onClick={() => zoomIn()}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Zoom in"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
          </svg>
        </button>
        <button
          onClick={() => zoomOut()}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Zoom out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35M8 11h6" />
          </svg>
        </button>
        <button
          onClick={onFitView}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Fit view"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </div>

      {/* Right: Share */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          {copied ? "Copied!" : "Share"}
        </button>
      </div>
    </div>
  );
}
