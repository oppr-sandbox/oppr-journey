"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { NodeResizer } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

const SECTION_COLORS = [
  { key: "blue", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.3)", text: "#3b82f6", dot: "#3b82f6" },
  { key: "green", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.3)", text: "#22c55e", dot: "#22c55e" },
  { key: "purple", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.3)", text: "#a855f7", dot: "#a855f7" },
  { key: "amber", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", text: "#f59e0b", dot: "#f59e0b" },
  { key: "rose", bg: "rgba(244,63,94,0.08)", border: "rgba(244,63,94,0.3)", text: "#f43f5e", dot: "#f43f5e" },
  { key: "cyan", bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.3)", text: "#06b6d4", dot: "#06b6d4" },
];

function getColorSet(colorKey: string) {
  return SECTION_COLORS.find((c) => c.key === colorKey) || SECTION_COLORS[0];
}

interface SectionNodeData {
  label: string;
  color?: string;
  onTextChange?: (text: string) => void;
  onColorChange?: (color: string) => void;
  onNodeResized?: (width: number, height: number) => void;
  [key: string]: unknown;
}

function SectionNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as SectionNodeData;
  const colorSet = getColorSet(nodeData.color || "blue");
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label || "Section");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(nodeData.label || "Section");
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

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={200}
        minHeight={100}
        lineStyle={{ borderColor: colorSet.border }}
        handleStyle={{ backgroundColor: colorSet.dot, width: 8, height: 8 }}
        onResizeEnd={(_event, params) => {
          nodeData.onNodeResized?.(params.width, params.height);
        }}
      />

      {/* No connection handles — sections are structural only */}

      <div
        className="h-full w-full rounded-xl"
        style={{
          backgroundColor: colorSet.bg,
          border: `2px dashed ${colorSet.border}`,
          pointerEvents: "none",
        }}
      >
        {/* Title bar — pointer events enabled */}
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ pointerEvents: "auto" }}
          onDoubleClick={() => setEditing(true)}
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
              className="nodrag nowheel border-none bg-transparent text-xs font-semibold outline-none"
              style={{ color: colorSet.text, width: "auto", minWidth: 60 }}
              placeholder="Section title..."
            />
          ) : (
            <span
              className="text-xs font-semibold select-none"
              style={{ color: colorSet.text }}
            >
              {label}
            </span>
          )}

          {/* Color picker — visible when selected */}
          {selected && (
            <div className="nodrag flex items-center gap-1 ml-2">
              {SECTION_COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => nodeData.onColorChange?.(c.key)}
                  className="rounded-full transition-transform hover:scale-125"
                  style={{
                    width: 12,
                    height: 12,
                    backgroundColor: c.dot,
                    border: c.key === (nodeData.color || "blue") ? "2px solid white" : "none",
                    boxShadow: c.key === (nodeData.color || "blue") ? `0 0 0 1px ${c.dot}` : "none",
                  }}
                  title={c.key}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(SectionNode);
