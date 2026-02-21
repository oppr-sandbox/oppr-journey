"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface PromptTemplate {
  _id: string;
  key: string;
  label: string;
  category: string;
  prompt: string;
  updatedAt: number;
}

const CATEGORY_ORDER = ["chat", "summary", "report", "walkthrough", "improvement"];
const CATEGORY_LABELS: Record<string, string> = {
  chat: "Chat",
  summary: "Summary",
  report: "Report",
  walkthrough: "Walkthrough",
  improvement: "Improvement",
};

export default function ConfigurationPanel() {
  const templates = useQuery(api.promptTemplates.getAll);
  const upsert = useMutation(api.promptTemplates.upsert);
  const seedTemplates = useMutation(api.promptTemplates.seed);
  const resetToDefaults = useMutation(api.promptTemplates.resetToDefaults);
  const testSlack = useAction(api.slack.testConnection);

  const [activeTab, setActiveTab] = useState<string>("chat");
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [resetting, setResetting] = useState(false);
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackResult, setSlackResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const hasSeeded = useRef(false);

  // Auto-seed on first load if empty
  useEffect(() => {
    if (templates && templates.length === 0 && !hasSeeded.current) {
      hasSeeded.current = true;
      seedTemplates();
    }
  }, [templates, seedTemplates]);

  // Build a flat list ordered by category
  const orderedTemplates: PromptTemplate[] = [];
  if (templates) {
    for (const category of CATEGORY_ORDER) {
      for (const t of templates as PromptTemplate[]) {
        if (t.category === category) orderedTemplates.push(t);
      }
    }
    // Add any templates not in CATEGORY_ORDER
    for (const t of templates as PromptTemplate[]) {
      if (!CATEGORY_ORDER.includes(t.category)) orderedTemplates.push(t);
    }
  }

  const activeTemplate = orderedTemplates.find((t) => t.category === activeTab)
    ?? orderedTemplates[0];

  const handleSave = async (template: PromptTemplate, newPrompt: string) => {
    if (newPrompt === template.prompt) return;
    setSavingKeys((prev) => new Set(prev).add(template.key));
    try {
      await upsert({
        key: template.key,
        label: template.label,
        category: template.category,
        prompt: newPrompt,
      });
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(template.key);
        return next;
      });
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all prompts to their default values? This will overwrite any customizations.")) return;
    setResetting(true);
    try {
      await resetToDefaults();
      setEditedValues({});
    } finally {
      setResetting(false);
    }
  };

  if (!templates) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            AI Prompt Configuration
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Customize the prompts used for all AI-generated content
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          {resetting ? "Resetting..." : "Reset All to Defaults"}
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          No prompt templates found. They will be auto-seeded on first AI usage.
        </p>
      ) : (
        <div className="flex min-h-[500px] overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          {/* Left tab list */}
          <div className="w-44 shrink-0 border-r border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
              Prompt Type
            </p>
            <div className="space-y-0.5">
              {CATEGORY_ORDER.map((category) => {
                const template = orderedTemplates.find((t) => t.category === category);
                if (!template) return null;
                const isActive = activeTab === category;
                const isSaving = savingKeys.has(template.key);
                const isDirty = editedValues[template.key] !== undefined && editedValues[template.key] !== template.prompt;

                return (
                  <button
                    key={category}
                    onClick={() => setActiveTab(category)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                        : "text-zinc-600 hover:bg-white/70 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-200"
                    }`}
                  >
                    <span>{CATEGORY_LABELS[category] || category}</span>
                    {isSaving && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" title="Saving..." />
                    )}
                    {isDirty && !isSaving && (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Unsaved changes" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right editor */}
          <div className="flex flex-1 flex-col p-5">
            {activeTemplate ? (() => {
              const currentValue = editedValues[activeTemplate.key] ?? activeTemplate.prompt;
              const isSaving = savingKeys.has(activeTemplate.key);
              const isDirty = editedValues[activeTemplate.key] !== undefined && editedValues[activeTemplate.key] !== activeTemplate.prompt;

              return (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        {activeTemplate.label}
                      </p>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] text-zinc-400 dark:bg-zinc-800">
                        {activeTemplate.key}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSaving && (
                        <span className="text-[10px] text-blue-500">Saving...</span>
                      )}
                      {isDirty && !isSaving && (
                        <span className="text-[10px] text-amber-500">Unsaved changes</span>
                      )}
                    </div>
                  </div>
                  <textarea
                    key={activeTemplate.key}
                    value={currentValue}
                    onChange={(e) => {
                      setEditedValues((prev) => ({
                        ...prev,
                        [activeTemplate.key]: e.target.value,
                      }));
                    }}
                    onBlur={() => {
                      const val = editedValues[activeTemplate.key];
                      if (val !== undefined) {
                        handleSave(activeTemplate, val);
                      }
                    }}
                    className="flex-1 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    style={{ minHeight: "400px" }}
                    placeholder="Enter prompt..."
                  />
                </>
              );
            })() : (
              <p className="py-8 text-center text-sm text-zinc-400">Select a prompt type from the left.</p>
            )}
          </div>
        </div>
      )}

      {/* Slack Integration */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Slack Integration
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Get notified when improvements are created or status changes
            </p>
          </div>
          <button
            onClick={async () => {
              setSlackTesting(true);
              setSlackResult(null);
              try {
                const result = await testSlack();
                setSlackResult(result);
              } catch (err: any) {
                setSlackResult({ ok: false, error: err.message || "Connection failed" });
              } finally {
                setSlackTesting(false);
              }
            }}
            disabled={slackTesting}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {slackTesting ? "Testing..." : "Test Slack"}
          </button>
        </div>

        {slackResult && (
          <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${
            slackResult.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          }`}>
            {slackResult.ok
              ? "Slack connection successful! A test message was sent."
              : `Slack error: ${slackResult.error || "Failed to send message"}`}
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Environment Variables Required
          </p>
          <div className="space-y-2 text-[11px]">
            <div className="rounded-lg bg-zinc-50 p-2 font-mono dark:bg-zinc-800">
              <p className="text-zinc-500">SLACK_ENABLED=<span className="text-emerald-600">"true"</span></p>
              <p className="text-zinc-500">SLACK_BOT_TOKEN=<span className="text-blue-600">"xoxb-your-token"</span></p>
              <p className="text-zinc-500">SLACK_CHANNEL_ID=<span className="text-blue-600">"C0XXXXXXXXX"</span></p>
              <p className="text-zinc-500">APP_BASE_URL=<span className="text-blue-600">"https://your-app.vercel.app"</span></p>
            </div>
            <p className="text-zinc-400">
              Set these in your Convex dashboard under Settings &gt; Environment Variables.
              The bot needs <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">chat:write</code> permission in your Slack workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
