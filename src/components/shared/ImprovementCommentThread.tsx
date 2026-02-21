"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatRelativeTime } from "@/lib/utils";

interface ImprovementCommentThreadProps {
  improvementId: Id<"improvements">;
  boardId: Id<"boards">;
  compact?: boolean;
}

export default function ImprovementCommentThread({
  improvementId,
  boardId,
  compact = false,
}: ImprovementCommentThreadProps) {
  const { user } = useUser();
  const comments = useQuery(api.improvementComments.getByImprovement, { improvementId });
  const addComment = useMutation(api.improvementComments.addComment);
  const deleteComment = useMutation(api.improvementComments.deleteComment);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || !user) return;
    setSubmitting(true);
    try {
      await addComment({
        improvementId,
        boardId,
        authorId: user.id,
        authorName: user.fullName || user.firstName || "User",
        authorImageUrl: user.imageUrl || undefined,
        text: text.trim(),
      });
      setText("");
    } finally {
      setSubmitting(false);
    }
  };

  const textSize = compact ? "text-[10px]" : "text-xs";
  const inputSize = compact ? "text-[10px] py-1 px-2" : "text-xs py-1.5 px-3";

  return (
    <div>
      <p className={`mb-1.5 ${compact ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-wider text-zinc-400`}>
        Comments ({comments?.length || 0})
      </p>

      {/* Comment input */}
      <div className="mb-2 flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Add a comment..."
          className={`flex-1 rounded border border-zinc-200 bg-white ${inputSize} text-zinc-700 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`}
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          className={`rounded bg-blue-600 px-2 ${compact ? "py-0.5 text-[9px]" : "py-1 text-[10px]"} font-medium text-white hover:bg-blue-700 disabled:opacity-40`}
        >
          {submitting ? "..." : "Post"}
        </button>
      </div>

      {/* Comment list */}
      {comments && comments.length > 0 && (
        <div className={`space-y-1.5 ${compact ? "max-h-40" : "max-h-60"} overflow-y-auto`}>
          {comments.map((c) => (
            <div
              key={c._id}
              className="rounded border border-zinc-100 bg-zinc-50/50 p-1.5 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  {c.authorImageUrl && (
                    <img
                      src={c.authorImageUrl}
                      alt=""
                      className="h-4 w-4 rounded-full"
                    />
                  )}
                  <span className={`font-medium text-zinc-700 dark:text-zinc-300 ${compact ? "text-[9px]" : "text-[10px]"}`}>
                    {c.authorName}
                  </span>
                  <span className={`text-zinc-400 ${compact ? "text-[8px]" : "text-[9px]"}`}>
                    {formatRelativeTime(c.createdAt)}
                  </span>
                </div>
                {user?.id === c.authorId && (
                  <button
                    onClick={() => deleteComment({ commentId: c._id })}
                    className="rounded p-0.5 text-zinc-300 hover:bg-red-50 hover:text-red-400 dark:text-zinc-600 dark:hover:bg-red-900/20"
                    title="Delete comment"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <p className={`mt-0.5 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400 ${textSize}`}>
                {c.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
