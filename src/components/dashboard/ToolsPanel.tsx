"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface Tool {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
}

export default function ToolsPanel() {
  const tools = useQuery(api.tools.getAll);
  const createTool = useMutation(api.tools.create);
  const updateTool = useMutation(api.tools.update);
  const removeTool = useMutation(api.tools.remove);
  const seedTools = useMutation(api.tools.seed);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, Partial<Tool>>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const hasSeeded = useRef(false);

  // Auto-seed on first load if empty
  useEffect(() => {
    if (tools && tools.length === 0 && !hasSeeded.current) {
      hasSeeded.current = true;
      seedTools();
    }
  }, [tools, seedTools]);

  const handleSaveField = async (toolId: string, field: string, value: string) => {
    const tool = (tools as Tool[])?.find((t) => t._id === toolId);
    if (!tool) return;
    if ((tool as any)[field] === value) return;
    await updateTool({ toolId: toolId as any, [field]: value });
  };

  const handleDelete = async (toolId: string) => {
    if (!confirm("Delete this tool? Boards that reference it will no longer show it.")) return;
    setDeleting(toolId);
    try {
      await removeTool({ toolId: toolId as any });
      if (expandedId === toolId) setExpandedId(null);
    } finally {
      setDeleting(null);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newSlug.trim()) return;
    await createTool({
      name: newName.trim(),
      slug: newSlug.trim(),
      description: newDescription.trim(),
      category: newCategory.trim() || undefined,
    });
    setNewName("");
    setNewSlug("");
    setNewDescription("");
    setNewCategory("");
    setShowAddForm(false);
  };

  if (!tools) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Tools / Products
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Define your product tools. When assigned to a journey, their descriptions provide context to all AI features.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          + Add Tool
        </button>
      </div>

      {/* Add new tool form */}
      {showAddForm && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">New Tool</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newSlug || newSlug === slugify(newName)) {
                    setNewSlug(slugify(e.target.value));
                  }
                }}
                placeholder="e.g., Logs Desktop"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Slug</label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="e.g., logs-desktop"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Category</label>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g., Platform, Product"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Description</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Detailed description of this tool/product. The AI will use this as context when analyzing journeys."
              rows={4}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewName("");
                setNewSlug("");
                setNewDescription("");
                setNewCategory("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || !newSlug.trim()}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Create Tool
            </button>
          </div>
        </div>
      )}

      {/* Tool cards */}
      <div className="space-y-3">
        {(tools as Tool[]).map((tool) => {
          const isExpanded = expandedId === tool._id;
          const edits = editValues[tool._id] || {};

          return (
            <div
              key={tool._id}
              className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
            >
              {/* Collapsed card */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : tool._id)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{tool.name}</h3>
                    <div className="flex items-center gap-2">
                      {tool.category && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          {tool.category}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-400">{tool.slug}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="max-w-md text-xs text-zinc-400 line-clamp-1">{tool.description}</p>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </button>

              {/* Expanded edit form */}
              {isExpanded && (
                <div className="border-t border-zinc-200 p-4 dark:border-zinc-700">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Name</label>
                      <input
                        type="text"
                        value={edits.name ?? tool.name}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [tool._id]: { ...prev[tool._id], name: e.target.value } }))}
                        onBlur={() => edits.name !== undefined && handleSaveField(tool._id, "name", edits.name!)}
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Slug</label>
                      <input
                        type="text"
                        value={edits.slug ?? tool.slug}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [tool._id]: { ...prev[tool._id], slug: e.target.value } }))}
                        onBlur={() => edits.slug !== undefined && handleSaveField(tool._id, "slug", edits.slug!)}
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Category</label>
                      <input
                        type="text"
                        value={edits.category ?? tool.category ?? ""}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [tool._id]: { ...prev[tool._id], category: e.target.value } }))}
                        onBlur={() => edits.category !== undefined && handleSaveField(tool._id, "category", edits.category!)}
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Description</label>
                    <textarea
                      value={edits.description ?? tool.description}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [tool._id]: { ...prev[tool._id], description: e.target.value } }))}
                      onBlur={() => edits.description !== undefined && handleSaveField(tool._id, "description", edits.description!)}
                      rows={Math.min(12, Math.max(4, (edits.description ?? tool.description).split("\n").length + 1))}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 outline-none focus:border-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleDelete(tool._id)}
                      disabled={deleting === tool._id}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-900/20"
                    >
                      {deleting === tool._id ? "Deleting..." : "Delete Tool"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {tools.length === 0 && (
        <p className="py-12 text-center text-sm text-zinc-400">
          No tools defined. They will be auto-seeded shortly.
        </p>
      )}
    </div>
  );
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
