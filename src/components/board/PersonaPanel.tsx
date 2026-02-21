"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Node } from "@xyflow/react";

interface PersonaPanelProps {
  boardId: Id<"boards">;
  activePersonaId: string | null;
  onSetActivePersonaId: (id: string | null) => void;
  nodes: Node[];
}

const DEFAULT_COLORS = ["#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4"];

export default function PersonaPanel({
  boardId,
  activePersonaId,
  onSetActivePersonaId,
  nodes,
}: PersonaPanelProps) {
  const personas = useQuery(api.personas.getByBoard, { boardId });
  const personaNodeAssignments = useQuery(api.personaNodes.getByBoard, { boardId });
  const createPersona = useMutation(api.personas.create);
  const updatePersona = useMutation(api.personas.update);
  const removePersona = useMutation(api.personas.remove);
  const assignNode = useMutation(api.personaNodes.assign);
  const unassignNode = useMutation(api.personaNodes.unassign);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);

  const screenshotNodes = nodes.filter((n) => n.type === "screenshot");

  // Build assignment set for the active persona
  const activePersonaNodeIds = new Set<string>();
  if (activePersonaId && personaNodeAssignments) {
    for (const pn of personaNodeAssignments) {
      if (pn.personaId === activePersonaId) {
        activePersonaNodeIds.add(pn.nodeId);
      }
    }
  }

  // Count assignments per persona
  const personaNodeCounts = new Map<string, number>();
  if (personaNodeAssignments) {
    for (const pn of personaNodeAssignments) {
      personaNodeCounts.set(pn.personaId, (personaNodeCounts.get(pn.personaId) || 0) + 1);
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createPersona({
      boardId,
      name: name.trim(),
      description: description.trim(),
      color,
      order: (personas?.length || 0) + 1,
    });
    setName("");
    setDescription("");
    setColor(DEFAULT_COLORS[(personas?.length || 0) % DEFAULT_COLORS.length]);
    setShowForm(false);
  };

  const handleUpdate = async (personaId: string) => {
    if (!name.trim()) return;
    await updatePersona({
      personaId: personaId as Id<"personas">,
      name: name.trim(),
      description: description.trim(),
      color,
    });
    setEditingId(null);
    setName("");
    setDescription("");
  };

  const startEdit = (persona: any) => {
    setEditingId(persona._id);
    setName(persona.name);
    setDescription(persona.description);
    setColor(persona.color);
    setShowForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    setName("");
    setDescription("");
  };

  const handleToggleAssignment = (personaId: string, nodeId: string, isAssigned: boolean) => {
    if (isAssigned) {
      unassignNode({ boardId, personaId: personaId as Id<"personas">, nodeId });
    } else {
      assignNode({ boardId, personaId: personaId as Id<"personas">, nodeId });
    }
  };

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          Personas ({personas?.length || 0})
        </p>
        <div className="flex items-center gap-1">
          {activePersonaId && (
            <button
              onClick={() => onSetActivePersonaId(null)}
              className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              Clear highlight
            </button>
          )}
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setName("");
              setDescription("");
              setColor(DEFAULT_COLORS[(personas?.length || 0) % DEFAULT_COLORS.length]);
            }}
            className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Persona list */}
      <div className="space-y-2">
        {personas?.map((persona) => (
          <div key={persona._id}>
            {editingId === persona._id ? (
              <PersonaForm
                name={name}
                setName={setName}
                description={description}
                setDescription={setDescription}
                color={color}
                setColor={setColor}
                onSave={() => handleUpdate(persona._id)}
                onCancel={cancelEdit}
                saveLabel="Save"
              />
            ) : (
              <div className={`rounded-lg border ${
                activePersonaId === persona._id
                  ? "border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/20"
                  : "border-zinc-200 dark:border-zinc-700"
              }`}>
                <div className="group flex items-start gap-2 p-2">
                  <div
                    className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: persona.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                        {persona.name}
                      </p>
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {personaNodeCounts.get(persona._id) || 0}
                      </span>
                    </div>
                    {persona.description && (
                      <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                        {persona.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => {
                        if (activePersonaId === persona._id) {
                          onSetActivePersonaId(null);
                        } else {
                          onSetActivePersonaId(persona._id);
                        }
                      }}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                        activePersonaId === persona._id
                          ? "bg-blue-500 text-white"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      }`}
                      title={activePersonaId === persona._id ? "Stop highlighting" : "Highlight this persona's flow"}
                    >
                      {activePersonaId === persona._id ? "On" : "Highlight"}
                    </button>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(persona)}
                        className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                        title="Edit"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete persona "${persona.name}"?`)) {
                            removePersona({ personaId: persona._id });
                            if (activePersonaId === persona._id) onSetActivePersonaId(null);
                          }
                        }}
                        className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                        title="Delete"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Node assignment checkboxes - shown when this persona is highlighted */}
                {activePersonaId === persona._id && screenshotNodes.length > 0 && (
                  <div className="border-t border-blue-200 px-2 py-1.5 dark:border-blue-800">
                    <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-blue-500">
                      Assign screens
                    </p>
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {screenshotNodes.map((node) => {
                        const isAssigned = activePersonaNodeIds.has(node.id);
                        return (
                          <label
                            key={node.id}
                            className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] text-zinc-700 hover:bg-blue-100/50 cursor-pointer dark:text-zinc-300 dark:hover:bg-blue-900/20"
                          >
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => handleToggleAssignment(persona._id, node.id, isAssigned)}
                              className="h-3 w-3 rounded border-zinc-300 text-blue-500 focus:ring-blue-400"
                            />
                            <span className="truncate">
                              {(node.data as any)?.label || node.id}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new persona form */}
      {showForm && (
        <div className="mt-2">
          <PersonaForm
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            color={color}
            setColor={setColor}
            onSave={handleCreate}
            onCancel={cancelEdit}
            saveLabel="Create"
          />
        </div>
      )}

      {(!personas || personas.length === 0) && !showForm && (
        <p className="py-4 text-center text-[11px] text-zinc-400">
          No personas defined yet. Add personas to track who uses each screen.
        </p>
      )}
    </div>
  );
}

function PersonaForm({
  name,
  setName,
  description,
  setDescription,
  color,
  setColor,
  onSave,
  onCancel,
  saveLabel,
}: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  const colors = ["#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2 dark:border-blue-800 dark:bg-blue-950/20">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Persona name"
        className="mb-1.5 w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && onSave()}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="mb-1.5 w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
      />
      <div className="mb-2 flex gap-1">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`h-5 w-5 rounded-full border-2 ${
              color === c ? "border-zinc-800 dark:border-white" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex justify-end gap-1.5">
        <button
          onClick={onCancel}
          className="rounded px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!name.trim()}
          className="rounded bg-blue-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
