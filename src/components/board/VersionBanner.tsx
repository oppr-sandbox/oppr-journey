"use client";

import Link from "next/link";
import type { Id } from "../../../convex/_generated/dataModel";

interface VersionBannerProps {
  version?: string;
  versionNote?: string;
  parentBoardId?: Id<"boards">;
}

export default function VersionBanner({
  version,
  versionNote,
  parentBoardId,
}: VersionBannerProps) {
  if (!parentBoardId) return null;

  return (
    <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-3 py-1 text-xs dark:border-blue-800 dark:bg-blue-950/30">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-blue-500">
        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
      <span className="font-medium text-blue-700 dark:text-blue-300">
        Version {version || "1.0"}
      </span>
      {versionNote && (
        <>
          <span className="text-blue-400">—</span>
          <span className="text-blue-600 dark:text-blue-400">{versionNote}</span>
        </>
      )}
      <Link
        href={`/board/${parentBoardId}`}
        className="ml-auto text-[10px] text-blue-500 hover:text-blue-700 hover:underline dark:text-blue-400"
      >
        View parent version
      </Link>
    </div>
  );
}
