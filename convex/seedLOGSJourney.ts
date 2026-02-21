import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Creates a comprehensive OPPR Logs Platform Journey board.
 *
 * Maps the complete workflow across six swim lanes:
 *   Lane 1 — Desktop App Entry & Navigation
 *   Lane 2 — Project Configuration (Controls, Schedules, Members, Settings)
 *   Lane 3 — Log Management & Data Viewing
 *   Lane 4 — Assets & Floor Plans
 *   Lane 5 — Libraries & HMI Templates
 *   Lane 6 — Mobile Field Operations (push notification → round completion)
 *
 * Includes:
 *   - 38 screenshot nodes (24 desktop + 14 mobile)
 *   - Terminology glossary report with naming inconsistencies
 *   - Gap analysis report with structured findings
 *   - Attention blocks for every naming inconsistency found
 *   - Detailed UX comments on every screen
 *   - Persona-node assignments across all 5 personas
 *   - Full edge graph connecting desktop ↔ mobile workflows
 */

const DEFAULT_PERSONAS = [
  {
    name: "OPPR Admin",
    description:
      "Internal OPPR staff responsible for platform-wide configuration and oversight. " +
      "Manages tenant provisioning, global IAM policies, service health monitoring, and billing. " +
      "Has superuser access across all tenants. In the Logs context, monitors platform health " +
      "and supports customers with configuration issues.",
    color: "#a855f7",
  },
  {
    name: "Customer Admin",
    description:
      "External customer-side administrator who manages their organization's OPPR tenant. " +
      "Sets up projects, configures log templates, manages schedules, assigns team members, " +
      "and reviews completed log data. Full access to all desktop features. " +
      "Primary workflow: create project → configure logs/assets/schedules → assign operators → review data.",
    color: "#3b82f6",
  },
  {
    name: "Customer Ops Manager",
    description:
      "Mid-level manager who oversees daily operations. Uses desktop to review dashboards, " +
      "check log completion rates, and monitor schedule adherence. Occasionally uses mobile " +
      "for on-the-go approvals. Needs visibility into team progress and bottlenecks. " +
      "Cannot create projects but can configure existing ones.",
    color: "#f59e0b",
  },
  {
    name: "Customer Operator",
    description:
      "Front-line field worker who primarily uses the mobile app. Receives push notifications " +
      "when a scheduled round is due, opens the app, navigates to the assigned log, completes " +
      "each step, and submits. May also scan QR codes on assets and view floor plans on-site. " +
      "Has no access to project configuration or user management.",
    color: "#22c55e",
  },
  {
    name: "External Auditor",
    description:
      "Third-party compliance or quality auditor with read-only access. Reviews completed logs, " +
      "checks data integrity, examines floor plan documentation, and exports reports. " +
      "Desktop-only access with time-limited credentials.",
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
      name: "OPPR Logs — Complete Platform Journey",
      description:
        "End-to-end journey through the OPPR Logs platform covering desktop project setup, " +
        "log configuration, asset/floor plan management, schedule creation, HMI templates, " +
        "and the complete mobile field workflow from push notification to round completion. " +
        "Includes terminology glossary, naming consistency analysis, and UX gap findings.",
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
    // SCREENSHOT FOLDER (LOGS)
    // ====================================================================
    const existingFolders = await ctx.db
      .query("screenshotFolders")
      .withIndex("by_name", (q) => q.eq("name", "LOGS"))
      .collect();
    let logsFolderId: Id<"screenshotFolders">;
    if (existingFolders.length > 0) {
      logsFolderId = existingFolders[0]._id;
    } else {
      logsFolderId = await ctx.db.insert("screenshotFolders", {
        name: "LOGS",
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

    // Helper: link screenshot to board + assign to LOGS folder + add tags
    const linkAndTag = async (
      gs: (typeof allGS)[0],
      tags: string[]
    ) => {
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
      await ctx.db.patch(gs._id, { folderId: logsFolderId });
      const existingTags = gs.tags || [];
      const mergedTags = Array.from(new Set([...existingTags, ...tags]));
      await ctx.db.patch(gs._id, { tags: mergedTags });
    };

    // ====================================================================
    // SCREENSHOT NODE DEFINITIONS
    // ====================================================================
    interface ScreenshotNodeDef {
      nodeId: string;
      gsLabel: string;
      gsPlatform: string;
      label: string;
      x: number;
      y: number;
      tags: string[];
    }

    // Layout: 6 horizontal swim lanes, left-to-right flow
    //
    //  LANE 1 (y=150):  Desktop App Entry & Navigation
    //  LANE 2 (y=700):  Project Configuration
    //  LANE 3 (y=1250): Log Management & Data
    //  LANE 4 (y=1800): Assets & Floor Plans
    //  LANE 5 (y=2350): Libraries & HMI Templates
    //  LANE 6 (y=2900): Mobile Field Operations
    //  LANE 7 (y=3450): Mobile Additional Screens

    const screenshotNodes: ScreenshotNodeDef[] = [
      // ---- LANE 1: Desktop App Entry & Navigation ----
      {
        nodeId: "logs-home-dashboard",
        gsLabel: "Home Dashboard", gsPlatform: "desktop",
        label: "Home Dashboard",
        x: 100, y: 150,
        tags: ["logs", "desktop", "navigation", "dashboard", "entry-point"],
      },
      {
        nodeId: "logs-home-libraries",
        gsLabel: "Home Dashboard (Libraries)", gsPlatform: "desktop",
        label: "Home — Libraries Panel",
        x: 450, y: 150,
        tags: ["logs", "desktop", "navigation", "libraries"],
      },
      {
        nodeId: "logs-projects-list",
        gsLabel: "Projects List", gsPlatform: "desktop",
        label: "Projects List",
        x: 800, y: 150,
        tags: ["logs", "desktop", "navigation", "projects"],
      },
      {
        nodeId: "logs-project-overview",
        gsLabel: "Project Overview", gsPlatform: "desktop",
        label: "Project Overview",
        x: 1150, y: 150,
        tags: ["logs", "desktop", "project", "overview"],
      },
      {
        nodeId: "logs-project-dashboard",
        gsLabel: "Project Dashboard", gsPlatform: "desktop",
        label: "Project Dashboard",
        x: 1500, y: 150,
        tags: ["logs", "desktop", "project", "dashboard", "analytics"],
      },

      // ---- LANE 2: Project Configuration ----
      {
        nodeId: "logs-project-controls",
        gsLabel: "Project Controls", gsPlatform: "desktop",
        label: "Project Controls",
        x: 100, y: 700,
        tags: ["logs", "desktop", "project", "controls", "configuration"],
      },
      {
        nodeId: "logs-project-controls-rounds",
        gsLabel: "Project Controls - Rounds", gsPlatform: "desktop",
        label: "Controls — Rounds View",
        x: 450, y: 700,
        tags: ["logs", "desktop", "project", "controls", "rounds"],
      },
      {
        nodeId: "logs-schedule-working-hours",
        gsLabel: "Schedules - Working Hours", gsPlatform: "desktop",
        label: "Schedules — Working Hours",
        x: 800, y: 700,
        tags: ["logs", "desktop", "project", "schedules", "working-hours"],
      },
      {
        nodeId: "logs-schedule-standard",
        gsLabel: "Schedules - Standard", gsPlatform: "desktop",
        label: "Schedules — Standard",
        x: 1150, y: 700,
        tags: ["logs", "desktop", "project", "schedules", "standard"],
      },
      {
        nodeId: "logs-schedule-custom",
        gsLabel: "Schedules - Custom", gsPlatform: "desktop",
        label: "Schedules — Custom",
        x: 1500, y: 700,
        tags: ["logs", "desktop", "project", "schedules", "custom"],
      },
      {
        nodeId: "logs-project-members",
        gsLabel: "Project Members", gsPlatform: "desktop",
        label: "Project Members",
        x: 1850, y: 700,
        tags: ["logs", "desktop", "project", "members", "team"],
      },
      {
        nodeId: "logs-project-settings",
        gsLabel: "Project Settings", gsPlatform: "desktop",
        label: "Project Settings",
        x: 2200, y: 700,
        tags: ["logs", "desktop", "project", "settings"],
      },

      // ---- LANE 3: Log Management & Data ----
      {
        nodeId: "logs-project-logs",
        gsLabel: "Project Logs", gsPlatform: "desktop",
        label: "Project Logs",
        x: 100, y: 1250,
        tags: ["logs", "desktop", "project", "log-list", "management"],
      },
      {
        nodeId: "logs-project-logs-alt",
        gsLabel: "Project Logs (alt)", gsPlatform: "desktop",
        label: "Project Logs — Detail View",
        x: 450, y: 1250,
        tags: ["logs", "desktop", "project", "log-detail"],
      },
      {
        nodeId: "logs-project-log-data-viewer",
        gsLabel: "Project Log Data Viewer", gsPlatform: "desktop",
        label: "Log Data Viewer",
        x: 800, y: 1250,
        tags: ["logs", "desktop", "project", "data-viewer", "analytics"],
      },
      {
        nodeId: "logs-project-history",
        gsLabel: "Project History", gsPlatform: "desktop",
        label: "Project History",
        x: 1150, y: 1250,
        tags: ["logs", "desktop", "project", "history", "audit-trail"],
      },

      // ---- LANE 4: Assets & Floor Plans ----
      {
        nodeId: "logs-assets-list",
        gsLabel: "Project Assets - List View", gsPlatform: "desktop",
        label: "Assets — List View",
        x: 100, y: 1800,
        tags: ["logs", "desktop", "project", "assets", "list-view"],
      },
      {
        nodeId: "logs-assets-hierarchy",
        gsLabel: "Project Assets - Hierarchy", gsPlatform: "desktop",
        label: "Assets — Hierarchy View",
        x: 450, y: 1800,
        tags: ["logs", "desktop", "project", "assets", "hierarchy", "tree"],
      },
      {
        nodeId: "logs-floorplans-list",
        gsLabel: "Project Floor Plans List", gsPlatform: "desktop",
        label: "Floor Plans List",
        x: 800, y: 1800,
        tags: ["logs", "desktop", "project", "floor-plans", "list"],
      },
      {
        nodeId: "logs-floorplan-detail",
        gsLabel: "Project Floor Plan Detail", gsPlatform: "desktop",
        label: "Floor Plan Detail",
        x: 1150, y: 1800,
        tags: ["logs", "desktop", "project", "floor-plans", "detail"],
      },
      {
        nodeId: "logs-floorplan-modal",
        gsLabel: "Project Floor Plan Modal", gsPlatform: "desktop",
        label: "Floor Plan — Asset Modal",
        x: 1500, y: 1800,
        tags: ["logs", "desktop", "project", "floor-plans", "modal", "asset-detail"],
      },
      {
        nodeId: "logs-floorplan-connected",
        gsLabel: "Floor Plan - Connected Assets", gsPlatform: "desktop",
        label: "Floor Plan — Connected Assets",
        x: 1850, y: 1800,
        tags: ["logs", "desktop", "project", "floor-plans", "connected-assets"],
      },

      // ---- LANE 5: Libraries & HMI Templates ----
      {
        nodeId: "logs-hmi-templates",
        gsLabel: "Project HMI Templates", gsPlatform: "desktop",
        label: "Project HMI Templates",
        x: 100, y: 2350,
        tags: ["logs", "desktop", "project", "hmi", "templates"],
      },
      {
        nodeId: "logs-hmi-library",
        gsLabel: "HMI Templates Library", gsPlatform: "desktop",
        label: "HMI Templates Library",
        x: 450, y: 2350,
        tags: ["logs", "desktop", "library", "hmi", "templates"],
      },
      {
        nodeId: "logs-assets-library",
        gsLabel: "Assets Library", gsPlatform: "desktop",
        label: "Assets Library",
        x: 800, y: 2350,
        tags: ["logs", "desktop", "library", "assets"],
      },
      {
        nodeId: "logs-logs-library",
        gsLabel: "Logs Library", gsPlatform: "desktop",
        label: "Logs Library",
        x: 1150, y: 2350,
        tags: ["logs", "desktop", "library", "logs", "templates"],
      },

      // ---- LANE 6: Mobile Field Operations (Main Flow) ----
      {
        nodeId: "logs-mobile-push",
        gsLabel: "Push Notification", gsPlatform: "mobile",
        label: "Push Notification",
        x: 100, y: 2900,
        tags: ["logs", "mobile", "notification", "entry-point", "schedule-trigger"],
      },
      {
        nodeId: "logs-mobile-projects",
        gsLabel: "Projects List", gsPlatform: "mobile",
        label: "Mobile — Projects List",
        x: 450, y: 2900,
        tags: ["logs", "mobile", "projects", "navigation"],
      },
      {
        nodeId: "logs-mobile-project-overview",
        gsLabel: "Project Overview", gsPlatform: "mobile",
        label: "Mobile — Project Overview",
        x: 800, y: 2900,
        tags: ["logs", "mobile", "project", "overview"],
      },
      {
        nodeId: "logs-mobile-running",
        gsLabel: "Project Running", gsPlatform: "mobile",
        label: "Mobile — Round In Progress",
        x: 1150, y: 2900,
        tags: ["logs", "mobile", "project", "running", "active-round"],
      },
      {
        nodeId: "logs-mobile-notifications",
        gsLabel: "Notifications Screen", gsPlatform: "mobile",
        label: "Mobile — Notifications",
        x: 1500, y: 2900,
        tags: ["logs", "mobile", "notifications", "inbox"],
      },
      {
        nodeId: "logs-mobile-logs-list",
        gsLabel: "Logs List", gsPlatform: "mobile",
        label: "Mobile — Logs List",
        x: 1850, y: 2900,
        tags: ["logs", "mobile", "logs", "list"],
      },
      {
        nodeId: "logs-mobile-log-step",
        gsLabel: "Log Step View", gsPlatform: "mobile",
        label: "Mobile — Log Step View",
        x: 2200, y: 2900,
        tags: ["logs", "mobile", "log-step", "data-entry"],
      },
      {
        nodeId: "logs-mobile-log-history",
        gsLabel: "Log History", gsPlatform: "mobile",
        label: "Mobile — Log History",
        x: 2550, y: 2900,
        tags: ["logs", "mobile", "log-history", "completed-rounds"],
      },

      // ---- LANE 7: Mobile Additional Screens ----
      {
        nodeId: "logs-mobile-round-status",
        gsLabel: "Logs Tab - Round Status", gsPlatform: "mobile",
        label: "Mobile — Round Status Detail",
        x: 100, y: 3450,
        tags: ["logs", "mobile", "round-status", "progress"],
      },
      {
        nodeId: "logs-mobile-projects-badge",
        gsLabel: "Projects (Badge)", gsPlatform: "mobile",
        label: "Mobile — Projects (Badge Count)",
        x: 450, y: 3450,
        tags: ["logs", "mobile", "projects", "badge", "notification-count"],
      },
      {
        nodeId: "logs-mobile-logs-badge",
        gsLabel: "Logs (Badge)", gsPlatform: "mobile",
        label: "Mobile — Logs Tab (Badge)",
        x: 800, y: 3450,
        tags: ["logs", "mobile", "logs", "badge", "pending-count"],
      },
      {
        nodeId: "logs-mobile-logs-notification",
        gsLabel: "Logs List (Notification)", gsPlatform: "mobile",
        label: "Mobile — Logs (via Notification)",
        x: 1150, y: 3450,
        tags: ["logs", "mobile", "logs", "notification-entry"],
      },
      {
        nodeId: "logs-mobile-log-step-alt",
        gsLabel: "Log Step View (alt)", gsPlatform: "mobile",
        label: "Mobile — Log Step (Response)",
        x: 1500, y: 3450,
        tags: ["logs", "mobile", "log-step", "response", "completed"],
      },
      {
        nodeId: "logs-mobile-assets-floorplan",
        gsLabel: "Assets Floor Plan", gsPlatform: "mobile",
        label: "Mobile — Assets Floor Plan",
        x: 1850, y: 3450,
        tags: ["logs", "mobile", "assets", "floor-plan", "field-reference"],
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
        nodeId: "header-lane1",
        text: "LANE 1 — DESKTOP APP ENTRY & NAVIGATION\nHome Dashboard → Projects → Project Overview → Dashboard. Entry points for all desktop users.\nPersonas: Customer Admin, Customer Ops Manager",
        x: 100, y: 50,
      },
      {
        nodeId: "header-lane2",
        text: "LANE 2 — PROJECT CONFIGURATION\nControls (log templates + rounds), Schedules (working hours, standard, custom), Members & Settings.\nPersonas: Customer Admin",
        x: 100, y: 600,
      },
      {
        nodeId: "header-lane3",
        text: "LANE 3 — LOG MANAGEMENT & DATA\nLog list, log detail, log data viewer (analytics), and project history (audit trail).\nPersonas: Customer Admin, Customer Ops Manager, External Auditor",
        x: 100, y: 1150,
      },
      {
        nodeId: "header-lane4",
        text: "LANE 4 — ASSETS & FLOOR PLANS\nAsset hierarchy, floor plan visualization, connected asset mapping, and asset detail modals.\nPersonas: Customer Admin, Customer Ops Manager",
        x: 100, y: 1700,
      },
      {
        nodeId: "header-lane5",
        text: "LANE 5 — LIBRARIES & HMI TEMPLATES\nCross-project reusable libraries for logs, assets, and HMI templates.\nPersonas: Customer Admin",
        x: 100, y: 2250,
      },
      {
        nodeId: "header-lane6",
        text: "LANE 6 — MOBILE FIELD OPERATIONS (Main Flow)\nPush notification → Project → Round in progress → Log steps → History.\nPersonas: Customer Operator, Customer Ops Manager",
        x: 100, y: 2800,
      },
      {
        nodeId: "header-lane7",
        text: "LANE 7 — MOBILE ADDITIONAL SCREENS\nRound status detail, badge notifications, alternate entry points, and on-site asset reference.\nPersonas: Customer Operator",
        x: 100, y: 3350,
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
        nodeId: "handoff-desktop-to-mobile",
        text: "HANDOFF: DESKTOP → MOBILE\nAdmin configures schedules on desktop → schedule triggers push notification → operator receives on mobile device → opens app to start round",
        x: 1850, y: 800,
      },
      {
        nodeId: "handoff-mobile-to-desktop",
        text: "HANDOFF: MOBILE → DESKTOP\nOperator completes round on mobile → data syncs to Convex → Admin reviews completed log data in Log Data Viewer and Project History on desktop",
        x: 800, y: 1350,
      },
      {
        nodeId: "annotation-hierarchy",
        text: "DATA HIERARCHY: Project → Logs (templates) + Assets → Controls → Rounds → Steps → Responses\nEach level nests within the previous. A Project contains Logs (log templates), which define Steps. Controls group Logs. Rounds are instances of a Control execution. Each Round contains Step Responses.",
        x: 100, y: 1600,
      },
      {
        nodeId: "annotation-nav-structure",
        text: "DESKTOP NAVIGATION: Two sidebar contexts\n• Main App: Home, Projects, Analytics, Libraries (Logs/Assets/HMI), User Mgmt, Role Mgmt\n• Project Context: Overview, Dashboard, Controls, Logs, Log Data Viewer, Floor Plans, Assets, HMI Templates, Schedules, Members, History, Settings",
        x: 1500, y: 50,
      },
      {
        nodeId: "annotation-mobile-nav",
        text: "MOBILE NAVIGATION: Bottom tabs\n• Projects (list + badge) • Logs (list + badge) • History • Notifications • Scan (QR) • Profile\nLog statuses: Done, Pending, Active, Halted, Started",
        x: 2200, y: 3350,
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
    // ATTENTION BLOCKS (Naming Inconsistencies & UX Issues)
    // ====================================================================
    const attentionBlocks = [
      {
        nodeId: "attn-title-vs-logname",
        x: 1150, y: 1350,
        text: "NAMING: 'Title' vs 'Log Name'\nLogs Library uses the column header 'Title' for log templates. Project Logs uses 'Log Name' for the same concept. These refer to the same field but use different labels depending on context. Standardize to one term.",
      },
      {
        nodeId: "attn-history-vs-analytics",
        x: 1150, y: 1450,
        text: "NAMING: 'History' vs 'Project Analytics'\nThe sidebar navigation item is called 'History' but the Project History page functions as an activity/analytics log. The Dashboard tab also shows analytics charts. Unclear which is the 'analytics' view vs the 'history' view. Consider 'Activity Log' for History.",
      },
      {
        nodeId: "attn-log-connected-vs-attached",
        x: 1850, y: 1900,
        text: "NAMING: 'No log connected' vs 'No log attached'\nFloor Plan asset tooltips say 'No log connected' while the Assets list says 'No log attached'. Both mean 'this asset has no associated log template'. Pick one term: 'linked', 'connected', or 'attached'.",
      },
      {
        nodeId: "attn-hmi-casing",
        x: 100, y: 2450,
        text: "NAMING: 'Hmi' vs 'HMI'\nThe breadcrumb trail shows 'Hmi Templates' (lowercase 'mi') while the page heading and sidebar use 'HMI Templates' (all caps). Acronyms should be consistently capitalized. Fix the breadcrumb rendering.",
      },
      {
        nodeId: "attn-floorplan-spelling",
        x: 800, y: 1900,
        text: "NAMING: 'Floor Plan' vs 'Floorplan' vs 'floorplan'\nThree spellings used: 'Floor Plans' (sidebar), 'Floorplan' (some labels), 'floorplan' (URL/code). User-facing text should consistently use 'Floor Plan' (two words, capitalized).",
      },
      {
        nodeId: "attn-steps-vs-responses",
        x: 2200, y: 3000,
        text: "NAMING: 'Steps' vs 'Responses'\nLog templates define 'Steps' (the questions/checks to complete). Completed rounds show 'Responses' (the answers). This is logically correct but nowhere in the UI explains the distinction. A new operator sees 'Steps' during setup and 'Responses' in history with no connecting context.",
      },
      {
        nodeId: "attn-schedule-naming",
        x: 800, y: 800,
        text: "NAMING: 'Schedule Tasks' vs 'Schedules' vs 'Project Schedules'\nThe sidebar uses 'Schedules', the page heading uses 'Project Schedules', and the schedule configuration refers to 'Schedule Tasks'. Three names for the same feature. Standardize to 'Schedules'.",
      },
      {
        nodeId: "attn-session-vs-round",
        x: 450, y: 800,
        text: "NAMING: Desktop 'Log Session' vs Mobile 'Round'\nDesktop Controls page refers to log execution instances as 'sessions' or 'log sessions'. Mobile exclusively calls them 'Rounds'. The Round status page shows round progress. Cross-platform users will be confused. Standardize to 'Round' everywhere.",
      },
      {
        nodeId: "attn-start-vs-execute",
        x: 1150, y: 3000,
        text: "NAMING: Desktop 'Start' vs Mobile 'Execute'\nDesktop round actions use 'Start Round' button. Mobile uses 'Execute' to begin a round. Both initiate the same action. Operators switching between platforms will search for the wrong button. Standardize to 'Start Round'.",
      },
      {
        nodeId: "attn-no-empty-states",
        x: 1500, y: 1250,
        text: "UX GAP: Missing empty states\nMultiple screens (Log Data Viewer, Floor Plans, Assets) show blank areas when no data exists. No helpful empty state illustrations, no 'Get Started' prompts, no links to the relevant configuration screen. New users hitting an empty screen have no idea what to do next.",
      },
      {
        nodeId: "attn-mobile-offline",
        x: 2550, y: 3000,
        text: "UX GAP: No offline support indication\nThe mobile app shows no indication of offline capability. Field operators often work in areas with poor connectivity (basements, industrial sites). If the app supports offline mode, it should show sync status. If it doesn't, this is a critical gap for field use.",
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
      // Lane 1: Desktop navigation flow
      { source: "logs-home-dashboard", target: "logs-home-libraries", label: "Libraries panel" },
      { source: "logs-home-dashboard", target: "logs-projects-list", label: "View Projects" },
      { source: "logs-projects-list", target: "logs-project-overview", label: "Select Project" },
      { source: "logs-project-overview", target: "logs-project-dashboard", label: "Dashboard" },

      // Lane 1 → Lane 2: Project config
      { source: "logs-project-overview", target: "logs-project-controls", label: "Controls" },
      { source: "logs-project-overview", target: "logs-project-members", label: "Members" },
      { source: "logs-project-overview", target: "logs-project-settings", label: "Settings" },

      // Lane 2: Configuration flow
      { source: "logs-project-controls", target: "logs-project-controls-rounds", label: "View Rounds" },
      { source: "logs-project-controls", target: "logs-schedule-working-hours", label: "Configure Schedules" },
      { source: "logs-schedule-working-hours", target: "logs-schedule-standard", label: "Standard schedule" },
      { source: "logs-schedule-standard", target: "logs-schedule-custom", label: "Custom schedule" },

      // Lane 2 → Lane 6: Desktop to Mobile handoff
      { source: "logs-schedule-custom", target: "handoff-desktop-to-mobile", label: "Schedule triggers" },
      { source: "handoff-desktop-to-mobile", target: "logs-mobile-push", label: "Push notification" },

      // Lane 1 → Lane 3: Log management
      { source: "logs-project-overview", target: "logs-project-logs", label: "Logs" },
      { source: "logs-project-logs", target: "logs-project-logs-alt", label: "Log detail" },
      { source: "logs-project-logs", target: "logs-project-log-data-viewer", label: "View data" },
      { source: "logs-project-overview", target: "logs-project-history", label: "History" },

      // Lane 1 → Lane 4: Assets & Floor Plans
      { source: "logs-project-overview", target: "logs-assets-list", label: "Assets" },
      { source: "logs-assets-list", target: "logs-assets-hierarchy", label: "Hierarchy view" },
      { source: "logs-project-overview", target: "logs-floorplans-list", label: "Floor Plans" },
      { source: "logs-floorplans-list", target: "logs-floorplan-detail", label: "Open floor plan" },
      { source: "logs-floorplan-detail", target: "logs-floorplan-modal", label: "Asset detail" },
      { source: "logs-floorplan-detail", target: "logs-floorplan-connected", label: "Connected assets" },
      { source: "logs-assets-list", target: "logs-floorplan-connected", label: "Assets on plan" },

      // Lane 1 → Lane 5: HMI & Libraries
      { source: "logs-project-overview", target: "logs-hmi-templates", label: "HMI Templates" },
      { source: "logs-home-libraries", target: "logs-hmi-library", label: "HMI Library" },
      { source: "logs-home-libraries", target: "logs-assets-library", label: "Assets Library" },
      { source: "logs-home-libraries", target: "logs-logs-library", label: "Logs Library" },

      // Lane 6: Mobile main flow
      { source: "logs-mobile-push", target: "logs-mobile-projects", label: "Open app" },
      { source: "logs-mobile-projects", target: "logs-mobile-project-overview", label: "Select project" },
      { source: "logs-mobile-project-overview", target: "logs-mobile-running", label: "Start round" },
      { source: "logs-mobile-running", target: "logs-mobile-logs-list", label: "View logs" },
      { source: "logs-mobile-logs-list", target: "logs-mobile-log-step", label: "Open log step" },
      { source: "logs-mobile-log-step", target: "logs-mobile-log-history", label: "Complete → History" },
      { source: "logs-mobile-push", target: "logs-mobile-notifications", label: "Via notifications" },
      { source: "logs-mobile-notifications", target: "logs-mobile-logs-notification", label: "Open from notification" },

      // Lane 7: Additional mobile connections
      { source: "logs-mobile-logs-list", target: "logs-mobile-round-status", label: "Round detail" },
      { source: "logs-mobile-log-step", target: "logs-mobile-log-step-alt", label: "View response" },
      { source: "logs-mobile-project-overview", target: "logs-mobile-assets-floorplan", label: "Floor plan" },

      // Mobile → Desktop: Data sync back
      { source: "logs-mobile-log-history", target: "handoff-mobile-to-desktop", label: "Data syncs" },
      { source: "handoff-mobile-to-desktop", target: "logs-project-log-data-viewer", label: "Review data" },
      { source: "handoff-mobile-to-desktop", target: "logs-project-history", label: "Activity log" },

      // Badge flows
      { source: "logs-mobile-push", target: "logs-mobile-projects-badge", label: "Badge increments" },
      { source: "logs-mobile-push", target: "logs-mobile-logs-badge", label: "Badge increments" },
    ];

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      await ctx.db.insert("edges", {
        boardId,
        edgeId: `logs-edge-${i}`,
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
      // Customer Admin — full desktop access
      { persona: "Customer Admin", nodeId: "logs-home-dashboard" },
      { persona: "Customer Admin", nodeId: "logs-home-libraries" },
      { persona: "Customer Admin", nodeId: "logs-projects-list" },
      { persona: "Customer Admin", nodeId: "logs-project-overview" },
      { persona: "Customer Admin", nodeId: "logs-project-dashboard" },
      { persona: "Customer Admin", nodeId: "logs-project-controls" },
      { persona: "Customer Admin", nodeId: "logs-project-controls-rounds" },
      { persona: "Customer Admin", nodeId: "logs-schedule-working-hours" },
      { persona: "Customer Admin", nodeId: "logs-schedule-standard" },
      { persona: "Customer Admin", nodeId: "logs-schedule-custom" },
      { persona: "Customer Admin", nodeId: "logs-project-members" },
      { persona: "Customer Admin", nodeId: "logs-project-settings" },
      { persona: "Customer Admin", nodeId: "logs-project-logs" },
      { persona: "Customer Admin", nodeId: "logs-project-logs-alt" },
      { persona: "Customer Admin", nodeId: "logs-project-log-data-viewer" },
      { persona: "Customer Admin", nodeId: "logs-project-history" },
      { persona: "Customer Admin", nodeId: "logs-assets-list" },
      { persona: "Customer Admin", nodeId: "logs-assets-hierarchy" },
      { persona: "Customer Admin", nodeId: "logs-floorplans-list" },
      { persona: "Customer Admin", nodeId: "logs-floorplan-detail" },
      { persona: "Customer Admin", nodeId: "logs-floorplan-modal" },
      { persona: "Customer Admin", nodeId: "logs-floorplan-connected" },
      { persona: "Customer Admin", nodeId: "logs-hmi-templates" },
      { persona: "Customer Admin", nodeId: "logs-hmi-library" },
      { persona: "Customer Admin", nodeId: "logs-assets-library" },
      { persona: "Customer Admin", nodeId: "logs-logs-library" },

      // Customer Ops Manager — desktop dashboard + review, some mobile
      { persona: "Customer Ops Manager", nodeId: "logs-home-dashboard" },
      { persona: "Customer Ops Manager", nodeId: "logs-projects-list" },
      { persona: "Customer Ops Manager", nodeId: "logs-project-overview" },
      { persona: "Customer Ops Manager", nodeId: "logs-project-dashboard" },
      { persona: "Customer Ops Manager", nodeId: "logs-project-controls-rounds" },
      { persona: "Customer Ops Manager", nodeId: "logs-project-logs" },
      { persona: "Customer Ops Manager", nodeId: "logs-project-log-data-viewer" },
      { persona: "Customer Ops Manager", nodeId: "logs-project-history" },
      { persona: "Customer Ops Manager", nodeId: "logs-assets-list" },
      { persona: "Customer Ops Manager", nodeId: "logs-floorplans-list" },
      { persona: "Customer Ops Manager", nodeId: "logs-mobile-projects" },
      { persona: "Customer Ops Manager", nodeId: "logs-mobile-notifications" },

      // Customer Operator — mobile-focused
      { persona: "Customer Operator", nodeId: "logs-mobile-push" },
      { persona: "Customer Operator", nodeId: "logs-mobile-projects" },
      { persona: "Customer Operator", nodeId: "logs-mobile-project-overview" },
      { persona: "Customer Operator", nodeId: "logs-mobile-running" },
      { persona: "Customer Operator", nodeId: "logs-mobile-notifications" },
      { persona: "Customer Operator", nodeId: "logs-mobile-logs-list" },
      { persona: "Customer Operator", nodeId: "logs-mobile-log-step" },
      { persona: "Customer Operator", nodeId: "logs-mobile-log-history" },
      { persona: "Customer Operator", nodeId: "logs-mobile-round-status" },
      { persona: "Customer Operator", nodeId: "logs-mobile-projects-badge" },
      { persona: "Customer Operator", nodeId: "logs-mobile-logs-badge" },
      { persona: "Customer Operator", nodeId: "logs-mobile-logs-notification" },
      { persona: "Customer Operator", nodeId: "logs-mobile-log-step-alt" },
      { persona: "Customer Operator", nodeId: "logs-mobile-assets-floorplan" },

      // External Auditor — read-only desktop
      { persona: "External Auditor", nodeId: "logs-project-log-data-viewer" },
      { persona: "External Auditor", nodeId: "logs-project-history" },
      { persona: "External Auditor", nodeId: "logs-project-logs" },
      { persona: "External Auditor", nodeId: "logs-project-logs-alt" },

      // OPPR Admin — platform oversight
      { persona: "OPPR Admin", nodeId: "logs-home-dashboard" },
      { persona: "OPPR Admin", nodeId: "logs-projects-list" },
      { persona: "OPPR Admin", nodeId: "logs-project-overview" },
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
      // Lane 1: Desktop Entry
      {
        nodeId: "logs-home-dashboard",
        authorName: "UX Analyst",
        text: "Home Dashboard is the primary landing page after login. Shows a welcome banner with 'First time login' indicator, a stats card showing log count (7 logs), Quick Actions panel, and a Recent Activity feed. The left sidebar has two-level navigation: main app level (Home, Projects, Analytics, Libraries, User Management, Role Management). Clean layout but the Recent Activity section appears to use placeholder text. The 'Get Started' CTA button has no tooltip explaining where it leads. Recommendation: add a setup checklist for first-time users (create project → add logs → invite team → configure schedule).",
      },
      {
        nodeId: "logs-home-libraries",
        authorName: "UX Analyst",
        text: "The Libraries panel on the Home Dashboard shows expandable sections for Logs, Assets, and HMI Templates. Libraries are cross-project reusable templates — they live at the organization level, not the project level. The distinction between 'Library' items (org-level templates) and 'Project' items (project-level instances) is not clearly communicated. A user might create a log in a project and expect it to appear in the library, or vice versa. Need a clear 'Import from Library' / 'Save to Library' workflow.",
      },
      {
        nodeId: "logs-projects-list",
        authorName: "UX Analyst",
        text: "Projects List shows project cards with name, status, member count, and timestamps. The green status badge shows 'Active' with clear visual treatment. Missing: no indication of pending rounds or overdue schedules per project. An Ops Manager scanning this page can't tell which projects need attention without clicking into each one. Add 'Pending Rounds' and 'Overdue' badges to project cards.",
      },
      {
        nodeId: "logs-project-overview",
        authorName: "UX Analyst",
        text: "Project Overview is the hub for all project-level navigation. Sidebar switches to project context with 12 items: Overview, Dashboard, Controls, Logs, Log Data Viewer, Floor Plans, Assets, HMI Templates, Schedules, Members, History, Settings. This is a LOT of navigation items — consider grouping: 'Setup' (Controls, Logs, Assets, Floor Plans, HMI, Schedules) vs 'Monitor' (Dashboard, Log Data Viewer, History) vs 'Manage' (Members, Settings). The overview page itself shows project summary stats and recent activity.",
      },
      {
        nodeId: "logs-project-dashboard",
        authorName: "UX Analyst",
        text: "Project Dashboard shows analytics charts — likely log completion rates, round statistics, and timeline data. This is one of two 'analytics' views (the other being the main 'Analytics' page in the app-level nav). The relationship between project-level Dashboard and app-level Analytics is unclear. If they show similar data at different scopes, the naming should reflect this (e.g., 'Project Analytics' vs 'Organization Analytics').",
      },

      // Lane 2: Configuration
      {
        nodeId: "logs-project-controls",
        authorName: "UX Analyst",
        text: "Project Controls is the central configuration hub for log templates within a project. Shows a list of 'controls' — each control groups multiple log templates together. The concept of a 'Control' is unique to OPPR and not immediately intuitive. A new admin might ask: 'What is a Control vs a Log?' A control is a grouping mechanism (like a checklist category) that contains multiple log templates. This conceptual model needs to be explained in the UI, perhaps with a tooltip or onboarding prompt.",
      },
      {
        nodeId: "logs-project-controls-rounds",
        authorName: "UX Analyst",
        text: "The Rounds view within Controls shows round execution history — each row represents one instance of running through a set of log templates. Columns include round number, status (Done/Pending/Active/Halted/Started), timestamps, and operator. CRITICAL NAMING ISSUE: Desktop sometimes calls these 'sessions' or 'log sessions' while mobile exclusively uses 'Round'. The status badges use color coding but the colors are not explained anywhere. Need a legend or tooltip.",
      },
      {
        nodeId: "logs-schedule-working-hours",
        authorName: "UX Analyst",
        text: "Schedules — Working Hours defines when scheduled rounds can occur. Shows a weekly calendar grid where admins define operational hours (e.g., Mon-Fri 8am-6pm). This determines when push notifications are sent to operators. The interaction model for setting hours isn't immediately clear — is it click-to-toggle, drag-to-select, or form-based? The header says 'Project Schedules' but the sidebar says 'Schedules' — inconsistent naming.",
      },
      {
        nodeId: "logs-schedule-standard",
        authorName: "UX Analyst",
        text: "Standard Schedule shows predefined schedule templates (daily, weekly, monthly). These are the most common scheduling patterns. The distinction between 'Standard' and 'Custom' is clear conceptually but the visual treatment is identical — both are tabs within the Schedules page. Consider: should 'Standard' be renamed to 'Templates' and 'Custom' to 'Manual'? This would better communicate that standard schedules are pre-built patterns while custom ones are user-defined.",
      },
      {
        nodeId: "logs-schedule-custom",
        authorName: "UX Analyst",
        text: "Custom Schedule allows admins to create one-off or irregular schedules that don't fit standard patterns. The 'Schedule Tasks' label appears here — a third name for what is fundamentally a 'scheduled round'. The admin is configuring WHEN rounds should happen and WHO should receive notifications. The connection between schedule → notification → mobile app is not visualized anywhere in the UI. Need a 'Preview next notification' feature.",
      },
      {
        nodeId: "logs-project-members",
        authorName: "UX Analyst",
        text: "Project Members shows the team assigned to this project with their roles and access levels. Same dual-role system as IAM: Project Role (owner/admin) + System Role (Super Admin/user). The 'Access Level' column shows 'full' vs 'standard' with permission counts. SAME BUG AS IAM: 'full' access has fewer listed permissions than 'standard' access — counterintuitive naming. An admin cannot see WHAT the permissions actually are, only the count.",
      },
      {
        nodeId: "logs-project-settings",
        authorName: "UX Analyst",
        text: "Project Settings page with general configuration (name, description, timeline, timezone), read-only project info, and Danger Zone (Delete/Archive). The Danger Zone styling uses red for both Delete and Archive buttons — Archive is reversible and should be visually softer (amber/yellow). No 'last modified by' indicator on settings. No version history for setting changes. Missing: project-level notification preferences (who gets notified for what events).",
      },

      // Lane 3: Logs & Data
      {
        nodeId: "logs-project-logs",
        authorName: "UX Analyst",
        text: "Project Logs shows the list of log templates configured for this project. Each log template defines the steps (questions/checks) that operators complete during a round. The 'Log Name' column header differs from the 'Title' column in the Logs Library — same data, different label. The status indicators show which logs are active vs. draft vs. archived. Missing: no way to preview a log template's steps from this list view. Admins must open each log individually to see its contents.",
      },
      {
        nodeId: "logs-project-logs-alt",
        authorName: "UX Analyst",
        text: "Log detail/alternate view showing a different state of the project logs screen — likely with a selected log showing its configuration or expanded details. The step configuration for each log template is where admins define what operators will fill out in the field. Step types likely include: text input, number, checkbox, photo capture, signature. Each step can be required or optional. The relationship between Steps (template) and Responses (completed data) is the core data model.",
      },
      {
        nodeId: "logs-project-log-data-viewer",
        authorName: "UX Analyst",
        text: "Log Data Viewer is the analytics powerhouse — where admins and auditors review completed round data. Shows tabular data with filtering, sorting, and likely export capabilities. This is where mobile-submitted data lands after sync. Key question: does this show raw responses or aggregated analytics? If raw, it's a 'Data Explorer'. If aggregated, it's a 'Dashboard'. The name 'Log Data Viewer' is functional but generic. Consider 'Round Results' or 'Response Explorer' for clarity.",
      },
      {
        nodeId: "logs-project-history",
        authorName: "UX Analyst",
        text: "Project History shows the activity audit trail — who did what, when. This overlaps conceptually with the app-level 'Analytics' page and the project 'Dashboard'. Three screens showing historical/analytical data creates confusion about where to look for what. History = activity log (user actions). Dashboard = visual analytics (charts). Log Data Viewer = raw data. This distinction needs to be clearer in the navigation naming. Consider renaming History to 'Activity Log'.",
      },
      {
        nodeId: "logs-project-history",
        authorName: "External Auditor",
        text: "From a compliance perspective, the History/Activity Log needs to capture: who accessed what data, all configuration changes (schedule modifications, member additions/removals, log template edits), round completions with timestamps, and data exports. The current view appears to show basic activity but may not capture the granularity needed for regulatory compliance (ISO 9001, GMP). Need: filterable date ranges, exportable to PDF with digital signatures, tamper-evident audit trail.",
      },

      // Lane 4: Assets & Floor Plans
      {
        nodeId: "logs-assets-list",
        authorName: "UX Analyst",
        text: "Assets List View shows all assets (equipment, machinery, systems) configured for the project in a flat table. Columns include name, type, status, and associated logs. An asset can be 'connected' to floor plans and 'attached' to log templates. NAMING ISSUE: the connection terminology varies — 'No log connected' in Floor Plans vs 'No log attached' in Assets. Both mean the same thing. The list view is functional but with many assets (the test project shows 9), pagination will be needed. No bulk operations visible.",
      },
      {
        nodeId: "logs-assets-hierarchy",
        authorName: "UX Analyst",
        text: "Assets Hierarchy View shows the same assets in a tree structure, revealing parent-child relationships (e.g., Building → Floor → Room → Equipment). This is a powerful view for understanding asset topology but the tree rendering could benefit from expand/collapse icons and a search/filter. The switch between List and Hierarchy views is via a toggle — good pattern. Missing: drag-and-drop to restructure the hierarchy, and a 'move asset' action to reassign parents.",
      },
      {
        nodeId: "logs-floorplans-list",
        authorName: "UX Analyst",
        text: "Floor Plans List shows uploaded floor plan images for the project. Each floor plan is a visual map with interactive asset pins. The list shows thumbnail previews, floor plan names, and asset counts. NAMING ISSUE: 'Floor Plan' vs 'Floorplan' vs 'floorplan' appears in different contexts. Standardize to 'Floor Plan' (two words). The upload interaction should support PDF and image formats. Missing: floor plan versioning (when plans change, keep history).",
      },
      {
        nodeId: "logs-floorplan-detail",
        authorName: "UX Analyst",
        text: "Floor Plan Detail shows the full floor plan image with interactive asset pins/markers. Each pin represents an asset positioned on the physical floor plan. Clicking a pin opens the asset detail modal. The pin interaction is critical for field operators using the mobile app — they need to quickly find and identify assets on-site. Pin colors should indicate asset status (active/inactive/needs-attention). Current implementation may show all pins identically.",
      },
      {
        nodeId: "logs-floorplan-modal",
        authorName: "UX Analyst",
        text: "Floor Plan Asset Modal appears when clicking an asset pin on the floor plan. Shows asset details: name, type, associated logs, and status. From here, users can navigate to the asset's log data or start a round focused on this specific asset. The modal should show quick-access actions: 'Start Round for this Asset', 'View Last Response', 'View Asset History'. If no log is connected, the empty state says 'No log connected' — should match the Assets list terminology.",
      },
      {
        nodeId: "logs-floorplan-connected",
        authorName: "UX Analyst",
        text: "Floor Plan Connected Assets view shows the relationship between a floor plan and its positioned assets. This is a list/sidebar view alongside the floor plan, making it easier to see which assets are placed and which are 'unplaced' (exist in the project but not positioned on any floor plan). Missing: a way to batch-place unpositioned assets and a 'coverage map' showing which areas of the floor plan have no asset coverage.",
      },

      // Lane 5: Libraries & HMI
      {
        nodeId: "logs-hmi-templates",
        authorName: "UX Analyst",
        text: "Project HMI Templates shows Human-Machine Interface templates configured for the project. HMI templates define how operators interact with equipment through the mobile app — they can include gauges, controls, readings, and visual indicators. The breadcrumb shows 'Hmi Templates' (lowercase 'mi') while the heading uses 'HMI Templates' — casing inconsistency. HMI is a specialized feature that may not apply to all customers; consider feature-flagging it.",
      },
      {
        nodeId: "logs-hmi-library",
        authorName: "UX Analyst",
        text: "HMI Templates Library is the org-level repository of HMI templates that can be imported into projects. Shows reusable templates with preview thumbnails, template names, and usage counts. The Library → Project import flow should be one-click: select a template in the library → 'Import to Project' button. Currently unclear if templates are copied (independent after import) or linked (changes propagate). Org-level libraries are powerful for standardization across multiple projects.",
      },
      {
        nodeId: "logs-assets-library",
        authorName: "UX Analyst",
        text: "Assets Library at the org level. Shows reusable asset type definitions that can be imported into projects. This is useful for organizations with standardized equipment across sites — define the asset type once, import into each project. The 'Title' column header here may differ from 'Name' in the project-level Assets view — another subtle naming inconsistency. Consider asset versioning: when the library template is updated, should existing project instances be notified?",
      },
      {
        nodeId: "logs-logs-library",
        authorName: "UX Analyst",
        text: "Logs Library at the org level. Shows reusable log templates with 'Title' column header (vs 'Log Name' in project). Each library log template defines steps, step types, and default configurations. This is the master template repository. NAMING: 'Title' here vs 'Log Name' in project context. The same log template appears as 'Title: Safety Checklist' in the library and 'Log Name: Safety Checklist' in the project. Standardize column headers across library and project views.",
      },

      // Lane 6: Mobile Main Flow
      {
        nodeId: "logs-mobile-push",
        authorName: "UX Analyst",
        text: "Push Notification is the primary entry point for field operators. When a scheduled round is due, the system sends a push notification to assigned operators' mobile devices. The notification shows the project name, log name, and urgency. Tapping opens the app. This is the critical desktop→mobile handoff point. Quality of the notification text directly impacts whether operators engage quickly. Need: customizable notification templates, snooze option, escalation if not acknowledged within X minutes.",
      },
      {
        nodeId: "logs-mobile-push",
        authorName: "Product Manager",
        text: "Push notifications are our primary user engagement mechanism for field operators. Metrics to track: notification-to-open time, notification-to-completion time, missed/ignored notification rate. If operators consistently ignore notifications, it might indicate: (1) too many notifications (notification fatigue), (2) notifications arrive at inconvenient times (schedule misconfiguration), or (3) the notification text is not informative enough. We need a notification analytics dashboard.",
      },
      {
        nodeId: "logs-mobile-projects",
        authorName: "UX Analyst",
        text: "Mobile Projects List is the home screen after login. Shows project cards with name, status, and pending round indicators. The bottom navigation has 6 tabs: Projects, Logs, History, Notifications, Scan, Profile. The 'Scan' tab for QR code scanning of assets is a differentiated feature for field use. Design is clean with card-based layout. Missing: pull-to-refresh gesture, offline indicator, and sorting options (by urgency, by name, by recent activity).",
      },
      {
        nodeId: "logs-mobile-project-overview",
        authorName: "UX Analyst",
        text: "Mobile Project Overview shows project summary with quick-access buttons for common actions. The information hierarchy matches the desktop equivalent but is optimized for mobile viewport. Shows assets count (9), logs count (6), and team members. The 'Start' button to begin a round is prominent. NAMING: Desktop uses 'Start Round' while this may just show 'Start' or 'Execute' — verify consistency. Operators need to see: what's due now, what's overdue, what was last completed.",
      },
      {
        nodeId: "logs-mobile-running",
        authorName: "UX Analyst",
        text: "Mobile Running state shows an active round in progress. The UI transforms to focus on the current task — showing which log template is active, which step the operator is on, and progress through the round. The green 'running' indicator is clear. This is where operators spend most of their time. Key UX needs: large tap targets for field use (gloves, outdoor light), step progress indicator, ability to skip optional steps, photo/signature capture inline, and CRITICAL: save-as-you-go (don't lose work if the app crashes or loses connection).",
      },
      {
        nodeId: "logs-mobile-notifications",
        authorName: "UX Analyst",
        text: "Mobile Notifications Screen shows the in-app notification center. Separate from push notifications — this is the inbox within the app. Shows round assignments, schedule reminders, and possibly team messages. Each notification is tappable to navigate directly to the relevant log/round. Need: read/unread indicators, batch 'mark all read', notification grouping by project, and a filter for notification type (assignments vs reminders vs alerts).",
      },
      {
        nodeId: "logs-mobile-logs-list",
        authorName: "UX Analyst",
        text: "Mobile Logs List shows all log templates accessible to the operator for the current project. Each log shows name, status (Done/Pending/Active/Halted/Started), and the number of steps. The status color coding uses: green (Done), yellow (Pending), blue (Active), red (Halted), gray (Started). These 5 statuses might be too many for operators to internalize. Consider simplifying to 3: Not Started, In Progress, Complete. The distinction between 'Pending' and 'Started' and 'Active' is subtle and likely confuses field workers.",
      },
      {
        nodeId: "logs-mobile-log-step",
        authorName: "UX Analyst",
        text: "Mobile Log Step View is where the actual data entry happens. The operator sees one step at a time (or a scrollable list of steps). Each step has a question/instruction, input field (type varies: text, number, checkbox, photo, signature), and optional notes. This is the most critical screen in the entire app — it's where field data is captured. UX priorities: (1) large input fields for gloved hands, (2) clear 'required' indicators, (3) auto-save every entry, (4) offline-capable data capture, (5) camera integration for photo steps, (6) previous response as reference for comparison.",
      },
      {
        nodeId: "logs-mobile-log-history",
        authorName: "UX Analyst",
        text: "Mobile Log History shows completed rounds for a specific log template. Each entry shows the round date, status, completion time, and operator. Tapping opens the completed round's responses in read-only mode. This is useful for operators to verify their submissions and for supervisors doing spot-checks in the field. Missing: trend indicators (e.g., 'this reading has been increasing over the last 5 rounds'), comparison view between rounds, and export/share functionality.",
      },

      // Lane 7: Mobile Additional
      {
        nodeId: "logs-mobile-round-status",
        authorName: "UX Analyst",
        text: "Mobile Round Status Detail shows the progress of a specific round — which log templates have been completed, which are pending, and overall percentage. This is a supervision screen that Ops Managers use to track field progress. The progress bar and status badges provide quick visual feedback. Missing: estimated completion time, ability to reassign a pending log to a different operator, and a 'nudge' button to send a reminder notification to the assigned operator.",
      },
      {
        nodeId: "logs-mobile-projects-badge",
        authorName: "UX Analyst",
        text: "Projects tab with badge count shows unacknowledged notifications or pending rounds per project. The badge number on the bottom tab draws attention to projects needing action. Standard mobile pattern, well-implemented. The badge should reset when the user views the project (not when they complete the round — viewing acknowledges awareness). Consider badge priority: red badge for overdue rounds, normal badge for upcoming rounds.",
      },
      {
        nodeId: "logs-mobile-logs-badge",
        authorName: "UX Analyst",
        text: "Logs tab with badge count shows the total number of pending/active logs across all projects. This aggregated view is useful for operators assigned to multiple projects. The badge serves as a quick 'inbox count' — how many things need my attention right now? Important: the badge count should only show items assigned to the current user, not all pending logs in the system.",
      },
      {
        nodeId: "logs-mobile-logs-notification",
        authorName: "UX Analyst",
        text: "Logs List accessed via notification tap — potentially showing a filtered view focused on the specific log/round that triggered the notification. This is an alternate entry path: notification → directly to the relevant log, bypassing the project selection step. Good UX pattern that reduces navigation steps for urgent tasks. Verify: does tapping the notification deep-link to the exact step that needs attention, or just to the log list? Deep-linking would be ideal.",
      },
      {
        nodeId: "logs-mobile-log-step-alt",
        authorName: "UX Analyst",
        text: "Log Step alternate view showing a completed response rather than an empty form. This is the 'review' mode where operators or supervisors see previously submitted data. The distinction between 'Steps' (template/empty) and 'Responses' (completed/data) is handled by showing the same UI layout with data filled in. Good for consistency. Missing: ability to flag a response as 'needs review', edit capability for corrections (with audit trail), and photo zoom for submitted images.",
      },
      {
        nodeId: "logs-mobile-assets-floorplan",
        authorName: "UX Analyst",
        text: "Mobile Assets Floor Plan shows the floor plan with asset pins, optimized for mobile viewport. Field operators use this to locate assets physically — scan the floor plan to find where they need to go, then tap the asset pin for details. This is a unique differentiator for OPPR — merging physical location awareness with digital log workflows. Mobile-specific needs: pinch-to-zoom, GPS overlay (if indoor positioning is available), asset search with 'navigate to' highlighting, and quick-action to start a round for the selected asset.",
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
    // REPORT 1: TERMINOLOGY GLOSSARY
    // ====================================================================
    await ctx.db.insert("reports", {
      boardId,
      title: "Terminology Glossary — OPPR Logs Platform",
      summary:
        "Comprehensive glossary of all terms used across the OPPR Logs platform (desktop + mobile). " +
        "Documents 35+ terms, their definitions, where they appear, and 9 naming inconsistencies " +
        "that need resolution for a consistent user experience.",
      content:
        "## Terminology Glossary\n\n" +
        "### Core Entities\n\n" +
        "| Term | Definition | Where Used |\n" +
        "|------|-----------|------------|\n" +
        "| **Project** | Top-level container for all operational data. Has its own members, settings, logs, assets, and schedules. | Desktop sidebar, Mobile projects tab |\n" +
        "| **Log** / **Log Template** | A template defining a set of steps (questions/checks) that operators complete. | Desktop: 'Project Logs', Library: 'Logs Library' |\n" +
        "| **Step** | A single question/check within a log template. Defines what data to capture. | Desktop: log template editor, Mobile: step view |\n" +
        "| **Response** | A completed step — the data submitted by an operator. | Mobile: completed round view |\n" +
        "| **Round** | One execution instance of a control's log templates. Assigned to an operator. | Mobile: primary term. Desktop: sometimes 'session' |\n" +
        "| **Control** | A grouping of log templates. Organizes related logs that are executed together as a round. | Desktop: 'Project Controls' |\n" +
        "| **Asset** | Physical equipment, machinery, or location tracked in the system. Can be positioned on floor plans. | Desktop: 'Assets', Mobile: 'Assets' tab |\n" +
        "| **Floor Plan** | Visual map (image/PDF) showing physical layout with interactive asset pins. | Desktop: 'Floor Plans', Mobile: 'Assets Floor Plan' |\n" +
        "| **Schedule** | Configuration defining when rounds are triggered (working hours + recurrence pattern). | Desktop: 'Schedules' / 'Project Schedules' |\n" +
        "| **HMI Template** | Human-Machine Interface template for operator-equipment interaction. | Desktop: 'HMI Templates' |\n\n" +
        "### Status Terms\n\n" +
        "| Term | Definition | Where Used |\n" +
        "|------|-----------|------------|\n" +
        "| **Done** | Round/log fully completed and submitted. | Mobile: green badge |\n" +
        "| **Pending** | Round/log assigned but not yet started. | Mobile: yellow badge |\n" +
        "| **Active** | Round/log currently being worked on. | Mobile: blue badge |\n" +
        "| **Halted** | Round/log paused mid-execution. | Mobile: red badge |\n" +
        "| **Started** | Round/log begun but not actively being worked on. | Mobile: gray badge |\n\n" +
        "### Navigation Terms\n\n" +
        "| Term | Definition | Where Used |\n" +
        "|------|-----------|------------|\n" +
        "| **Home** | Main landing page with dashboard and quick actions. | Desktop sidebar |\n" +
        "| **Dashboard** | Analytics/summary view with charts and KPIs. | Desktop: project context |\n" +
        "| **History** | Activity/audit log showing who did what, when. | Desktop sidebar, Mobile bottom tab |\n" +
        "| **Library** | Org-level repository of reusable templates (Logs, Assets, HMI). | Desktop sidebar (expandable) |\n" +
        "| **Analytics** | App-level reporting and metrics. | Desktop sidebar (main app) |\n" +
        "| **Scan** | QR code scanner for quick asset identification in the field. | Mobile bottom tab |\n\n" +
        "### Access & Role Terms\n\n" +
        "| Term | Definition | Where Used |\n" +
        "|------|-----------|------------|\n" +
        "| **Project Role** | Role within a specific project (owner, admin). | Desktop: Project Members |\n" +
        "| **System Role** | Organization-level role (Super Admin, user). | Desktop: User Management |\n" +
        "| **Access Level** | Combined permission set (full, standard). | Desktop: Project Members |\n" +
        "| **Entitlement** | Product-level access (Logs, IDA). | Admin Portal: Companies |\n\n" +
        "---\n\n" +
        "## Naming Inconsistencies Found\n\n" +
        "### 1. 'Title' vs 'Log Name' (HIGH)\n" +
        "- **Logs Library** uses column header **'Title'**\n" +
        "- **Project Logs** uses column header **'Log Name'**\n" +
        "- Both refer to the same field on the same entity\n" +
        "- **Recommendation:** Standardize to **'Log Name'** everywhere (it's more specific)\n\n" +
        "### 2. 'History' vs 'Project Analytics' (MEDIUM)\n" +
        "- Sidebar: **'History'**\n" +
        "- Page may show as: **'Project Analytics'** or **'Activity Log'**\n" +
        "- Overlap with project **'Dashboard'** (also analytics)\n" +
        "- **Recommendation:** Rename to **'Activity Log'** to distinguish from Dashboard analytics\n\n" +
        "### 3. 'No log connected' vs 'No log attached' (MEDIUM)\n" +
        "- Floor Plan asset tooltips: **'No log connected'**\n" +
        "- Assets list: **'No log attached'**\n" +
        "- Both mean 'this asset has no associated log template'\n" +
        "- **Recommendation:** Standardize to **'No log linked'** (neutral, clear)\n\n" +
        "### 4. 'Hmi' vs 'HMI' (LOW)\n" +
        "- Breadcrumb: **'Hmi Templates'** (wrong casing)\n" +
        "- Page heading: **'HMI Templates'** (correct)\n" +
        "- **Recommendation:** Fix breadcrumb rendering to use **'HMI'** (all caps acronym)\n\n" +
        "### 5. 'Floor Plan' vs 'Floorplan' vs 'floorplan' (LOW)\n" +
        "- Sidebar: **'Floor Plans'** (two words, correct)\n" +
        "- Some labels: **'Floorplan'** (one word)\n" +
        "- URLs/code: **'floorplan'** (lowercase)\n" +
        "- **Recommendation:** User-facing text: **'Floor Plan'**. Code/URLs: **'floor-plan'**\n\n" +
        "### 6. 'Steps' vs 'Responses' (MEDIUM)\n" +
        "- Log templates define **'Steps'** (the questions)\n" +
        "- Completed rounds show **'Responses'** (the answers)\n" +
        "- Connection between them is not explained in UI\n" +
        "- **Recommendation:** Add contextual subtitle: 'Steps (N responses submitted)'\n\n" +
        "### 7. 'Schedule Tasks' vs 'Schedules' vs 'Project Schedules' (MEDIUM)\n" +
        "- Sidebar: **'Schedules'**\n" +
        "- Page heading: **'Project Schedules'**\n" +
        "- Configuration: **'Schedule Tasks'**\n" +
        "- **Recommendation:** Use **'Schedules'** everywhere. Drop 'Project' prefix (already in project context)\n\n" +
        "### 8. Desktop 'Log Session' vs Mobile 'Round' (HIGH)\n" +
        "- Desktop Controls: sometimes **'session'** or **'log session'**\n" +
        "- Mobile: exclusively **'Round'**\n" +
        "- **Recommendation:** Standardize to **'Round'** everywhere\n\n" +
        "### 9. Desktop 'Start' vs Mobile 'Execute' (MEDIUM)\n" +
        "- Desktop round initiation: **'Start Round'**\n" +
        "- Mobile round initiation: **'Execute'**\n" +
        "- **Recommendation:** Standardize to **'Start Round'** on both platforms\n",
      findings: [
        {
          type: "terminology",
          severity: "high",
          description: "'Title' (Library) vs 'Log Name' (Project) — same field, different column headers across views.",
          affectedNodes: ["logs-project-logs", "logs-logs-library"],
        },
        {
          type: "terminology",
          severity: "high",
          description: "Desktop 'Log Session'/'session' vs Mobile 'Round' — same concept with different names across platforms.",
          affectedNodes: ["logs-project-controls-rounds", "logs-mobile-running", "logs-mobile-round-status"],
        },
        {
          type: "terminology",
          severity: "medium",
          description: "'No log connected' (Floor Plans) vs 'No log attached' (Assets) — inconsistent verbs for asset-log association.",
          affectedNodes: ["logs-floorplan-connected", "logs-assets-list"],
        },
        {
          type: "terminology",
          severity: "medium",
          description: "'Steps' (template) vs 'Responses' (completed) — no UI explanation of the relationship between these terms.",
          affectedNodes: ["logs-mobile-log-step", "logs-mobile-log-step-alt"],
        },
        {
          type: "terminology",
          severity: "medium",
          description: "'Schedule Tasks' vs 'Schedules' vs 'Project Schedules' — three names for the scheduling feature.",
          affectedNodes: ["logs-schedule-working-hours", "logs-schedule-standard", "logs-schedule-custom"],
        },
        {
          type: "terminology",
          severity: "medium",
          description: "Desktop 'Start Round' vs Mobile 'Execute' — different action labels for the same operation.",
          affectedNodes: ["logs-project-controls-rounds", "logs-mobile-running"],
        },
        {
          type: "terminology",
          severity: "medium",
          description: "'History' page overlaps with 'Dashboard' analytics and app-level 'Analytics' — three views for historical data.",
          affectedNodes: ["logs-project-history", "logs-project-dashboard"],
        },
        {
          type: "terminology",
          severity: "low",
          description: "'Hmi' (breadcrumb) vs 'HMI' (heading) — acronym casing inconsistency.",
          affectedNodes: ["logs-hmi-templates"],
        },
        {
          type: "terminology",
          severity: "low",
          description: "'Floor Plan' vs 'Floorplan' vs 'floorplan' — three spellings across UI contexts.",
          affectedNodes: ["logs-floorplans-list", "logs-floorplan-detail"],
        },
      ],
      createdAt: now,
    });

    // ====================================================================
    // REPORT 2: GAP ANALYSIS
    // ====================================================================
    await ctx.db.insert("reports", {
      boardId,
      title: "UX Gap Analysis — OPPR Logs Platform",
      summary:
        "Comprehensive gap analysis of the OPPR Logs platform across desktop and mobile. " +
        "Identified 12 findings spanning navigation confusion, missing empty states, mobile offline gaps, " +
        "cross-platform inconsistencies, and scalability concerns for enterprise deployments.",
      content:
        "## Executive Summary\n\n" +
        "The OPPR Logs platform provides a comprehensive workflow management system spanning desktop configuration " +
        "and mobile field operations. The core flow — schedule → notification → round → data entry → review — is " +
        "well-structured. However, the platform suffers from terminology fragmentation (9 naming inconsistencies " +
        "documented in the Glossary report), missing empty states, unclear analytics overlap, and no visible " +
        "offline support for the mobile app despite being designed for field use.\n\n" +

        "## Critical Gaps\n\n" +

        "### 1. Cross-Platform Terminology Mismatch (Critical)\n" +
        "The most impactful issue: key concepts have different names on desktop vs mobile. " +
        "'Round' (mobile) vs 'Session' (desktop), 'Start' (desktop) vs 'Execute' (mobile), " +
        "'Title' (library) vs 'Log Name' (project). See Terminology Glossary for full list. " +
        "This directly impacts training, documentation, and support ticket resolution.\n\n" +

        "### 2. No Visible Offline Support (Critical)\n" +
        "Field operators work in basements, industrial facilities, and remote sites with poor connectivity. " +
        "The mobile app shows no offline indicator, no sync status, and no queued-submission feedback. " +
        "If data is lost because of a connection drop during round completion, operators lose trust in the app. " +
        "Need: offline-first architecture, sync queue indicator, 'saved locally' confirmations.\n\n" +

        "### 3. Five Log Statuses Are Too Many (High)\n" +
        "Mobile uses 5 statuses: Done, Pending, Active, Halted, Started. " +
        "The distinction between 'Pending', 'Started', and 'Active' is unclear to field operators. " +
        "'Halted' implies external intervention but has no explanation. " +
        "Simplify to 3: Not Started, In Progress, Complete. Add 'Paused' only if truly needed.\n\n" +

        "### 4. Analytics View Confusion (High)\n" +
        "Three screens show historical/analytical data: Project Dashboard (charts), " +
        "Project History (activity log), and Log Data Viewer (raw data). " +
        "Plus an app-level Analytics page. Users don't know where to look for what. " +
        "Need clear naming: 'Dashboard' (visual KPIs), 'Activity Log' (audit trail), 'Data Explorer' (raw data).\n\n" +

        "### 5. Missing Empty States (High)\n" +
        "New projects with no logs, assets, or floor plans show blank screens. " +
        "No illustrations, no 'Get Started' CTAs, no links to configuration pages. " +
        "First-time users hit a wall. Every empty screen needs: illustration + explanation + CTA button.\n\n" +

        "### 6. Project Navigation Overload (Medium)\n" +
        "12 items in the project sidebar is too many to scan quickly. " +
        "Group into sections: Setup (Controls, Logs, Assets, Floor Plans, HMI, Schedules), " +
        "Monitor (Dashboard, Log Data Viewer, History), Manage (Members, Settings). " +
        "Add collapsible section headers.\n\n" +

        "### 7. Desktop → Mobile Handoff Invisible (Medium)\n" +
        "Admins configure schedules on desktop but have no way to preview what the operator will see on mobile. " +
        "No 'Preview notification' feature, no 'Test push' button, no mobile mockup in the schedule config. " +
        "Admins configure blindly and hope the notification makes sense to operators.\n\n" +

        "### 8. No Bulk Operations (Medium)\n" +
        "Asset management, log configuration, and member management all lack multi-select and bulk actions. " +
        "With 9 assets this is manageable. With 50+ assets (enterprise), individual operations become a bottleneck.\n\n" +

        "### 9. Library ↔ Project Relationship Unclear (Medium)\n" +
        "Users don't understand the relationship between Library items (org-level templates) and " +
        "Project items (project instances). Is it a copy? A link? If the library template is updated, " +
        "does the project instance change? Need explicit 'Import from Library' and 'Save to Library' actions " +
        "with clear explanation of copy semantics.\n\n" +

        "### 10. Access Level Paradox (Medium)\n" +
        "Same issue as IAM: Project Members shows 'Access: full / 4 permissions' for owners but " +
        "'Access: standard / 8 permissions' for admins. 'Full' should mean MORE, not fewer. " +
        "Either the naming or the permission model needs fixing.\n\n" +

        "### 11. No Floor Plan Versioning (Low)\n" +
        "Floor plans change as facilities are modified. Current system appears to support only one version. " +
        "When a floor plan is updated, the old layout is lost. Need versioned floor plans with date stamps.\n\n" +

        "### 12. Badge Count Ambiguity (Low)\n" +
        "Mobile badge counts on Projects and Logs tabs show numbers, but it's unclear what they count. " +
        "Pending rounds? Notifications? Overdue items? The badge number needs a tooltip or long-press explanation.\n\n" +

        "## Prioritized Recommendations\n\n" +
        "1. **Immediate:** Fix all 9 naming inconsistencies (see Glossary report). Low effort, high impact.\n" +
        "2. **Sprint 1:** Add offline support indicators and save-locally confirmations in mobile app.\n" +
        "3. **Sprint 1:** Simplify log statuses from 5 to 3 (Not Started, In Progress, Complete).\n" +
        "4. **Sprint 2:** Add empty states to all configuration screens with contextual CTAs.\n" +
        "5. **Sprint 2:** Group project sidebar navigation into collapsible sections.\n" +
        "6. **Sprint 3:** Add 'Preview as operator' feature to schedule configuration.\n" +
        "7. **Sprint 3:** Implement bulk operations for assets, logs, and members.\n" +
        "8. **Backlog:** Floor plan versioning, badge tooltip explanations, analytics view consolidation.\n",
      findings: [
        {
          type: "inconsistency",
          severity: "critical",
          description: "Cross-platform terminology mismatch: 9 naming inconsistencies between desktop and mobile (Round/Session, Start/Execute, Title/Log Name, etc.).",
          affectedNodes: ["logs-project-controls-rounds", "logs-mobile-running", "logs-project-logs", "logs-logs-library"],
        },
        {
          type: "missing-feature",
          severity: "critical",
          description: "No visible offline support in mobile app. Field operators in low-connectivity areas risk data loss.",
          affectedNodes: ["logs-mobile-log-step", "logs-mobile-running"],
        },
        {
          type: "complexity",
          severity: "high",
          description: "Five log statuses (Done/Pending/Active/Halted/Started) are too many for field operators to understand.",
          affectedNodes: ["logs-mobile-logs-list", "logs-mobile-round-status"],
        },
        {
          type: "navigation",
          severity: "high",
          description: "Three analytics views (Dashboard, History, Log Data Viewer) cause confusion about where to find data.",
          affectedNodes: ["logs-project-dashboard", "logs-project-history", "logs-project-log-data-viewer"],
        },
        {
          type: "missing-feature",
          severity: "high",
          description: "Missing empty states on configuration screens — new users see blank pages with no guidance.",
          affectedNodes: ["logs-project-logs", "logs-floorplans-list", "logs-assets-list"],
        },
        {
          type: "navigation",
          severity: "medium",
          description: "12 items in project sidebar with no grouping. Needs collapsible sections (Setup/Monitor/Manage).",
          affectedNodes: ["logs-project-overview"],
        },
        {
          type: "missing-feature",
          severity: "medium",
          description: "No 'Preview notification' or 'Test push' in schedule configuration. Admins configure blindly.",
          affectedNodes: ["logs-schedule-custom", "logs-mobile-push"],
        },
        {
          type: "scalability",
          severity: "medium",
          description: "No bulk operations for assets, logs, or members. Won't scale to enterprise deployments.",
          affectedNodes: ["logs-assets-list", "logs-project-logs", "logs-project-members"],
        },
        {
          type: "missing-feature",
          severity: "medium",
          description: "Library ↔ Project relationship (copy vs link) not explained. Users don't know if changes propagate.",
          affectedNodes: ["logs-logs-library", "logs-assets-library", "logs-hmi-library"],
        },
        {
          type: "bug",
          severity: "medium",
          description: "Access Level paradox: 'full' shows 4 permissions, 'standard' shows 8. Naming contradicts numbers.",
          affectedNodes: ["logs-project-members"],
        },
        {
          type: "missing-feature",
          severity: "low",
          description: "No floor plan versioning. Facility layout changes overwrite the previous version.",
          affectedNodes: ["logs-floorplans-list", "logs-floorplan-detail"],
        },
        {
          type: "missing-feature",
          severity: "low",
          description: "Badge counts on mobile tabs are ambiguous — no indication of what the number represents.",
          affectedNodes: ["logs-mobile-projects-badge", "logs-mobile-logs-badge"],
        },
      ],
      createdAt: now + 1,
    });

    return boardId;
  },
});
