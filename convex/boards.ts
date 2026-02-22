import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const boards = await ctx.db
      .query("boards")
      .order("desc")
      .collect();
    return boards.filter((b) => !b.archived);
  },
});

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const boards = await ctx.db
      .query("boards")
      .order("desc")
      .collect();
    return boards.filter((b) => b.archived === true);
  },
});

export const archive = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.boardId, { archived: true, updatedAt: Date.now() });
  },
});

export const restore = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.boardId, { archived: false, updatedAt: Date.now() });
  },
});

export const get = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.boardId);
  },
});

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
    color: "#a855f7",
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
    color: "#3b82f6",
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
    color: "#f59e0b",
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
    color: "#22c55e",
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
    color: "#06b6d4",
  },
];

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.string(),
    ownerName: v.optional(v.string()),
    toolIds: v.optional(v.array(v.id("tools"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const boardId = await ctx.db.insert("boards", {
      name: args.name,
      description: args.description,
      ownerId: args.ownerId,
      ownerName: args.ownerName,
      toolIds: args.toolIds,
      createdAt: now,
      updatedAt: now,
    });

    // Seed default personas
    for (let i = 0; i < DEFAULT_PERSONAS.length; i++) {
      const p = DEFAULT_PERSONAS[i];
      await ctx.db.insert("personas", {
        boardId,
        name: p.name,
        description: p.description,
        color: p.color,
        order: i + 1,
      });
    }

    return boardId;
  },
});

export const update = mutation({
  args: {
    boardId: v.id("boards"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { boardId, ...updates } = args;
    await ctx.db.patch(boardId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const updateSummary = mutation({
  args: {
    boardId: v.id("boards"),
    aiSummary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.boardId, { aiSummary: args.aiSummary });
  },
});

export const updateTools = mutation({
  args: {
    boardId: v.id("boards"),
    toolIds: v.array(v.id("tools")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.boardId, {
      toolIds: args.toolIds,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    // Delete associated nodes
    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const node of nodes) {
      await ctx.db.delete(node._id);
    }

    // Delete associated edges
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const edge of edges) {
      await ctx.db.delete(edge._id);
    }

    // Delete associated screenshots
    const screenshots = await ctx.db
      .query("screenshots")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const screenshot of screenshots) {
      await ctx.storage.delete(screenshot.storageId);
      await ctx.db.delete(screenshot._id);
    }

    // Delete associated personas
    const personas = await ctx.db
      .query("personas")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const persona of personas) {
      await ctx.db.delete(persona._id);
    }

    // Delete associated comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete associated chat messages
    const chatMessages = await ctx.db
      .query("chatMessages")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const msg of chatMessages) {
      await ctx.db.delete(msg._id);
    }

    // Delete associated personaNodes
    const personaNodes = await ctx.db
      .query("personaNodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const pn of personaNodes) {
      await ctx.db.delete(pn._id);
    }

    // Delete associated reports
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const report of reports) {
      await ctx.db.delete(report._id);
    }

    // Delete associated boardScreenshots (junction to global screenshots)
    const boardScreenshots = await ctx.db
      .query("boardScreenshots")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const bs of boardScreenshots) {
      await ctx.db.delete(bs._id);
    }

    // Delete associated improvements
    const improvements = await ctx.db
      .query("improvements")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const imp of improvements) {
      await ctx.db.delete(imp._id);
    }

    // Delete associated improvement comments
    const improvementComments = await ctx.db
      .query("improvementComments")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const ic of improvementComments) {
      await ctx.db.delete(ic._id);
    }

    // Delete associated improvement todos
    const improvementTodos = await ctx.db
      .query("improvementTodos")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    for (const it of improvementTodos) {
      await ctx.db.delete(it._id);
    }

    // Delete the board
    await ctx.db.delete(args.boardId);
  },
});

export const createSample = mutation({
  args: { ownerId: v.string(), ownerName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Create the board
    const boardId = await ctx.db.insert("boards", {
      name: "Web Interface - Project Initiation",
      description: "Sample journey mapping a project initiation flow across desktop and mobile platforms",
      ownerId: args.ownerId,
      ownerName: args.ownerName,
      createdAt: now,
      updatedAt: now,
      version: "1.0",
    });

    // Seed personas
    const personaIds: Record<string, any> = {};
    for (let i = 0; i < DEFAULT_PERSONAS.length; i++) {
      const p = DEFAULT_PERSONAS[i];
      const id = await ctx.db.insert("personas", {
        boardId,
        name: p.name,
        description: p.description,
        color: p.color,
        order: i + 1,
      });
      personaIds[p.name] = id;
    }

    // Create screenshot-type nodes (no actual images, just labeled placeholders)
    const sampleNodes = [
      { nodeId: "sample-login", label: "Login Page", platform: "desktop", x: 100, y: 100 },
      { nodeId: "sample-dashboard", label: "Dashboard", platform: "desktop", x: 100, y: 400 },
      { nodeId: "sample-project-list", label: "Project List", platform: "desktop", x: 100, y: 700 },
      { nodeId: "sample-new-project", label: "New Project Form", platform: "desktop", x: 400, y: 700 },
      { nodeId: "sample-project-settings", label: "Project Settings", platform: "desktop", x: 400, y: 1000 },
      { nodeId: "sample-team-assign", label: "Team Assignment", platform: "admin", x: 700, y: 1000 },
      { nodeId: "sample-mobile-login", label: "Mobile Login", platform: "mobile", x: 1000, y: 100 },
      { nodeId: "sample-mobile-dashboard", label: "Mobile Dashboard", platform: "mobile", x: 1000, y: 400 },
      { nodeId: "sample-mobile-project", label: "Mobile Project View", platform: "mobile", x: 1000, y: 700 },
    ];

    for (const node of sampleNodes) {
      await ctx.db.insert("nodes", {
        boardId,
        nodeId: node.nodeId,
        type: "text",
        position: { x: node.x, y: node.y },
        data: { text: `[${node.platform.toUpperCase()}] ${node.label}`, platform: node.platform, missingScreenshot: true },
      });
    }

    // Create edges
    const sampleEdges = [
      { source: "sample-login", target: "sample-dashboard", label: "Login Success" },
      { source: "sample-dashboard", target: "sample-project-list", label: "View Projects" },
      { source: "sample-project-list", target: "sample-new-project", label: "Create New" },
      { source: "sample-new-project", target: "sample-project-settings", label: "Configure" },
      { source: "sample-project-settings", target: "sample-team-assign", label: "Assign Team" },
      { source: "sample-mobile-login", target: "sample-mobile-dashboard", label: "Login" },
      { source: "sample-mobile-dashboard", target: "sample-mobile-project", label: "Open Project" },
      { source: "sample-dashboard", target: "sample-mobile-dashboard", label: "Cross-platform sync" },
    ];

    for (let i = 0; i < sampleEdges.length; i++) {
      const e = sampleEdges[i];
      await ctx.db.insert("edges", {
        boardId,
        edgeId: `sample-edge-${i}`,
        source: e.source,
        target: e.target,
        label: e.label,
        type: "labeled",
      });
    }

    // Create personaNode assignments
    const assignments: { persona: string; nodeId: string }[] = [
      // Customer Admin sees all desktop screens
      { persona: "Customer Admin", nodeId: "sample-login" },
      { persona: "Customer Admin", nodeId: "sample-dashboard" },
      { persona: "Customer Admin", nodeId: "sample-project-list" },
      { persona: "Customer Admin", nodeId: "sample-new-project" },
      { persona: "Customer Admin", nodeId: "sample-project-settings" },
      { persona: "Customer Admin", nodeId: "sample-team-assign" },
      // Customer Operator uses mobile + dashboard
      { persona: "Customer Operator", nodeId: "sample-mobile-login" },
      { persona: "Customer Operator", nodeId: "sample-mobile-dashboard" },
      { persona: "Customer Operator", nodeId: "sample-mobile-project" },
      { persona: "Customer Operator", nodeId: "sample-dashboard" },
      // Ops Manager uses both
      { persona: "Customer Ops Manager", nodeId: "sample-dashboard" },
      { persona: "Customer Ops Manager", nodeId: "sample-project-list" },
      { persona: "Customer Ops Manager", nodeId: "sample-mobile-dashboard" },
      // OPPR Admin manages team assignment
      { persona: "OPPR Admin", nodeId: "sample-team-assign" },
    ];

    for (const a of assignments) {
      const personaId = personaIds[a.persona];
      if (personaId) {
        await ctx.db.insert("personaNodes", {
          boardId,
          personaId,
          nodeId: a.nodeId,
        });
      }
    }

    // Create attention blocks
    await ctx.db.insert("nodes", {
      boardId,
      nodeId: "attention-1",
      type: "attention",
      position: { x: 700, y: 400 },
      data: { text: "Mobile login uses different terminology ('Sign In' vs 'Log In') from desktop" },
    });

    await ctx.db.insert("nodes", {
      boardId,
      nodeId: "attention-2",
      type: "attention",
      position: { x: 700, y: 700 },
      data: { text: "No clear navigation path from Mobile Project View back to dashboard" },
    });

    return boardId;
  },
});

/**
 * Creates a comprehensive OPPR Logs journey board based on actual platform screenshots.
 * Maps the complete project creation → log completion flow across Admin Portal,
 * Desktop Log Manager, and Mobile App.
 */
export const createOPPRFlow = mutation({
  args: { ownerId: v.string(), ownerName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();

    const boardId = await ctx.db.insert("boards", {
      name: "OPPR Logs - Full Platform Journey",
      description:
        "Comprehensive journey mapping the OPPR platform across Admin Portal, Desktop Log Manager, and Mobile App. " +
        "Covers project creation, log management, user onboarding, mobile field operations, and notification flows.",
      ownerId: args.ownerId,
      ownerName: args.ownerName,
      createdAt: now,
      updatedAt: now,
      version: "1.0",
    });

    // === PERSONAS ===
    const personaIds: Record<string, any> = {};
    for (let i = 0; i < DEFAULT_PERSONAS.length; i++) {
      const p = DEFAULT_PERSONAS[i];
      const id = await ctx.db.insert("personas", {
        boardId,
        name: p.name,
        description: p.description,
        color: p.color,
        order: i + 1,
      });
      personaIds[p.name] = id;
    }

    // === NODES ===
    // Layout: 3 swim lanes
    // Column 0 (x=100): OPPR Admin Portal
    // Column 1 (x=500): Desktop Log Manager
    // Column 2 (x=900+): Mobile App

    const flowNodes = [
      // --- OPPR ADMIN PORTAL (x=100) ---
      { nodeId: "admin-dashboard", label: "[ADMIN] OPPR Admin Dashboard", x: 100, y: 100 },
      { nodeId: "admin-companies", label: "[ADMIN] Companies Management", x: 100, y: 350 },
      { nodeId: "admin-super-admins", label: "[ADMIN] Customer Super Admins", x: 100, y: 600 },
      { nodeId: "admin-team", label: "[ADMIN] OPPR Team Management", x: 100, y: 850 },
      { nodeId: "admin-audit-logs", label: "[ADMIN] Audit Logs", x: 100, y: 1100 },

      // --- DESKTOP LOG MANAGER (x=500) ---
      { nodeId: "desk-welcome", label: "[DESKTOP] Customer Admin Home", x: 500, y: 100 },
      { nodeId: "desk-projects", label: "[DESKTOP] Projects List", x: 500, y: 350 },
      { nodeId: "desk-proj-overview", label: "[DESKTOP] Project Overview", x: 500, y: 600 },
      { nodeId: "desk-proj-dashboard", label: "[DESKTOP] Project Dashboard", x: 500, y: 850 },
      { nodeId: "desk-proj-controls", label: "[DESKTOP] Project Controls", x: 500, y: 1100 },
      { nodeId: "desk-proj-logs", label: "[DESKTOP] Project Logs", x: 500, y: 1350 },
      { nodeId: "desk-log-data", label: "[DESKTOP] Log Data Viewer", x: 500, y: 1600 },
      { nodeId: "desk-floor-plans", label: "[DESKTOP] Floor Plans", x: 500, y: 1850 },
      { nodeId: "desk-assets", label: "[DESKTOP] Project Assets", x: 500, y: 2100 },
      { nodeId: "desk-hmi", label: "[DESKTOP] HMI Templates", x: 500, y: 2350 },
      { nodeId: "desk-user-mgmt", label: "[DESKTOP] User Management", x: 800, y: 600 },
      { nodeId: "desk-role-mgmt", label: "[DESKTOP] Role Management", x: 800, y: 850 },
      { nodeId: "desk-schedules", label: "[DESKTOP] Schedules", x: 800, y: 1100 },
      { nodeId: "desk-members", label: "[DESKTOP] Project Members", x: 800, y: 1350 },
      { nodeId: "desk-history", label: "[DESKTOP] Project History", x: 800, y: 1600 },
      { nodeId: "desk-settings", label: "[DESKTOP] Project Settings", x: 800, y: 1850 },

      // --- MOBILE APP (x=1200) ---
      { nodeId: "mob-push-notify", label: "[MOBILE] Push Notification", x: 1200, y: 100 },
      { nodeId: "mob-projects", label: "[MOBILE] Projects List", x: 1200, y: 350 },
      { nodeId: "mob-notifications", label: "[MOBILE] Notifications Center", x: 1200, y: 600 },
      { nodeId: "mob-logs-home", label: "[MOBILE] Logs Home", x: 1200, y: 850 },
      { nodeId: "mob-proj-overview", label: "[MOBILE] Project Overview", x: 1200, y: 1100 },
      { nodeId: "mob-log-completion", label: "[MOBILE] Log Completion Wizard", x: 1200, y: 1350 },
      { nodeId: "mob-assets", label: "[MOBILE] Project Assets", x: 1200, y: 1600 },
      { nodeId: "mob-logs-round", label: "[MOBILE] Logs / Round View", x: 1200, y: 1850 },
    ];

    for (const node of flowNodes) {
      // Detect platform from label prefix
      const platform = node.label.startsWith("[ADMIN]") ? "admin"
        : node.label.startsWith("[MOBILE]") ? "mobile"
        : "desktop";
      await ctx.db.insert("nodes", {
        boardId,
        nodeId: node.nodeId,
        type: "text",
        position: { x: node.x, y: node.y },
        data: { text: node.label, platform, missingScreenshot: true },
      });
    }

    // === EDGES ===
    const flowEdges = [
      // Admin Portal flow
      { source: "admin-dashboard", target: "admin-companies", label: "Manage Companies" },
      { source: "admin-companies", target: "admin-super-admins", label: "View Customer Admins" },
      { source: "admin-dashboard", target: "admin-team", label: "Manage Team" },
      { source: "admin-dashboard", target: "admin-audit-logs", label: "View Audit Logs" },

      // Admin → Desktop handoff
      { source: "admin-companies", target: "desk-welcome", label: "Provision Tenant → Customer Logs In" },

      // Desktop flow - main path
      { source: "desk-welcome", target: "desk-projects", label: "View Projects" },
      { source: "desk-projects", target: "desk-proj-overview", label: "Select Project" },
      { source: "desk-proj-overview", target: "desk-proj-dashboard", label: "Open Dashboard" },
      { source: "desk-proj-dashboard", target: "desk-proj-controls", label: "View Controls" },
      { source: "desk-proj-controls", target: "desk-proj-logs", label: "View Logs" },
      { source: "desk-proj-logs", target: "desk-log-data", label: "Open Log Data" },
      { source: "desk-proj-overview", target: "desk-floor-plans", label: "View Floor Plans" },
      { source: "desk-proj-overview", target: "desk-assets", label: "View Assets" },
      { source: "desk-proj-overview", target: "desk-hmi", label: "View HMI Templates" },

      // Desktop flow - admin sidebar
      { source: "desk-proj-overview", target: "desk-user-mgmt", label: "Manage Users" },
      { source: "desk-user-mgmt", target: "desk-role-mgmt", label: "Configure Roles" },
      { source: "desk-proj-overview", target: "desk-schedules", label: "Set Schedules" },
      { source: "desk-proj-overview", target: "desk-members", label: "View Members" },
      { source: "desk-proj-overview", target: "desk-history", label: "View History" },
      { source: "desk-proj-overview", target: "desk-settings", label: "Project Settings" },

      // Desktop → Mobile cross-platform
      { source: "desk-schedules", target: "mob-push-notify", label: "Schedule triggers push notification" },
      { source: "desk-proj-logs", target: "mob-logs-round", label: "Log round syncs to mobile" },

      // Mobile flow
      { source: "mob-push-notify", target: "mob-projects", label: "Open App" },
      { source: "mob-projects", target: "mob-notifications", label: "View Notifications" },
      { source: "mob-projects", target: "mob-logs-home", label: "Open Logs" },
      { source: "mob-logs-home", target: "mob-proj-overview", label: "Select Project" },
      { source: "mob-proj-overview", target: "mob-log-completion", label: "Start Log Round" },
      { source: "mob-log-completion", target: "mob-logs-round", label: "Complete Round" },
      { source: "mob-proj-overview", target: "mob-assets", label: "View Assets" },

      // Mobile → Desktop sync
      { source: "mob-log-completion", target: "desk-log-data", label: "Completed log data syncs to desktop" },
    ];

    for (let i = 0; i < flowEdges.length; i++) {
      const e = flowEdges[i];
      await ctx.db.insert("edges", {
        boardId,
        edgeId: `oppr-edge-${i}`,
        source: e.source,
        target: e.target,
        label: e.label,
        type: "labeled",
      });
    }

    // === PERSONA-NODE ASSIGNMENTS ===
    const pAssignments: { persona: string; nodeId: string }[] = [
      // OPPR Admin — admin portal only
      { persona: "OPPR Admin", nodeId: "admin-dashboard" },
      { persona: "OPPR Admin", nodeId: "admin-companies" },
      { persona: "OPPR Admin", nodeId: "admin-super-admins" },
      { persona: "OPPR Admin", nodeId: "admin-team" },
      { persona: "OPPR Admin", nodeId: "admin-audit-logs" },

      // Customer Admin — desktop log manager + some admin
      { persona: "Customer Admin", nodeId: "desk-welcome" },
      { persona: "Customer Admin", nodeId: "desk-projects" },
      { persona: "Customer Admin", nodeId: "desk-proj-overview" },
      { persona: "Customer Admin", nodeId: "desk-proj-dashboard" },
      { persona: "Customer Admin", nodeId: "desk-proj-controls" },
      { persona: "Customer Admin", nodeId: "desk-proj-logs" },
      { persona: "Customer Admin", nodeId: "desk-log-data" },
      { persona: "Customer Admin", nodeId: "desk-floor-plans" },
      { persona: "Customer Admin", nodeId: "desk-assets" },
      { persona: "Customer Admin", nodeId: "desk-hmi" },
      { persona: "Customer Admin", nodeId: "desk-user-mgmt" },
      { persona: "Customer Admin", nodeId: "desk-role-mgmt" },
      { persona: "Customer Admin", nodeId: "desk-schedules" },
      { persona: "Customer Admin", nodeId: "desk-members" },
      { persona: "Customer Admin", nodeId: "desk-history" },
      { persona: "Customer Admin", nodeId: "desk-settings" },

      // Customer Ops Manager — desktop + mobile oversight
      { persona: "Customer Ops Manager", nodeId: "desk-projects" },
      { persona: "Customer Ops Manager", nodeId: "desk-proj-overview" },
      { persona: "Customer Ops Manager", nodeId: "desk-proj-dashboard" },
      { persona: "Customer Ops Manager", nodeId: "desk-proj-logs" },
      { persona: "Customer Ops Manager", nodeId: "desk-log-data" },
      { persona: "Customer Ops Manager", nodeId: "desk-schedules" },
      { persona: "Customer Ops Manager", nodeId: "desk-members" },
      { persona: "Customer Ops Manager", nodeId: "desk-history" },
      { persona: "Customer Ops Manager", nodeId: "mob-push-notify" },
      { persona: "Customer Ops Manager", nodeId: "mob-projects" },
      { persona: "Customer Ops Manager", nodeId: "mob-notifications" },

      // Customer Operator — mobile primary, limited desktop
      { persona: "Customer Operator", nodeId: "mob-push-notify" },
      { persona: "Customer Operator", nodeId: "mob-projects" },
      { persona: "Customer Operator", nodeId: "mob-notifications" },
      { persona: "Customer Operator", nodeId: "mob-logs-home" },
      { persona: "Customer Operator", nodeId: "mob-proj-overview" },
      { persona: "Customer Operator", nodeId: "mob-log-completion" },
      { persona: "Customer Operator", nodeId: "mob-assets" },
      { persona: "Customer Operator", nodeId: "mob-logs-round" },
      { persona: "Customer Operator", nodeId: "desk-proj-logs" },

      // External Auditor — read-only audit screens
      { persona: "External Auditor", nodeId: "admin-audit-logs" },
      { persona: "External Auditor", nodeId: "desk-history" },
      { persona: "External Auditor", nodeId: "desk-log-data" },
    ];

    for (const a of pAssignments) {
      const personaId = personaIds[a.persona];
      if (personaId) {
        await ctx.db.insert("personaNodes", {
          boardId,
          personaId,
          nodeId: a.nodeId,
        });
      }
    }

    // === ATTENTION BLOCKS ===
    const attentionBlocks = [
      {
        nodeId: "attn-terminology-1",
        x: 1050, y: 200,
        text: "TERMINOLOGY MISMATCH: Mobile uses 'Projects' tab while desktop shows 'All Projects' with different column headers. Mobile omits project status indicator visible on desktop.",
      },
      {
        nodeId: "attn-nav-deadend",
        x: 1050, y: 900,
        text: "DEAD-END FLOW: After completing a log round on mobile, user sees 'Completed' status but no clear path to start the next round or return to project overview. Requires manual back-navigation.",
      },
      {
        nodeId: "attn-notification-gap",
        x: 1050, y: 500,
        text: "NOTIFICATION GAP: Push notifications arrive for scheduled logs but there is no in-app deep link. User must manually navigate from Projects → Logs → correct round.",
      },
      {
        nodeId: "attn-role-confusion",
        x: 380, y: 700,
        text: "ROLE CONFUSION: User Management and Role Management screens use different terminology. 'Permissions' on one screen vs 'Access Rights' on another. Customer Admin finds this confusing during onboarding.",
      },
      {
        nodeId: "attn-data-sync",
        x: 700, y: 1500,
        text: "DATA SYNC DELAY: Log data completed on mobile can take 5-15 seconds to appear on desktop Log Data Viewer. No loading indicator — users think data was lost.",
      },
      {
        nodeId: "attn-audit-export",
        x: 100, y: 1350,
        text: "AUDIT EXPORT: External auditors report that the Audit Logs CSV export only includes 1000 rows max with no pagination. Large tenants lose critical audit data on export.",
      },
    ];

    for (const attn of attentionBlocks) {
      await ctx.db.insert("nodes", {
        boardId,
        nodeId: attn.nodeId,
        type: "attention",
        position: { x: attn.x, y: attn.y },
        data: { text: attn.text },
      });
    }

    // === COMMENTS ===
    const flowComments = [
      // Admin Portal comments
      {
        nodeId: "admin-dashboard",
        text: "The admin dashboard shows real-time KPIs for companies, users, and system health. Layout is clean but lacks quick-action shortcuts for common tasks like 'Add Company' or 'View Recent Logins'.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "admin-companies",
        text: "Companies list shows all provisioned tenants with status indicators. Sorting works well. Missing: bulk operations (e.g., suspend multiple companies), search is basic text-only without filters.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "admin-audit-logs",
        text: "Critical finding: Audit logs table only loads 50 rows at a time. External auditors need to export all logs for compliance but CSV export truncates at 1000 rows. This is a blocker for SOC2 compliance reviews.",
        authorName: "Security Reviewer",
      },
      // Desktop comments
      {
        nodeId: "desk-welcome",
        text: "Customer Admin welcome/home screen is well-organized. The left sidebar navigation is consistent across all pages. Good use of breadcrumbs. Recommendation: add a 'Quick Start' widget for first-time users showing setup completion percentage.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "desk-projects",
        text: "Projects list view supports both table and card layouts. Table columns are configurable. Status badges use color-coding (green=active, amber=pending, red=issues). Missing: bulk project operations and project archiving.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "desk-proj-overview",
        text: "Project overview is the hub for all project management. Navigation tabs along the top (Overview, Dashboard, Controls, Logs, etc.) are intuitive. Issue: 'Overview' and 'Dashboard' tabs are confusing — users don't understand the difference. Consider merging or renaming.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "desk-proj-controls",
        text: "Controls page shows hardware/system controls tied to the project. Supports start/stop/reset actions. Good confirmation dialogs. Risk: no undo capability — 'Stop' is immediate and irreversible. Ops Managers want an 'Are you sure?' + reason field.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "desk-proj-logs",
        text: "Project Logs is the core data screen. Table view with date, status, operator, completion %. Filters work well. Issue: column width is fixed and some long log names get truncated without tooltip. Double-click to expand would improve usability.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "desk-log-data",
        text: "Log Data Viewer provides detailed drill-down into individual log entries. Shows timestamp, values, operator notes. Excellent for desktop review. Problem: mobile-submitted data sometimes shows timezone mismatches — server time vs device time.",
        authorName: "QA Engineer",
      },
      {
        nodeId: "desk-floor-plans",
        text: "Floor Plans allow uploading building/facility layouts and placing control points on them. Drag-and-drop works smoothly. Feature request: support for multi-floor navigation and zoom presets.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "desk-user-mgmt",
        text: "User management table shows name, email, role, status, last active. Adding users is straightforward with email invite flow. Problem: 'Role' column shows internal role IDs instead of display names for some tenants.",
        authorName: "QA Engineer",
      },
      {
        nodeId: "desk-role-mgmt",
        text: "Role management uses a permission matrix grid. Clear visual of what each role can do. Issue: terminology changes between this screen ('Permissions') and User Management ('Access Rights'). Should be consistent.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "desk-schedules",
        text: "Schedules screen allows creating recurring log schedules (daily, weekly, custom). Clean calendar view. The schedule triggers push notifications to assigned operators' mobile devices. Missing: schedule conflict detection when two schedules overlap for the same operator.",
        authorName: "UX Analyst",
      },
      // Mobile comments
      {
        nodeId: "mob-push-notify",
        text: "Push notifications arrive reliably for scheduled logs. Format: 'Log Round Due: [Project Name] - [Log Name]'. Issue: tapping the notification opens the app to the Projects list, NOT directly to the relevant log. User must navigate manually through 3 screens to reach the correct log round.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "mob-projects",
        text: "Mobile Projects screen shows project cards with name, status, and last activity. Swipe gestures not supported — would be useful for quick actions. List scrolling is smooth. Search is basic and doesn't support filters like the desktop version.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "mob-notifications",
        text: "Notifications center shows all app notifications (scheduled logs, role changes, system alerts). Notifications can be marked as read but NOT dismissed individually. No notification preferences — users can't mute specific notification types.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "mob-proj-overview",
        text: "Mobile project overview shows summary stats, recent activity, and quick links to logs. Layout is responsive. Issue: 'Start Log Round' button is below the fold — operators often miss it and look for it in the Logs tab instead.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "mob-log-completion",
        text: "Log completion wizard is a multi-step form: select items → enter values → add notes → upload photos → submit. UX is generally good. Critical issue: if the app crashes or phone disconnects mid-form, ALL progress is lost. Need auto-save/draft functionality.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "mob-logs-round",
        text: "Logs/Round view shows individual log entries within a round. Status indicators match desktop. Problem: terminology uses 'Round' on mobile but desktop shows same concept as 'Log Session'. Users are confused by the inconsistency.",
        authorName: "UX Analyst",
      },
      {
        nodeId: "mob-assets",
        text: "Mobile assets view shows photos, documents, and floor plans for a project. Supports pinch-to-zoom on images. Offline access limited — assets don't cache for field use without network. Feature request: mark assets as 'Available Offline'.",
        authorName: "UX Analyst",
      },
    ];

    for (const comment of flowComments) {
      await ctx.db.insert("comments", {
        boardId,
        nodeId: comment.nodeId,
        authorId: "system-analysis",
        authorName: comment.authorName,
        text: comment.text,
        createdAt: now + Math.floor(Math.random() * 10000),
        resolved: false,
      });
    }

    return boardId;
  },
});
