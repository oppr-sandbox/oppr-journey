import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect()
      .then((messages) => messages.sort((a, b) => a.createdAt - b.createdAt));
  },
});

export const addMessage = mutation({
  args: {
    boardId: v.id("boards"),
    role: v.string(),
    content: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chatMessages", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const clearChat = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
  },
});
