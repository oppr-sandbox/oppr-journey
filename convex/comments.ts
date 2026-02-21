import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("comments")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect()
      .then((comments) => comments.sort((a, b) => b.createdAt - a.createdAt));
  },
});

export const getByNode = query({
  args: { boardId: v.id("boards"), nodeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("comments")
      .withIndex("by_node", (q) =>
        q.eq("boardId", args.boardId).eq("nodeId", args.nodeId)
      )
      .collect()
      .then((comments) => comments.sort((a, b) => b.createdAt - a.createdAt));
  },
});

export const addComment = mutation({
  args: {
    boardId: v.id("boards"),
    nodeId: v.optional(v.string()),
    authorId: v.string(),
    authorName: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("comments", {
      ...args,
      createdAt: Date.now(),
      resolved: false,
    });
    await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
  },
});

export const resolveComment = mutation({
  args: {
    commentId: v.id("comments"),
    resolved: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commentId, { resolved: args.resolved });
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.commentId);
  },
});
