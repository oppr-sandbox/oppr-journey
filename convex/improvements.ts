import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const improvements = await ctx.db
      .query("improvements")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    return improvements.sort((a, b) => a.number - b.number);
  },
});

export const getById = query({
  args: { improvementId: v.id("improvements") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.improvementId);
  },
});

export const listAllWithBoardInfo = query({
  handler: async (ctx) => {
    const allImprovements = await ctx.db.query("improvements").collect();
    const result = [];

    for (const imp of allImprovements) {
      const board = await ctx.db.get(imp.boardId);
      if (!board) continue;

      // Count comments for this improvement
      const comments = await ctx.db
        .query("improvementComments")
        .withIndex("by_improvement", (q) => q.eq("improvementId", imp._id))
        .collect();

      // Count todos for this improvement
      const todos = await ctx.db
        .query("improvementTodos")
        .withIndex("by_improvement", (q) => q.eq("improvementId", imp._id))
        .collect();
      const todoTotal = todos.length;
      const todoCompleted = todos.filter((t) => t.completed).length;

      // Resolve connected screenshot URLs
      const connectedScreenshots: { nodeId: string; label: string; imageUrl: string | null }[] = [];
      for (const connectedNodeId of imp.connectedNodeIds) {
        const nodes = await ctx.db
          .query("nodes")
          .withIndex("by_board", (q) => q.eq("boardId", imp.boardId))
          .collect();
        const node = nodes.find((n) => n.nodeId === connectedNodeId);
        if (node && node.type === "screenshot" && node.data?.imageUrl) {
          connectedScreenshots.push({
            nodeId: connectedNodeId,
            label: node.data?.label || node.data?.text || connectedNodeId,
            imageUrl: node.data.imageUrl,
          });
        } else if (node) {
          connectedScreenshots.push({
            nodeId: connectedNodeId,
            label: node.data?.label || node.data?.text || connectedNodeId,
            imageUrl: null,
          });
        }
      }

      result.push({
        ...imp,
        boardName: board.name,
        boardArchived: board.archived === true,
        commentCount: comments.length,
        todoTotal,
        todoCompleted,
        connectedScreenshots,
      });
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const create = mutation({
  args: {
    boardId: v.id("boards"),
    nodeId: v.string(),
    title: v.string(),
    connectedNodeIds: v.optional(v.array(v.string())),
    createdById: v.optional(v.string()),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get next IMP number
    const existing = await ctx.db
      .query("improvements")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    const maxNumber = existing.reduce((max, imp) => Math.max(max, imp.number), 0);
    const nextNumber = maxNumber + 1;

    const id = await ctx.db.insert("improvements", {
      boardId: args.boardId,
      nodeId: args.nodeId,
      number: nextNumber,
      title: args.title,
      status: "open",
      connectedNodeIds: args.connectedNodeIds || [],
      generatedByAI: false,
      createdAt: Date.now(),
      createdById: args.createdById,
      createdByName: args.createdByName,
      statusHistory: [],
    });

    await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
    return { id, number: nextNumber };
  },
});

export const update = mutation({
  args: {
    improvementId: v.id("improvements"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    currentState: v.optional(v.string()),
    proposedImprovement: v.optional(v.string()),
    expectedImpact: v.optional(v.string()),
    developerTodos: v.optional(v.string()),
    priority: v.optional(v.string()),
    status: v.optional(v.string()),
    connectedNodeIds: v.optional(v.array(v.string())),
    generatedByAI: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { improvementId, ...updates } = args;
    // Filter out undefined values
    const patch: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(improvementId, patch);
    }
  },
});

export const changeStatus = mutation({
  args: {
    improvementId: v.id("improvements"),
    newStatus: v.string(),
    changedBy: v.string(),
    changedByName: v.string(),
  },
  handler: async (ctx, args) => {
    const imp = await ctx.db.get(args.improvementId);
    if (!imp) throw new Error("Improvement not found");

    const historyEntry = {
      from: imp.status,
      to: args.newStatus,
      changedBy: args.changedBy,
      changedByName: args.changedByName,
      changedAt: Date.now(),
    };

    const patch: Record<string, any> = {
      status: args.newStatus,
      statusHistory: [...(imp.statusHistory || []), historyEntry],
    };

    if (args.newStatus === "closed") {
      patch.closedAt = Date.now();
    } else if (imp.status === "closed" && args.newStatus !== "closed") {
      // Reopening — clear closedAt
      patch.closedAt = undefined;
    }

    await ctx.db.patch(args.improvementId, patch);
  },
});

export const assign = mutation({
  args: {
    improvementId: v.id("improvements"),
    assigneeId: v.optional(v.string()),
    assigneeName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.improvementId, {
      assigneeId: args.assigneeId,
      assigneeName: args.assigneeName,
    });
  },
});

// Backward compat wrappers
export const finalize = mutation({
  args: { improvementId: v.id("improvements") },
  handler: async (ctx, args) => {
    const imp = await ctx.db.get(args.improvementId);
    if (!imp) return;
    const historyEntry = {
      from: imp.status,
      to: "closed",
      changedBy: "system",
      changedByName: "System",
      changedAt: Date.now(),
    };
    await ctx.db.patch(args.improvementId, {
      status: "closed",
      closedAt: Date.now(),
      statusHistory: [...(imp.statusHistory || []), historyEntry],
    });
  },
});

export const reopen = mutation({
  args: { improvementId: v.id("improvements") },
  handler: async (ctx, args) => {
    const imp = await ctx.db.get(args.improvementId);
    if (!imp) return;
    const historyEntry = {
      from: imp.status,
      to: "open",
      changedBy: "system",
      changedByName: "System",
      changedAt: Date.now(),
    };
    await ctx.db.patch(args.improvementId, {
      status: "open",
      closedAt: undefined,
      statusHistory: [...(imp.statusHistory || []), historyEntry],
    });
  },
});

export const clearContent = mutation({
  args: { improvementId: v.id("improvements") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.improvementId, {
      title: "New improvement",
      content: undefined,
      currentState: undefined,
      proposedImprovement: undefined,
      expectedImpact: undefined,
      developerTodos: undefined,
      priority: undefined,
      generatedByAI: false,
      status: "open",
    });
  },
});

export const remove = mutation({
  args: { improvementId: v.id("improvements") },
  handler: async (ctx, args) => {
    // Delete associated improvement comments
    const comments = await ctx.db
      .query("improvementComments")
      .withIndex("by_improvement", (q) => q.eq("improvementId", args.improvementId))
      .collect();
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }
    // Delete associated improvement todos
    const todos = await ctx.db
      .query("improvementTodos")
      .withIndex("by_improvement", (q) => q.eq("improvementId", args.improvementId))
      .collect();
    for (const todo of todos) {
      await ctx.db.delete(todo._id);
    }
    await ctx.db.delete(args.improvementId);
  },
});

// One-time migration: convert "finalized" -> "closed"
export const migrateStatusValues = mutation({
  handler: async (ctx) => {
    const all = await ctx.db.query("improvements").collect();
    let migrated = 0;
    for (const imp of all) {
      const patch: Record<string, any> = {};
      if (imp.status === "finalized") {
        patch.status = "closed";
        patch.closedAt = imp.createdAt; // approximate
        migrated++;
      }
      if (!imp.statusHistory) {
        patch.statusHistory = [];
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(imp._id, patch);
      }
    }
    return { migrated, total: all.length };
  },
});
