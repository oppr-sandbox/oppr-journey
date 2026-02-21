import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByImprovement = query({
  args: { improvementId: v.id("improvements") },
  handler: async (ctx, args) => {
    const todos = await ctx.db
      .query("improvementTodos")
      .withIndex("by_improvement", (q) => q.eq("improvementId", args.improvementId))
      .collect();
    return todos.sort((a, b) => a.order - b.order);
  },
});

export const toggle = mutation({
  args: {
    todoId: v.id("improvementTodos"),
    completedBy: v.string(),
    completedByName: v.string(),
    completionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const todo = await ctx.db.get(args.todoId);
    if (!todo) return;

    if (todo.completed) {
      // Uncheck
      await ctx.db.patch(args.todoId, {
        completed: false,
        completedAt: undefined,
        completedBy: undefined,
        completedByName: undefined,
        completionNote: undefined,
      });
    } else {
      // Check
      await ctx.db.patch(args.todoId, {
        completed: true,
        completedAt: Date.now(),
        completedBy: args.completedBy,
        completedByName: args.completedByName,
        completionNote: args.completionNote || undefined,
      });
    }
  },
});

export const addNote = mutation({
  args: {
    todoId: v.id("improvementTodos"),
    completionNote: v.string(),
  },
  handler: async (ctx, args) => {
    const todo = await ctx.db.get(args.todoId);
    if (!todo) return;
    await ctx.db.patch(args.todoId, {
      completionNote: args.completionNote,
    });
  },
});

export const addTodo = mutation({
  args: {
    improvementId: v.id("improvements"),
    boardId: v.id("boards"),
    text: v.string(),
    phase: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get highest order
    const existing = await ctx.db
      .query("improvementTodos")
      .withIndex("by_improvement", (q) => q.eq("improvementId", args.improvementId))
      .collect();
    const maxOrder = existing.length > 0 ? Math.max(...existing.map((t) => t.order)) : -1;

    return await ctx.db.insert("improvementTodos", {
      improvementId: args.improvementId,
      boardId: args.boardId,
      text: args.text,
      completed: false,
      order: maxOrder + 1,
      phase: args.phase,
      createdAt: Date.now(),
      createdBy: args.createdBy,
      createdByName: args.createdByName,
    });
  },
});

export const deleteTodo = mutation({
  args: { todoId: v.id("improvementTodos") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.todoId);
  },
});

export const bulkCreate = mutation({
  args: {
    improvementId: v.id("improvements"),
    boardId: v.id("boards"),
    todos: v.array(v.object({
      text: v.string(),
      phase: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (let i = 0; i < args.todos.length; i++) {
      await ctx.db.insert("improvementTodos", {
        improvementId: args.improvementId,
        boardId: args.boardId,
        text: args.todos[i].text,
        completed: false,
        order: i,
        phase: args.todos[i].phase,
        createdAt: now,
        createdBy: "ai-generated",
        createdByName: "AI",
      });
    }
  },
});

export const updateText = mutation({
  args: {
    todoId: v.id("improvementTodos"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.todoId, { text: args.text });
  },
});
