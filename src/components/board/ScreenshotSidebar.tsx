"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface ScreenshotSidebarProps {
  boardId: Id<"boards">;
  usedScreenshotIds: Set<string>;
}

const PLATFORMS = ["all", "desktop", "mobile"] as const;
type Tab = "global" | "journey";
type ThumbSize = "S" | "M" | "L";

const THUMB_COL_WIDTH: Record<ThumbSize, number> = {
  S: 100,
  M: 170,
  L: 280,
};

const MIN_WIDTH = 220;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 340;

export default function ScreenshotSidebar({
  boardId,
  usedScreenshotIds,
}: ScreenshotSidebarProps) {
  const { user } = useUser();

  // Global screenshots + folders
  const globalScreenshots = useQuery(api.globalScreenshots.listAll);
  const journeyScreenshots = useQuery(api.globalScreenshots.listByBoard, { boardId });
  const folders = useQuery(api.screenshotFolders.listAll);
  const generateGlobalUploadUrl = useMutation(api.globalScreenshots.generateUploadUrl);
  const saveGlobalScreenshot = useMutation(api.globalScreenshots.save);
  const linkToBoard = useMutation(api.globalScreenshots.linkToBoard);

  const [uploading, setUploading] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("global");
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [thumbSize, setThumbSize] = useState<ThumbSize>("M");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null); // null = "All", "unfiled" = no folder
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const resizing = useRef(false);

  // Resize handle
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX)));
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
  }, [width]);

  // Upload to global repo
  const handleUploadGlobal = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !user) return;
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const compressed = await compressImage(file);
          const uploadUrl = await generateGlobalUploadUrl();
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

          const gsId = await saveGlobalScreenshot({
            storageId,
            filename: file.name,
            contentType: compressed.type,
            label: file.name.replace(/\.[^.]+$/, ""),
            platform,
            uploadedBy: user.id,
            uploadedByName: user.fullName || user.firstName || "User",
            size: compressed.blob.size,
          });

          // If uploading from Journey tab, auto-link to board
          if (activeTab === "journey") {
            await linkToBoard({ globalScreenshotId: gsId, boardId });
          }
        }
      } finally {
        setUploading(false);
      }
    },
    [user, generateGlobalUploadUrl, saveGlobalScreenshot, linkToBoard, boardId, activeTab]
  );

  const handleDragStart = (
    e: React.DragEvent,
    screenshot: { _id: string; url: string | null; label?: string; platform?: string },
    source: "global" | "board"
  ) => {
    if (!screenshot.url) return;
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        type: "screenshot",
        source,
        globalScreenshotId: source === "global" ? screenshot._id : undefined,
        imageUrl: screenshot.url,
        label: screenshot.label || "",
        platform: screenshot.platform || "",
        screenshotId: source === "board" ? screenshot._id : undefined,
      })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const allGlobalScreenshots = globalScreenshots || [];
  const allJourneyScreenshots = journeyScreenshots || [];

  // Count unfiled screenshots
  const unfiledCount = useMemo(() => {
    return allGlobalScreenshots.filter((s) => !s.folderId).length;
  }, [allGlobalScreenshots]);

  // Filter by platform + search + folder
  const filterItems = useCallback((items: any[], applyFolderFilter: boolean) => {
    return items.filter((s) => {
      if (filterPlatform !== "all" && s.platform !== filterPlatform) return false;
      if (search && !s.label?.toLowerCase().includes(search.toLowerCase()) && !s.filename?.toLowerCase().includes(search.toLowerCase())) return false;
      if (applyFolderFilter && activeFolderId !== null) {
        if (activeFolderId === "unfiled") {
          if (s.folderId) return false;
        } else {
          if (s.folderId !== activeFolderId) return false;
        }
      }
      return true;
    });
  }, [filterPlatform, search, activeFolderId]);

  const filteredGlobal = filterItems(allGlobalScreenshots, true);
  const filteredJourney = filterItems(allJourneyScreenshots, false);

  const colWidth = THUMB_COL_WIDTH[thumbSize];
  const cols = Math.max(1, Math.floor((width - 24) / colWidth));

  const renderScreenshot = (screenshot: any, isUsed: boolean, source: "global" | "board") => (
    <div
      key={screenshot._id + source}
      className={cn(
        "group relative overflow-hidden rounded-md border transition-all",
        isUsed
          ? "border-green-300 opacity-40 dark:border-green-700"
          : "cursor-grab border-zinc-200 hover:border-blue-300 hover:shadow-sm active:cursor-grabbing dark:border-zinc-700"
      )}
      draggable={!isUsed}
      onDragStart={(e) => handleDragStart(e, screenshot, source)}
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
      {/* Hover overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-[8px] font-medium text-white">
          {screenshot.label || screenshot.filename}
        </p>
      </div>
      {/* Platform badge - small colored dot with initial */}
      {screenshot.platform && (
        <div className="absolute left-0.5 top-0.5">
          <span className={cn(
            "flex h-3 w-3 items-center justify-center rounded-full text-[5px] font-bold uppercase leading-none text-white",
            screenshot.platform === "mobile" ? "bg-green-600/90" : "bg-blue-600/90"
          )}>
            {screenshot.platform === "mobile" ? "M" : "D"}
          </span>
        </div>
      )}
      {/* Used badge */}
      {isUsed && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-black/30">
          <span className="rounded bg-green-600 px-1 py-0.5 text-[8px] font-bold text-white">
            ON CANVAS
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative flex h-full shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900" style={{ width }}>
      {/* Header */}
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Screenshots
          </h3>
          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {allGlobalScreenshots.length}
          </span>
        </div>

        {/* 2-tab layout */}
        <div className="mt-2 flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          <button
            onClick={() => setActiveTab("global")}
            className={cn(
              "flex-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors",
              activeTab === "global"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            )}
          >
            Global Repo
          </button>
          <button
            onClick={() => setActiveTab("journey")}
            className={cn(
              "flex-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors",
              activeTab === "journey"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            )}
          >
            This Journey
          </button>
        </div>
      </div>

      {/* Upload area - on global and journey tabs */}
      {(activeTab === "global" || activeTab === "journey") && (
        <div className="border-b border-zinc-200 p-2 dark:border-zinc-700">
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-2 py-2 transition-colors",
              uploading
                ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/20"
                : "border-zinc-300 hover:border-blue-400 hover:bg-blue-50/50 dark:border-zinc-600 dark:hover:border-blue-600"
            )}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleUploadGlobal(e.dataTransfer.files);
            }}
          >
            {uploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            )}
            <span className="mt-0.5 text-[10px] text-zinc-500">
              {uploading
                ? "Uploading..."
                : activeTab === "journey"
                  ? "Upload to global + link to journey"
                  : "Upload to global repo"
              }
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUploadGlobal(e.target.files)}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {/* Search & Filter & Size */}
      <div className="space-y-1.5 border-b border-zinc-200 p-2 dark:border-zinc-700">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setFilterPlatform(p)}
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-medium capitalize transition-colors",
                  filterPlatform === p
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          {/* Thumbnail size toggle */}
          <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700">
            {(["S", "M", "L"] as ThumbSize[]).map((size) => (
              <button
                key={size}
                onClick={() => setThumbSize(size)}
                className={cn(
                  "px-1.5 py-0.5 text-[8px] font-bold transition-colors",
                  size === "S" && "rounded-l-[3px]",
                  size === "L" && "rounded-r-[3px]",
                  thumbSize === size
                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                    : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                )}
                title={size === "S" ? "Small thumbnails" : size === "M" ? "Medium thumbnails" : "Large thumbnails"}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Folder browser - only on global tab */}
      {activeTab === "global" && folders && folders.length > 0 && (
        <div className="border-b border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setFoldersExpanded(!foldersExpanded)}
            className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            <span className="uppercase tracking-wider">Folders</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={cn("transition-transform", foldersExpanded && "rotate-180")}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {foldersExpanded && (
            <div className="px-1 pb-1.5 space-y-px">
              {/* All */}
              <button
                onClick={() => setActiveFolderId(null)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors",
                  activeFolderId === null
                    ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                )}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
                <span className="flex-1 text-left">All</span>
                <span className="text-[9px] text-zinc-400">{allGlobalScreenshots.length}</span>
              </button>
              {/* Folders */}
              {folders.map((folder) => (
                <button
                  key={folder._id}
                  onClick={() => setActiveFolderId(folder._id)}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors",
                    activeFolderId === folder._id
                      ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  )}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="flex-1 truncate text-left">{folder.name}</span>
                  <span className="text-[9px] text-zinc-400">{folder.count}</span>
                </button>
              ))}
              {/* Unfiled */}
              <button
                onClick={() => setActiveFolderId("unfiled")}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-[10px] transition-colors",
                  activeFolderId === "unfiled"
                    ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                )}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
                <span className="flex-1 text-left">Unfiled</span>
                <span className="text-[9px] text-zinc-400">{unfiledCount}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Thumbnail grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === "global" ? (
          filteredGlobal.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-zinc-400">
              {allGlobalScreenshots.length === 0 ? "Upload screenshots to the global repo" : "No matches"}
            </p>
          ) : (
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {filteredGlobal.map((screenshot) => renderScreenshot(screenshot, false, "global"))}
            </div>
          )
        ) : (
          filteredJourney.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-zinc-400">
              No screenshots linked to this journey yet
            </p>
          ) : (
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {filteredJourney.map((screenshot) => {
                const isUsed = usedScreenshotIds.has(screenshot._id);
                return renderScreenshot(screenshot, isUsed, "board");
              })}
            </div>
          )
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 z-10 w-1 cursor-col-resize bg-transparent hover:bg-blue-400/50 active:bg-blue-500/50"
        onMouseDown={onResizeStart}
      />
    </div>
  );
}

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
      const MAX_WIDTH = 1920;
      let w = img.width;
      let h = img.height;

      if (w > MAX_WIDTH) {
        h = (h * MAX_WIDTH) / w;
        w = MAX_WIDTH;
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
