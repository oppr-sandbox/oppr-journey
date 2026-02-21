"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn, formatFileSize, formatDate } from "@/lib/utils";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface Screenshot {
  _id: string;
  url: string | null;
  label?: string;
  filename: string;
  platform?: string;
  tags?: string[];
  contentType: string;
  size?: number;
  createdAt: number;
  uploadedByName: string;
  usageCount?: number;
}

interface ScreenshotPreviewModalProps {
  screenshot: Screenshot;
  allTags: string[];
  onClose: () => void;
  onUpdate: (updates: { label?: string; platform?: string; tags?: string[] }) => void;
  onDelete: () => void;
}

export default function ScreenshotPreviewModal({
  screenshot,
  allTags,
  onClose,
  onUpdate,
  onDelete,
}: ScreenshotPreviewModalProps) {
  const [label, setLabel] = useState(screenshot.label || "");
  const [platform, setPlatform] = useState(screenshot.platform || "desktop");
  const [tags, setTags] = useState<string[]>(screenshot.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const saveLabel = useCallback(() => {
    if (label !== (screenshot.label || "")) {
      onUpdate({ label });
    }
  }, [label, screenshot.label, onUpdate]);

  const savePlatform = useCallback(
    (p: string) => {
      setPlatform(p);
      onUpdate({ platform: p });
    },
    [onUpdate]
  );

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (trimmed && !tags.includes(trimmed)) {
        const newTags = [...tags, trimmed];
        setTags(newTags);
        onUpdate({ tags: newTags });
      }
      setTagInput("");
      setShowAutocomplete(false);
    },
    [tags, onUpdate]
  );

  const removeTag = useCallback(
    (tag: string) => {
      const newTags = tags.filter((t) => t !== tag);
      setTags(newTags);
      onUpdate({ tags: newTags });
    },
    [tags, onUpdate]
  );

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (tagInput.trim()) addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const filteredAutocomplete = allTags.filter(
    (t) =>
      t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t)
  );

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex bg-black/70"
        onClick={onClose}
      >
        <div
          className="flex h-full w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left: Image */}
          <div className="flex flex-1 items-center justify-center overflow-auto bg-black/30 p-8">
            {screenshot.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={screenshot.url}
                alt={screenshot.label || screenshot.filename}
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              />
            )}
          </div>

          {/* Right: Details panel */}
          <div className="flex w-[380px] shrink-0 flex-col overflow-y-auto bg-white dark:bg-zinc-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Details
              </h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-5 p-5">
              {/* Label */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onBlur={saveLabel}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveLabel();
                  }}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                />
              </div>

              {/* Platform */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Platform
                </label>
                <div className="flex gap-1">
                  {(["desktop", "mobile"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => savePlatform(p)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                        platform === p
                          ? p === "mobile"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-0.5 text-zinc-400 hover:text-red-500"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative mt-1.5">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value);
                      setShowAutocomplete(e.target.value.length > 0);
                    }}
                    onKeyDown={handleTagKeyDown}
                    onFocus={() => tagInput && setShowAutocomplete(true)}
                    onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                    placeholder="Add tag..."
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  />
                  {showAutocomplete && filteredAutocomplete.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-32 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                      {filteredAutocomplete.slice(0, 8).map((t) => (
                        <button
                          key={t}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addTag(t);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-xs text-zinc-600 hover:bg-blue-50 dark:text-zinc-400 dark:hover:bg-zinc-700"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Metadata
                </label>
                <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="flex justify-between">
                    <span>File type</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {screenshot.contentType.split("/")[1]?.toUpperCase() || screenshot.contentType}
                    </span>
                  </div>
                  {screenshot.size != null && (
                    <div className="flex justify-between">
                      <span>Size</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {formatFileSize(screenshot.size)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Date added</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {formatDate(screenshot.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Uploaded by</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {screenshot.uploadedByName}
                    </span>
                  </div>
                  {screenshot.usageCount !== undefined && (
                    <div className="flex justify-between">
                      <span>Used in</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {screenshot.usageCount} {screenshot.usageCount === 1 ? "journey" : "journeys"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Delete */}
            <div className="border-t border-zinc-200 p-5 dark:border-zinc-700">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                Delete Screenshot
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete Screenshot"
        message="This will permanently delete this screenshot from the global repository and unlink it from all journeys."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
