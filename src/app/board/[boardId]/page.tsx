"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import FlowLoader from "@/components/board/FlowLoader";
import Link from "next/link";

export default function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = use(params);
  const board = useQuery(api.boards.get, {
    boardId: boardId as Id<"boards">,
  });

  if (board === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (board === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500">Board not found</p>
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <FlowLoader boardId={boardId as Id<"boards">} boardName={board.name} />
    </div>
  );
}
