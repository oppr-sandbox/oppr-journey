import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const save = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    label: v.optional(v.string()),
    platform: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    uploadedBy: v.string(),
    uploadedByName: v.string(),
    folderId: v.optional(v.id("screenshotFolders")),
    size: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("globalScreenshots", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const listAll = query({
  handler: async (ctx) => {
    const screenshots = await ctx.db
      .query("globalScreenshots")
      .order("desc")
      .collect();

    // Get all boardScreenshots to compute usage counts and boardIds
    const allBoardScreenshots = await ctx.db.query("boardScreenshots").collect();

    // Build usage map: globalScreenshotId -> Set of boardIds
    const usageMap = new Map<string, Set<string>>();
    for (const bs of allBoardScreenshots) {
      const existing = usageMap.get(bs.globalScreenshotId) || new Set();
      existing.add(bs.boardId);
      usageMap.set(bs.globalScreenshotId, existing);
    }

    return await Promise.all(
      screenshots.map(async (s) => {
        const boardIdSet = usageMap.get(s._id) || new Set();
        return {
          ...s,
          url: await ctx.storage.getUrl(s.storageId),
          usageCount: boardIdSet.size,
          boardIds: Array.from(boardIdSet),
        };
      })
    );
  },
});

export const listByBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("boardScreenshots")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    const results = [];
    for (const link of links) {
      const gs = await ctx.db.get(link.globalScreenshotId);
      if (gs) {
        const url = await ctx.storage.getUrl(gs.storageId);
        results.push({
          ...gs,
          url,
          folder: link.folder,
          boardScreenshotId: link._id,
        });
      }
    }
    return results;
  },
});

export const getFoldersWithBoards = query({
  handler: async (ctx) => {
    const allLinks = await ctx.db.query("boardScreenshots").collect();

    // Group by boardId
    const boardCounts = new Map<string, number>();
    for (const link of allLinks) {
      boardCounts.set(link.boardId, (boardCounts.get(link.boardId) || 0) + 1);
    }

    const results = [];
    for (const [boardId, count] of boardCounts) {
      const board = await ctx.db.get(boardId as Id<"boards">);
      if (board) {
        results.push({
          boardId,
          boardName: board.name,
          count,
        });
      }
    }

    return results.sort((a, b) => b.count - a.count);
  },
});

export const update = mutation({
  args: {
    id: v.id("globalScreenshots"),
    label: v.optional(v.string()),
    platform: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    folderId: v.optional(v.id("screenshotFolders")),
    clearFolder: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, clearFolder, ...updates } = args;
    const filtered: Record<string, any> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[k] = val;
    }
    if (clearFolder) {
      filtered.folderId = undefined;
    }
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered);
    }
  },
});

export const bulkMoveToFolder = mutation({
  args: {
    ids: v.array(v.id("globalScreenshots")),
    folderId: v.optional(v.id("screenshotFolders")),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.patch(id, { folderId: args.folderId });
    }
  },
});

export const bulkDelete = mutation({
  args: {
    ids: v.array(v.id("globalScreenshots")),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const screenshot = await ctx.db.get(id);
      if (!screenshot) continue;

      // Delete storage
      await ctx.storage.delete(screenshot.storageId);

      // Delete all boardScreenshots references
      const links = await ctx.db
        .query("boardScreenshots")
        .withIndex("by_global", (q) => q.eq("globalScreenshotId", id))
        .collect();
      for (const link of links) {
        await ctx.db.delete(link._id);
      }

      // Delete the record
      await ctx.db.delete(id);
    }
  },
});

export const remove = mutation({
  args: { id: v.id("globalScreenshots") },
  handler: async (ctx, args) => {
    const screenshot = await ctx.db.get(args.id);
    if (!screenshot) return;

    // Delete storage
    await ctx.storage.delete(screenshot.storageId);

    // Delete all boardScreenshots references
    const links = await ctx.db
      .query("boardScreenshots")
      .withIndex("by_global", (q) => q.eq("globalScreenshotId", args.id))
      .collect();
    for (const link of links) {
      await ctx.db.delete(link._id);
    }

    // Delete the record
    await ctx.db.delete(args.id);
  },
});

export const linkToBoard = mutation({
  args: {
    globalScreenshotId: v.id("globalScreenshots"),
    boardId: v.id("boards"),
    folder: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if already linked (idempotent)
    const existing = await ctx.db
      .query("boardScreenshots")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .filter((q) => q.eq(q.field("globalScreenshotId"), args.globalScreenshotId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("boardScreenshots", {
      boardId: args.boardId,
      globalScreenshotId: args.globalScreenshotId,
      folder: args.folder,
      addedAt: Date.now(),
    });
  },
});

export const unlinkFromBoard = mutation({
  args: {
    globalScreenshotId: v.id("globalScreenshots"),
    boardId: v.id("boards"),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("boardScreenshots")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .filter((q) => q.eq(q.field("globalScreenshotId"), args.globalScreenshotId))
      .first();

    if (link) {
      await ctx.db.delete(link._id);
    }
  },
});
