import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByImprovement = query({
  args: { improvementId: v.id("improvements") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("improvementComments")
      .withIndex("by_improvement", (q) => q.eq("improvementId", args.improvementId))
      .collect();
    return comments.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const addComment = mutation({
  args: {
    improvementId: v.id("improvements"),
    boardId: v.id("boards"),
    authorId: v.string(),
    authorName: v.string(),
    authorImageUrl: v.optional(v.string()),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("improvementComments", {
      improvementId: args.improvementId,
      boardId: args.boardId,
      authorId: args.authorId,
      authorName: args.authorName,
      authorImageUrl: args.authorImageUrl,
      text: args.text,
      createdAt: Date.now(),
    });
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("improvementComments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.commentId);
  },
});
