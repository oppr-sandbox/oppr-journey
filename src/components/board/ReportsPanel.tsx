"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatRelativeTime } from "@/lib/utils";

interface ReportsPanelProps {
  boardId: Id<"boards">;
  onFocusNode: (nodeId: string) => void;
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300" },
  medium: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  low: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
};

export default function ReportsPanel({ boardId, onFocusNode }: ReportsPanelProps) {
  const reports = useQuery(api.reports.getByBoard, { boardId });
  const personas = useQuery(api.personas.getByBoard, { boardId });
  const generateReport = useAction(api.gemini.generateReport);
  const runUXWalkthrough = useAction(api.gemini.runUXWalkthrough);
  const removeReport = useMutation(api.reports.remove);

  const [generating, setGenerating] = useState(false);
  const [walkthroughRunning, setWalkthroughRunning] = useState(false);
  const [walkthroughResult, setWalkthroughResult] = useState<string | null>(null);
  const [filterPersonaId, setFilterPersonaId] = useState<string>("");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateReport({
        boardId,
        personaId: filterPersonaId ? (filterPersonaId as Id<"personas">) : undefined,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleUXWalkthrough = async () => {
    setWalkthroughRunning(true);
    setWalkthroughResult(null);
    try {
      const result = await runUXWalkthrough({ boardId });
      if (result.error) {
        setWalkthroughResult(`Error: ${result.error}`);
      } else {
        setWalkthroughResult(
          `Analyzed ${result.commentsCreated} screens. Check Comments tab for per-screen analysis.`
        );
      }
    } catch (err: any) {
      setWalkthroughResult(`Error: ${err.message}`);
    } finally {
      setWalkthroughRunning(false);
    }
  };

  const handleDownload = (report: any) => {
    const blob = new Blob([report.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeveritySummary = (findings: any[]) => {
    const counts: Record<string, number> = { high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      counts[f.severity] = (counts[f.severity] || 0) + 1;
    }
    return counts;
  };

  return (
    <div className="p-3">
      <div className="mb-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          Gap Analysis ({reports?.length || 0})
        </p>

        {/* Generate controls */}
        <div className="flex items-center gap-1.5">
          <select
            value={filterPersonaId}
            onChange={(e) => setFilterPersonaId(e.target.value)}
            className="flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] outline-none focus:border-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <option value="">All personas</option>
            {personas?.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="shrink-0 rounded bg-blue-600 px-3 py-1 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? (
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                Analyzing...
              </span>
            ) : (
              "Generate Report"
            )}
          </button>
        </div>

        {/* AI UX Walkthrough */}
        <div className="mt-3 rounded-lg border border-dashed border-purple-300 bg-purple-50/50 p-2 dark:border-purple-700 dark:bg-purple-950/20">
          <p className="mb-1.5 text-[10px] font-medium text-purple-700 dark:text-purple-300">
            AI UX Walkthrough
          </p>
          <p className="mb-2 text-[9px] text-purple-600/70 dark:text-purple-400/70">
            Let AI walk through every screen from a UX/UI perspective. Generates per-screen comments and a summary report with terminology checks and flow gap analysis.
          </p>
          <button
            onClick={handleUXWalkthrough}
            disabled={walkthroughRunning || generating}
            className="w-full rounded bg-purple-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {walkthroughRunning ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                Walking through screens...
              </span>
            ) : (
              "Run UX Walkthrough"
            )}
          </button>
          {walkthroughResult && (
            <p className="mt-1.5 text-[9px] text-purple-600 dark:text-purple-400">
              {walkthroughResult}
            </p>
          )}
        </div>
      </div>

      {/* Report list */}
      <div className="space-y-2">
        {reports?.map((report, idx) => {
          const isExpanded = expandedReportId === report._id;
          const severity = getSeveritySummary(report.findings);
          const prevReport = reports[idx + 1]; // older report
          const findingsDiff = prevReport
            ? report.findings.length - prevReport.findings.length
            : null;

          return (
            <div key={report._id} className="rounded-lg border border-zinc-200 dark:border-zinc-700">
              {/* Report header */}
              <button
                onClick={() => setExpandedReportId(isExpanded ? null : report._id)}
                className="w-full p-2.5 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                      {report.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">
                      {formatRelativeTime(report.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {severity.high > 0 && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-medium text-red-600 dark:bg-red-900/40 dark:text-red-300">
                        {severity.high}H
                      </span>
                    )}
                    {severity.medium > 0 && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
                        {severity.medium}M
                      </span>
                    )}
                    {severity.low > 0 && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                        {severity.low}L
                      </span>
                    )}
                    {findingsDiff !== null && findingsDiff !== 0 && (
                      <span className={`text-[9px] font-medium ${
                        findingsDiff < 0 ? "text-green-500" : "text-red-500"
                      }`}>
                        {findingsDiff < 0 ? `${findingsDiff}` : `+${findingsDiff}`}
                      </span>
                    )}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>
                {!isExpanded && (
                  <p className="mt-1 text-[10px] text-zinc-500 line-clamp-2">
                    {report.summary}
                  </p>
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-zinc-200 p-2.5 dark:border-zinc-700">
                  {/* Findings */}
                  {report.findings.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-zinc-400">
                        Findings ({report.findings.length})
                      </p>
                      <div className="space-y-1">
                        {report.findings.map((finding: any, fi: number) => {
                          const sev = SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.low;
                          return (
                            <div
                              key={fi}
                              className="rounded border border-zinc-100 p-1.5 dark:border-zinc-800"
                            >
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase ${sev.bg} ${sev.text}`}>
                                  {finding.severity}
                                </span>
                                <span className="rounded bg-zinc-100 px-1 py-0.5 text-[8px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                  {finding.type}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-700 dark:text-zinc-300">
                                {finding.description}
                              </p>
                              {finding.affectedNodes && finding.affectedNodes.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-0.5">
                                  {finding.affectedNodes.map((nodeId: string) => (
                                    <button
                                      key={nodeId}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onFocusNode(nodeId);
                                      }}
                                      className="rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
                                    >
                                      {nodeId}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Full report content (simplified rendering) */}
                  <div className="mb-2 max-h-64 overflow-y-auto rounded bg-zinc-50 p-2 text-[10px] text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                    <pre className="whitespace-pre-wrap font-sans">{report.content}</pre>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDownload(report)}
                      className="rounded border border-zinc-200 px-2 py-0.5 text-[9px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this report?")) {
                          removeReport({ reportId: report._id as Id<"reports"> });
                          setExpandedReportId(null);
                        }
                      }}
                      className="rounded border border-zinc-200 px-2 py-0.5 text-[9px] font-medium text-red-500 hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-red-900/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(!reports || reports.length === 0) && !generating && (
        <p className="py-6 text-center text-[11px] text-zinc-400">
          No reports yet. Generate a gap analysis to identify issues in your journey flow.
        </p>
      )}
    </div>
  );
}
