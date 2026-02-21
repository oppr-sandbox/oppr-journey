import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
  },
});

export const addNode = mutation({
  args: {
    boardId: v.id("boards"),
    nodeId: v.string(),
    type: v.string(),
    position: v.object({ x: v.number(), y: v.number() }),
    data: v.any(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("nodes", args);
    await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
  },
});

export const updatePosition = mutation({
  args: {
    boardId: v.id("boards"),
    nodeId: v.string(),
    position: v.object({ x: v.number(), y: v.number() }),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .filter((q) => q.eq(q.field("nodeId"), args.nodeId))
      .first();
    if (node) {
      await ctx.db.patch(node._id, { position: args.position });
      await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
    }
  },
});

export const updateData = mutation({
  args: {
    boardId: v.id("boards"),
    nodeId: v.string(),
    data: v.any(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .filter((q) => q.eq(q.field("nodeId"), args.nodeId))
      .first();
    if (node) {
      const updates: Record<string, unknown> = { data: args.data };
      if (args.width !== undefined) updates.width = args.width;
      if (args.height !== undefined) updates.height = args.height;
      await ctx.db.patch(node._id, updates);
      await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
    }
  },
});

export const updateDimensions = mutation({
  args: {
    boardId: v.id("boards"),
    nodeId: v.string(),
    width: v.number(),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .filter((q) => q.eq(q.field("nodeId"), args.nodeId))
      .first();
    if (node) {
      const updates: Record<string, unknown> = { width: args.width };
      if (args.height !== undefined) updates.height = args.height;
      await ctx.db.patch(node._id, updates);
      await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
    }
  },
});

export const bulkUpdatePositions = mutation({
  args: {
    boardId: v.id("boards"),
    updates: v.array(
      v.object({
        nodeId: v.string(),
        position: v.object({ x: v.number(), y: v.number() }),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const update of args.updates) {
      const node = await ctx.db
        .query("nodes")
        .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
        .filter((q) => q.eq(q.field("nodeId"), update.nodeId))
        .first();
      if (node) {
        await ctx.db.patch(node._id, { position: update.position });
      }
    }
    await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
  },
});

export const deleteNode = mutation({
  args: {
    boardId: v.id("boards"),
    nodeId: v.string(),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .filter((q) => q.eq(q.field("nodeId"), args.nodeId))
      .first();
    if (node) {
      await ctx.db.delete(node._id);
      await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
    }

    // Also delete connected edges
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const edge of edges) {
      if (edge.source === args.nodeId || edge.target === args.nodeId) {
        await ctx.db.delete(edge._id);
      }
    }

    // Also delete personaNode assignments for this node
    const personaNodes = await ctx.db
      .query("personaNodes")
      .withIndex("by_node", (q) => q.eq("boardId", args.boardId).eq("nodeId", args.nodeId))
      .collect();
    for (const pn of personaNodes) {
      await ctx.db.delete(pn._id);
    }
  },
});

export const convertToScreenshot = mutation({
  args: {
    boardId: v.id("boards"),
    nodeId: v.string(),
    imageUrl: v.string(),
    label: v.string(),
    platform: v.optional(v.string()),
    globalScreenshotId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .filter((q) => q.eq(q.field("nodeId"), args.nodeId))
      .first();
    if (node) {
      await ctx.db.patch(node._id, {
        type: "screenshot",
        data: {
          imageUrl: args.imageUrl,
          label: args.label,
          platform: args.platform || "",
          globalScreenshotId: args.globalScreenshotId,
        },
        width: 220,
      });
      await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
    }
  },
});
