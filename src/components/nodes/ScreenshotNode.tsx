"use client";

import { memo, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { getPlatformColor } from "@/lib/utils";

function ScreenshotNode({ id, data, selected }: NodeProps) {
  const nodeData = data as any;
  const [showPreview, setShowPreview] = useState(false);
  const borderColor = getPlatformColor(nodeData.platform);

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={80}
        minHeight={60}
        keepAspectRatio
        lineStyle={{ borderColor: "#3b82f6" }}
        handleStyle={{ backgroundColor: "#3b82f6", width: 8, height: 8 }}
        onResizeEnd={(_event, params) => {
          nodeData.onNodeResized?.(params.width, params.height);
        }}
      />

      {/* Each side has both source + target so connections work in any direction */}
      <Handle type="target" position={Position.Top} id="top-target" className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Top} id="top-source" className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="target" position={Position.Left} id="left-target" className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Left} id="left-source" className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="target" position={Position.Right} id="right-target" className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />

      <div
        className={`group/node relative h-full w-full overflow-hidden rounded-lg border-2 bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900 ${borderColor} ${
          selected ? "ring-2 ring-blue-500 ring-offset-1" : ""
        }`}
        style={{ minWidth: 80 }}
      >
        <div
          className="relative cursor-pointer"
          onDoubleClick={() => setShowPreview(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={nodeData.imageUrl}
            alt={nodeData.label || "Screenshot"}
            className="block h-auto w-full object-cover"
            draggable={false}
          />
          {/* Preview eye icon on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPreview(true);
            }}
            className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover/node:opacity-100"
            title="Preview full size"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        {/* Multi-persona dots (top-left) */}
        {nodeData.assignedPersonas && (nodeData.assignedPersonas as any[]).length > 0 && (
          <div className="absolute left-1 top-1 z-10 flex items-center gap-0.5" title={
            (nodeData.assignedPersonas as any[]).map((p: any) => p.name).join(", ")
          }>
            {(nodeData.assignedPersonas as any[]).slice(0, 3).map((p: any, i: number) => (
              <span
                key={i}
                className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: p.color }}
                title={p.name}
              />
            ))}
            {(nodeData.assignedPersonas as any[]).length > 3 && (
              <span className="rounded-full bg-zinc-800/70 px-1 py-0.5 text-[7px] font-bold text-white">
                +{(nodeData.assignedPersonas as any[]).length - 3}
              </span>
            )}
          </div>
        )}

        {/* Comment count badge (bottom-right) */}
        {nodeData.commentCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onOpenComments?.();
            }}
            className="absolute bottom-1 right-1 z-10 flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-sm hover:bg-amber-600"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {nodeData.commentCount}
          </button>
        )}

        {nodeData.label && (
          <div className="border-t border-zinc-200 bg-zinc-50 px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-800">
            <p className="truncate text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
              {nodeData.label}
            </p>
          </div>
        )}
      </div>

      {showPreview && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-8"
          onClick={() => setShowPreview(false)}
          style={{ pointerEvents: "all" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={nodeData.imageUrl}
            alt={nodeData.label || "Screenshot preview"}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        </div>,
        document.body
      )}
    </>
  );
}

export default memo(ScreenshotNode);
