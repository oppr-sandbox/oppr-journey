"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";
import UserList from "@/components/dashboard/UserList";
import ScreenshotBrowser from "@/components/dashboard/ScreenshotBrowser";
import PersonasEditor from "@/components/dashboard/PersonasEditor";
import ConfigurationPanel from "@/components/dashboard/ConfigurationPanel";
import ToolsPanel from "@/components/dashboard/ToolsPanel";
import ImprovementsHub from "@/components/dashboard/ImprovementsHub";

interface BoardDoc {
  _id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  version?: string;
  parentBoardId?: string;
  rootBoardId?: string;
  versionNote?: string;
  archived?: boolean;
  aiSummary?: string;
  ownerName?: string;
}

interface JourneyGroup {
  rootBoardId: string;
  latestBoard: BoardDoc;
  allVersions: BoardDoc[];
}

type MainTab = "journeys" | "improvements" | "screenshots" | "personas" | "users" | "tools" | "configuration";
type JourneyFilter = "all" | "archived";

export default function DashboardPage() {
  const { user } = useUser();
  const router = useRouter();
  const boards = useQuery(
    api.boards.list,
    user ? {} : "skip"
  ) as BoardDoc[] | undefined;
  const archivedBoards = useQuery(
    api.boards.listArchived,
    user ? {} : "skip"
  ) as BoardDoc[] | undefined;
  const createBoard = useMutation(api.boards.create);
  const removeBoard = useMutation(api.boards.remove);
  const archiveBoard = useMutation(api.boards.archive);
  const restoreBoard = useMutation(api.boards.restore);
  const generateSummary = useAction(api.gemini.generateBoardSummary);
  const upsertUser = useMutation(api.users.upsert);
  const ensureLatestTemplates = useMutation(api.promptTemplates.ensureLatestTemplates);

  // Register/update user on every visit
  useEffect(() => {
    if (user) {
      upsertUser({
        clerkId: user.id,
        name: user.fullName || user.firstName || "User",
        email: user.primaryEmailAddress?.emailAddress || "",
        imageUrl: user.imageUrl || undefined,
      });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-upgrade stale prompt templates on every dashboard visit
  useEffect(() => {
    ensureLatestTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allTools = useQuery(api.tools.getAll);

  const [showDialog, setShowDialog] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [boardDesc, setBoardDesc] = useState("");
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [expandedJourney, setExpandedJourney] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>("journeys");
  const [journeyFilter, setJourneyFilter] = useState<JourneyFilter>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());

  // Group boards by journey (rootBoardId)
  const journeyGroups = useMemo(() => {
    if (!boards) return [];

    const groups = new Map<string, BoardDoc[]>();

    for (const board of boards) {
      const rootId = board.rootBoardId || board._id;
      const existing = groups.get(rootId) || [];
      existing.push(board);
      groups.set(rootId, existing);
    }

    const result: JourneyGroup[] = [];
    for (const [rootId, versions] of groups) {
      versions.sort((a, b) => b.updatedAt - a.updatedAt);
      result.push({
        rootBoardId: rootId,
        latestBoard: versions[0],
        allVersions: versions.sort((a, b) => {
          const vA = a.version || "1.0";
          const vB = b.version || "1.0";
          return vB.localeCompare(vA, undefined, { numeric: true });
        }),
      });
    }

    result.sort((a, b) => b.latestBoard.updatedAt - a.latestBoard.updatedAt);
    return result;
  }, [boards]);

  const handleCreate = async () => {
    if (!boardName.trim() || !user) return;
    setCreating(true);
    try {
      const boardId = await createBoard({
        name: boardName.trim(),
        description: boardDesc.trim() || undefined,
        ownerId: user.id,
        ownerName: user.fullName || user.firstName || "User",
        toolIds: selectedToolIds.length > 0 ? selectedToolIds as any : undefined,
      });
      setShowDialog(false);
      setBoardName("");
      setBoardDesc("");
      setSelectedToolIds([]);
      router.push(`/board/${boardId}`);
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    await archiveBoard({ boardId: boardId as any });
  };

  const handleRestore = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    await restoreBoard({ boardId: boardId as any });
  };

  const handleDelete = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    if (!confirm("Permanently delete this journey and all its contents? This cannot be undone.")) return;
    await removeBoard({ boardId: boardId as any });
  };

  const handleGenerateSummary = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    setGeneratingIds((prev) => new Set(prev).add(boardId));
    try {
      await generateSummary({ boardId: boardId as any });
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(boardId);
        return next;
      });
    }
  };

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    {
      key: "journeys",
      label: "Journeys",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" />
        </svg>
      ),
    },
    {
      key: "improvements",
      label: "Improvements",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2.26C8.19 13.47 7 11.38 7 9a7 7 0 0 1 5-7z" />
        </svg>
      ),
    },
    {
      key: "screenshots",
      label: "Screenshots",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
        </svg>
      ),
    },
    {
      key: "personas",
      label: "Personas",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      key: "users",
      label: "Users",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      key: "tools",
      label: "Tools",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      ),
    },
    {
      key: "configuration",
      label: "Configuration",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              OPPR Customer Journey Tool
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Map, analyze and optimize customer journeys
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {user.fullName || user.firstName}
              </span>
            )}
            <UserButton afterSignOutUrl="/" />
            {mainTab === "journeys" && (
              <button
                onClick={() => setShowDialog(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                + New Journey
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Primary tab bar */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <nav className="flex">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMainTab(tab.key)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  mainTab === tab.key
                    ? "border-blue-600 text-zinc-900 dark:text-zinc-100"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
          {/* View mode toggle — only on journeys tab */}
          {mainTab === "journeys" && journeyFilter === "all" && (
            <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded p-1 ${viewMode === "grid" ? "bg-zinc-200 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                title="Grid view"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600 dark:text-zinc-400">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`rounded p-1 ${viewMode === "table" ? "bg-zinc-200 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                title="Table view"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600 dark:text-zinc-400">
                  <path d="M3 6h18M3 12h18M3 18h18" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Journey sub-filters */}
      {mainTab === "journeys" && (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div className="flex gap-1">
            <button
              onClick={() => setJourneyFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                journeyFilter === "all"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setJourneyFilter("archived")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                journeyFilter === "archived"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              Archived{archivedBoards?.length ? ` (${archivedBoards.length})` : ""}
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-6 py-6">
        {mainTab === "configuration" ? (
          <ConfigurationPanel />
        ) : mainTab === "improvements" ? (
          <ImprovementsHub />
        ) : mainTab === "tools" ? (
          <ToolsPanel />
        ) : mainTab === "users" ? (
          <UserList />
        ) : mainTab === "screenshots" ? (
          <ScreenshotBrowser />
        ) : mainTab === "personas" ? (
          <PersonasEditor />
        ) : /* mainTab === "journeys" */ journeyFilter === "archived" ? (
          /* Archived journeys view */
          <div>
            {!archivedBoards || archivedBoards.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-400">No archived journeys.</p>
            ) : (
              <div className="space-y-2">
                {archivedBoards.map((board) => (
                  <div
                    key={board._id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{board.name}</p>
                      {board.description && (
                        <p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">{board.description}</p>
                      )}
                      <p className="mt-1 text-[10px] text-zinc-400">Archived {formatRelativeTime(board.updatedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleRestore(e, board._id)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Restore
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, board._id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                      >
                        Delete Forever
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : boards === undefined ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 text-6xl opacity-30">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-medium text-zinc-700 dark:text-zinc-300">
              No journeys yet
            </h2>
            <p className="mb-6 text-sm text-zinc-500">
              Create your first customer journey to get started.
            </p>
            <button
              onClick={() => setShowDialog(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + New Journey
            </button>
          </div>
        ) : viewMode === "table" ? (
          /* Table view */
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Description</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Creator</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Version</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Versions</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Updated</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {journeyGroups.map((group) => {
                  const board = group.latestBoard;
                  return (
                    <tr
                      key={group.rootBoardId}
                      onClick={() => router.push(`/board/${board._id}`)}
                      className="cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{board.name}</p>
                        {board.aiSummary && (
                          <p className="mt-0.5 text-[10px] text-zinc-400 line-clamp-1">{board.aiSummary}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="line-clamp-1">{board.description || "\u2014"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                        {board.ownerName || "\u2014"}
                      </td>
                      <td className="px-4 py-3">
                        {board.version && (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            v{board.version}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {group.allVersions.length}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {formatRelativeTime(board.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {!board.aiSummary && (
                            <button
                              onClick={(e) => handleGenerateSummary(e, board._id)}
                              disabled={generatingIds.has(board._id)}
                              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-amber-500 dark:hover:bg-zinc-800 disabled:opacity-50"
                              title="Generate AI summary"
                            >
                              {generatingIds.has(board._id) ? (
                                <span className="h-3.5 w-3.5 block animate-spin rounded-full border border-amber-400 border-t-transparent" />
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 3v1m0 16v1m-8-9H3m18 0h-1M5.6 5.6l.7.7m12.1 12.1l.7.7M5.6 18.4l.7-.7m12.1-12.1l.7-.7" />
                                </svg>
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => handleArchive(e, board._id)}
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                            title="Archive"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid view (default) */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {journeyGroups.map((group) => {
              const board = group.latestBoard;
              const versionCount = group.allVersions.length;
              const isExpanded = expandedJourney === group.rootBoardId;

              return (
                <div key={group.rootBoardId} className="space-y-2">
                  {/* Main journey card */}
                  <div
                    onClick={() => router.push(`/board/${board._id}`)}
                    className="group cursor-pointer rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-600"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                          {board.name}
                        </h3>
                        {board.version && (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            v{board.version}
                          </span>
                        )}
                        {versionCount > 1 && (
                          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                            {versionCount} versions
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {!board.aiSummary && (
                          <button
                            onClick={(e) => handleGenerateSummary(e, board._id)}
                            disabled={generatingIds.has(board._id)}
                            className="rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-amber-500 group-hover:opacity-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                            title="Generate AI summary"
                          >
                            {generatingIds.has(board._id) ? (
                              <span className="h-3.5 w-3.5 block animate-spin rounded-full border border-amber-400 border-t-transparent" />
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 3v1m0 16v1m-8-9H3m18 0h-1M5.6 5.6l.7.7m12.1 12.1l.7.7M5.6 18.4l.7-.7m12.1-12.1l.7-.7" />
                              </svg>
                            )}
                          </button>
                        )}
                        <button
                          onClick={(e) => handleArchive(e, board._id)}
                          className="rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100 dark:hover:bg-zinc-800"
                          title="Archive journey"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {board.aiSummary && (
                      <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-2">
                        {board.aiSummary}
                      </p>
                    )}
                    {board.description && !board.aiSummary && (
                      <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                        {board.description}
                      </p>
                    )}
                    {board.versionNote && (
                      <p className="mb-2 text-xs text-blue-500 dark:text-blue-400">
                        {board.versionNote}
                      </p>
                    )}
                    {board.ownerName && (
                      <p className="mb-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Created by {board.ownerName}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        Updated {formatRelativeTime(board.updatedAt)}
                      </p>
                      {versionCount > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedJourney(isExpanded ? null : group.rootBoardId);
                          }}
                          className="text-[10px] text-blue-500 hover:text-blue-700 dark:text-blue-400"
                        >
                          {isExpanded ? "Hide versions" : "Show all versions"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded version list */}
                  {isExpanded && versionCount > 1 && (
                    <div className="ml-4 space-y-1">
                      {group.allVersions
                        .filter((v) => v._id !== board._id)
                        .map((version) => (
                          <div
                            key={version._id}
                            onClick={() => router.push(`/board/${version._id}`)}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3 transition-all hover:border-blue-200 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-blue-700"
                          >
                            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              v{version.version || "1.0"}
                            </span>
                            {version.versionNote && (
                              <span className="truncate text-xs text-zinc-400">
                                {version.versionNote}
                              </span>
                            )}
                            <span className="ml-auto text-[10px] text-zinc-400">
                              {formatRelativeTime(version.updatedAt)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Journey Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Create New Journey
            </h2>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Journey Name
              </label>
              <input
                type="text"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                placeholder="e.g., Onboarding Flow v2"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Description (optional)
              </label>
              <textarea
                value={boardDesc}
                onChange={(e) => setBoardDesc(e.target.value)}
                placeholder="What journey does this map?"
                rows={2}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            {/* Tool selection */}
            {allTools && allTools.length > 0 && (
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Related Tools (optional)
                </label>
                <p className="mb-2 text-[11px] text-zinc-400">
                  Select which tools this journey covers. AI features will use their descriptions as context.
                </p>
                <div className="space-y-1.5">
                  {(allTools as any[]).map((tool) => (
                    <label
                      key={tool._id}
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      <input
                        type="checkbox"
                        checked={selectedToolIds.includes(tool._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedToolIds((prev) => [...prev, tool._id]);
                          } else {
                            setSelectedToolIds((prev) => prev.filter((id) => id !== tool._id));
                          }
                        }}
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{tool.name}</span>
                      {tool.category && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800">
                          {tool.category}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDialog(false);
                  setBoardName("");
                  setBoardDesc("");
                  setSelectedToolIds([]);
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!boardName.trim() || creating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Journey"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
