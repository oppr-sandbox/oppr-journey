"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface UniquePersona {
  name: string;
  description: string;
  color: string;
  boardCount: number;
  boardNames: string[];
}

const DEFAULT_COLORS = [
  "#a855f7", "#3b82f6", "#f59e0b", "#22c55e", "#06b6d4",
  "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];

export default function PersonasEditor() {
  const personas = useQuery(api.personas.listAllUnique);
  const updateAllByName = useMutation(api.personas.updateAllByName);
  const removeAllByName = useMutation(api.personas.removeAllByName);
  const createGlobal = useMutation(api.personas.createGlobal);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState("");

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);

  const startEditing = (persona: UniquePersona) => {
    setEditing(persona.name);
    setEditName(persona.name);
    setEditDesc(persona.description);
    setEditColor(persona.color);
  };

  const handleSaveEdit = async (originalName: string) => {
    await updateAllByName({
      originalName,
      name: editName !== originalName ? editName : undefined,
      description: editDesc,
      color: editColor,
    });
    setEditing(null);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete "${name}" from all journeys? This will also remove all persona-node assignments.`)) return;
    await removeAllByName({ name });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createGlobal({
      name: newName.trim(),
      description: newDesc.trim(),
      color: newColor,
    });
    setNewName("");
    setNewDesc("");
    setNewColor(DEFAULT_COLORS[0]);
    setShowCreate(false);
  };

  if (personas === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Header with Add button */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {personas.length} persona{personas.length !== 1 ? "s" : ""} across all journeys
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          + Add Persona
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
          <h4 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">New Persona</h4>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Product Manager"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Description</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Describe this persona's role, responsibilities, and pain points..."
                rows={3}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Color</label>
              <div className="flex gap-2">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`h-6 w-6 rounded-full transition-all ${newColor === c ? "ring-2 ring-blue-500 ring-offset-2" : "hover:scale-110"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Create on All Journeys
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persona cards */}
      {personas.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">No personas found. Create one to get started.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(personas as UniquePersona[]).map((persona) => {
            const isExpanded = expanded === persona.name;
            const isEditing = editing === persona.name;

            if (isEditing) {
              return (
                <div
                  key={persona.name}
                  className="rounded-xl border border-blue-200 bg-white p-4 dark:border-blue-700 dark:bg-zinc-900"
                >
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Name</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Description</label>
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Color</label>
                      <div className="flex gap-2">
                        {DEFAULT_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setEditColor(c)}
                            className={`h-6 w-6 rounded-full transition-all ${editColor === c ? "ring-2 ring-blue-500 ring-offset-2" : "hover:scale-110"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditing(null)}
                        className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(persona.name)}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={persona.name}
                className="group rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: persona.color }}
                  />
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                    {persona.name}
                  </h3>
                  <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                    {persona.boardCount} {persona.boardCount === 1 ? "journey" : "journeys"}
                  </span>
                </div>
                <p className={`text-xs text-zinc-500 dark:text-zinc-400 ${isExpanded ? "" : "line-clamp-3"}`}>
                  {persona.description}
                </p>
                {persona.description.length > 150 && (
                  <button
                    onClick={() => setExpanded(isExpanded ? null : persona.name)}
                    className="mt-1 text-[10px] text-blue-500 hover:text-blue-700"
                  >
                    {isExpanded ? "Show less" : "Show more"}
                  </button>
                )}
                {persona.boardNames.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {persona.boardNames.map((name) => (
                      <span
                        key={name}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
                {/* Action buttons */}
                <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3 opacity-0 transition-opacity group-hover:opacity-100 dark:border-zinc-800">
                  <button
                    onClick={() => startEditing(persona)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(persona.name)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
