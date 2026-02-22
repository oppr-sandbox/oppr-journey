"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AIChatProps {
  boardId: Id<"boards">;
}

const QUICK_ACTIONS = [
  { label: "Full analysis", prompt: "Do a comprehensive analysis of this customer journey. Walk through every persona's path, add yellow notes with observations, red attention markers for friction points, and green improvement boxes for recommendations. Connect screens in logical flow order. Be thorough — annotate every screen from each relevant persona's perspective. Propose all changes as structured JSON." },
  { label: "Analyze gaps", prompt: "Analyze this customer journey for gaps, missing screens, and dead-end flows. What screens or connections are likely missing? Add red attention markers at dead-ends and propose new screens to fill gaps. Propose the changes as structured JSON so I can apply them." },
  { label: "Check terminology", prompt: "Review the terminology used across all screens in this journey. Identify any naming inconsistencies or confusing labels. Add yellow notes highlighting mismatches and red attention markers for the worst offenders. If you find issues, propose relabelEdge changes as structured JSON." },
  { label: "Per-persona review", prompt: "Analyze this journey from each persona's perspective separately. For EACH persona, walk through their path step by step and add yellow notes (observations), red attention markers (friction/issues), and green improvement suggestions at every relevant screen. Be thorough and comprehensive. Propose all changes as structured JSON." },
];

export default function AIChat({ boardId }: AIChatProps) {
  const router = useRouter();
  const messages = useQuery(api.chat.getByBoard, { boardId });
  const addMessage = useMutation(api.chat.addMessage);
  const clearChat = useMutation(api.chat.clearChat);
  const analyzeJourney = useAction(api.gemini.analyzeJourney);
  const applyProposals = useMutation(api.versions.applyProposals);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    setInput("");
    setLoading(true);

    try {
      // Save user message
      await addMessage({ boardId, role: "user", content: messageText });

      // Call Gemini
      const result = await analyzeJourney({ boardId, userMessage: messageText });

      // Save assistant response
      await addMessage({
        boardId,
        role: "assistant",
        content: result.response,
        metadata: result.proposals ? { proposals: result.proposals } : undefined,
      });
    } catch (error: any) {
      await addMessage({
        boardId,
        role: "assistant",
        content: `Error: ${error.message || "Failed to get AI response"}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = async (messageId: string, proposals: any[]) => {
    setApplying(messageId);
    try {
      const newBoardId = await applyProposals({
        sourceBoardId: boardId,
        proposals,
        versionNote: `AI changes applied (${proposals.length} modification${proposals.length !== 1 ? "s" : ""})`,
      });
      router.push(`/board/${newBoardId}`);
    } catch (error: any) {
      alert(`Failed to apply changes: ${error.message}`);
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {(!messages || messages.length === 0) && !loading && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-3 rounded-full bg-purple-100 p-3 dark:bg-purple-900/30">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-500">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 18a1 1 0 1 1 1-1 1 1 0 0 1-1 1zm1-5.16V14a1 1 0 0 1-2 0v-2a1 1 0 0 1 1-1 1.5 1.5 0 1 0-1.5-1.5 1 1 0 0 1-2 0 3.5 3.5 0 1 1 4.5 3.34z" />
              </svg>
            </div>
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">AI Journey Analyst</p>
            <p className="mt-1 text-[10px] text-zinc-400">
              Ask questions about your journey map or use quick actions below.
            </p>
            <p className="mt-1 text-[10px] text-zinc-400">
              The AI can propose changes you can apply to the canvas with one click.
            </p>
          </div>
        )}

        {messages?.map((msg) => {
          const proposals = msg.metadata?.proposals;
          const hasProposals = proposals && Array.isArray(proposals) && proposals.length > 0;
          const isApplying = applying === msg._id;

          return (
            <div key={msg._id}>
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-xs ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-xs prose-zinc dark:prose-invert max-w-none [&_p]:text-xs [&_li]:text-xs [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_code]:text-[10px] [&_pre]:text-[10px] [&_pre]:bg-zinc-200 [&_pre]:dark:bg-zinc-900 [&_pre]:p-2 [&_pre]:rounded">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>

              {/* Apply Changes button */}
              {hasProposals && msg.role === "assistant" && (
                <div className="mt-1.5 flex justify-start">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-2 dark:border-green-800 dark:bg-green-950/30">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span className="text-[10px] font-medium text-green-700 dark:text-green-300">
                        {proposals.length} proposed change{proposals.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="mb-2 space-y-0.5 max-h-40 overflow-y-auto">
                      {proposals.slice(0, 10).map((p: any, i: number) => (
                        <p key={i} className={`text-[9px] ${
                          p.action === "addAttention" ? "text-red-600 dark:text-red-400" :
                          p.action === "addImprovement" ? "text-emerald-600 dark:text-emerald-400" :
                          p.action === "addNote" ? "text-amber-600 dark:text-amber-400" :
                          p.action === "removeNode" || p.action === "removeEdge" ? "text-red-500 dark:text-red-400" :
                          "text-green-600 dark:text-green-400"
                        }`}>
                          {p.action === "addNode" && `+ Add screen: "${p.label}"`}
                          {p.action === "addEdge" && `+ Connect: ${p.source} → ${p.target}${p.label ? ` [${p.label}]` : ""}`}
                          {p.action === "addNote" && `📝 Note${p.persona ? ` (${p.persona})` : ""}: "${(p.text || "").slice(0, 50)}..."`}
                          {p.action === "addAttention" && `⚠ Issue${p.persona ? ` (${p.persona})` : ""}: "${(p.text || "").slice(0, 50)}..."`}
                          {p.action === "addImprovement" && `✨ Improve${p.persona ? ` (${p.persona})` : ""}: "${(p.text || "").slice(0, 50)}..."`}
                          {p.action === "relabelEdge" && `~ Relabel edge: "${p.newLabel}"`}
                          {p.action === "removeNode" && `- Remove node: ${p.nodeId}`}
                          {p.action === "removeEdge" && `- Remove edge: ${p.source} → ${p.target}`}
                        </p>
                      ))}
                      {proposals.length > 10 && (
                        <p className="text-[9px] text-green-500">...and {proposals.length - 10} more</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleApplyChanges(msg._id, proposals)}
                      disabled={isApplying || loading}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {isApplying ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Creating new version...
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          Apply Changes (creates new version)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {(!messages || messages.length === 0) && (
        <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
          <p className="mb-1.5 text-[9px] font-medium uppercase text-zinc-400">Quick Actions</p>
          <div className="flex flex-wrap gap-1">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleSend(action.prompt)}
                disabled={loading}
                className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[10px] font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your journey..."
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-purple-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
        {messages && messages.length > 0 && (
          <button
            onClick={() => clearChat({ boardId })}
            className="mt-1.5 text-[10px] text-zinc-400 hover:text-red-500"
          >
            Clear chat history
          </button>
        )}
      </div>
    </div>
  );
}
