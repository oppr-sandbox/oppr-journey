"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Node } from "@xyflow/react";
import { formatRelativeTime } from "@/lib/utils";

interface NodeDetailPanelProps {
  boardId: Id<"boards">;
  node: Node;
  onBack: () => void;
  onFocusNode: (nodeId: string) => void;
}

const PLATFORM_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  desktop: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", label: "Desktop" },
  mobile: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", label: "Mobile" },
  admin: { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300", label: "Admin" },
};

export default function NodeDetailPanel({
  boardId,
  node,
  onBack,
  onFocusNode,
}: NodeDetailPanelProps) {
  const { user } = useUser();
  const comments = useQuery(api.comments.getByBoard, { boardId });
  const addComment = useMutation(api.comments.addComment);
  const resolveComment = useMutation(api.comments.resolveComment);
  const deleteComment = useMutation(api.comments.deleteComment);

  const [text, setText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const data = node.data as any;
  const isScreenshot = node.type === "screenshot";
  const isAttention = node.type === "attention";
  const platform = data.platform || "";
  const platformStyle = PLATFORM_COLORS[platform];
  const assignedPersonas: { personaId: string; name: string; color: string }[] =
    data.assignedPersonas || [];
  const label = isAttention
    ? data.text || "Attention"
    : isScreenshot
      ? data.label || node.id
      : data.text || node.id;

  // Filter comments for this node
  const nodeComments = (comments || []).filter(
    (c) => c.nodeId === node.id && !c.resolved
  );
  const resolvedComments = (comments || []).filter(
    (c) => c.nodeId === node.id && c.resolved
  );

  const handleSubmit = async () => {
    if (!text.trim() || !user) return;
    await addComment({
      boardId,
      nodeId: node.id,
      authorId: user.id,
      authorName: user.fullName || user.firstName || "User",
      text: text.trim(),
    });
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Back button */}
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-700">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to Journey Overview
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Node header with thumbnail */}
        <div className="border-b border-zinc-200 p-3 dark:border-zinc-700">
          {isScreenshot && data.imageUrl && (
            <div className="mb-2">
              <button
                onClick={() => setPreviewOpen(true)}
                className="relative w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-blue-400 transition-colors"
              >
                <img
                  src={data.imageUrl}
                  alt={label}
                  className="w-full h-auto max-h-40 object-cover object-top"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="opacity-0 hover:opacity-100 drop-shadow-lg" style={{ opacity: "inherit" }}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
              </button>
            </div>
          )}

          {isAttention && (
            <div className="mb-2 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-[10px] font-medium uppercase tracking-wider text-red-500">
                Attention Flag
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {label}
            </p>
            {platformStyle && (
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${platformStyle.bg} ${platformStyle.text}`}>
                {platformStyle.label}
              </span>
            )}
          </div>

          <button
            onClick={() => onFocusNode(node.id)}
            className="mt-1.5 text-[10px] text-blue-500 hover:text-blue-600"
          >
            Focus on canvas
          </button>
        </div>

        {/* Assigned Personas */}
        <div className="border-b border-zinc-200 p-3 dark:border-zinc-700">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Assigned Personas
          </p>
          {assignedPersonas.length > 0 ? (
            <div className="space-y-1.5">
              {assignedPersonas.map((p) => (
                <div key={p.personaId} className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-xs text-zinc-700 dark:text-zinc-300">
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-400">No personas assigned</p>
          )}
        </div>

        {/* Comments */}
        <div className="p-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Comments ({nodeComments.length})
            {resolvedComments.length > 0 && (
              <span className="ml-1 text-zinc-300">
                + {resolvedComments.length} resolved
              </span>
            )}
          </p>

          {nodeComments.length === 0 && resolvedComments.length === 0 && (
            <p className="py-3 text-center text-[11px] text-zinc-400">
              No comments on this node yet.
            </p>
          )}

          <div className="space-y-1.5">
            {nodeComments.map((c) => (
              <div
                key={c._id}
                className="group rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
                        {c.authorName}
                      </span>
                      <span className="text-[9px] text-zinc-400">
                        {formatRelativeTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                      {c.text}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => resolveComment({ commentId: c._id, resolved: true })}
                      className="rounded p-0.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                      title="Resolve"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteComment({ commentId: c._id })}
                      className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                      title="Delete"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {resolvedComments.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] text-zinc-400 hover:text-zinc-600">
                  {resolvedComments.length} resolved comment{resolvedComments.length > 1 ? "s" : ""}
                </summary>
                <div className="mt-1.5 space-y-1.5">
                  {resolvedComments.map((c) => (
                    <div
                      key={c._id}
                      className="group rounded-lg border border-green-200 bg-green-50/50 p-2 dark:border-green-800 dark:bg-green-950/20"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
                              {c.authorName}
                            </span>
                            <span className="text-[9px] text-zinc-400">
                              {formatRelativeTime(c.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-400 line-through">
                            {c.text}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => resolveComment({ commentId: c._id, resolved: false })}
                            className="rounded p-0.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            title="Unresolve"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteComment({ commentId: c._id })}
                            className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>

      {/* Add comment - pinned at bottom */}
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="rounded bg-blue-600 px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      {/* Screenshot preview modal */}
      {previewOpen && isScreenshot && data.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={data.imageUrl}
              alt={label}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />
            <button
              onClick={() => setPreviewOpen(false)}
              className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow-md hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
