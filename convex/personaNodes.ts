import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("personaNodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
  },
});

export const getByPersona = query({
  args: {
    boardId: v.id("boards"),
    personaId: v.id("personas"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("personaNodes")
      .withIndex("by_persona", (q) =>
        q.eq("boardId", args.boardId).eq("personaId", args.personaId)
      )
      .collect();
  },
});

export const assign = mutation({
  args: {
    boardId: v.id("boards"),
    personaId: v.id("personas"),
    nodeId: v.string(),
  },
  handler: async (ctx, args) => {
    // Idempotent: check if already exists
    const existing = await ctx.db
      .query("personaNodes")
      .withIndex("by_node", (q) =>
        q.eq("boardId", args.boardId).eq("nodeId", args.nodeId)
      )
      .collect();
    const alreadyAssigned = existing.find(
      (pn) => pn.personaId === args.personaId
    );
    if (alreadyAssigned) return alreadyAssigned._id;

    return await ctx.db.insert("personaNodes", {
      boardId: args.boardId,
      personaId: args.personaId,
      nodeId: args.nodeId,
    });
  },
});

export const unassign = mutation({
  args: {
    boardId: v.id("boards"),
    personaId: v.id("personas"),
    nodeId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("personaNodes")
      .withIndex("by_node", (q) =>
        q.eq("boardId", args.boardId).eq("nodeId", args.nodeId)
      )
      .collect();
    const record = existing.find((pn) => pn.personaId === args.personaId);
    if (record) {
      await ctx.db.delete(record._id);
    }
  },
});

export const bulkAssign = mutation({
  args: {
    boardId: v.id("boards"),
    personaId: v.id("personas"),
    nodeIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Remove all existing assignments for this persona on this board
    const existing = await ctx.db
      .query("personaNodes")
      .withIndex("by_persona", (q) =>
        q.eq("boardId", args.boardId).eq("personaId", args.personaId)
      )
      .collect();
    for (const pn of existing) {
      await ctx.db.delete(pn._id);
    }

    // Create new assignments
    for (const nodeId of args.nodeIds) {
      await ctx.db.insert("personaNodes", {
        boardId: args.boardId,
        personaId: args.personaId,
        nodeId,
      });
    }
  },
});
