"use client";

import dynamic from "next/dynamic";
import { ReactFlowProvider } from "@xyflow/react";
import { Id } from "../../../convex/_generated/dataModel";

const FlowCanvas = dynamic(() => import("./FlowCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
    </div>
  ),
});

interface FlowLoaderProps {
  boardId: Id<"boards">;
  boardName: string;
}

export default function FlowLoader({ boardId, boardName }: FlowLoaderProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas boardId={boardId} boardName={boardName} />
    </ReactFlowProvider>
  );
}
