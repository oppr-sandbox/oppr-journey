"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";

interface VersionSelectorProps {
  boardId: Id<"boards">;
  currentVersion?: string;
}

export default function VersionSelector({ boardId, currentVersion }: VersionSelectorProps) {
  const router = useRouter();
  const versions = useQuery(api.versions.getVersionHistory, { boardId });
  const cloneBoard = useMutation(api.versions.cloneBoard);

  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [versionNote, setVersionNote] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateVersion = async () => {
    setCreating(true);
    try {
      const newBoardId = await cloneBoard({
        sourceBoardId: boardId,
        versionNote: versionNote.trim() || undefined,
      });
      setShowCreateModal(false);
      setVersionNote("");
      router.push(`/board/${newBoardId}`);
    } finally {
      setCreating(false);
    }
  };

  const displayVersion = currentVersion || "1.0";

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        v{displayVersion}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowDropdown(false)} />
          <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <div className="border-b border-zinc-100 px-3 py-1.5 dark:border-zinc-700">
              <p className="text-[10px] font-medium uppercase text-zinc-400">Version History</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {versions?.map((v) => (
                <button
                  key={v._id}
                  onClick={() => {
                    setShowDropdown(false);
                    if (v._id !== boardId) {
                      router.push(`/board/${v._id}`);
                    }
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700 ${
                    v._id === boardId ? "bg-blue-50 dark:bg-blue-900/20" : ""
                  }`}
                >
                  <span className={`font-medium ${v._id === boardId ? "text-blue-600 dark:text-blue-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                    v{v.version || "1.0"}
                  </span>
                  {v.versionNote && (
                    <span className="truncate text-[10px] text-zinc-400">{v.versionNote}</span>
                  )}
                  {v._id === boardId && (
                    <span className="ml-auto rounded bg-blue-100 px-1 py-0.5 text-[8px] font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                      CURRENT
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-zinc-100 p-1 dark:border-zinc-700">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  setShowCreateModal(true);
                }}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create New Version
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create Version Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Create New Version
            </h3>
            <p className="mb-3 text-xs text-zinc-500">
              This will create a copy of the current board (v{displayVersion}) as a new version.
            </p>
            <input
              type="text"
              value={versionNote}
              onChange={(e) => setVersionNote(e.target.value)}
              placeholder="What changed? (optional)"
              className="mb-4 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreateVersion()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setVersionNote("");
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVersion}
                disabled={creating}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Version"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
