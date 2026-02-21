import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("tools").collect();
  },
});

export const getById = query({
  args: { toolId: v.id("tools") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.toolId);
  },
});

export const getByIds = query({
  args: { toolIds: v.array(v.id("tools")) },
  handler: async (ctx, args) => {
    const tools = [];
    for (const id of args.toolIds) {
      const tool = await ctx.db.get(id);
      if (tool) tools.push(tool);
    }
    return tools;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("tools", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      category: args.category,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { toolId, ...updates } = args;
    const filtered: Record<string, string> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[k] = val;
    }
    await ctx.db.patch(toolId, { ...filtered, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.toolId);
  },
});

const DEFAULT_TOOLS = [
  {
    name: "IAM",
    slug: "iam",
    category: "Platform",
    description: `Identity and Access Management (IAM) is the core authentication and authorization layer of the OPPR platform. It handles tenant provisioning, user lifecycle management, role-based access control (RBAC), and permission policies across the entire system.

Key capabilities include:
- Multi-tenant architecture with strict data isolation between customer organizations
- Customer admin vs OPPR admin separation — OPPR admins manage platform-wide settings while customer admins manage their own tenant
- SSO/OIDC integration for enterprise single sign-on, supporting SAML 2.0 and OpenID Connect
- Role management with granular permission policies — roles can be scoped to projects, teams, or the entire tenant
- User lifecycle: invitation flow, onboarding, role assignment, deactivation, and offboarding
- Audit trails capturing every access event, permission change, and administrative action
- Admin Portal (desktop) provides OPPR staff with cross-tenant visibility, company management, and system health monitoring
- Session management with configurable timeout policies and concurrent session limits`,
  },
  {
    name: "Logs General",
    slug: "logs-general",
    category: "Product",
    description: `OPPR Logs is the core data collection and operational logging platform. It enables organizations to define, schedule, collect, and analyze structured log data across facilities, equipment, and field operations.

Key capabilities include:
- Log ingestion from both desktop and mobile sources with automatic sync and conflict resolution
- Search and filtering with full-text search, date ranges, operator filters, and status-based queries
- Configurable retention policies per project — data can be retained for compliance or archived
- Alert rules triggered by log values, missed schedules, or anomaly detection
- Dashboards showing project health, completion rates, overdue logs, and operator activity
- API access for third-party integrations and data export (CSV, PDF, JSON)
- Project organization with hierarchical structure: Organization → Projects → Log Types → Log Rounds
- Multi-platform sync ensuring data consistency between desktop log manager and mobile field app
- Role-based data access — operators see only their assigned logs, managers see team-wide data, admins see everything`,
  },
  {
    name: "Logs Desktop",
    slug: "logs-desktop",
    category: "Product",
    description: `The OPPR Logs Desktop application is the primary management interface for configuring and overseeing log operations. Used by Customer Admins and Ops Managers to set up projects, define log structures, and review collected data.

Key capabilities include:
- Project setup and configuration: create projects, define log types, set schedules, assign operators
- Log source configuration: define what data points to collect, validation rules, acceptable ranges
- Real-time tailing of incoming log data as operators complete rounds in the field
- Export functionality for compliance reports, audits, and data analysis (CSV, PDF, Excel)
- Advanced filtering: multi-column sort, saved filter presets, date range selectors, status filters
- Library management for reusable log templates, equipment definitions, and standard operating procedures
- Asset tracking: upload and manage facility floor plans, equipment photos, reference documents
- HMI template designer for creating custom data entry interfaces
- Floor plan management with interactive placement of monitoring points
- Schedule management: create recurring log schedules (daily, weekly, custom), assign operators, set notification preferences
- User and role management within projects — invite members, assign roles, configure permissions`,
  },
  {
    name: "Logs Mobile",
    slug: "logs-mobile",
    category: "Product",
    description: `The OPPR Logs Mobile application is the field data collection tool used by operators and field workers. It runs on iOS and Android devices and is designed for efficient data entry in environments with variable connectivity.

Key capabilities include:
- Field data collection with structured forms, validation, and guided workflows
- Offline mode: full functionality without network — data syncs automatically when connectivity returns
- Automatic sync with conflict resolution when multiple operators work on overlapping data
- Barcode and QR code scanning for equipment identification and log round verification
- Photo capture with annotation — attach photos to log entries, mark up images, add notes
- Location tracking with GPS coordinates attached to log entries for field verification
- Push notifications for scheduled log rounds, overdue reminders, and system alerts
- Round-based workflows: operators receive assigned rounds, complete step-by-step data entry, submit for review
- Mobile-optimized UX with large touch targets, swipe gestures, and offline-first architecture
- Asset viewing: browse project floor plans, equipment documentation, and reference materials in the field`,
  },
];

export const seed = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("tools").collect();
    if (existing.length > 0) return;

    const now = Date.now();
    for (const tool of DEFAULT_TOOLS) {
      await ctx.db.insert("tools", {
        ...tool,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
