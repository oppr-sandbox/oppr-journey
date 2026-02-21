"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Node } from "@xyflow/react";
import { formatRelativeTime } from "@/lib/utils";

interface CommentsPanelProps {
  boardId: Id<"boards">;
  nodes: Node[];
  onFocusNode: (nodeId: string) => void;
  filterNodeId?: string | null;
  onClearFilter?: () => void;
}

export default function CommentsPanel({
  boardId,
  nodes,
  onFocusNode,
  filterNodeId,
  onClearFilter,
}: CommentsPanelProps) {
  const { user } = useUser();
  const comments = useQuery(api.comments.getByBoard, { boardId });
  const addComment = useMutation(api.comments.addComment);
  const resolveComment = useMutation(api.comments.resolveComment);
  const deleteComment = useMutation(api.comments.deleteComment);

  const [text, setText] = useState("");
  const [attachToNode, setAttachToNode] = useState<string | "">(filterNodeId || "");
  const [showResolved, setShowResolved] = useState(false);

  const screenshotNodes = nodes.filter((n) => n.type === "screenshot");
  const nodeMap = new Map(screenshotNodes.map((n) => [n.id, (n.data as any)?.label || n.id]));

  const handleSubmit = async () => {
    if (!text.trim() || !user) return;
    await addComment({
      boardId,
      nodeId: attachToNode || undefined,
      authorId: user.id,
      authorName: user.fullName || user.firstName || "User",
      text: text.trim(),
    });
    setText("");
  };

  const filteredComments = (comments || []).filter((c) => {
    if (filterNodeId && c.nodeId !== filterNodeId) return false;
    if (!showResolved && c.resolved) return false;
    return true;
  });

  // Group by node
  const boardLevelComments = filteredComments.filter((c) => !c.nodeId);
  const nodeGrouped = new Map<string, typeof filteredComments>();
  for (const c of filteredComments) {
    if (c.nodeId) {
      const existing = nodeGrouped.get(c.nodeId) || [];
      existing.push(c);
      nodeGrouped.set(c.nodeId, existing);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-700">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Comments ({filteredComments.length})
          </p>
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`text-[10px] font-medium ${
              showResolved ? "text-blue-500" : "text-zinc-400"
            }`}
          >
            {showResolved ? "Hide resolved" : "Show resolved"}
          </button>
        </div>
        {filterNodeId && (
          <div className="flex items-center gap-1 rounded bg-blue-50 px-2 py-1 dark:bg-blue-900/20">
            <span className="text-[10px] text-blue-600 dark:text-blue-400">
              Filtered: {nodeMap.get(filterNodeId) || filterNodeId}
            </span>
            <button
              onClick={onClearFilter}
              className="ml-auto text-blue-400 hover:text-blue-600"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Board-level comments */}
        {boardLevelComments.length > 0 && (
          <div>
            <p className="mb-1.5 text-[9px] font-medium uppercase text-zinc-400">Board</p>
            {boardLevelComments.map((c) => (
              <CommentCard
                key={c._id}
                comment={c}
                onResolve={() => resolveComment({ commentId: c._id, resolved: !c.resolved })}
                onDelete={() => deleteComment({ commentId: c._id })}
              />
            ))}
          </div>
        )}

        {/* Node-grouped comments */}
        {Array.from(nodeGrouped.entries()).map(([nodeId, nodeComments]) => (
          <div key={nodeId}>
            <button
              onClick={() => onFocusNode(nodeId)}
              className="mb-1.5 flex items-center gap-1 text-[9px] font-medium uppercase text-zinc-400 hover:text-blue-500"
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              {nodeMap.get(nodeId) || nodeId}
            </button>
            {nodeComments.map((c) => (
              <CommentCard
                key={c._id}
                comment={c}
                onResolve={() => resolveComment({ commentId: c._id, resolved: !c.resolved })}
                onDelete={() => deleteComment({ commentId: c._id })}
              />
            ))}
          </div>
        ))}

        {filteredComments.length === 0 && (
          <p className="py-4 text-center text-[11px] text-zinc-400">
            No comments yet. Add one below.
          </p>
        )}
      </div>

      {/* Add comment */}
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
        {!filterNodeId && (
          <select
            value={attachToNode}
            onChange={(e) => setAttachToNode(e.target.value)}
            className="mb-2 w-full rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <option value="">Board-level comment</option>
            {screenshotNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {(n.data as any)?.label || n.id}
              </option>
            ))}
          </select>
        )}
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
    </div>
  );
}

function CommentCard({
  comment,
  onResolve,
  onDelete,
}: {
  comment: any;
  onResolve: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group mb-1.5 rounded-lg border p-2 ${
        comment.resolved
          ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
              {comment.authorName}
            </span>
            <span className="text-[9px] text-zinc-400">
              {formatRelativeTime(comment.createdAt)}
            </span>
          </div>
          <p className={`mt-0.5 text-xs ${comment.resolved ? "text-zinc-400 line-through" : "text-zinc-600 dark:text-zinc-300"}`}>
            {comment.text}
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onResolve}
            className={`rounded p-0.5 ${
              comment.resolved
                ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                : "text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
            }`}
            title={comment.resolved ? "Unresolve" : "Resolve"}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
          <button
            onClick={onDelete}
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
  );
}
