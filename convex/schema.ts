import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  boards: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Versioning fields
    version: v.optional(v.string()),
    parentBoardId: v.optional(v.id("boards")),
    rootBoardId: v.optional(v.id("boards")),
    versionNote: v.optional(v.string()),
    // Phase 2 additions
    archived: v.optional(v.boolean()),
    aiSummary: v.optional(v.string()),
    // Phase 3 additions
    ownerName: v.optional(v.string()),
    // Tools association
    toolIds: v.optional(v.array(v.id("tools"))),
  }).index("by_owner", ["ownerId"])
    .index("by_root", ["rootBoardId"]),

  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    lastSeenAt: v.number(),
    createdAt: v.number(),
    lastViewedScreenshotsAt: v.optional(v.number()),
  }).index("by_clerk", ["clerkId"]),

  screenshotFolders: defineTable({
    name: v.string(),
    createdAt: v.number(),
    createdBy: v.string(),
  }).index("by_name", ["name"]),

  globalScreenshots: defineTable({
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    label: v.optional(v.string()),
    platform: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    uploadedBy: v.string(),
    uploadedByName: v.string(),
    createdAt: v.number(),
    folderId: v.optional(v.id("screenshotFolders")),
    size: v.optional(v.number()),
  }).index("by_uploader", ["uploadedBy"])
    .index("by_folder", ["folderId"]),

  boardScreenshots: defineTable({
    boardId: v.id("boards"),
    globalScreenshotId: v.id("globalScreenshots"),
    folder: v.optional(v.string()),
    addedAt: v.number(),
  }).index("by_board", ["boardId"])
    .index("by_global", ["globalScreenshotId"]),

  nodes: defineTable({
    boardId: v.id("boards"),
    nodeId: v.string(),
    type: v.string(),
    position: v.object({ x: v.number(), y: v.number() }),
    data: v.any(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  }).index("by_board", ["boardId"]),

  edges: defineTable({
    boardId: v.id("boards"),
    edgeId: v.string(),
    source: v.string(),
    target: v.string(),
    sourceHandle: v.optional(v.string()),
    targetHandle: v.optional(v.string()),
    label: v.optional(v.string()),
    type: v.optional(v.string()),
  }).index("by_board", ["boardId"]),

  screenshots: defineTable({
    boardId: v.id("boards"),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    label: v.optional(v.string()),
    platform: v.optional(v.string()),
    folder: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    createdAt: v.number(),
  }).index("by_board", ["boardId"]),

  personas: defineTable({
    boardId: v.id("boards"),
    name: v.string(),
    description: v.string(),
    color: v.string(),
    order: v.number(),
  }).index("by_board", ["boardId"]),

  comments: defineTable({
    boardId: v.id("boards"),
    nodeId: v.optional(v.string()),
    authorId: v.string(),
    authorName: v.string(),
    text: v.string(),
    createdAt: v.number(),
    resolved: v.boolean(),
  }).index("by_board", ["boardId"])
    .index("by_node", ["boardId", "nodeId"]),

  chatMessages: defineTable({
    boardId: v.id("boards"),
    role: v.string(),
    content: v.string(),
    createdAt: v.number(),
    metadata: v.optional(v.any()),
  }).index("by_board", ["boardId"]),

  personaNodes: defineTable({
    boardId: v.id("boards"),
    personaId: v.id("personas"),
    nodeId: v.string(),
  }).index("by_board", ["boardId"])
    .index("by_persona", ["boardId", "personaId"])
    .index("by_node", ["boardId", "nodeId"]),

  reports: defineTable({
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
    createdAt: v.number(),
    personaId: v.optional(v.id("personas")),
  }).index("by_board", ["boardId"]),

  improvements: defineTable({
    boardId: v.id("boards"),
    nodeId: v.string(),
    number: v.number(),
    title: v.string(),
    content: v.optional(v.string()),
    currentState: v.optional(v.string()),
    proposedImprovement: v.optional(v.string()),
    expectedImpact: v.optional(v.string()),
    developerTodos: v.optional(v.string()),
    priority: v.optional(v.string()),
    status: v.string(),
    connectedNodeIds: v.array(v.string()),
    generatedByAI: v.boolean(),
    createdAt: v.number(),
    assigneeId: v.optional(v.string()),
    assigneeName: v.optional(v.string()),
    createdById: v.optional(v.string()),
    createdByName: v.optional(v.string()),
    closedAt: v.optional(v.number()),
    statusHistory: v.optional(v.array(v.object({
      from: v.string(),
      to: v.string(),
      changedBy: v.string(),
      changedByName: v.string(),
      changedAt: v.number(),
    }))),
  }).index("by_board", ["boardId"])
    .index("by_status", ["status"]),

  improvementTodos: defineTable({
    improvementId: v.id("improvements"),
    boardId: v.id("boards"),
    text: v.string(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.string()),
    completedByName: v.optional(v.string()),
    completionNote: v.optional(v.string()),
    order: v.number(),
    phase: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.optional(v.string()),
    createdByName: v.optional(v.string()),
  }).index("by_improvement", ["improvementId"])
    .index("by_board", ["boardId"]),

  improvementComments: defineTable({
    improvementId: v.id("improvements"),
    boardId: v.id("boards"),
    authorId: v.string(),
    authorName: v.string(),
    authorImageUrl: v.optional(v.string()),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_improvement", ["improvementId"])
    .index("by_board", ["boardId"]),

  promptTemplates: defineTable({
    key: v.string(),
    label: v.string(),
    category: v.string(),
    prompt: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  tools: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    category: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),
});
