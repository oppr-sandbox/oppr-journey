"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatRelativeTime } from "@/lib/utils";

interface ImprovementTodoListProps {
  improvementId: Id<"improvements">;
  boardId: Id<"boards">;
  compact?: boolean;
}

export default function ImprovementTodoList({
  improvementId,
  boardId,
  compact = false,
}: ImprovementTodoListProps) {
  const { user } = useUser();
  const todos = useQuery(api.improvementTodos.getByImprovement, { improvementId });
  const toggleTodo = useMutation(api.improvementTodos.toggle);
  const addTodo = useMutation(api.improvementTodos.addTodo);
  const deleteTodo = useMutation(api.improvementTodos.deleteTodo);
  const addNote = useMutation(api.improvementTodos.addNote);

  const [newTodoText, setNewTodoText] = useState("");
  const [newTodoPhase, setNewTodoPhase] = useState("");
  const [addingTodo, setAddingTodo] = useState(false);
  const [noteInputId, setNoteInputId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(["__all__"]));

  if (!todos) {
    return (
      <div className="flex items-center justify-center py-3">
        <div className="h-4 w-4 animate-spin rounded-full border border-violet-400 border-t-transparent" />
      </div>
    );
  }

  const totalCount = todos.length;
  const completedCount = todos.filter((t) => t.completed).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Group by phase
  const phaseGroups: { phase: string; todos: typeof todos }[] = [];
  const phaseOrder: string[] = [];
  for (const todo of todos) {
    const phase = todo.phase || "Ungrouped";
    if (!phaseOrder.includes(phase)) {
      phaseOrder.push(phase);
      phaseGroups.push({ phase, todos: [] });
    }
    phaseGroups.find((g) => g.phase === phase)!.todos.push(todo);
  }

  // Get unique phases for "add todo" dropdown
  const existingPhases = phaseOrder.filter((p) => p !== "Ungrouped");

  const handleToggle = async (todoId: Id<"improvementTodos">, isCompleted: boolean) => {
    if (!user) return;

    if (!isCompleted && noteInputId !== todoId) {
      // Show note input before checking
      setNoteInputId(todoId);
      setNoteText("");
      return;
    }

    await toggleTodo({
      todoId,
      completedBy: user.id,
      completedByName: user.fullName || user.firstName || "User",
      completionNote: isCompleted ? undefined : noteText.trim() || undefined,
    });
    setNoteInputId(null);
    setNoteText("");
  };

  const handleConfirmToggle = async (todoId: Id<"improvementTodos">) => {
    if (!user) return;
    await toggleTodo({
      todoId,
      completedBy: user.id,
      completedByName: user.fullName || user.firstName || "User",
      completionNote: noteText.trim() || undefined,
    });
    setNoteInputId(null);
    setNoteText("");
  };

  const handleAddTodo = async () => {
    if (!newTodoText.trim() || !user) return;
    setAddingTodo(true);
    try {
      await addTodo({
        improvementId,
        boardId,
        text: newTodoText.trim(),
        phase: newTodoPhase || undefined,
        createdBy: user.id,
        createdByName: user.fullName || user.firstName || "User",
      });
      setNewTodoText("");
    } finally {
      setAddingTodo(false);
    }
  };

  const togglePhase = (phase: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  const textSize = compact ? "text-[10px]" : "text-xs";
  const smallText = compact ? "text-[8px]" : "text-[10px]";

  return (
    <div>
      {/* Header with progress */}
      <div className="mb-2 flex items-center gap-2">
        <p className={`${compact ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-wider text-violet-600`}>
          Tasks ({completedCount}/{totalCount})
        </p>
        {totalCount > 0 && (
          <span className={`${smallText} font-medium ${
            progressPercent === 100 ? "text-emerald-600" : "text-violet-500"
          }`}>
            {progressPercent}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              progressPercent === 100
                ? "bg-emerald-500"
                : progressPercent > 50
                  ? "bg-violet-500"
                  : "bg-violet-400"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Todo list grouped by phase */}
      <div className="space-y-2">
        {phaseGroups.map((group) => {
          const isExpanded = expandedPhases.has("__all__") || expandedPhases.has(group.phase);
          const groupCompleted = group.todos.filter((t) => t.completed).length;
          const groupTotal = group.todos.length;

          return (
            <div key={group.phase}>
              {/* Phase header (only show if more than one group) */}
              {phaseGroups.length > 1 && (
                <button
                  onClick={() => togglePhase(group.phase)}
                  className="mb-1 flex w-full items-center gap-1.5"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-zinc-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  <span className={`${smallText} font-semibold text-zinc-600 dark:text-zinc-400`}>
                    {group.phase}
                  </span>
                  <span className={`${smallText} text-zinc-400`}>
                    ({groupCompleted}/{groupTotal})
                  </span>
                </button>
              )}

              {/* Todo items */}
              {isExpanded && (
                <div className="space-y-1">
                  {group.todos.map((todo) => (
                    <div
                      key={todo._id}
                      className={`group rounded border px-2 py-1.5 transition-colors ${
                        todo.completed
                          ? "border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/10"
                          : "border-zinc-100 bg-white hover:border-violet-200 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-800"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {/* Checkbox */}
                        <button
                          onClick={() => handleToggle(todo._id as Id<"improvementTodos">, todo.completed)}
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            todo.completed
                              ? "border-emerald-400 bg-emerald-500 text-white"
                              : "border-zinc-300 bg-white hover:border-violet-400 dark:border-zinc-600 dark:bg-zinc-800"
                          }`}
                        >
                          {todo.completed && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </button>

                        {/* Text + meta */}
                        <div className="min-w-0 flex-1">
                          <p className={`${textSize} leading-relaxed ${
                            todo.completed
                              ? "text-zinc-400 line-through dark:text-zinc-500"
                              : "text-zinc-700 dark:text-zinc-300"
                          }`}>
                            {todo.text}
                          </p>

                          {/* Completed info */}
                          {todo.completed && todo.completedByName && (
                            <p className={`mt-0.5 ${smallText} text-emerald-500 dark:text-emerald-400`}>
                              Completed by {todo.completedByName} {todo.completedAt && formatRelativeTime(todo.completedAt)}
                            </p>
                          )}

                          {/* Completion note */}
                          {todo.completionNote && (
                            <div className={`mt-1 rounded bg-zinc-100 px-2 py-1 ${smallText} text-zinc-500 italic dark:bg-zinc-800 dark:text-zinc-400`}>
                              {todo.completionNote}
                            </div>
                          )}

                          {/* Note input when checking off */}
                          {noteInputId === todo._id && !todo.completed && (
                            <div className="mt-1.5 flex gap-1">
                              <input
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleConfirmToggle(todo._id as Id<"improvementTodos">);
                                  if (e.key === "Escape") setNoteInputId(null);
                                }}
                                placeholder="What did you do? (optional)"
                                autoFocus
                                className={`flex-1 rounded border border-violet-200 bg-white px-2 py-0.5 ${smallText} text-zinc-700 outline-none focus:border-violet-400 dark:border-violet-800 dark:bg-zinc-900 dark:text-zinc-300`}
                              />
                              <button
                                onClick={() => handleConfirmToggle(todo._id as Id<"improvementTodos">)}
                                className={`rounded bg-emerald-600 px-2 py-0.5 ${smallText} font-medium text-white hover:bg-emerald-700`}
                              >
                                Done
                              </button>
                              <button
                                onClick={() => setNoteInputId(null)}
                                className={`rounded px-1.5 py-0.5 ${smallText} text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800`}
                              >
                                Skip
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={() => {
                            if (confirm("Delete this task?")) {
                              deleteTodo({ todoId: todo._id as Id<"improvementTodos"> });
                            }
                          }}
                          className="shrink-0 rounded p-0.5 text-zinc-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-400 group-hover:opacity-100 dark:text-zinc-600 dark:hover:bg-red-900/20"
                          title="Delete task"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Add note to completed item */}
                      {todo.completed && !todo.completionNote && noteInputId !== `note-${todo._id}` && (
                        <button
                          onClick={() => {
                            setNoteInputId(`note-${todo._id}`);
                            setNoteText("");
                          }}
                          className={`mt-1 ${smallText} text-zinc-400 hover:text-violet-500`}
                        >
                          + Add note
                        </button>
                      )}
                      {noteInputId === `note-${todo._id}` && (
                        <div className="mt-1 flex gap-1">
                          <input
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && noteText.trim()) {
                                addNote({ todoId: todo._id as Id<"improvementTodos">, completionNote: noteText.trim() });
                                setNoteInputId(null);
                                setNoteText("");
                              }
                              if (e.key === "Escape") setNoteInputId(null);
                            }}
                            placeholder="Add a note..."
                            autoFocus
                            className={`flex-1 rounded border border-zinc-200 bg-white px-2 py-0.5 ${smallText} text-zinc-700 outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`}
                          />
                          <button
                            onClick={() => {
                              if (noteText.trim()) {
                                addNote({ todoId: todo._id as Id<"improvementTodos">, completionNote: noteText.trim() });
                                setNoteInputId(null);
                                setNoteText("");
                              }
                            }}
                            className={`rounded bg-violet-600 px-2 py-0.5 ${smallText} font-medium text-white hover:bg-violet-700`}
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new todo */}
      <div className="mt-2 rounded border border-dashed border-zinc-200 p-2 dark:border-zinc-700">
        <div className="flex gap-1.5">
          <input
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAddTodo();
              }
            }}
            placeholder="Add a new task..."
            className={`flex-1 rounded border border-zinc-200 bg-white px-2 py-1 ${textSize} text-zinc-700 outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`}
          />
          <button
            onClick={handleAddTodo}
            disabled={!newTodoText.trim() || addingTodo}
            className={`rounded bg-violet-600 px-2.5 py-1 ${compact ? "text-[9px]" : "text-[10px]"} font-medium text-white hover:bg-violet-700 disabled:opacity-40`}
          >
            {addingTodo ? "..." : "+ Add"}
          </button>
        </div>
        {existingPhases.length > 0 && (
          <div className="mt-1 flex items-center gap-1">
            <span className={`${smallText} text-zinc-400`}>Phase:</span>
            <select
              value={newTodoPhase}
              onChange={(e) => setNewTodoPhase(e.target.value)}
              className={`rounded border border-zinc-200 bg-white px-1.5 py-0.5 ${smallText} text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400`}
            >
              <option value="">None</option>
              {existingPhases.map((phase) => (
                <option key={phase} value={phase}>{phase}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <p className={`mt-2 text-center ${smallText} text-zinc-400`}>
          No tasks yet. Add tasks manually or generate them with AI.
        </p>
      )}
    </div>
  );
}
