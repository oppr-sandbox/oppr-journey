"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface AttentionNodeData {
  text: string;
  onTextChange?: (text: string) => void;
  onNodeResized?: (width: number, height: number) => void;
  [key: string]: unknown;
}

function AttentionNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as AttentionNodeData;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(nodeData.text || "Needs investigation");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(nodeData.text || "Needs investigation");
  }, [nodeData.text]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    setEditing(false);
    if (nodeData.onTextChange) {
      nodeData.onTextChange(text);
    }
  }, [text, nodeData]);

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={120}
        minHeight={50}
        lineStyle={{ borderColor: "#ef4444" }}
        handleStyle={{ backgroundColor: "#ef4444", width: 8, height: 8 }}
        onResizeEnd={(_event, params) => {
          nodeData.onNodeResized?.(params.width, params.height);
        }}
      />

      {/* Each side has both source + target so connections work in any direction */}
      <Handle type="target" position={Position.Top} id="top-target" className="!w-4 !h-4 !bg-red-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Top} id="top-source" className="!w-4 !h-4 !bg-red-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!w-4 !h-4 !bg-red-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-4 !h-4 !bg-red-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="target" position={Position.Left} id="left-target" className="!w-4 !h-4 !bg-red-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Left} id="left-source" className="!w-4 !h-4 !bg-red-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="target" position={Position.Right} id="right-target" className="!w-4 !h-4 !bg-red-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-4 !h-4 !bg-red-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />

      <div
        className={`h-full w-full overflow-hidden rounded-lg border-2 bg-red-50 shadow-sm dark:bg-red-950/30 ${
          selected
            ? "border-red-500 ring-2 ring-red-400 ring-offset-2"
            : "border-red-400 dark:border-red-700"
        }`}
        onDoubleClick={() => setEditing(true)}
      >
        <div className="flex h-full items-start gap-2 overflow-y-auto px-3 py-2">
          {/* Warning icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mt-0.5 shrink-0 text-red-500"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="flex-1 min-w-0">
            {editing ? (
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => {
                  if (e.key === "Escape") handleSave();
                  e.stopPropagation();
                }}
                className="nodrag nowheel h-full w-full resize-none border-none bg-transparent text-sm text-red-800 outline-none dark:text-red-200"
                style={{ minHeight: "2em" }}
                placeholder="Describe the issue..."
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm font-medium text-red-800 dark:text-red-200">
                {text || "Double-click to edit"}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(AttentionNode);
