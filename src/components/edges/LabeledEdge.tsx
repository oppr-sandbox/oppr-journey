"use client";

import { memo, useState, useRef, useEffect } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";

interface LabeledEdgeData {
  onLabelChange?: (label: string) => void;
  onDelete?: () => void;
  [key: string]: unknown;
}

function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  selected,
  data,
}: EdgeProps) {
  const edgeData = data as unknown as LabeledEdgeData | undefined;
  const [editing, setEditing] = useState(false);
  const [labelText, setLabelText] = useState((label as string) || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabelText((label as string) || "");
  }, [label]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleSave = () => {
    setEditing(false);
    if (edgeData?.onLabelChange) {
      edgeData.onLabelChange(labelText);
    }
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "#3b82f6" : "#94a3b8",
          strokeWidth: selected ? 2.5 : 1.5,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") {
                  setLabelText((label as string) || "");
                  setEditing(false);
                }
                e.stopPropagation();
              }}
              className="rounded border border-blue-400 bg-white px-2 py-0.5 text-xs text-zinc-800 shadow-sm outline-none focus:ring-1 focus:ring-blue-400 dark:bg-zinc-800 dark:text-zinc-200"
              placeholder="Add label..."
            />
          ) : (
            <div
              className={`group flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs shadow-sm transition-colors ${
                selected
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-300"
                  : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
              onDoubleClick={() => setEditing(true)}
            >
              <span>{labelText || "click to label"}</span>
              {selected && edgeData?.onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    edgeData.onDelete!();
                  }}
                  className="ml-1 rounded-full p-0.5 text-red-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                  title="Delete edge"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(LabeledEdge);
