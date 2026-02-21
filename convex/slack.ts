"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

const getSlackConfig = () => {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;
  const enabled = process.env.SLACK_ENABLED;
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  return { token, channel, enabled: enabled === "true", baseUrl };
};

async function postToSlack(token: string, channel: string, text: string, blocks: any[]): Promise<boolean> {
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, text, blocks }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

const PRIORITY_EMOJI: Record<string, string> = {
  high: ":red_circle:",
  medium: ":large_orange_circle:",
  low: ":large_blue_circle:",
};

export const notifyNewImprovement = action({
  args: {
    improvementId: v.id("improvements"),
    boardId: v.id("boards"),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const config = getSlackConfig();
    if (!config.enabled || !config.token || !config.channel) {
      return { ok: false };
    }

    const imp: any = await ctx.runQuery(api.improvements.getById, {
      improvementId: args.improvementId,
    });
    if (!imp) return { ok: false };

    const board: any = await ctx.runQuery(api.boards.get, {
      boardId: args.boardId,
    });

    const priorityEmoji = PRIORITY_EMOJI[imp.priority || ""] || ":white_circle:";
    const boardUrl = `${config.baseUrl}/board/${args.boardId}`;
    const impNum = String(imp.number).padStart(3, "0");

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${priorityEmoji} *New Improvement Created*\n*IMP-${impNum}:* ${imp.title}\n*Journey:* ${board?.name || "Unknown"}\n*Priority:* ${(imp.priority || "unset").charAt(0).toUpperCase() + (imp.priority || "unset").slice(1)}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open in Canvas" },
            url: boardUrl,
          },
        ],
      },
    ];

    const ok = await postToSlack(
      config.token,
      config.channel,
      `New improvement IMP-${impNum}: ${imp.title}`,
      blocks
    );
    return { ok };
  },
});

export const notifyStatusChange = action({
  args: {
    improvementId: v.id("improvements"),
    boardId: v.id("boards"),
    oldStatus: v.string(),
    newStatus: v.string(),
    changedByName: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const config = getSlackConfig();
    if (!config.enabled || !config.token || !config.channel) {
      return { ok: false };
    }

    const imp: any = await ctx.runQuery(api.improvements.getById, {
      improvementId: args.improvementId,
    });
    if (!imp) return { ok: false };

    const board: any = await ctx.runQuery(api.boards.get, {
      boardId: args.boardId,
    });

    const boardUrl = `${config.baseUrl}/board/${args.boardId}`;
    const impNum = String(imp.number).padStart(3, "0");

    const statusEmoji: Record<string, string> = {
      open: ":white_circle:",
      in_progress: ":large_blue_circle:",
      closed: ":white_check_mark:",
    };

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${statusEmoji[args.newStatus] || ":arrows_counterclockwise:"} *Status Changed*\n*IMP-${impNum}:* ${imp.title}\n*Journey:* ${board?.name || "Unknown"}\n${args.oldStatus} → *${args.newStatus}*\n_by ${args.changedByName}_`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open in Canvas" },
            url: boardUrl,
          },
        ],
      },
    ];

    const ok = await postToSlack(
      config.token,
      config.channel,
      `IMP-${impNum} status: ${args.oldStatus} → ${args.newStatus}`,
      blocks
    );
    return { ok };
  },
});

export const testConnection = action({
  handler: async (): Promise<{ ok: boolean; error?: string }> => {
    const config = getSlackConfig();
    if (!config.enabled) return { ok: false, error: "SLACK_ENABLED is not set to 'true'" };
    if (!config.token) return { ok: false, error: "SLACK_BOT_TOKEN not configured" };
    if (!config.channel) return { ok: false, error: "SLACK_CHANNEL_ID not configured" };

    const ok = await postToSlack(
      config.token,
      config.channel,
      "OPPR Customer Journey Tool — Slack integration test",
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: ":white_check_mark: *Slack Integration Active*\nThis is a test message from the OPPR Customer Journey Tool.",
          },
        },
      ]
    );
    return { ok };
  },
});
