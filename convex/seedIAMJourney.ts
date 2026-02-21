import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Creates a comprehensive IAM Journey board — the showcase example.
 *
 * Maps the complete Identity & Access Management workflow across three tiers:
 *   Tier 1 — OPPR Admin Portal  (platform-level provisioning & audit)
 *   Tier 2 — Oppr Logs App      (tenant-level user & role management)
 *   Tier 3 — Project Level      (project-scoped membership & settings)
 *
 * Uses actual global screenshots, links them to the board, and creates
 * screenshot nodes with real image URLs, detailed comments, attention blocks,
 * persona assignments, tags, and a gap-analysis report.
 */

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

export const seed = mutation({
  args: {
    ownerId: v.string(),
    ownerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // ====================================================================
    // BOARD
    // ====================================================================
    const boardId = await ctx.db.insert("boards", {
      name: "IAM — Identity & Access Management Journey",
      description:
        "Complete IAM workflow across three tiers: OPPR Admin Portal (platform provisioning & audit), " +
        "Oppr Logs application (tenant user & role management), and Project-level access control " +
        "(membership, roles, permissions). Maps the full lifecycle from company creation to " +
        "project-scoped operator access with real screenshots, UX analysis, and gap findings.",
      ownerId: args.ownerId,
      ownerName: args.ownerName,
      createdAt: now,
      updatedAt: now,
      version: "1.0",
    });

    // ====================================================================
    // PERSONAS
    // ====================================================================
    const personaIds: Record<string, Id<"personas">> = {};
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

    // ====================================================================
    // SCREENSHOT FOLDER (IAM)
    // ====================================================================
    // Check if "IAM" folder already exists
    const existingFolders = await ctx.db
      .query("screenshotFolders")
      .withIndex("by_name", (q) => q.eq("name", "IAM"))
      .collect();
    let iamFolderId: Id<"screenshotFolders">;
    if (existingFolders.length > 0) {
      iamFolderId = existingFolders[0]._id;
    } else {
      iamFolderId = await ctx.db.insert("screenshotFolders", {
        name: "IAM",
        createdAt: now,
        createdBy: args.ownerId,
      });
    }

    // ====================================================================
    // RESOLVE GLOBAL SCREENSHOTS by label+platform (first match)
    // ====================================================================
    const allGS = await ctx.db.query("globalScreenshots").collect();
    const gsMap = new Map<string, (typeof allGS)[0]>();
    for (const gs of allGS) {
      const key = `${gs.label}|${gs.platform}`;
      if (!gsMap.has(key)) gsMap.set(key, gs);
    }

    const resolveGS = (label: string, platform: string) => {
      return gsMap.get(`${label}|${platform}`);
    };

    // Helper: link screenshot to board + assign to IAM folder + add tags
    const linkAndTag = async (
      gs: (typeof allGS)[0],
      tags: string[]
    ) => {
      // Link to board
      const existingLink = await ctx.db
        .query("boardScreenshots")
        .withIndex("by_board", (q) => q.eq("boardId", boardId))
        .filter((q) => q.eq(q.field("globalScreenshotId"), gs._id))
        .first();
      if (!existingLink) {
        await ctx.db.insert("boardScreenshots", {
          boardId,
          globalScreenshotId: gs._id,
          addedAt: now,
        });
      }
      // Move to IAM folder
      await ctx.db.patch(gs._id, { folderId: iamFolderId });
      // Set tags
      const existingTags = gs.tags || [];
      const mergedTags = Array.from(new Set([...existingTags, ...tags]));
      await ctx.db.patch(gs._id, { tags: mergedTags });
    };

    // ====================================================================
    // SCREENSHOT DEFINITIONS — maps label to node data
    // ====================================================================
    interface ScreenshotNodeDef {
      nodeId: string;
      gsLabel: string;      // label in globalScreenshots
      gsPlatform: string;   // platform in globalScreenshots
      label: string;        // display label on canvas
      x: number;
      y: number;
      tags: string[];
    }

    // Layout: 3 horizontal swim-lanes, left-to-right flow
    //
    //  y=50    ┌──────── TIER 1: OPPR ADMIN PORTAL ────────────┐
    //  y=150   │ Admin Dashboard → Companies → Super Admins →   │
    //          │ Team Mgmt → Audit Logs                         │
    //          └────────────────────────────────────────────────-┘
    //
    //  y=650   ┌──────── TIER 2: TENANT USER/ROLE MGMT ────────┐
    //  y=750   │ Home Dashboard → User Mgmt → Role Mgmt        │
    //          └────────────────────────────────────────────────-┘
    //
    //  y=1200  ┌──────── TIER 3: PROJECT ACCESS CONTROL ────────┐
    //  y=1300  │ Project Members → Project Settings              │
    //          └─────────────────────────────────────────────────┘

    const screenshotNodes: ScreenshotNodeDef[] = [
      // ---- TIER 1: OPPR Admin Portal ----
      {
        nodeId: "iam-admin-dashboard",
        gsLabel: "Admin Dashboard", gsPlatform: "admin",
        label: "OPPR Admin Dashboard",
        x: 100, y: 150,
        tags: ["iam", "admin-portal", "dashboard", "tier-1"],
      },
      {
        nodeId: "iam-companies-list",
        gsLabel: "Companies List", gsPlatform: "admin",
        label: "Companies / Tenant List",
        x: 450, y: 150,
        tags: ["iam", "admin-portal", "multi-tenancy", "tier-1"],
      },
      {
        nodeId: "iam-super-admins",
        gsLabel: "Customer Super Admins", gsPlatform: "admin",
        label: "Customer Super Admins",
        x: 800, y: 150,
        tags: ["iam", "admin-portal", "user-provisioning", "tier-1"],
      },
      {
        nodeId: "iam-team-mgmt",
        gsLabel: "Team Management", gsPlatform: "admin",
        label: "OPPR Team Management",
        x: 1150, y: 150,
        tags: ["iam", "admin-portal", "internal-team", "tier-1"],
      },
      {
        nodeId: "iam-audit-logs",
        gsLabel: "Audit Logs", gsPlatform: "admin",
        label: "Audit Logs",
        x: 1500, y: 150,
        tags: ["iam", "admin-portal", "audit", "compliance", "tier-1"],
      },

      // ---- TIER 2: Tenant-Level IAM (Oppr Logs) ----
      {
        nodeId: "iam-home-dashboard",
        gsLabel: "Home Dashboard", gsPlatform: "desktop",
        label: "Customer Admin Home",
        x: 100, y: 750,
        tags: ["iam", "tenant", "onboarding", "tier-2"],
      },
      {
        nodeId: "iam-user-mgmt",
        gsLabel: "User Management", gsPlatform: "desktop",
        label: "Tenant User Management",
        x: 450, y: 750,
        tags: ["iam", "tenant", "user-management", "rbac", "tier-2"],
      },
      {
        nodeId: "iam-role-mgmt",
        gsLabel: "Role Management", gsPlatform: "desktop",
        label: "Role Management",
        x: 800, y: 750,
        tags: ["iam", "tenant", "role-management", "rbac", "tier-2"],
      },
      {
        nodeId: "iam-home-libraries",
        gsLabel: "Home Dashboard (Libraries)", gsPlatform: "desktop",
        label: "Home — Libraries Overview",
        x: 100, y: 1050,
        tags: ["iam", "tenant", "navigation", "tier-2"],
      },

      // ---- TIER 3: Project-Level Access ----
      {
        nodeId: "iam-proj-members",
        gsLabel: "Project Members", gsPlatform: "desktop",
        label: "Project Members & Access",
        x: 100, y: 1400,
        tags: ["iam", "project", "membership", "access-control", "tier-3"],
      },
      {
        nodeId: "iam-proj-settings",
        gsLabel: "Project Settings", gsPlatform: "desktop",
        label: "Project Settings",
        x: 450, y: 1400,
        tags: ["iam", "project", "settings", "tier-3"],
      },
      {
        nodeId: "iam-projects-list",
        gsLabel: "Projects List", gsPlatform: "desktop",
        label: "Projects List",
        x: 800, y: 1400,
        tags: ["iam", "project", "navigation", "tier-3"],
      },
    ];

    // Insert screenshot nodes
    for (const def of screenshotNodes) {
      const gs = resolveGS(def.gsLabel, def.gsPlatform);
      if (gs) {
        const url = await ctx.storage.getUrl(gs.storageId);
        await ctx.db.insert("nodes", {
          boardId,
          nodeId: def.nodeId,
          type: "screenshot",
          position: { x: def.x, y: def.y },
          data: {
            imageUrl: url,
            label: def.label,
            platform: def.gsPlatform,
            globalScreenshotId: gs._id,
          },
          width: 280,
        });
        await linkAndTag(gs, def.tags);
      } else {
        // Fallback: text node if screenshot not found
        await ctx.db.insert("nodes", {
          boardId,
          nodeId: def.nodeId,
          type: "text",
          position: { x: def.x, y: def.y },
          data: {
            text: `[${def.gsPlatform.toUpperCase()}] ${def.label}`,
            platform: def.gsPlatform,
            missingScreenshot: true,
          },
        });
      }
    }

    // ====================================================================
    // LANE HEADER TEXT NODES
    // ====================================================================
    const laneHeaders = [
      {
        nodeId: "header-tier1",
        text: "TIER 1 — OPPR ADMIN PORTAL\nPlatform-level provisioning, tenant management, internal team oversight & audit logging.\nPersonas: OPPR Admin, External Auditor",
        x: 100, y: 50,
      },
      {
        nodeId: "header-tier2",
        text: "TIER 2 — TENANT USER & ROLE MANAGEMENT\nCustomer-facing IAM within the Oppr Logs application. Super Admin onboarding, user invites, role configuration.\nPersonas: Customer Admin, Customer Ops Manager",
        x: 100, y: 650,
      },
      {
        nodeId: "header-tier3",
        text: "TIER 3 — PROJECT-LEVEL ACCESS CONTROL\nProject-scoped membership, dual-role system (Project Role + System Role), granular permissions.\nPersonas: Customer Admin, Customer Ops Manager, Customer Operator",
        x: 100, y: 1300,
      },
    ];

    for (const h of laneHeaders) {
      await ctx.db.insert("nodes", {
        boardId,
        nodeId: h.nodeId,
        type: "text",
        position: { x: h.x, y: h.y },
        data: { text: h.text },
      });
    }

    // ====================================================================
    // HANDOFF / ANNOTATION NODES
    // ====================================================================
    const annotations = [
      {
        nodeId: "handoff-1",
        text: "HANDOFF: OPPR Admin creates Company & assigns Customer Super Admin → Super Admin receives invitation email → logs into Oppr Logs for the first time",
        x: 450, y: 520,
      },
      {
        nodeId: "handoff-2",
        text: "HANDOFF: Customer Admin configures users & roles at tenant level → assigns users to Projects with project-scoped roles & access levels",
        x: 450, y: 1170,
      },
      {
        nodeId: "annotation-dual-role",
        text: "DUAL ROLE SYSTEM: Each project member has both a Project Role (owner/admin) and a System Role (Super Admin/user). Access Level combines both: 'full' = 4 permissions, 'standard' = 8 permissions. Counterintuitive naming — 'standard' has MORE permissions listed than 'full'.",
        x: 100, y: 1680,
      },
      {
        nodeId: "annotation-entitlements",
        text: "ENTITLEMENT LAYER: Companies have product-level entitlements (Logs, IDA). Super Admins also have per-user entitlements. This creates a matrix: Company entitlements × User entitlements × Role permissions × Project access level.",
        x: 800, y: 520,
      },
    ];

    for (const a of annotations) {
      await ctx.db.insert("nodes", {
        boardId,
        nodeId: a.nodeId,
        type: "text",
        position: { x: a.x, y: a.y },
        data: { text: a.text },
      });
    }

    // ====================================================================
    // ATTENTION BLOCKS (UX Issues / Gaps)
    // ====================================================================
    const attentionBlocks = [
      {
        nodeId: "attn-role-naming",
        x: 1150, y: 750,
        text: "ROLE NAMING INCONSISTENCY: Admin Portal calls them 'Customer Super Admins'. The Logs App shows 'Super Admin' badges in User Management but only lists 'admin' and 'user' in Role Management. Three different names for potentially the same concept. This will confuse onboarding admins.",
      },
      {
        nodeId: "attn-permission-terminology",
        x: 450, y: 1680,
        text: "TERMINOLOGY MISMATCH: Role Management uses 'Roles' with no visible permissions. Project Members shows 'Access Level' (full/standard) with permission counts. User Management shows role badges. Three different screens, three different mental models for the same access control concept.",
      },
      {
        nodeId: "attn-access-level-inversion",
        x: 100, y: 1850,
        text: "ACCESS LEVEL PARADOX: Project Members screen shows 'Access: full / 4 permissions' for owners but 'Access: standard / 8 permissions' for admins. Users expect 'full' > 'standard', but the numbers suggest the opposite. Either the naming or the permission counts are wrong.",
      },
      {
        nodeId: "attn-audit-export-limit",
        x: 1500, y: 450,
        text: "AUDIT EXPORT BLOCKER: CSV export limited to visible rows. Large tenants with hundreds of IAM events will lose critical audit data. This is a SOC2/ISO27001 compliance risk — auditors need complete, untruncated exports with all fields.",
      },
      {
        nodeId: "attn-no-permission-matrix",
        x: 800, y: 1050,
        text: "MISSING PERMISSION VISIBILITY: Role Management shows only role names ('admin', 'user') with no indication of what permissions each role grants. Admins cannot verify what access a role provides without assigning it and testing. Need a permission matrix or detail view.",
      },
      {
        nodeId: "attn-team-domain-leak",
        x: 1150, y: 450,
        text: "SECURITY CONCERN: OPPR Team Management shows pending invitations to non-@oppr.ai emails (test@testtest.com, external gmail). If this is the internal team, external email invitations are a security risk. Need domain restriction enforcement or at minimum a warning.",
      },
      {
        nodeId: "attn-stale-accounts",
        x: 450, y: 450,
        text: "STALE ACCOUNT HYGIENE: Companies list shows tenants with 0 users and 1 admin — likely test/abandoned accounts. Super Admins list shows 'Never' for Last Login on Active accounts. No automated cleanup, no 'inactive for 90 days' warnings, no bulk deactivation.",
      },
      {
        nodeId: "attn-no-bulk-ops",
        x: 450, y: 1050,
        text: "NO BULK OPERATIONS: User Management has no multi-select, no bulk role change, no bulk deactivation. With 4 users this is fine, but enterprise customers with 50+ users will hit a wall. Same issue exists on Companies and Super Admins tables.",
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

    // ====================================================================
    // EDGES (Flow Connections)
    // ====================================================================
    const edges = [
      // Tier 1 main flow
      { source: "iam-admin-dashboard", target: "iam-companies-list", label: "Manage Companies" },
      { source: "iam-companies-list", target: "iam-super-admins", label: "Assign Super Admins" },
      { source: "iam-admin-dashboard", target: "iam-team-mgmt", label: "Manage Internal Team" },
      { source: "iam-admin-dashboard", target: "iam-audit-logs", label: "View Audit Trail" },
      { source: "iam-companies-list", target: "iam-audit-logs", label: "Actions logged" },
      { source: "iam-super-admins", target: "iam-audit-logs", label: "Login/invite events" },

      // Tier 1 → Tier 2 handoff
      { source: "iam-super-admins", target: "handoff-1", label: "Invite sent" },
      { source: "handoff-1", target: "iam-home-dashboard", label: "First login" },

      // Tier 2 main flow
      { source: "iam-home-dashboard", target: "iam-user-mgmt", label: "Manage Users" },
      { source: "iam-user-mgmt", target: "iam-role-mgmt", label: "Configure Roles" },
      { source: "iam-home-dashboard", target: "iam-home-libraries", label: "Access Libraries" },

      // Tier 2 → Tier 3 handoff
      { source: "iam-user-mgmt", target: "handoff-2", label: "Users created" },
      { source: "iam-role-mgmt", target: "handoff-2", label: "Roles defined" },
      { source: "handoff-2", target: "iam-proj-members", label: "Assign to project" },

      // Tier 3 flow
      { source: "iam-proj-members", target: "iam-proj-settings", label: "Configure Project" },
      { source: "iam-projects-list", target: "iam-proj-members", label: "Select Project" },
      { source: "iam-home-dashboard", target: "iam-projects-list", label: "View Projects" },

      // Cross-tier audit
      { source: "iam-proj-members", target: "iam-audit-logs", label: "Access changes audited" },
    ];

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      await ctx.db.insert("edges", {
        boardId,
        edgeId: `iam-edge-${i}`,
        source: e.source,
        target: e.target,
        label: e.label,
        type: "labeled",
      });
    }

    // ====================================================================
    // PERSONA-NODE ASSIGNMENTS
    // ====================================================================
    const assignments: { persona: string; nodeId: string }[] = [
      // OPPR Admin — full Tier 1 access
      { persona: "OPPR Admin", nodeId: "iam-admin-dashboard" },
      { persona: "OPPR Admin", nodeId: "iam-companies-list" },
      { persona: "OPPR Admin", nodeId: "iam-super-admins" },
      { persona: "OPPR Admin", nodeId: "iam-team-mgmt" },
      { persona: "OPPR Admin", nodeId: "iam-audit-logs" },

      // Customer Admin — Tier 2 + Tier 3
      { persona: "Customer Admin", nodeId: "iam-home-dashboard" },
      { persona: "Customer Admin", nodeId: "iam-user-mgmt" },
      { persona: "Customer Admin", nodeId: "iam-role-mgmt" },
      { persona: "Customer Admin", nodeId: "iam-home-libraries" },
      { persona: "Customer Admin", nodeId: "iam-proj-members" },
      { persona: "Customer Admin", nodeId: "iam-proj-settings" },
      { persona: "Customer Admin", nodeId: "iam-projects-list" },

      // Customer Ops Manager — read access to Tier 2, some Tier 3
      { persona: "Customer Ops Manager", nodeId: "iam-home-dashboard" },
      { persona: "Customer Ops Manager", nodeId: "iam-user-mgmt" },
      { persona: "Customer Ops Manager", nodeId: "iam-proj-members" },
      { persona: "Customer Ops Manager", nodeId: "iam-projects-list" },

      // Customer Operator — only sees project membership (read)
      { persona: "Customer Operator", nodeId: "iam-projects-list" },
      { persona: "Customer Operator", nodeId: "iam-proj-members" },

      // External Auditor — audit logs + read-only
      { persona: "External Auditor", nodeId: "iam-audit-logs" },
      { persona: "External Auditor", nodeId: "iam-proj-members" },
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

    // ====================================================================
    // COMMENTS (Detailed UX Analysis per Screen)
    // ====================================================================
    const comments = [
      // Tier 1
      {
        nodeId: "iam-admin-dashboard",
        authorName: "UX Analyst",
        text: "The Admin Dashboard shows 5 KPI cards (Active Companies, Super Admins, Administrators, Recent Activity, Platform Status) with a Quick Actions panel and Recent Activity feed. The layout is clean but the Quick Actions panel has a 'Reset Rate Limits' button with zero context — no explanation of what it resets, for which tenant, or what the impact is. The Recent Activity feed shows login/logout/invite events with role-tagged actor names. Recommendation: add quick-action links for the most common admin tasks (suspend company, reset user password), and group the activity feed by action type with expandable details.",
      },
      {
        nodeId: "iam-admin-dashboard",
        authorName: "Product Manager",
        text: "The dashboard is the first thing OPPR Admins see. We need to surface system-level alerts here (e.g., a company exceeding user limits, failed login spikes, pending invitations older than 7 days). Currently it's a static summary — it should be an operational command center.",
      },
      {
        nodeId: "iam-companies-list",
        authorName: "UX Analyst",
        text: "Companies table shows Name, Tenant ID (slug format like 'oppr-2730-42'), Admin count, User count, Entitlements (Logs/IDA badge pills), Status (active), and Created date. The entitlement system is product-level access control — companies can have Logs, IDA, or both. Issue: Tenant ID uses a technical slug format that's meaningless to admin users. Several companies show 0 users with 1 admin — stale test accounts with no cleanup indicator. No bulk operations (suspend/delete multiple companies).",
      },
      {
        nodeId: "iam-super-admins",
        authorName: "UX Analyst",
        text: "Comprehensive cross-tenant view of all Customer Super Admins with company, status, entitlement badges (Logs/IDA), and Last Login. The entitlement filter uses two separate dropdowns ('All (Logs)' and 'All (IDA)') which is awkward — a single multi-select with checkboxes would be cleaner. Critical issue: some Active users show 'Never' for Last Login — these are likely invited-but-never-onboarded accounts. There's no way to distinguish 'invited but pending' from 'actively using' if status shows Active for both.",
      },
      {
        nodeId: "iam-super-admins",
        authorName: "Security Reviewer",
        text: "Security observation: the table shows a mix of @oppr.ai and @gmail.com email addresses as Customer Super Admins. At the platform level, any email can be a Super Admin. While this is correct for customer accounts, we need domain validation at the company level — a company should be able to restrict admin accounts to their corporate domain only.",
      },
      {
        nodeId: "iam-team-mgmt",
        authorName: "UX Analyst",
        text: "Internal team management with invitation flow. Shows active and pending states. Critical finding: two 'pending' team members have non-@oppr.ai email addresses (test@testtest.com, external gmail). If the OPPR team is supposed to be domain-restricted, the invitation flow is not enforcing domain validation. All active members are @oppr.ai, suggesting the restriction should exist but isn't implemented. Need: domain restriction with a bypass (super-admin override) + expiry on pending invitations.",
      },
      {
        nodeId: "iam-audit-logs",
        authorName: "UX Analyst",
        text: "Audit log viewer with date range, action type, entity type, company, and actor search filters. Shows timestamp, actor (name + email), action type (color-coded badges), entity (role types), and details. The CSV Export button is present but problematic — external auditors report the export is limited in row count. For SOC2 compliance, we need full export with date-range filtering, pagination support, and PDF format option.",
      },
      {
        nodeId: "iam-audit-logs",
        authorName: "External Auditor",
        text: "From a compliance perspective: the visible action types (login/logout/invite) are incomplete. I need to see permission changes, role modifications, account deactivations, and failed login attempts. The entity column shows role types rather than the specific resource being acted on — I need to know 'User X was given Role Y in Project Z', not just 'customer_super_admin'. The date range picker is too small and awkward to use during long audit sessions.",
      },

      // Tier 2
      {
        nodeId: "iam-home-dashboard",
        authorName: "UX Analyst",
        text: "Customer Admin landing page after first login. Shows welcome message with 'First time login' indicator, an onboarding banner ('Say hello to OPPR Logs!'), a stats card (Logs: 7), and Quick Actions. The left sidebar navigation includes Home, Projects, Analytics, Libraries (expandable), User Management, and Role Management. UX is clean but sparse — the Recent Activity section is literally placeholder text. The 'Get Started' button gives no indication of where it leads. Recommendation: add a setup completion checklist (create first project, invite first user, configure roles).",
      },
      {
        nodeId: "iam-user-mgmt",
        authorName: "UX Analyst",
        text: "Tenant-level User Management table with 4 users. Columns: Name, Email, Role (color-coded: green 'Super Admin' with crown, orange 'user' with person icon), Status, Created, Last Login, and Actions (view/edit/more). The 'Invite User' button triggers an email invitation flow. Issues: (1) No pagination visible — won't scale past 20-30 users, (2) No bulk operations, (3) The 'Super Admin' badge name here differs from 'admin' in Role Management and 'Customer Super Admin' in the Admin Portal — three names for the same concept.",
      },
      {
        nodeId: "iam-role-mgmt",
        authorName: "UX Analyst",
        text: "Role Management is critically underbuilt. Shows only 2 roles ('admin', 'user') with Name, Created date, and an edit action. There is no description, no permissions summary, no user count per role. The 'Create New Role' button suggests roles are configurable but there's zero visibility into what each role actually grants. An admin cannot verify role capabilities without assigning the role and testing it. Need: inline permission matrix, role description field, user count, and a 'preview as this role' capability.",
      },
      {
        nodeId: "iam-role-mgmt",
        authorName: "Product Manager",
        text: "The role naming is our biggest IAM confusion point. This screen lists 'admin' and 'user'. But User Management shows 'Super Admin' (not 'admin'). And the Admin Portal calls them 'Customer Super Admins'. We need to establish a single naming convention: Platform Admin / Tenant Admin / Project Admin — or similar hierarchy that's consistent everywhere.",
      },
      {
        nodeId: "iam-home-libraries",
        authorName: "UX Analyst",
        text: "The Libraries section (Logs, Assets, HMI) is accessible from the sidebar. This shows that the navigation structure has IAM screens (User Management, Role Management) at the same level as operational screens (Projects, Libraries). There's no visual grouping to separate 'Administration' from 'Operations'. Recommendation: add a sidebar section divider or group heading to separate Admin functions from daily-use features.",
      },

      // Tier 3
      {
        nodeId: "iam-proj-members",
        authorName: "UX Analyst",
        text: "Project Members is the most complex IAM screen. It introduces a dual-role system: each member has a Project Role (owner/admin, color-coded badges) AND a System Role (purple 'Super Admin' badge). The Access Level column shows 'Access: full / 4 permissions' and 'Access: standard / 8 permissions'. CRITICAL ISSUE: 'full' has FEWER permissions (4) than 'standard' (8). This is either a naming bug or a display bug — either way it will confuse every admin who sees it. The owner row has no action buttons (correct — can't demote yourself), but there's no tooltip explaining why.",
      },
      {
        nodeId: "iam-proj-members",
        authorName: "Security Reviewer",
        text: "The dual-role system (Project Role + System Role) creates a permission matrix that's invisible to the admin. A 'Super Admin' system role + 'admin' project role = what exactly? There's no documentation, no tooltip, and no way to see the combined effective permissions. We need: (1) a tooltip showing effective permissions on hover, (2) a dedicated 'Permission Calculator' view, (3) clear documentation of how project roles intersect with system roles.",
      },
      {
        nodeId: "iam-proj-settings",
        authorName: "UX Analyst",
        text: "Project Settings shows general config (name, status, description, timeline, timezone, dates) plus read-only project info and a Danger Zone with Delete + Archive buttons. IAM concern: there's no indication of who can access this page. Any project member navigating here might assume they can make changes, but only owners/admins should have write access. The Archive and Delete buttons are styled identically (both red) in the Danger Zone — Archive is reversible and should be visually softer (amber/yellow).",
      },
      {
        nodeId: "iam-projects-list",
        authorName: "UX Analyst",
        text: "Projects List is the navigation hub for all projects. It shows project cards with name, status, and last activity. From here, users navigate to individual projects where they'll encounter project-level IAM. Missing: a column or badge showing the current user's role in each project, so admins can quickly see where they have admin vs. read-only access.",
      },
    ];

    for (const c of comments) {
      await ctx.db.insert("comments", {
        boardId,
        nodeId: c.nodeId,
        authorId: "system-ux-review",
        authorName: c.authorName,
        text: c.text,
        createdAt: now + Math.floor(Math.random() * 60000),
        resolved: false,
      });
    }

    // ====================================================================
    // GAP ANALYSIS REPORT
    // ====================================================================
    await ctx.db.insert("reports", {
      boardId,
      title: "IAM Gap Analysis — Identity & Access Management",
      summary:
        "Analysis of the three-tier IAM system across OPPR Admin Portal, Oppr Logs tenant management, " +
        "and project-level access control. Identified 8 critical findings spanning role naming inconsistencies, " +
        "missing permission visibility, audit compliance gaps, and counterintuitive access level naming.",
      content:
        "## Executive Summary\n\n" +
        "The OPPR IAM system implements a three-tier access control architecture: platform-level administration " +
        "(OPPR Admin Portal), tenant-level user/role management (Oppr Logs), and project-scoped membership " +
        "with granular permissions. While the architectural separation is sound, the implementation suffers from " +
        "significant UX inconsistencies that will confuse users during onboarding and ongoing administration.\n\n" +

        "## Key Findings\n\n" +

        "### 1. Role Naming Chaos (Critical)\n" +
        "The same concept is called different things across the three tiers:\n" +
        "- Admin Portal: 'Customer Super Admin'\n" +
        "- User Management: 'Super Admin' (badge)\n" +
        "- Role Management: 'admin' (role name)\n" +
        "This triple-naming will cause confusion during onboarding, support tickets, and documentation.\n\n" +

        "### 2. Invisible Permission Model (Critical)\n" +
        "Role Management shows role names but zero information about what each role grants. " +
        "Project Members shows 'Access Level' with permission counts but no detail. " +
        "There is no single screen where an admin can see the complete permission model.\n\n" +

        "### 3. Access Level Paradox (High)\n" +
        "'Access: full / 4 permissions' for owners vs 'Access: standard / 8 permissions' for admins. " +
        "The naming contradicts the numbers. This is either a labeling bug or a data model issue.\n\n" +

        "### 4. Audit Compliance Gap (High)\n" +
        "Audit logs only capture login/logout/invite. Missing: permission changes, role modifications, " +
        "account deactivations, failed logins. CSV export has row limits. Not SOC2-ready.\n\n" +

        "### 5. No Bulk Operations (Medium)\n" +
        "No multi-select on any IAM table. Enterprise customers with 50+ users cannot efficiently manage " +
        "bulk role changes, deactivations, or project assignments.\n\n" +

        "### 6. Domain Restriction Leak (Medium)\n" +
        "OPPR Team Management allows invitations to non-@oppr.ai emails despite appearing to be an internal-only system.\n\n" +

        "### 7. Stale Account Management (Medium)\n" +
        "No automated warnings for dormant accounts, no expiry on pending invitations, " +
        "no distinction between 'invited but pending' and 'active but inactive'.\n\n" +

        "### 8. Missing Navigation Grouping (Low)\n" +
        "IAM screens (User Management, Role Management) are at the same sidebar level as operational screens " +
        "(Projects, Libraries) with no visual separation.\n\n" +

        "## Recommendations\n\n" +
        "1. Establish a universal role naming convention: Platform Admin → Tenant Admin → Project Admin → User\n" +
        "2. Build a permission matrix view in Role Management\n" +
        "3. Fix access level naming or permission counts in Project Members\n" +
        "4. Expand audit logging to cover all IAM mutations + unlimited CSV export\n" +
        "5. Add bulk operations to all IAM tables\n" +
        "6. Enforce domain restrictions on Team invitations\n" +
        "7. Add dormant account warnings + invitation expiry\n" +
        "8. Add sidebar section groupings (Admin vs Operations)\n",
      findings: [
        {
          type: "inconsistency",
          severity: "critical",
          description: "Role naming inconsistency across three tiers — 'Customer Super Admin' vs 'Super Admin' vs 'admin'. Same concept, three names.",
          affectedNodes: ["iam-super-admins", "iam-user-mgmt", "iam-role-mgmt"],
        },
        {
          type: "missing-feature",
          severity: "critical",
          description: "No permission visibility in Role Management. Admins cannot see what each role grants without assigning it and testing.",
          affectedNodes: ["iam-role-mgmt"],
        },
        {
          type: "bug",
          severity: "high",
          description: "Access Level naming paradox: 'full' shows fewer permissions (4) than 'standard' (8). Either naming or data is wrong.",
          affectedNodes: ["iam-proj-members"],
        },
        {
          type: "compliance",
          severity: "high",
          description: "Audit logs missing critical IAM events (permission changes, role modifications, failed logins). CSV export has row limits. Not SOC2-ready.",
          affectedNodes: ["iam-audit-logs"],
        },
        {
          type: "scalability",
          severity: "medium",
          description: "No bulk operations on any IAM table. Enterprise customers with 50+ users cannot manage users efficiently.",
          affectedNodes: ["iam-user-mgmt", "iam-companies-list", "iam-super-admins"],
        },
        {
          type: "security",
          severity: "medium",
          description: "Team Management allows invitations to non-@oppr.ai emails despite being internal-only.",
          affectedNodes: ["iam-team-mgmt"],
        },
        {
          type: "hygiene",
          severity: "medium",
          description: "No stale account detection, no pending invitation expiry, no dormant account warnings.",
          affectedNodes: ["iam-companies-list", "iam-super-admins"],
        },
        {
          type: "navigation",
          severity: "low",
          description: "IAM screens mixed with operational screens in sidebar with no grouping or visual separation.",
          affectedNodes: ["iam-home-dashboard", "iam-home-libraries"],
        },
      ],
      createdAt: now,
    });

    return boardId;
  },
});
