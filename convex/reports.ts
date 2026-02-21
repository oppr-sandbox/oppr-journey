import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reports")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect()
      .then((reports) => reports.sort((a, b) => b.createdAt - a.createdAt));
  },
});

export const get = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.reportId);
  },
});

export const create = mutation({
  args: {
    boardId: v.id("boards"),
    title: v.string(),
    content: v.string(),
    summary: v.string(),
    findings: v.array(v.object({
      type: v.string(),
      severity: v.string(),
      description: v.string(),
      affectedNodes: v.optional(v.array(v.string())),
    })),
    personaId: v.optional(v.id("personas")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("reports", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.reportId);
  },
});
