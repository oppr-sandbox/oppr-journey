import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
  },
});

export const addEdge = mutation({
  args: {
    boardId: v.id("boards"),
    edgeId: v.string(),
    source: v.string(),
    target: v.string(),
    sourceHandle: v.optional(v.string()),
    targetHandle: v.optional(v.string()),
    label: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("edges", args);
    await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
  },
});

export const updateLabel = mutation({
  args: {
    boardId: v.id("boards"),
    edgeId: v.string(),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const edge = await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .filter((q) => q.eq(q.field("edgeId"), args.edgeId))
      .first();
    if (edge) {
      await ctx.db.patch(edge._id, { label: args.label });
      await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
    }
  },
});

export const updateConnection = mutation({
  args: {
    boardId: v.id("boards"),
    edgeId: v.string(),
    source: v.string(),
    target: v.string(),
    sourceHandle: v.optional(v.string()),
    targetHandle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const edge = await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .filter((q) => q.eq(q.field("edgeId"), args.edgeId))
      .first();
    if (edge) {
      await ctx.db.patch(edge._id, {
        source: args.source,
        target: args.target,
        sourceHandle: args.sourceHandle,
        targetHandle: args.targetHandle,
      });
      await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
    }
  },
});

export const deleteEdge = mutation({
  args: {
    boardId: v.id("boards"),
    edgeId: v.string(),
  },
  handler: async (ctx, args) => {
    const edge = await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .filter((q) => q.eq(q.field("edgeId"), args.edgeId))
      .first();
    if (edge) {
      await ctx.db.delete(edge._id);
      await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
    }
  },
});
