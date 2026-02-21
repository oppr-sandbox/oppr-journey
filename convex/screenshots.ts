import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveScreenshot = mutation({
  args: {
    boardId: v.id("boards"),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    label: v.optional(v.string()),
    platform: v.optional(v.string()),
    folder: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("screenshots", {
      ...args,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
  },
});

export const getByBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const screenshots = await ctx.db
      .query("screenshots")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .order("desc")
      .collect();

    return await Promise.all(
      screenshots.map(async (screenshot) => ({
        ...screenshot,
        url: await ctx.storage.getUrl(screenshot.storageId),
      }))
    );
  },
});

export const deleteScreenshot = mutation({
  args: {
    screenshotId: v.id("screenshots"),
  },
  handler: async (ctx, args) => {
    const screenshot = await ctx.db.get(args.screenshotId);
    if (screenshot) {
      await ctx.storage.delete(screenshot.storageId);
      await ctx.db.delete(args.screenshotId);
    }
  },
});

export const updateScreenshot = mutation({
  args: {
    screenshotId: v.id("screenshots"),
    label: v.optional(v.string()),
    platform: v.optional(v.string()),
    folder: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { screenshotId, ...updates } = args;
    const filtered: Record<string, any> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[k] = val;
    }
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(screenshotId, filtered);
    }
  },
});

export const bulkMoveToFolder = mutation({
  args: {
    screenshotIds: v.array(v.id("screenshots")),
    folder: v.string(),
  },
  handler: async (ctx, args) => {
    for (const id of args.screenshotIds) {
      await ctx.db.patch(id, { folder: args.folder });
    }
  },
});

export const getFolders = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const screenshots = await ctx.db
      .query("screenshots")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    const folders = new Set<string>();
    for (const s of screenshots) {
      if (s.folder) folders.add(s.folder);
    }
    return Array.from(folders).sort();
  },
});
