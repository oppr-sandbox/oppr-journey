"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ScreenshotPreviewModal from "./ScreenshotPreviewModal";

const PLATFORMS = ["all", "desktop", "mobile"] as const;

type SidebarView =
  | { kind: "all" }
  | { kind: "unfiled" }
  | { kind: "folder"; folderId: Id<"screenshotFolders"> }
  | { kind: "journey"; boardId: string };

export default function ScreenshotBrowser() {
  const { user } = useUser();
  const globalScreenshots = useQuery(api.globalScreenshots.listAll);
  const boardFolders = useQuery(api.globalScreenshots.getFoldersWithBoards);
  const screenshotFolders = useQuery(api.screenshotFolders.listAll);
  const currentUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  const generateUploadUrl = useMutation(api.globalScreenshots.generateUploadUrl);
  const saveGlobalScreenshot = useMutation(api.globalScreenshots.save);
  const removeGlobalScreenshot = useMutation(api.globalScreenshots.remove);
  const updateScreenshot = useMutation(api.globalScreenshots.update);
  const bulkMoveToFolder = useMutation(api.globalScreenshots.bulkMoveToFolder);
  const bulkDelete = useMutation(api.globalScreenshots.bulkDelete);
  const createFolder = useMutation(api.screenshotFolders.create);
  const renameFolder = useMutation(api.screenshotFolders.rename);
  const removeFolder = useMutation(api.screenshotFolders.remove);
  const updateLastViewed = useMutation(api.users.updateLastViewedScreenshots);

  const [uploading, setUploading] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [sidebarView, setSidebarView] = useState<SidebarView>({ kind: "all" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [previewScreenshot, setPreviewScreenshot] = useState<any>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState("");
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<string | null>(null);
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);

  // "NEW" badge logic: capture lastViewedScreenshotsAt on mount, then update
  const newBadgeThreshold = useRef<number | null>(null);
  const hasSetThreshold = useRef(false);

  useEffect(() => {
    if (currentUser && !hasSetThreshold.current) {
      newBadgeThreshold.current = currentUser.lastViewedScreenshotsAt ?? 0;
      hasSetThreshold.current = true;
      // Update the last viewed timestamp
      if (user?.id) {
        updateLastViewed({ clerkId: user.id });
      }
    }
  }, [currentUser, user?.id, updateLastViewed]);

  // Collect all unique tags across screenshots
  const allTags = useMemo(() => {
    if (!globalScreenshots) return [];
    const tagSet = new Set<string>();
    for (const s of globalScreenshots) {
      if (s.tags) {
        for (const t of s.tags) tagSet.add(t);
      }
    }
    return Array.from(tagSet).sort();
  }, [globalScreenshots]);

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !user) return;
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const compressed = await compressImage(file);
          const uploadUrl = await generateUploadUrl();
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": compressed.type },
            body: compressed.blob,
          });
          const { storageId } = await response.json();

          const lower = file.name.toLowerCase();
          let platform: string | undefined;
          if (lower.includes("mobile") || lower.includes("phone") || lower.includes("app")) {
            platform = "mobile";
          } else {
            platform = "desktop";
          }

          const folderId =
            sidebarView.kind === "folder" ? sidebarView.folderId : undefined;

          await saveGlobalScreenshot({
            storageId,
            filename: file.name,
            contentType: compressed.type,
            label: file.name.replace(/\.[^.]+$/, ""),
            platform,
            uploadedBy: user.id,
            uploadedByName: user.fullName || user.firstName || "User",
            folderId,
            size: compressed.blob.size,
          });
        }
      } finally {
        setUploading(false);
      }
    },
    [user, generateUploadUrl, saveGlobalScreenshot, sidebarView]
  );

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim() || !user) return;
    await createFolder({ name: newFolderName.trim(), createdBy: user.id });
    setNewFolderName("");
    setCreatingFolder(false);
  }, [newFolderName, user, createFolder]);

  const handleRenameFolder = useCallback(
    async (id: string) => {
      if (!renamingFolderName.trim()) return;
      await renameFolder({
        id: id as Id<"screenshotFolders">,
        name: renamingFolderName.trim(),
      });
      setRenamingFolderId(null);
      setRenamingFolderName("");
    },
    [renamingFolderName, renameFolder]
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      await removeFolder({ id: id as Id<"screenshotFolders"> });
      setDeleteFolderConfirm(null);
      // If we were viewing this folder, go back to All
      if (sidebarView.kind === "folder" && sidebarView.folderId === id) {
        setSidebarView({ kind: "all" });
      }
    },
    [removeFolder, sidebarView]
  );

  // Selection handling
  const toggleSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastClickedId && lastClickedId !== id) {
          // Range select
          const ids = filtered.map((s) => s._id as string);
          const startIdx = ids.indexOf(lastClickedId);
          const endIdx = ids.indexOf(id);
          if (startIdx !== -1 && endIdx !== -1) {
            const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
            for (let i = from; i <= to; i++) {
              next.add(ids[i]);
            }
          }
        } else {
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }

        return next;
      });
      setLastClickedId(id);
    },
    [lastClickedId] // filtered is used inside but changes shouldn't trigger re-creation
  );

  // Drag from cards to folders
  const handleCardDragStart = useCallback(
    (e: React.DragEvent, id: string) => {
      const ids = selectedIds.has(id)
        ? Array.from(selectedIds)
        : [id];
      e.dataTransfer.setData("application/screenshot-ids", JSON.stringify(ids));
      e.dataTransfer.effectAllowed = "move";
    },
    [selectedIds]
  );

  const handleFolderDrop = useCallback(
    async (e: React.DragEvent, folderId: Id<"screenshotFolders"> | undefined) => {
      e.preventDefault();
      setDragOverTarget(null);
      const data = e.dataTransfer.getData("application/screenshot-ids");
      if (!data) return;
      const ids = JSON.parse(data) as string[];
      await bulkMoveToFolder({
        ids: ids as Id<"globalScreenshots">[],
        folderId,
      });
      setSelectedIds(new Set());
    },
    [bulkMoveToFolder]
  );

  const handleBulkDelete = useCallback(async () => {
    await bulkDelete({ ids: Array.from(selectedIds) as Id<"globalScreenshots">[] });
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
  }, [selectedIds, bulkDelete]);

  const handleBulkMove = useCallback(
    async (folderId: Id<"screenshotFolders"> | undefined) => {
      await bulkMoveToFolder({
        ids: Array.from(selectedIds) as Id<"globalScreenshots">[],
        folderId,
      });
      setSelectedIds(new Set());
      setShowMoveDropdown(false);
    },
    [selectedIds, bulkMoveToFolder]
  );

  // Data
  const allScreenshots = globalScreenshots || [];
  const journeyFolders = boardFolders || [];
  const folders = screenshotFolders || [];
  const unfiledCount = allScreenshots.filter((s) => !s.folderId).length;

  // Filtering pipeline
  const filtered = useMemo(() => {
    let result = [...allScreenshots];

    // 1. Sidebar filter
    if (sidebarView.kind === "unfiled") {
      result = result.filter((s) => !s.folderId);
    } else if (sidebarView.kind === "folder") {
      result = result.filter((s) => s.folderId === sidebarView.folderId);
    } else if (sidebarView.kind === "journey") {
      result = result.filter((s) =>
        s.boardIds?.includes(sidebarView.boardId)
      );
    }

    // 2. Platform filter
    if (filterPlatform !== "all") {
      result = result.filter((s) => s.platform === filterPlatform);
    }

    // 3. Tag filter
    if (filterTag !== "all") {
      result = result.filter((s) => s.tags?.includes(filterTag));
    }

    // 4. Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.label?.toLowerCase().includes(q) ||
          s.filename.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // 5. Sort
    result.sort((a, b) =>
      sortOrder === "newest"
        ? b.createdAt - a.createdAt
        : a.createdAt - b.createdAt
    );

    return result;
  }, [allScreenshots, sidebarView, filterPlatform, filterTag, search, sortOrder]);

  // Upload label
  const uploadLabel = useMemo(() => {
    if (uploading) return "Uploading...";
    if (sidebarView.kind === "folder") {
      const f = folders.find((f) => f._id === sidebarView.folderId);
      return f ? `Upload to ${f.name}` : "Upload";
    }
    return "Upload";
  }, [uploading, sidebarView, folders]);

  if (globalScreenshots === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Left sidebar */}
      <div className="w-56 shrink-0 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Browse
        </h3>

        {/* All Screenshots */}
        <SidebarItem
          active={sidebarView.kind === "all"}
          onClick={() => setSidebarView({ kind: "all" })}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
            </svg>
          }
          label="All Screenshots"
          count={allScreenshots.length}
          isDropTarget={dragOverTarget === "all"}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverTarget("all");
          }}
          onDragLeave={() => setDragOverTarget(null)}
          onDrop={() => {}}
        />

        {/* Unfiled */}
        <SidebarItem
          active={sidebarView.kind === "unfiled"}
          onClick={() => setSidebarView({ kind: "unfiled" })}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
          }
          label="Unfiled"
          count={unfiledCount}
          isDropTarget={dragOverTarget === "unfiled"}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverTarget("unfiled");
          }}
          onDragLeave={() => setDragOverTarget(null)}
          onDrop={(e) => handleFolderDrop(e, undefined)}
        />

        {/* Folders */}
        <div className="mt-3 flex items-center justify-between">
          <h3 className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
            Folders
          </h3>
          <button
            onClick={() => {
              setCreatingFolder(true);
              setNewFolderName("");
            }}
            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            title="New Folder"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {creatingFolder && (
          <div className="mt-1">
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") setCreatingFolder(false);
              }}
              onBlur={() => {
                if (newFolderName.trim()) handleCreateFolder();
                else setCreatingFolder(false);
              }}
              placeholder="Folder name..."
              className="w-full rounded-md border border-blue-400 bg-white px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400 dark:border-blue-600 dark:bg-zinc-800 dark:text-zinc-200"
            />
          </div>
        )}

        {folders.map((folder) => (
          <div key={folder._id} className="relative">
            {renamingFolderId === folder._id ? (
              <div className="mt-0.5">
                <input
                  autoFocus
                  type="text"
                  value={renamingFolderName}
                  onChange={(e) => setRenamingFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameFolder(folder._id);
                    if (e.key === "Escape") setRenamingFolderId(null);
                  }}
                  onBlur={() => {
                    if (renamingFolderName.trim()) handleRenameFolder(folder._id);
                    else setRenamingFolderId(null);
                  }}
                  className="w-full rounded-md border border-blue-400 bg-white px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400 dark:border-blue-600 dark:bg-zinc-800 dark:text-zinc-200"
                />
              </div>
            ) : (
              <SidebarItem
                active={sidebarView.kind === "folder" && sidebarView.folderId === folder._id}
                onClick={() =>
                  setSidebarView({ kind: "folder", folderId: folder._id as Id<"screenshotFolders"> })
                }
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                }
                label={folder.name}
                count={folder.count}
                isDropTarget={dragOverTarget === folder._id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverTarget(folder._id);
                }}
                onDragLeave={() => setDragOverTarget(null)}
                onDrop={(e) => handleFolderDrop(e, folder._id as Id<"screenshotFolders">)}
                menuButton={
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderMenuId(folderMenuId === folder._id ? null : folder._id);
                      }}
                      className="rounded p-0.5 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100 dark:hover:bg-zinc-700"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="6" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="18" r="2" />
                      </svg>
                    </button>
                    {folderMenuId === folder._id && (
                      <div className="absolute left-0 top-full z-20 mt-1 w-28 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingFolderId(folder._id);
                            setRenamingFolderName(folder.name);
                            setFolderMenuId(null);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                        >
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteFolderConfirm(folder._id);
                            setFolderMenuId(null);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                }
              />
            )}
          </div>
        ))}

        {/* By Journey */}
        {journeyFolders.length > 0 && (
          <>
            <h3 className="mb-1 mt-3 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
              By Journey
            </h3>
            {journeyFolders.map((f) => (
              <SidebarItem
                key={f.boardId}
                active={sidebarView.kind === "journey" && sidebarView.boardId === f.boardId}
                onClick={() =>
                  setSidebarView(
                    sidebarView.kind === "journey" && sidebarView.boardId === f.boardId
                      ? { kind: "all" }
                      : { kind: "journey", boardId: f.boardId }
                  )
                }
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                }
                label={f.boardName}
                count={f.count}
              />
            ))}
          </>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1">
        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search screenshots..."
            className="w-64 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          />
          <div className="flex gap-1">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setFilterPlatform(p)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-medium capitalize transition-colors",
                  filterPlatform === p
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          {/* Tag filter */}
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <option value="all">All Tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {/* Sort */}
          <button
            onClick={() => setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))}
            className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Sort: {sortOrder === "newest" ? "Newest" : "Oldest"}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {/* Upload */}
          <label className="ml-auto cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
            {uploadLabel}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-400">
            {allScreenshots.length === 0
              ? "No screenshots uploaded yet. Upload to get started."
              : "No matches."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((screenshot) => {
              const isSelected = selectedIds.has(screenshot._id);
              const isNew =
                newBadgeThreshold.current !== null &&
                screenshot.createdAt > newBadgeThreshold.current;

              return (
                <div
                  key={screenshot._id}
                  className={cn(
                    "group relative overflow-hidden rounded-lg border bg-white transition-all hover:shadow-md dark:bg-zinc-900",
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700"
                      : "border-zinc-200 hover:border-blue-300 dark:border-zinc-700"
                  )}
                  draggable={selectedIds.size > 0 || isSelected}
                  onDragStart={(e) => handleCardDragStart(e, screenshot._id)}
                  onClick={() => setPreviewScreenshot(screenshot)}
                >
                  {screenshot.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={screenshot.url}
                      alt={screenshot.label || screenshot.filename}
                      className="block h-auto w-full"
                      draggable={false}
                    />
                  )}

                  {/* Checkbox */}
                  <div
                    className={cn(
                      "absolute left-1.5 top-1.5 z-10",
                      isSelected || selectedIds.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(screenshot._id, e.shiftKey);
                      }}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                        isSelected
                          ? "border-blue-500 bg-blue-500 text-white"
                          : "border-white/80 bg-black/30 text-transparent hover:border-blue-400"
                      )}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* NEW badge */}
                  {isNew && (
                    <div className="absolute right-1.5 top-1.5 z-10">
                      <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">
                        NEW
                      </span>
                    </div>
                  )}

                  {/* Info overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="truncate text-xs font-medium text-white">
                      {screenshot.label || screenshot.filename}
                    </p>
                    <p className="text-[10px] text-zinc-300">
                      by {screenshot.uploadedByName}
                      {screenshot.usageCount !== undefined &&
                        screenshot.usageCount > 0 && (
                          <>
                            {" "}
                            &middot; Used in {screenshot.usageCount}{" "}
                            {screenshot.usageCount === 1 ? "journey" : "journeys"}
                          </>
                        )}
                    </p>
                  </div>

                  {/* Platform badge */}
                  {screenshot.platform && !isNew && (
                    <div className="absolute right-1.5 top-1.5">
                      <span
                        className={cn(
                          "rounded px-1 py-0.5 text-[8px] font-bold uppercase text-white",
                          screenshot.platform === "mobile"
                            ? "bg-green-600/80"
                            : "bg-blue-600/80"
                        )}
                      >
                        {screenshot.platform}
                      </span>
                    </div>
                  )}

                  {/* Tags */}
                  {screenshot.tags && screenshot.tags.length > 0 && (
                    <div className="absolute bottom-8 left-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {screenshot.tags.slice(0, 3).map((tag: string) => (
                        <span
                          key={tag}
                          className="rounded bg-black/40 px-1 py-0.5 text-[7px] text-white"
                        >
                          {tag}
                        </span>
                      ))}
                      {screenshot.tags.length > 3 && (
                        <span className="rounded bg-black/40 px-1 py-0.5 text-[7px] text-white">
                          +{screenshot.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Floating action bar for multi-select */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400"
            >
              Deselect All
            </button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
            {/* Move to folder dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMoveDropdown(!showMoveDropdown)}
                className="flex items-center gap-1 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300"
              >
                Move to folder
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {showMoveDropdown && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-40 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                  <button
                    onClick={() => handleBulkMove(undefined)}
                    className="block w-full px-3 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  >
                    Unfiled
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f._id}
                      onClick={() => handleBulkMove(f._id as Id<"screenshotFolders">)}
                      className="block w-full px-3 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
            >
              Delete Selected
            </button>
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewScreenshot && (
        <ScreenshotPreviewModal
          screenshot={previewScreenshot}
          allTags={allTags}
          onClose={() => setPreviewScreenshot(null)}
          onUpdate={(updates) => {
            updateScreenshot({ id: previewScreenshot._id as Id<"globalScreenshots">, ...updates });
          }}
          onDelete={() => {
            removeGlobalScreenshot({ id: previewScreenshot._id as Id<"globalScreenshots"> });
            setPreviewScreenshot(null);
          }}
        />
      )}

      {/* Bulk delete confirm */}
      <ConfirmModal
        open={showBulkDeleteConfirm}
        title="Delete Selected Screenshots"
        message={`This will permanently delete ${selectedIds.size} screenshot${selectedIds.size === 1 ? "" : "s"} from the global repository and unlink from all journeys.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      {/* Folder delete confirm */}
      <ConfirmModal
        open={deleteFolderConfirm !== null}
        title="Delete Folder"
        message="This will delete the folder. Screenshots inside will become unfiled (not deleted)."
        confirmLabel="Delete Folder"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteFolderConfirm) handleDeleteFolder(deleteFolderConfirm);
        }}
        onCancel={() => setDeleteFolderConfirm(null)}
      />
    </div>
  );
}

// ---- Sidebar Item Component ----

function SidebarItem({
  active,
  onClick,
  icon,
  label,
  count,
  isDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
  menuButton,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  isDropTarget?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  menuButton?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
        active
          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
        isDropTarget && "ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20"
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
      <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-400">
        {menuButton}
        {count}
      </span>
    </button>
  );
}

// ---- Image compression ----

async function compressImage(file: File): Promise<{ blob: Blob; type: string }> {
  return new Promise((resolve) => {
    if (file.size < 500_000) {
      resolve({ blob: file, type: file.type });
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const MAX = 1920;
      let w = img.width;
      let h = img.height;
      if (w > MAX) {
        h = (h * MAX) / w;
        w = MAX;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve({ blob: blob!, type: "image/jpeg" }),
        "image/jpeg",
        0.8
      );
    };
    img.src = url;
  });
}
