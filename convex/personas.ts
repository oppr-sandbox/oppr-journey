import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const getByBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("personas")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect()
      .then((personas) => personas.sort((a, b) => a.order - b.order));
  },
});

export const create = mutation({
  args: {
    boardId: v.id("boards"),
    name: v.string(),
    description: v.string(),
    color: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("personas", args);
  },
});

export const update = mutation({
  args: {
    personaId: v.id("personas"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { personaId, ...updates } = args;
    const filtered: Record<string, string> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[k] = val;
    }
    await ctx.db.patch(personaId, filtered);
  },
});

export const remove = mutation({
  args: { personaId: v.id("personas") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.personaId);
  },
});

export const reorder = mutation({
  args: {
    personaId: v.id("personas"),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.personaId, { order: args.order });
  },
});

// Default OPPR personas with rich descriptions for AI analysis
const DEFAULT_PERSONAS = [
  {
    name: "OPPR Admin",
    description:
      "Internal OPPR staff responsible for platform-wide configuration and oversight. " +
      "Manages tenant provisioning, global IAM policies, service health monitoring, and billing. " +
      "Has superuser access across all tenants. Primary concerns: security compliance, audit trails, " +
      "platform stability. Typically accesses the OPPR Admin Portal (desktop). " +
      "Expected workflow: configure tenant settings → assign customer admin roles → monitor audit logs → review compliance reports. " +
      "Pain points: needs quick access to cross-tenant views, bulk operations, and escalation paths.",
    color: "#a855f7", // purple
  },
  {
    name: "Customer Admin",
    description:
      "External customer-side administrator who manages their organization's OPPR tenant. " +
      "Responsible for user management, role assignments, SSO/SAML configuration, and organizational policies. " +
      "Has full admin access within their own tenant but no cross-tenant visibility. " +
      "Primary concerns: onboarding new team members quickly, enforcing security policies, managing permissions. " +
      "Typically accesses the Customer Admin Dashboard (desktop). " +
      "Expected workflow: invite users → assign roles → configure authentication → set up teams/departments → review activity logs. " +
      "Pain points: needs clear separation between admin and operator views, self-service password resets, delegation of sub-admin tasks.",
    color: "#3b82f6", // blue
  },
  {
    name: "Customer Ops Manager",
    description:
      "Mid-level manager on the customer side who oversees day-to-day operations and team workflows. " +
      "Does not configure IAM policies but needs visibility into team activity, approval queues, and operational metrics. " +
      "Has read access to most admin screens plus write access to operational workflows. " +
      "Primary concerns: team productivity, workflow bottlenecks, approval turnaround times, reporting. " +
      "Accesses both the desktop dashboard and mobile app for on-the-go approvals. " +
      "Expected workflow: review pending approvals → check team activity → generate reports → escalate issues to Customer Admin. " +
      "Pain points: terminology differences between admin and operator views cause confusion, needs streamlined approval flows, " +
      "wants mobile notifications for urgent approvals.",
    color: "#f59e0b", // amber
  },
  {
    name: "Customer Operator",
    description:
      "Front-line user on the customer side who performs daily tasks within OPPR. " +
      "Has the most restricted access — can only interact with screens and workflows assigned to their role. " +
      "Does not manage users or configure policies. " +
      "Primary concerns: getting tasks done quickly, understanding what actions are available, knowing status of requests. " +
      "Primarily uses the mobile app, occasionally the desktop interface. " +
      "Expected workflow: log in → view assigned tasks → complete actions (start/stop/submit) → check status → receive notifications. " +
      "Pain points: inconsistent terminology (e.g., 'start' in one screen vs 'initiate' in another vs 'activate' in mobile), " +
      "unclear navigation between related screens, no indication of what happens after submitting an action, " +
      "dead-end flows where the user doesn't know what to do next.",
    color: "#22c55e", // green
  },
  {
    name: "External Auditor",
    description:
      "Third-party compliance or security auditor who requires read-only access to audit trails, " +
      "access logs, policy configurations, and compliance reports. " +
      "Has a time-limited, scoped-down read-only role — cannot modify any data. " +
      "Primary concerns: completeness of audit logs, evidence of access controls, policy enforcement proof, data export. " +
      "Accesses the Audit & Compliance portal (desktop only). " +
      "Expected workflow: log in via temporary credentials → navigate to audit logs → filter by date/user/action → export CSV/PDF → review IAM policies. " +
      "Pain points: needs clear log filtering, difficulty finding specific events across tenants, " +
      "export formats not always compatible with compliance tools, session timeouts during long reviews.",
    color: "#06b6d4", // cyan
  },
];

export const listAllUnique = query({
  handler: async (ctx) => {
    const allPersonas = await ctx.db.query("personas").collect();

    // Group by name
    const grouped = new Map<string, {
      name: string;
      description: string;
      color: string;
      boardIds: Set<string>;
    }>();

    for (const p of allPersonas) {
      const existing = grouped.get(p.name);
      if (existing) {
        existing.boardIds.add(p.boardId);
      } else {
        grouped.set(p.name, {
          name: p.name,
          description: p.description,
          color: p.color,
          boardIds: new Set([p.boardId]),
        });
      }
    }

    // Resolve board names
    const result = [];
    for (const [, data] of grouped) {
      const boardNames: string[] = [];
      for (const boardId of data.boardIds) {
        const board = await ctx.db.get(boardId as Id<"boards">);
        if (board) boardNames.push(board.name);
      }
      result.push({
        name: data.name,
        description: data.description,
        color: data.color,
        boardCount: data.boardIds.size,
        boardNames,
      });
    }

    return result.sort((a, b) => b.boardCount - a.boardCount);
  },
});

// === Global editing mutations (dashboard-level persona management) ===

export const updateAllByName = mutation({
  args: {
    originalName: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { originalName, ...updates } = args;
    const filtered: Record<string, string> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[k] = val;
    }
    if (Object.keys(filtered).length === 0) return;

    const allPersonas = await ctx.db.query("personas").collect();
    const matching = allPersonas.filter((p) => p.name === originalName);
    for (const p of matching) {
      await ctx.db.patch(p._id, filtered);
    }
    return matching.length;
  },
});

export const removeAllByName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const allPersonas = await ctx.db.query("personas").collect();
    const matching = allPersonas.filter((p) => p.name === args.name);

    for (const p of matching) {
      // Delete personaNodes assignments for this persona
      const assignments = await ctx.db
        .query("personaNodes")
        .withIndex("by_persona", (q) => q.eq("boardId", p.boardId).eq("personaId", p._id))
        .collect();
      for (const a of assignments) {
        await ctx.db.delete(a._id);
      }
      // Delete the persona itself
      await ctx.db.delete(p._id);
    }
    return matching.length;
  },
});

export const createGlobal = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all active (non-archived) boards
    const allBoards = await ctx.db.query("boards").collect();
    const activeBoards = allBoards.filter((b) => !b.archived);

    let created = 0;
    for (const board of activeBoards) {
      // Find max order for this board
      const boardPersonas = await ctx.db
        .query("personas")
        .withIndex("by_board", (q) => q.eq("boardId", board._id))
        .collect();
      const maxOrder = boardPersonas.reduce((max, p) => Math.max(max, p.order), 0);

      await ctx.db.insert("personas", {
        boardId: board._id,
        name: args.name,
        description: args.description,
        color: args.color,
        order: maxOrder + 1,
      });
      created++;
    }
    return created;
  },
});

// Seeds default personas for a board (called automatically on board creation)
export const seedDefaults = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    // Check if board already has personas — don't double-seed
    const existing = await ctx.db
      .query("personas")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .first();
    if (existing) return;

    for (let i = 0; i < DEFAULT_PERSONAS.length; i++) {
      const p = DEFAULT_PERSONAS[i];
      await ctx.db.insert("personas", {
        boardId: args.boardId,
        name: p.name,
        description: p.description,
        color: p.color,
        order: i + 1,
      });
    }
  },
});
