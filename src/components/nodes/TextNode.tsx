"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface TextNodeData {
  text: string;
  onTextChange?: (text: string) => void;
  onNodeResized?: (width: number, height: number) => void;
  missingScreenshot?: boolean;
  platform?: string;
  [key: string]: unknown;
}

function TextNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as TextNodeData;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(nodeData.text || "Double-click to edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(nodeData.text || "Double-click to edit");
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

  const hasMissing = nodeData.missingScreenshot === true;

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={100}
        minHeight={40}
        lineStyle={{ borderColor: "#f59e0b" }}
        handleStyle={{ backgroundColor: "#f59e0b", width: 8, height: 8 }}
        onResizeEnd={(_event, params) => {
          nodeData.onNodeResized?.(params.width, params.height);
        }}
      />

      {/* Each side has both source + target so connections work in any direction */}
      <Handle type="target" position={Position.Top} id="top-target" className="!w-4 !h-4 !bg-amber-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Top} id="top-source" className="!w-4 !h-4 !bg-amber-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!w-4 !h-4 !bg-amber-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-4 !h-4 !bg-amber-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="target" position={Position.Left} id="left-target" className="!w-4 !h-4 !bg-amber-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Left} id="left-source" className="!w-4 !h-4 !bg-amber-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="target" position={Position.Right} id="right-target" className="!w-4 !h-4 !bg-amber-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-4 !h-4 !bg-amber-500 !border-2 !border-white hover:!w-5 hover:!h-5 !transition-all !duration-150 !cursor-crosshair" />

      <div
        className={`h-full w-full overflow-hidden rounded-lg border shadow-sm ${
          hasMissing
            ? "border-dashed border-2 border-orange-400 bg-orange-50/80 dark:bg-orange-950/20"
            : selected
              ? "border-amber-400 ring-2 ring-amber-400 ring-offset-2 bg-amber-50 dark:bg-amber-950/30"
              : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
        }`}
        onDoubleClick={() => setEditing(true)}
      >
        {/* Missing screenshot indicator */}
        {hasMissing && (
          <div className="flex items-center gap-1.5 border-b border-dashed border-orange-300 px-3 py-1.5 dark:border-orange-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-500">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-[9px] font-medium text-orange-600 dark:text-orange-400">
              Drop screenshot here
            </span>
            {nodeData.platform && (
              <span className={`ml-auto rounded px-1 py-0.5 text-[7px] font-bold uppercase ${
                nodeData.platform === "mobile" ? "bg-green-600/80 text-white" :
                nodeData.platform === "admin" ? "bg-purple-600/80 text-white" :
                "bg-blue-600/80 text-white"
              }`}>
                {nodeData.platform}
              </span>
            )}
          </div>
        )}
        <div className="h-full flex flex-col px-3 py-2">
          {editing ? (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Escape") handleSave();
                // Allow enter for newlines, don't propagate to React Flow
                e.stopPropagation();
              }}
              className="nodrag nowheel flex-1 w-full resize-none border-none bg-transparent text-sm text-zinc-800 outline-none overflow-y-auto dark:text-zinc-200"
              style={{ minHeight: "2em" }}
              placeholder="Enter annotation..."
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 overflow-y-auto">
              {text || "Double-click to edit"}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(TextNode);
