#!/usr/bin/env node
/**
 * Seed script: uploads all screenshots to Convex and places them on the board.
 *
 * Usage:
 *   node scripts/seed-board.mjs <boardId>
 *
 * Requires NEXT_PUBLIC_CONVEX_URL in .env.local
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "fs";
import { resolve, basename } from "path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local");
  process.exit(1);
}

const boardId = process.argv[2];
if (!boardId) {
  console.error("Usage: node scripts/seed-board.mjs <boardId>");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// All screenshots with their categorization
const SCREENSHOTS = [
  // === ADMIN (5) ===
  { filename: "Screenshot 2026-02-20 084602.png", platform: "admin", label: "Admin Dashboard", group: "admin" },
  { filename: "Screenshot 2026-02-20 084607.png", platform: "admin", label: "Companies List", group: "admin" },
  { filename: "Screenshot 2026-02-20 084613.png", platform: "admin", label: "Customer Super Admins", group: "admin" },
  { filename: "Screenshot 2026-02-20 084618.png", platform: "admin", label: "Team Management", group: "admin" },
  { filename: "Screenshot 2026-02-20 084624.png", platform: "admin", label: "Audit Logs", group: "admin" },

  // === DESKTOP - GLOBAL (8) ===
  { filename: "Screenshot 2026-02-20 084635.png", platform: "desktop", label: "Home Dashboard", group: "desktop-global" },
  { filename: "Screenshot 2026-02-20 084642.png", platform: "desktop", label: "Home Dashboard (Libraries)", group: "desktop-global" },
  { filename: "Screenshot 2026-02-20 084648.png", platform: "desktop", label: "Logs Library", group: "desktop-global" },
  { filename: "Screenshot 2026-02-20 084659.png", platform: "desktop", label: "Assets Library", group: "desktop-global" },
  { filename: "Screenshot 2026-02-20 084705.png", platform: "desktop", label: "HMI Templates Library", group: "desktop-global" },
  { filename: "Screenshot 2026-02-20 084717.png", platform: "desktop", label: "User Management", group: "desktop-global" },
  { filename: "Screenshot 2026-02-20 084722.png", platform: "desktop", label: "Role Management", group: "desktop-global" },
  { filename: "Screenshot 2026-02-20 084728.png", platform: "desktop", label: "Projects List", group: "desktop-global" },

  // === DESKTOP - PROJECT CONTEXT (18) ===
  { filename: "Screenshot 2026-02-20 084733.png", platform: "desktop", label: "Project Overview", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084745.png", platform: "desktop", label: "Project Dashboard", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084752.png", platform: "desktop", label: "Project Controls", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084758.png", platform: "desktop", label: "Project Controls - Rounds", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084803.png", platform: "desktop", label: "Project Logs", group: "desktop-project" },
  { filename: "Screenshot 2026-02-19 151041.png", platform: "desktop", label: "Project Logs (alt)", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084808.png", platform: "desktop", label: "Project Log Data Viewer", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084814.png", platform: "desktop", label: "Project Floor Plans List", group: "desktop-project" },
  { filename: "Screenshot 2026-02-19 151239.png", platform: "desktop", label: "Project Floor Plan Detail", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084819.png", platform: "desktop", label: "Project Floor Plan Modal", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084826.png", platform: "desktop", label: "Floor Plan - Connected Assets", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084833.png", platform: "desktop", label: "Project Assets - List View", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084838.png", platform: "desktop", label: "Project Assets - Hierarchy", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084843.png", platform: "desktop", label: "Project HMI Templates", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084848.png", platform: "desktop", label: "Schedules - Working Hours", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084857.png", platform: "desktop", label: "Schedules - Standard", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084902.png", platform: "desktop", label: "Schedules - Custom", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084907.png", platform: "desktop", label: "Project Members", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084913.png", platform: "desktop", label: "Project History", group: "desktop-project" },
  { filename: "Screenshot 2026-02-20 084919.png", platform: "desktop", label: "Project Settings", group: "desktop-project" },

  // === MOBILE (12 unique - skip exact duplicates) ===
  { filename: "Screenshot 2026-02-19 150453.png", platform: "mobile", label: "Projects List", group: "mobile" },
  { filename: "Screenshot 2026-02-19 150702.png", platform: "mobile", label: "Logs List", group: "mobile" },
  { filename: "Screenshot 2026-02-19 150718.png", platform: "mobile", label: "Project Overview", group: "mobile" },
  { filename: "Screenshot 2026-02-19 152513.png", platform: "mobile", label: "Logs List (Notification)", group: "mobile" },
  { filename: "Screenshot 2026-02-19 153002.png", platform: "mobile", label: "Log History", group: "mobile" },
  { filename: "WhatsApp Image 2026-02-20 at 09.18.05.jpeg", platform: "mobile", label: "Push Notification", group: "mobile" },
  { filename: "WhatsApp Image 2026-02-20 at 09.18.05 (1).jpeg", platform: "mobile", label: "Projects (Badge)", group: "mobile" },
  { filename: "WhatsApp Image 2026-02-20 at 09.18.05 (2).jpeg", platform: "mobile", label: "Notifications Screen", group: "mobile" },
  { filename: "WhatsApp Image 2026-02-20 at 09.18.05 (3).jpeg", platform: "mobile", label: "Logs (Badge)", group: "mobile" },
  { filename: "WhatsApp Image 2026-02-20 at 09.18.05 (4).jpeg", platform: "mobile", label: "Project Running", group: "mobile" },
  { filename: "WhatsApp Image 2026-02-20 at 09.18.05 (5).jpeg", platform: "mobile", label: "Log Step View", group: "mobile" },
  { filename: "WhatsApp Image 2026-02-20 at 09.18.05 (9).jpeg", platform: "mobile", label: "Log Step View (alt)", group: "mobile" },
  { filename: "WhatsApp Image 2026-02-20 at 09.18.05 (10).jpeg", platform: "mobile", label: "Assets Floor Plan", group: "mobile" },
  { filename: "WhatsApp Image 2026-02-20 at 09.18.05 (11).jpeg", platform: "mobile", label: "Logs Tab - Round Status", group: "mobile" },
];

// Layout: group screenshots in rows
const NODE_WIDTH = 320;
const NODE_GAP = 40;
const ROW_GAP = 200;

function getLayout() {
  const layout = [];
  let yOffset = 0;

  // Group label text nodes
  const groups = [
    { key: "admin", title: "OPPR Admin (IAM Service)", color: "purple" },
    { key: "desktop-global", title: "Oppr Logs - Global Views", color: "blue" },
    { key: "desktop-project", title: "Oppr Logs - Project Context", color: "blue" },
    { key: "mobile", title: "OPPR Mobile App", color: "green" },
  ];

  for (const group of groups) {
    const items = SCREENSHOTS.filter((s) => s.group === group.key);
    const cols = group.key === "mobile" ? 7 : 5; // mobile screenshots are narrower

    // Add group title text node
    layout.push({
      type: "text",
      nodeId: `text-${group.key}`,
      position: { x: 0, y: yOffset },
      data: { text: `--- ${group.title} ---` },
    });

    yOffset += 60;

    // Place screenshots in a grid
    for (let i = 0; i < items.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      layout.push({
        type: "screenshot",
        ...items[i],
        position: {
          x: col * (NODE_WIDTH + NODE_GAP),
          y: yOffset + row * (280 + NODE_GAP),
        },
      });
    }

    const rows = Math.ceil(items.length / cols);
    yOffset += rows * (280 + NODE_GAP) + ROW_GAP;
  }

  return layout;
}

const SCREENSHOT_DIR = resolve(process.cwd(), "..", "screenshotdump");

async function uploadFile(filepath, contentType) {
  const fileBuffer = readFileSync(filepath);
  const uploadUrl = await client.mutation(api.screenshots.generateUploadUrl);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: fileBuffer,
  });
  const result = await response.json();
  return result.storageId;
}

async function main() {
  console.log(`Seeding board: ${boardId}`);
  console.log(`Screenshot dir: ${SCREENSHOT_DIR}`);
  console.log(`Total screenshots to upload: ${SCREENSHOTS.length}\n`);

  const layout = getLayout();
  let uploaded = 0;

  for (const item of layout) {
    if (item.type === "text") {
      // Create text annotation node
      console.log(`  [text] ${item.data.text}`);
      await client.mutation(api.nodes.addNode, {
        boardId,
        nodeId: item.nodeId,
        type: "text",
        position: item.position,
        data: item.data,
      });
      continue;
    }

    // Upload screenshot
    const filepath = resolve(SCREENSHOT_DIR, item.filename);
    const contentType = item.filename.endsWith(".png") ? "image/png" : "image/jpeg";

    try {
      console.log(`  [${++uploaded}/${SCREENSHOTS.length}] Uploading: ${item.label}`);
      const storageId = await uploadFile(filepath, contentType);

      // Save screenshot record
      await client.mutation(api.screenshots.saveScreenshot, {
        boardId,
        storageId,
        filename: item.filename,
        contentType,
        label: item.label,
        platform: item.platform,
      });

      // Get the URL for the uploaded file
      const screenshots = await client.query(api.screenshots.getByBoard, { boardId });
      const latest = screenshots.find((s) => s.filename === item.filename);

      if (latest?.url) {
        // Create node on the canvas
        await client.mutation(api.nodes.addNode, {
          boardId,
          nodeId: `screenshot-${item.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          type: "screenshot",
          position: item.position,
          data: {
            imageUrl: latest.url,
            label: item.label,
            platform: item.platform,
          },
        });
      }
    } catch (err) {
      console.error(`  FAILED: ${item.filename} - ${err.message}`);
    }
  }

  console.log(`\nDone! Uploaded ${uploaded} screenshots and created board layout.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
