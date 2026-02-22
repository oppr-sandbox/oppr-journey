"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface DividerNodeData {
  label: string;
  orientation?: "horizontal" | "vertical";
  onTextChange?: (text: string) => void;
  onOrientationChange?: (orientation: "horizontal" | "vertical") => void;
  onNodeResized?: (width: number, height: number) => void;
  [key: string]: unknown;
}

function DividerNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as DividerNodeData;
  const orientation = nodeData.orientation || "horizontal";
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(nodeData.label || "");
  }, [nodeData.label]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    setEditing(false);
    if (nodeData.onTextChange) {
      nodeData.onTextChange(label);
    }
  }, [label, nodeData]);

  const isHorizontal = orientation === "horizontal";

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={isHorizontal ? 100 : 20}
        minHeight={isHorizontal ? 20 : 100}
        lineStyle={{ borderColor: "#a1a1aa", opacity: 0.3 }}
        handleStyle={{ backgroundColor: "#a1a1aa", width: 6, height: 6 }}
        onResizeEnd={(_event, params) => {
          nodeData.onNodeResized?.(params.width, params.height);
        }}
      />

      {/* Endpoint handles */}
      {isHorizontal ? (
        <>
          <Handle
            type="source"
            position={Position.Left}
            id="left"
            className="!w-2 !h-2 !bg-zinc-400 !border !border-zinc-300"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            className="!w-2 !h-2 !bg-zinc-400 !border !border-zinc-300"
          />
        </>
      ) : (
        <>
          <Handle
            type="source"
            position={Position.Top}
            id="top"
            className="!w-2 !h-2 !bg-zinc-400 !border !border-zinc-300"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="bottom"
            className="!w-2 !h-2 !bg-zinc-400 !border !border-zinc-300"
          />
        </>
      )}

      <div className="h-full w-full flex items-center justify-center relative">
        {/* The dashed line */}
        <div
          className={`absolute ${
            isHorizontal
              ? "left-0 right-0 top-1/2 -translate-y-1/2 h-0 border-t-2 border-dashed border-zinc-400"
              : "top-0 bottom-0 left-1/2 -translate-x-1/2 w-0 border-l-2 border-dashed border-zinc-400"
          }`}
        />

        {/* Label */}
        {(label || editing) && (
          <div
            className="relative z-10 bg-zinc-50 dark:bg-zinc-900 px-2"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {editing ? (
              <input
                ref={inputRef}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") handleSave();
                  e.stopPropagation();
                }}
                className="nodrag nowheel w-24 border-none bg-transparent text-center text-[10px] font-medium text-zinc-500 outline-none dark:text-zinc-400"
                placeholder="Label..."
              />
            ) : (
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 select-none">
                {label}
              </span>
            )}
          </div>
        )}

        {/* Orientation toggle — only when selected */}
        {selected && (
          <button
            onClick={() => {
              const next = isHorizontal ? "vertical" : "horizontal";
              nodeData.onOrientationChange?.(next);
            }}
            className="nodrag absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] font-medium text-white shadow hover:bg-zinc-600"
            title={`Switch to ${isHorizontal ? "vertical" : "horizontal"}`}
          >
            {isHorizontal ? "↕" : "↔"}
          </button>
        )}
      </div>
    </>
  );
}

export default memo(DividerNode);
