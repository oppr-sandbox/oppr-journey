import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    name: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("screenshotFolders", {
      name: args.name,
      createdAt: Date.now(),
      createdBy: args.createdBy,
    });
  },
});

export const listAll = query({
  handler: async (ctx) => {
    const folders = await ctx.db.query("screenshotFolders").collect();

    // Count screenshots per folder
    const allScreenshots = await ctx.db.query("globalScreenshots").collect();
    const countMap = new Map<string, number>();
    for (const s of allScreenshots) {
      if (s.folderId) {
        countMap.set(s.folderId, (countMap.get(s.folderId) || 0) + 1);
      }
    }

    return folders
      .map((f) => ({
        ...f,
        count: countMap.get(f._id) || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const rename = mutation({
  args: {
    id: v.id("screenshotFolders"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { name: args.name });
  },
});

export const remove = mutation({
  args: {
    id: v.id("screenshotFolders"),
  },
  handler: async (ctx, args) => {
    // Unfile all screenshots in this folder
    const screenshots = await ctx.db
      .query("globalScreenshots")
      .withIndex("by_folder", (q) => q.eq("folderId", args.id))
      .collect();
    for (const s of screenshots) {
      await ctx.db.patch(s._id, { folderId: undefined });
    }
    // Delete the folder
    await ctx.db.delete(args.id);
  },
});
