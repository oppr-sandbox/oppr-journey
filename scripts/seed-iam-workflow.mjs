#!/usr/bin/env node
/**
 * Seeds the IAM workflow: places admin screenshots on canvas,
 * connects them with labeled edges, and adds text annotations.
 *
 * Usage: node scripts/seed-iam-workflow.mjs <boardId>
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) { console.error("Missing NEXT_PUBLIC_CONVEX_URL"); process.exit(1); }

const boardId = process.argv[2];
if (!boardId) { console.error("Usage: node scripts/seed-iam-workflow.mjs <boardId>"); process.exit(1); }

const client = new ConvexHttpClient(CONVEX_URL);

async function main() {
  console.log("Fetching existing screenshots...");

  // Get all screenshots for this board
  const screenshots = await client.query(api.screenshots.getByBoard, { boardId });

  // Find admin screenshots by label
  const findScreenshot = (label) => {
    const s = screenshots.find((s) => s.label === label);
    if (!s) console.warn(`  WARNING: Screenshot "${label}" not found`);
    return s;
  };

  const dashboard = findScreenshot("Admin Dashboard");
  const companies = findScreenshot("Companies List");
  const customerAdmins = findScreenshot("Customer Super Admins");
  const team = findScreenshot("Team Management");
  const auditLogs = findScreenshot("Audit Logs");

  if (!dashboard || !companies || !customerAdmins || !team || !auditLogs) {
    console.error("Missing admin screenshots. Make sure they are uploaded first.");
    process.exit(1);
  }

  // Layout: Dashboard at top center, Companies left, Team right,
  // Customer Admins below Companies, Audit Logs at bottom center
  const NODE_W = 300;

  const nodes = [
    // Title annotation
    {
      nodeId: "iam-title",
      type: "text",
      position: { x: 280, y: -80 },
      data: { text: "OPPR Admin - IAM Service\nCustomer Journey Flow" },
    },
    // Dashboard - top center
    {
      nodeId: "iam-dashboard",
      type: "screenshot",
      position: { x: 300, y: 0 },
      data: {
        imageUrl: dashboard.url,
        label: "Dashboard (Entry Point)",
        platform: "admin",
        screenshotId: dashboard._id,
      },
      width: NODE_W,
    },
    // Companies - left
    {
      nodeId: "iam-companies",
      type: "screenshot",
      position: { x: 0, y: 350 },
      data: {
        imageUrl: companies.url,
        label: "Companies (Tenants)",
        platform: "admin",
        screenshotId: companies._id,
      },
      width: NODE_W,
    },
    // Team - right
    {
      nodeId: "iam-team",
      type: "screenshot",
      position: { x: 600, y: 350 },
      data: {
        imageUrl: team.url,
        label: "Team (Internal Staff)",
        platform: "admin",
        screenshotId: team._id,
      },
      width: NODE_W,
    },
    // Customer Super Admins - below companies
    {
      nodeId: "iam-customer-admins",
      type: "screenshot",
      position: { x: 0, y: 700 },
      data: {
        imageUrl: customerAdmins.url,
        label: "Customer Super Admins",
        platform: "admin",
        screenshotId: customerAdmins._id,
      },
      width: NODE_W,
    },
    // Audit Logs - bottom center
    {
      nodeId: "iam-audit-logs",
      type: "screenshot",
      position: { x: 300, y: 1050 },
      data: {
        imageUrl: auditLogs.url,
        label: "Audit Logs (Compliance)",
        platform: "admin",
        screenshotId: auditLogs._id,
      },
      width: NODE_W,
    },
    // Annotations
    {
      nodeId: "iam-note-dashboard",
      type: "text",
      position: { x: 680, y: 30 },
      data: { text: "Entry point: shows KPI summary\n- 8 Active Companies\n- 13 Customer Admins\n- 10 OPPR Admins\n- Quick Actions panel" },
    },
    {
      nodeId: "iam-note-companies",
      type: "text",
      position: { x: -300, y: 380 },
      data: { text: "Tenant management:\n- Create/edit/deactivate companies\n- Assign entitlements (Logs, IDA)\n- View admin count per tenant" },
    },
    {
      nodeId: "iam-note-team",
      type: "text",
      position: { x: 960, y: 380 },
      data: { text: "Internal OPPR staff:\n- Invite team members\n- Track invitation status\n- Active/Pending states" },
    },
    {
      nodeId: "iam-note-admins",
      type: "text",
      position: { x: -300, y: 730 },
      data: { text: "External customer admins:\n- Create admin for a company\n- Assign Logs/IDA entitlements\n- Filter by company, status" },
    },
    {
      nodeId: "iam-note-audit",
      type: "text",
      position: { x: 680, y: 1080 },
      data: { text: "Cross-cutting observability:\n- All actions logged here\n- Filter by date, action, entity\n- Export CSV for compliance" },
    },
  ];

  // Edges connecting the screens
  const edges = [
    // Dashboard -> Companies
    {
      edgeId: "iam-e-dash-companies",
      source: "iam-dashboard",
      target: "iam-companies",
      sourceHandle: "bottom",
      targetHandle: "top",
      label: '"View Companies" / "Create Company"',
    },
    // Dashboard -> Team
    {
      edgeId: "iam-e-dash-team",
      source: "iam-dashboard",
      target: "iam-team",
      sourceHandle: "bottom",
      targetHandle: "top",
      label: '"Invite Team Member"',
    },
    // Dashboard -> Audit Logs
    {
      edgeId: "iam-e-dash-audit",
      source: "iam-dashboard",
      target: "iam-audit-logs",
      sourceHandle: "bottom",
      targetHandle: "top",
      label: '"View Audit Logs" / "View All"',
    },
    // Companies -> Customer Admins
    {
      edgeId: "iam-e-companies-admins",
      source: "iam-companies",
      target: "iam-customer-admins",
      sourceHandle: "bottom",
      targetHandle: "top",
      label: "View Admins for Company",
    },
    // Customer Admins -> Companies (back ref)
    {
      edgeId: "iam-e-admins-companies",
      source: "iam-customer-admins",
      target: "iam-companies",
      sourceHandle: "right",
      targetHandle: "left",
      label: "Company filter / reference",
    },
    // Companies -> Audit Logs
    {
      edgeId: "iam-e-companies-audit",
      source: "iam-companies",
      target: "iam-audit-logs",
      sourceHandle: "bottom",
      targetHandle: "left",
      label: "Company actions logged",
    },
    // Customer Admins -> Audit Logs
    {
      edgeId: "iam-e-admins-audit",
      source: "iam-customer-admins",
      target: "iam-audit-logs",
      sourceHandle: "bottom",
      targetHandle: "left",
      label: "Admin actions logged",
    },
    // Team -> Audit Logs
    {
      edgeId: "iam-e-team-audit",
      source: "iam-team",
      target: "iam-audit-logs",
      sourceHandle: "bottom",
      targetHandle: "right",
      label: "Team actions logged",
    },
  ];

  // Create all nodes
  console.log("Creating nodes...");
  for (const node of nodes) {
    console.log(`  [node] ${node.nodeId}: ${node.data.label || node.data.text?.substring(0, 40)}`);
    await client.mutation(api.nodes.addNode, {
      boardId,
      nodeId: node.nodeId,
      type: node.type,
      position: node.position,
      data: node.data,
      width: node.width,
    });
  }

  // Create all edges
  console.log("Creating edges...");
  for (const edge of edges) {
    console.log(`  [edge] ${edge.source} -> ${edge.target}: "${edge.label}"`);
    await client.mutation(api.edges.addEdge, {
      boardId,
      edgeId: edge.edgeId,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label,
      type: "labeled",
    });
  }

  console.log("\nDone! IAM workflow created with 6 screens, 6 annotations, and 8 connections.");
  console.log("Refresh your browser to see the flow.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
