"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const analyzeJourney = action({
  args: {
    boardId: v.id("boards"),
    userMessage: v.string(),
  },
  returns: v.object({
    response: v.string(),
    proposals: v.any(),
  }),
  handler: async (ctx, args): Promise<{ response: string; proposals: any }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        response: "Gemini API key not configured. Please add GEMINI_API_KEY to your Convex environment variables.",
        proposals: null,
      };
    }

    // Gather context from the board
    const nodes: any[] = await ctx.runQuery(api.nodes.getByBoard, { boardId: args.boardId });
    const edges: any[] = await ctx.runQuery(api.edges.getByBoard, { boardId: args.boardId });
    const personas: any[] = await ctx.runQuery(api.personas.getByBoard, { boardId: args.boardId });
    const comments: any[] = await ctx.runQuery(api.comments.getByBoard, { boardId: args.boardId });

    // Build context string
    const screenshotNodes = nodes.filter((n: any) => n.type === "screenshot");
    const textNodes = nodes.filter((n: any) => n.type === "text");
    const attentionNodes = nodes.filter((n: any) => n.type === "attention");
    const improvementNodes = nodes.filter((n: any) => n.type === "improvement");

    const screenDescriptions = screenshotNodes.map((n: any) => {
      const persona = n.data?.personaId
        ? personas.find((p: any) => p._id === n.data.personaId)
        : null;
      return `- "${n.data?.label || n.nodeId}" (platform: ${n.data?.platform || "unknown"}${persona ? `, persona: ${persona.name}` : ""}, nodeId: ${n.nodeId})`;
    }).join("\n");

    const connectionDescriptions = edges.map((e: any) => {
      const source = nodes.find((n: any) => n.nodeId === e.source);
      const target = nodes.find((n: any) => n.nodeId === e.target);
      return `- "${source?.data?.label || source?.data?.text || e.source}" → "${target?.data?.label || target?.data?.text || e.target}"${e.label ? ` [${e.label}]` : ""}`;
    }).join("\n");

    const annotationDescriptions = textNodes.map((n: any) => {
      return `- Note: "${n.data?.text || ""}"`;
    }).join("\n");

    const attentionDescriptions = attentionNodes.map((n: any) => {
      return `- Issue: "${n.data?.text || ""}"`;
    }).join("\n");

    const improvementDescriptions = improvementNodes.map((n: any) => {
      return `- Improvement: "${n.data?.text || ""}"`;
    }).join("\n");

    const personaDescriptions = personas.map((p: any) => {
      return `- ${p.name}: ${p.description}`;
    }).join("\n");

    const unresolvedComments = comments
      .filter((c: any) => !c.resolved)
      .map((c: any) => {
        const node = c.nodeId
          ? screenshotNodes.find((n: any) => n.nodeId === c.nodeId)
          : null;
        return `- ${c.authorName}${node ? ` (on "${node.data?.label || c.nodeId}")` : ""}: "${c.text}"`;
      }).join("\n");

    // Build a nodeId reference list so Gemini can use real IDs
    const nodeIdList = screenshotNodes.map((n: any) =>
      `  - nodeId: "${n.nodeId}" → label: "${n.data?.label || ""}"`
    ).join("\n");

    // Build a position reference so Gemini knows spatial layout
    const nodePositionList = nodes.map((n: any) =>
      `  - nodeId: "${n.nodeId}" → label: "${n.data?.label || n.data?.text || ""}" (type: ${n.type}, x: ${Math.round(n.position.x)}, y: ${Math.round(n.position.y)})`
    ).join("\n");

    const systemPrompt = `You are an expert UX analyst specializing in customer journey mapping across multi-platform enterprise software (OPPR platforms). You help teams analyze and improve cross-platform customer journeys.

Your capabilities:
1. Identify terminology mismatches across screens (e.g. "start" vs "initiate" vs "activate")
2. Find missing screens or dead-end flows where users might get stuck
3. Analyze per-persona experience — walk through each persona's path and annotate friction points
4. Suggest specific improvements with references to actual screen names
5. Propose canvas changes as structured JSON that can be applied automatically
6. Add yellow annotation notes, red attention/issue markers, and green improvement boxes to provide rich visual feedback on the journey map

## Canvas Node Types
The journey map canvas supports these node types:
- **Screenshot nodes**: Actual screen captures with labels and platform tags
- **Text nodes (yellow)**: Annotation notes — use these for observations, context, persona-specific notes
- **Attention nodes (red)**: Issue markers — use these for problems, friction points, UX issues, dead ends
- **Improvement nodes (green)**: Improvement suggestions — use these for actionable recommendations

## Tone
Be constructive and supportive. Frame issues as opportunities — use "users may find this confusing because..." rather than "this is broken". Acknowledge what works well before suggesting changes. Your goal is to guide the team, not criticize.

## How to provide comprehensive analysis
When analyzing a journey, you should:
1. Walk through EACH persona's path and identify where they succeed and where they get stuck
2. For EACH screen, consider adding:
   - A yellow **note** with persona-specific observations (e.g. "Admin sees this first after login")
   - A red **attention** marker for any UX issues or friction points found
   - A green **improvement** suggestion with actionable recommendations
3. Connect screens in logical flow order using appropriate directional edges
4. Add missing screens where the journey has gaps

IMPORTANT: Whenever you suggest changes, you MUST ALWAYS include a structured JSON proposals block so the user can apply your changes directly to the canvas with one click. Do not just describe changes in text — always provide the JSON.

Be generous with annotations! Add notes, attention markers, and improvement boxes for every meaningful observation. The goal is a richly annotated journey map that tells the full story.

Available node IDs and positions (use these exact IDs in your proposals):
${nodePositionList || "(no nodes yet)"}

Available screenshot node IDs (for edges and references):
${nodeIdList || "(no nodes yet)"}

When proposing changes, format them as JSON in a code block with this structure:
\`\`\`json
{
  "proposals": [
    { "action": "addNode", "label": "Screen Name", "platform": "admin", "afterNode": "existing-node-id", "connectionLabel": "label for auto-created edge" },
    { "action": "addEdge", "source": "existing-node-id", "target": "existing-node-id", "label": "Connection Label" },
    { "action": "addNote", "text": "Observation or context note", "nearNode": "existing-node-id", "persona": "Persona Name (optional)" },
    { "action": "addAttention", "text": "Issue or friction point description", "nearNode": "existing-node-id", "persona": "Persona Name (optional)" },
    { "action": "addImprovement", "text": "Actionable improvement suggestion", "nearNode": "existing-node-id", "persona": "Persona Name (optional)" },
    { "action": "relabelEdge", "edgeSource": "node-id", "edgeTarget": "node-id", "newLabel": "New Label" },
    { "action": "removeNode", "nodeId": "node-id-to-remove" },
    { "action": "removeEdge", "source": "node-id", "target": "node-id" }
  ]
}
\`\`\`

### Proposal types explained:
- **addNode**: Add a proposed new screen (creates a yellow text node placeholder). Use "afterNode" to position it near an existing screen and auto-connect.
- **addEdge**: Connect two existing nodes with a labeled edge. The system will automatically choose the correct handle direction (top/bottom/left/right) based on node positions.
- **addNote**: Add a yellow annotation box near a screen. Use "nearNode" to place it near the relevant screen. Include "persona" to tag which persona this note applies to.
- **addAttention**: Add a red attention/issue box near a screen. Same positioning as addNote. Use for problems, friction points, dead-ends.
- **addImprovement**: Add a green improvement box near a screen. Same positioning as addNote. Use for actionable recommendations.
- **relabelEdge**: Change the label on an existing edge.
- **removeNode**: Remove an existing node and its connections.
- **removeEdge**: Remove a specific edge.

Rules for proposals:
- Use the exact nodeId values listed above (e.g. "screenshot-abc123"), NOT screen labels
- For "afterNode" in addNode, use the nodeId of the screen the new node should appear after
- For "nearNode" in addNote/addAttention/addImprovement, use the nodeId of the screen to annotate
- For addEdge source/target, use nodeIds
- Always include the proposals JSON block alongside your analysis text
- Include persona name in addNote/addAttention/addImprovement when the observation is persona-specific
- Create MULTIPLE notes/attention/improvement boxes — one per distinct observation, not one giant block`;

    // Inject tool context
    const toolContext = await getToolContext(ctx, args.boardId);
    const systemPromptWithTools = systemPrompt + toolContext;

    const boardContext = `## Current Journey Map

### Screens (${screenshotNodes.length}):
${screenDescriptions || "(none)"}

### Connections (${edges.length}):
${connectionDescriptions || "(none)"}

### Annotations (yellow notes):
${annotationDescriptions || "(none)"}

### Attention / Issues (red markers):
${attentionDescriptions || "(none)"}

### Improvements (green suggestions):
${improvementDescriptions || "(none)"}

### Personas (${personas.length}):
${personaDescriptions || "(none defined)"}

### Unresolved Comments:
${unresolvedComments || "(none)"}`;

    const fullPrompt = `${boardContext}\n\n## User Question:\n${args.userMessage}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPromptWithTools }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: fullPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          response: `Gemini API error (${response.status}): ${errorText}`,
          proposals: null,
        };
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini.";

      // Try to extract structured proposals from code blocks
      let proposals = null;
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.proposals) {
            proposals = parsed.proposals;
          }
        } catch {
          // JSON parse failed, that's fine — just return the text
        }
      }

      return { response: text, proposals };
    } catch (error: any) {
      return {
        response: `Error calling Gemini: ${error.message}`,
        proposals: null,
      };
    }
  },
});

export const generateBoardSummary = action({
  args: { boardId: v.id("boards") },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "API key not configured.";

    const nodes: any[] = await ctx.runQuery(api.nodes.getByBoard, { boardId: args.boardId });
    const edges: any[] = await ctx.runQuery(api.edges.getByBoard, { boardId: args.boardId });
    const personas: any[] = await ctx.runQuery(api.personas.getByBoard, { boardId: args.boardId });

    const screenshotNodes = nodes.filter((n: any) => n.type === "screenshot");
    const screenList = screenshotNodes.map((n: any) => n.data?.label || n.nodeId).join(", ");
    const edgeCount = edges.length;
    const personaList = personas.map((p: any) => p.name).join(", ");

    const toolContext = await getToolContext(ctx, args.boardId);

    const prompt = `Summarize this customer journey map in 1-2 concise sentences for a dashboard card. Keep the tone neutral and informative.
Screens: ${screenList || "(none)"}
Connections: ${edgeCount}
Personas: ${personaList || "(none)"}${toolContext}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 200 },
          }),
        }
      );
      if (!response.ok) return "Failed to generate summary.";
      const data = await response.json();
      const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No summary generated.";

      await ctx.runMutation(api.boards.updateSummary, { boardId: args.boardId, aiSummary: summary });
      return summary;
    } catch {
      return "Error generating summary.";
    }
  },
});

export const generateReport = action({
  args: {
    boardId: v.id("boards"),
    personaId: v.optional(v.id("personas")),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "API key not configured.";

    const nodes: any[] = await ctx.runQuery(api.nodes.getByBoard, { boardId: args.boardId });
    const edges: any[] = await ctx.runQuery(api.edges.getByBoard, { boardId: args.boardId });
    const personas: any[] = await ctx.runQuery(api.personas.getByBoard, { boardId: args.boardId });
    const personaNodes: any[] = await ctx.runQuery(api.personaNodes.getByBoard, { boardId: args.boardId });
    const comments: any[] = await ctx.runQuery(api.comments.getByBoard, { boardId: args.boardId });

    const screenshotNodes = nodes.filter((n: any) => n.type === "screenshot");
    const textNodes = nodes.filter((n: any) => n.type === "text");
    const attentionNodes = nodes.filter((n: any) => n.type === "attention");

    // Build persona assignments map
    const nodePersonas: Record<string, string[]> = {};
    for (const pn of personaNodes) {
      const persona = personas.find((p: any) => p._id === pn.personaId);
      if (persona) {
        if (!nodePersonas[pn.nodeId]) nodePersonas[pn.nodeId] = [];
        nodePersonas[pn.nodeId].push(persona.name);
      }
    }

    const screenDescriptions = screenshotNodes.map((n: any) => {
      const assignedPersonas = nodePersonas[n.nodeId] || [];
      return `- "${n.data?.label || n.nodeId}" (platform: ${n.data?.platform || "unknown"}${assignedPersonas.length > 0 ? `, personas: ${assignedPersonas.join(", ")}` : ""})`;
    }).join("\n");

    const connectionDescriptions = edges.map((e: any) => {
      const source = screenshotNodes.find((n: any) => n.nodeId === e.source);
      const target = screenshotNodes.find((n: any) => n.nodeId === e.target);
      return `- "${source?.data?.label || e.source}" → "${target?.data?.label || e.target}"${e.label ? ` [${e.label}]` : ""}`;
    }).join("\n");

    const attentionDescriptions = attentionNodes.map((n: any) => {
      return `- ATTENTION: "${n.data?.text || "No description"}"`;
    }).join("\n");

    const unresolvedComments = comments
      .filter((c: any) => !c.resolved)
      .map((c: any) => `- ${c.authorName}: "${c.text}"`)
      .join("\n");

    const personaDescriptions = personas.map((p: any) => `- ${p.name}: ${p.description}`).join("\n");

    let focusNote = "";
    if (args.personaId) {
      const focusPersona = personas.find((p: any) => p._id === args.personaId);
      if (focusPersona) {
        focusNote = `\n\nFOCUS: Analyze specifically from the perspective of "${focusPersona.name}": ${focusPersona.description}`;
      }
    }

    const nodeIdList = screenshotNodes.map((n: any) =>
      `  - nodeId: "${n.nodeId}" → label: "${n.data?.label || ""}"`
    ).join("\n");

    const systemPrompt = `You are a supportive UX consultant conducting a gap analysis of this customer journey map. Your role is to help the team understand where the experience can be strengthened.

Frame all findings constructively — instead of "this is broken" or "this fails", explain what users experience and why it may cause friction. Acknowledge the strengths of the current journey before diving into areas for improvement. Write as a collaborative partner, not a critic.

Your response MUST follow this exact format:

## Executive Summary
(2-3 sentences summarizing the overall journey health, leading with what's working well)

## Findings
Provide findings as a JSON code block:
\`\`\`json
[
  { "type": "gap|terminology|dead-end|missing-connection", "severity": "high|medium|low", "description": "...", "affectedNodes": ["nodeId1", "nodeId2"] }
]
\`\`\`

## Detailed Analysis
(Markdown analysis with specific, constructive recommendations)

Available node IDs:
${nodeIdList || "(none)"}
${focusNote}`;

    // Inject tool context
    const toolContext = await getToolContext(ctx, args.boardId);
    const reportSystemPrompt = systemPrompt + toolContext;

    const boardContext = `### Screens (${screenshotNodes.length}):
${screenDescriptions || "(none)"}

### Connections (${edges.length}):
${connectionDescriptions || "(none)"}

### Attention Flags:
${attentionDescriptions || "(none)"}

### Personas (${personas.length}):
${personaDescriptions || "(none)"}

### Unresolved Comments:
${unresolvedComments || "(none)"}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: reportSystemPrompt }] },
            contents: [{ role: "user", parts: [{ text: `Analyze this journey map:\n\n${boardContext}` }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 8192 },
          }),
        }
      );

      if (!response.ok) return "Failed to generate report.";
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No report generated.";

      // Extract findings JSON
      let findings: any[] = [];
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          findings = JSON.parse(jsonMatch[1]);
        } catch { /* ignore */ }
      }

      // Extract executive summary
      const summaryMatch = text.match(/## Executive Summary\s*([\s\S]*?)(?=\n## )/);
      const summary = summaryMatch ? summaryMatch[1].trim() : "See full report.";

      // Generate title
      const focusPersona = args.personaId ? personas.find((p: any) => p._id === args.personaId) : null;
      const title = focusPersona
        ? `Gap Analysis: ${focusPersona.name} Flow`
        : `Gap Analysis Report`;

      // Save the report
      const reportId = await ctx.runMutation(api.reports.create, {
        boardId: args.boardId,
        title,
        content: text,
        summary,
        findings,
        personaId: args.personaId,
      });

      return reportId;
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  },
});

/**
 * AI UX Walkthrough — walks through every screen in the journey from a UX/UI
 * perspective and generates per-node analysis comments + an overall report.
 *
 * This is the "let the AI agent walk through the system" feature.
 * It creates comments on each screenshot node (from "AI UX Analyst") and
 * generates a summary report with structured findings.
 */
export const runUXWalkthrough = action({
  args: {
    boardId: v.id("boards"),
  },
  returns: v.object({
    commentsCreated: v.number(),
    reportId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    commentsCreated: number;
    reportId?: string;
    error?: string;
  }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { commentsCreated: 0, error: "Gemini API key not configured." };
    }

    // Gather all board data
    const board: any = await ctx.runQuery(api.boards.get, { boardId: args.boardId });
    const nodes: any[] = await ctx.runQuery(api.nodes.getByBoard, { boardId: args.boardId });
    const edges: any[] = await ctx.runQuery(api.edges.getByBoard, { boardId: args.boardId });
    const personas: any[] = await ctx.runQuery(api.personas.getByBoard, { boardId: args.boardId });
    const personaNodes: any[] = await ctx.runQuery(api.personaNodes.getByBoard, { boardId: args.boardId });
    const existingComments: any[] = await ctx.runQuery(api.comments.getByBoard, { boardId: args.boardId });

    const screenshotNodes = nodes.filter((n: any) => n.type === "screenshot");
    const textNodes = nodes.filter((n: any) => n.type === "text");
    const attentionNodes = nodes.filter((n: any) => n.type === "attention");

    if (screenshotNodes.length === 0) {
      return { commentsCreated: 0, error: "No screenshot nodes found on this board." };
    }

    // Build persona assignments map
    const nodePersonaMap: Record<string, string[]> = {};
    for (const pn of personaNodes) {
      const persona = personas.find((p: any) => p._id === pn.personaId);
      if (persona) {
        if (!nodePersonaMap[pn.nodeId]) nodePersonaMap[pn.nodeId] = [];
        nodePersonaMap[pn.nodeId].push(persona.name);
      }
    }

    // Build edge map (what connects to each node)
    const incomingEdges: Record<string, string[]> = {};
    const outgoingEdges: Record<string, string[]> = {};
    for (const e of edges) {
      if (!outgoingEdges[e.source]) outgoingEdges[e.source] = [];
      outgoingEdges[e.source].push(`→ ${findNodeLabel(nodes, e.target)} [${e.label || ""}]`);
      if (!incomingEdges[e.target]) incomingEdges[e.target] = [];
      incomingEdges[e.target].push(`← ${findNodeLabel(nodes, e.source)} [${e.label || ""}]`);
    }

    // Build the full board context for the AI
    const boardContext = buildBoardContext(
      board, screenshotNodes, textNodes, attentionNodes,
      edges, personas, nodePersonaMap, existingComments
    );

    // Build per-node analysis request
    const nodeDescriptions = screenshotNodes.map((n: any) => {
      const assignedPersonas = nodePersonaMap[n.nodeId] || [];
      const incoming = incomingEdges[n.nodeId] || [];
      const outgoing = outgoingEdges[n.nodeId] || [];
      const nodeComments = existingComments.filter(
        (c: any) => c.nodeId === n.nodeId && !c.resolved
      );

      return `### Screen: "${n.data?.label || n.nodeId}" (nodeId: ${n.nodeId})
Platform: ${n.data?.platform || "unknown"}
Personas: ${assignedPersonas.length > 0 ? assignedPersonas.join(", ") : "none assigned"}
Incoming flows: ${incoming.length > 0 ? incoming.join("; ") : "entry point"}
Outgoing flows: ${outgoing.length > 0 ? outgoing.join("; ") : "dead end"}
Existing comments: ${nodeComments.length > 0 ? nodeComments.map((c: any) => `[${c.authorName}] ${c.text.slice(0, 100)}...`).join("; ") : "none"}`;
    }).join("\n\n");

    const systemPrompt = `You are a supportive senior UX/UI colleague conducting a walkthrough of an enterprise software application. You are reviewing each screen in a customer journey map as a collaborative partner helping the team improve the experience.

For EACH screen listed below, you must provide a focused UX analysis. Your response must be a JSON array where each item has:
- "nodeId": the exact nodeId provided
- "comment": your UX analysis (150-300 words). Cover:
  1. First impressions and visual hierarchy — note what works well first
  2. Information architecture and labeling clarity
  3. Navigation flow — is it clear where the user came from and where they can go?
  4. Terminology consistency — flag any terms that differ from other screens
  5. Accessibility and usability observations
  6. Specific, actionable suggestions framed as opportunities (not vague criticism)
  7. If the screen is a dead end (no outgoing flows), explain the user impact

After the per-screen analysis, provide an overall summary object with:
- "overallFindings": array of { "type", "severity" (critical/high/medium/low), "description", "affectedNodes": [nodeIds] }
- "terminologyIssues": array of { "term", "usedOn": [nodeIds], "alternateTerms": [strings], "recommendation" }
- "flowGaps": array of { "description", "fromNode", "toNode" or null }

## Tone
Think of yourself as a trusted colleague doing a design review, not an auditor filing a report. Acknowledge what each screen does well before noting areas for improvement. Frame suggestions constructively: instead of "the navigation is confusing", try "users coming from the previous screen may not immediately see how to proceed — consider adding a visual cue or breadcrumb."

Be specific. Reference actual screen names. If something works well, say so. Focus on user impact in your suggestions.

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, just the JSON object.`;

    // Inject tool context
    const walkthroughToolContext = await getToolContext(ctx, args.boardId);
    const walkthroughSystemPrompt = systemPrompt + walkthroughToolContext;

    const userPrompt = `## Board: "${board?.name || "Unknown"}"
${board?.description || ""}

## Full Board Context
${boardContext}

## Screens to Analyze (${screenshotNodes.length}):

${nodeDescriptions}

Respond with a JSON object: { "screenAnalyses": [...], "overallFindings": [...], "terminologyIssues": [...], "flowGaps": [...] }`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: walkthroughSystemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 16384,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          commentsCreated: 0,
          error: `Gemini API error (${response.status}): ${errorText.slice(0, 200)}`,
        };
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      let parsed: any;
      try {
        // Try parsing directly (responseMimeType should give clean JSON)
        parsed = JSON.parse(rawText);
      } catch {
        // Fallback: try extracting from code block
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          return {
            commentsCreated: 0,
            error: "Failed to parse AI response as JSON.",
          };
        }
      }

      // Create comments for each screen analysis
      let commentsCreated = 0;
      const screenAnalyses = parsed.screenAnalyses || parsed.screen_analyses || [];

      for (const analysis of screenAnalyses) {
        const nodeId = analysis.nodeId || analysis.node_id;
        const comment = analysis.comment || analysis.analysis;
        if (!nodeId || !comment) continue;

        // Check the nodeId actually exists
        const nodeExists = nodes.some((n: any) => n.nodeId === nodeId);
        if (!nodeExists) continue;

        await ctx.runMutation(api.comments.addComment, {
          boardId: args.boardId,
          nodeId,
          authorId: "ai-ux-walkthrough",
          authorName: "AI UX Analyst",
          text: comment,
        });
        commentsCreated++;
      }

      // Build findings for the report
      const findings: any[] = [];
      const overallFindings = parsed.overallFindings || parsed.overall_findings || [];
      for (const f of overallFindings) {
        findings.push({
          type: f.type || "ux-issue",
          severity: f.severity || "medium",
          description: f.description || "",
          affectedNodes: f.affectedNodes || f.affected_nodes || [],
        });
      }

      // Add terminology issues as findings
      const terminologyIssues = parsed.terminologyIssues || parsed.terminology_issues || [];
      for (const t of terminologyIssues) {
        findings.push({
          type: "terminology",
          severity: "medium",
          description: `Term "${t.term}" used on ${(t.usedOn || []).length} screens. Alternates found: ${(t.alternateTerms || t.alternate_terms || []).join(", ")}. Recommendation: ${t.recommendation || "Standardize naming."}`,
          affectedNodes: t.usedOn || [],
        });
      }

      // Add flow gaps as findings
      const flowGaps = parsed.flowGaps || parsed.flow_gaps || [];
      for (const g of flowGaps) {
        findings.push({
          type: "flow-gap",
          severity: "high",
          description: g.description || "",
          affectedNodes: [g.fromNode, g.toNode].filter(Boolean),
        });
      }

      // Build report content
      let reportContent = `## AI UX Walkthrough Report\n\n`;
      reportContent += `**Board:** ${board?.name || "Unknown"}\n`;
      reportContent += `**Screens analyzed:** ${commentsCreated}\n`;
      reportContent += `**Findings:** ${findings.length}\n\n`;

      if (terminologyIssues.length > 0) {
        reportContent += `## Terminology Issues\n\n`;
        for (const t of terminologyIssues) {
          reportContent += `- **"${t.term}"**: Found on ${(t.usedOn || []).join(", ")}. `;
          reportContent += `Alternates: ${(t.alternateTerms || t.alternate_terms || []).join(", ")}. `;
          reportContent += `${t.recommendation || ""}\n`;
        }
        reportContent += "\n";
      }

      if (flowGaps.length > 0) {
        reportContent += `## Flow Gaps\n\n`;
        for (const g of flowGaps) {
          reportContent += `- ${g.description}\n`;
        }
        reportContent += "\n";
      }

      reportContent += `## Per-Screen Analyses\n\n`;
      for (const analysis of screenAnalyses) {
        const nodeId = analysis.nodeId || analysis.node_id;
        const comment = analysis.comment || analysis.analysis;
        if (!nodeId || !comment) continue;
        const node = screenshotNodes.find((n: any) => n.nodeId === nodeId);
        reportContent += `### ${node?.data?.label || nodeId}\n${comment}\n\n`;
      }

      // Save report
      let reportId: string | undefined;
      if (findings.length > 0 || commentsCreated > 0) {
        reportId = await ctx.runMutation(api.reports.create, {
          boardId: args.boardId,
          title: "AI UX Walkthrough Analysis",
          content: reportContent,
          summary: `AI analyzed ${commentsCreated} screens. Found ${findings.length} issues: ${findings.filter(f => f.severity === "critical" || f.severity === "high").length} critical/high, ${findings.filter(f => f.severity === "medium").length} medium, ${findings.filter(f => f.severity === "low").length} low.`,
          findings,
        });
      }

      return { commentsCreated, reportId };
    } catch (error: any) {
      return {
        commentsCreated: 0,
        error: `Error: ${error.message}`,
      };
    }
  },
});

/**
 * Generate an improvement suggestion by analyzing connected screenshot nodes.
 * Uses Gemini vision to analyze screenshot images when available.
 */
export const generateImprovement = action({
  args: {
    boardId: v.id("boards"),
    connectedNodeIds: v.array(v.string()),
    promptOverride: v.optional(v.string()),
  },
  returns: v.object({
    title: v.string(),
    content: v.string(),
    developerTodos: v.string(),
    priority: v.string(),
    structuredTodos: v.optional(v.array(v.object({
      text: v.string(),
      phase: v.optional(v.string()),
    }))),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    title: string;
    content: string;
    developerTodos: string;
    priority: string;
    structuredTodos?: { text: string; phase?: string }[];
    error?: string;
  }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        title: "API Key Missing",
        content: "",
        developerTodos: "",
        priority: "medium",
        structuredTodos: [],
        error: "Gemini API key not configured.",
      };
    }

    const board: any = await ctx.runQuery(api.boards.get, { boardId: args.boardId });
    const nodes: any[] = await ctx.runQuery(api.nodes.getByBoard, { boardId: args.boardId });
    const edges: any[] = await ctx.runQuery(api.edges.getByBoard, { boardId: args.boardId });
    const comments: any[] = await ctx.runQuery(api.comments.getByBoard, { boardId: args.boardId });

    // Get connected nodes
    const connectedNodes = nodes.filter((n: any) =>
      args.connectedNodeIds.includes(n.nodeId)
    );

    const nodeDescriptions = connectedNodes.map((n: any) => {
      const nodeComments = comments
        .filter((c: any) => c.nodeId === n.nodeId && !c.resolved)
        .map((c: any) => `  - ${c.authorName}: ${c.text.slice(0, 150)}`);

      // Find edges to/from this node
      const incoming = edges
        .filter((e: any) => e.target === n.nodeId)
        .map((e: any) => `← ${findNodeLabel(nodes, e.source)} [${e.label || ""}]`);
      const outgoing = edges
        .filter((e: any) => e.source === n.nodeId)
        .map((e: any) => `→ ${findNodeLabel(nodes, e.target)} [${e.label || ""}]`);

      return `Screen: "${n.data?.label || n.data?.text || n.nodeId}"
Platform: ${n.data?.platform || "unknown"}
Type: ${n.type}
Incoming: ${incoming.join("; ") || "none"}
Outgoing: ${outgoing.join("; ") || "none"}
Comments:\n${nodeComments.join("\n") || "  (none)"}`;
    }).join("\n\n");

    // Try to get custom prompt from templates
    let systemPrompt = args.promptOverride || "";
    if (!systemPrompt) {
      try {
        const template: any = await ctx.runQuery(api.promptTemplates.getByKey, {
          key: "improvement_generate",
        });
        if (template) {
          systemPrompt = template.prompt;
        }
      } catch {
        // Template table may not exist yet
      }
    }
    if (!systemPrompt) {
      systemPrompt = `You are a senior UX improvement analyst conducting a deep-dive analysis of a customer journey. Your task is to thoroughly examine the connected screens and produce a comprehensive, granular improvement suggestion. DO NOT summarize or take shortcuts — be exhaustive and specific.

## Tone Guidelines
- NEVER use dismissive or harsh language like "this is broken", "poorly designed", "fails", "terrible", or "unusable"
- Frame observations as user experience insights: "users may struggle here because..." or "the cognitive load increases when..."
- Acknowledge what the current design does well before identifying areas for improvement
- Explain the reasoning behind each suggestion — help the team understand the user's perspective
- Use language that invites collaboration: "consider", "one approach would be", "this could be strengthened by"

CRITICAL RULES:
1. When referencing any screen or page name, ALWAYS wrap it in **double asterisks** like **Screen Name**. This enables clickable navigation in the UI.
2. Do NOT condense multiple observations into one sentence. Break down each one separately and explain WHY it matters for users.
3. Write as if you're presenting to a product team that needs to understand the FULL context without looking at the screens themselves.
4. Reference specific UI elements, labels, buttons, navigation paths, and user actions by name.
5. The content field must contain all three analysis sections as markdown — each 150-300+ words.
6. The developerTodos section MUST be a sequenced, numbered checklist grouped by implementation phase. Each item must be a single, actionable task a developer can complete and check off independently.

Respond with a JSON object with these fields:

{
  "title": "A clear, descriptive improvement title (10-15 words) that captures the opportunity",

  "content": "A comprehensive markdown analysis with three labeled sections. Write each section as multiple paragraphs:\\n\\n## Problem / Current State\\nStart by acknowledging what works well. Then describe what the user sees and experiences step by step, identifying where they may encounter friction. Reference screens using **Screen Name** format.\\n\\n## Proposed Solution\\nA detailed multi-paragraph solution addressing every observation. Be prescriptive — describe exactly what to change and how. Reference screens using **Screen Name** format.\\n\\n## Expected Impact\\nCover: direct UX improvements, measurable metrics, business impact, which personas benefit most, and any risks or trade-offs.",

  "developerTodos": "A structured, sequenced developer checklist as markdown text. Format with phase headers:\\n\\nPhase 1: Quick Wins (< 1 day)\\n1. [ ] Change button label on **Screen Name**\\n2. [ ] Add loading state to form submit\\n\\nPhase 2: Navigation & Flow (2-3 days)\\n3. [ ] Add breadcrumb bar on **Screen Name**\\n\\nPhase 3: Structural Changes (1+ week)\\n4. [ ] Refactor settings panel\\n\\nEach task must be specific enough that a developer knows exactly what to change. Number all tasks sequentially across phases.",

  "structuredTodos": [
    { "text": "Change button label from 'Submit' to 'Save Changes' on **Screen Name**", "phase": "Phase 1: Quick Wins" },
    { "text": "Add loading spinner to form submit action", "phase": "Phase 1: Quick Wins" },
    { "text": "Add breadcrumb navigation bar on **Screen Name**", "phase": "Phase 2: Navigation & Flow" },
    { "text": "Refactor settings panel into tabbed layout", "phase": "Phase 3: Structural Changes" }
  ],

  "priority": "high|medium|low — based on severity of current friction, number of affected users, and implementation complexity"
}

IMPORTANT: The "structuredTodos" array MUST mirror the same tasks from "developerTodos" but as individual structured objects. Each todo must have a "text" describing a single, actionable task, and a "phase" grouping label. Include 6-15 specific, granular sub-tasks covering the full scope of work. Be exhaustive — break larger tasks into smaller checkable steps.

Return ONLY valid JSON. Every screen name mentioned MUST be wrapped in **double asterisks**.`;
    }

    // Also gather attention blocks and text annotations for fuller context
    const attentionNodes = nodes.filter((n: any) => n.type === "attention");
    const textNodes = nodes.filter((n: any) => n.type === "text");

    const attentionContext = attentionNodes.map((n: any) =>
      `- ATTENTION FLAG: "${n.data?.text || "No description"}"`
    ).join("\n");

    const annotationContext = textNodes.map((n: any) =>
      `- Annotation: "${n.data?.text?.slice(0, 200) || ""}"`
    ).join("\n");

    // Build a full edge map for context
    const allEdgeDescriptions = edges.map((e: any) => {
      const src = findNodeLabel(nodes, e.source);
      const tgt = findNodeLabel(nodes, e.target);
      return `- "${src}" → "${tgt}"${e.label ? ` [${e.label}]` : ""}`;
    }).join("\n");

    const userPrompt = `## Journey Board: "${board?.name || "Unknown"}"
${board?.description ? `Description: ${board.description}` : ""}

## Full Journey Context
All screens in this journey (${nodes.filter((n: any) => n.type === "screenshot").length} total):
${nodes.filter((n: any) => n.type === "screenshot").map((n: any) => `- "${n.data?.label || n.nodeId}" (${n.data?.platform || "unknown"})`).join("\n")}

All connections (${edges.length} total):
${allEdgeDescriptions || "(none)"}

Attention flags:
${attentionContext || "(none)"}

Annotations:
${annotationContext || "(none)"}

## Connected Screens to Analyze for This Improvement (${connectedNodes.length}):

${nodeDescriptions}

## Instructions
Analyze the connected screens listed above in the context of the full journey. Produce ONE comprehensive improvement suggestion. Be extremely thorough and detailed in all fields. Reference screen names wrapped in **double asterisks** so they become clickable links. Do NOT summarize — write full, detailed paragraphs for each section. Return ONLY valid JSON.`;

    // Inject tool context
    const improvementToolContext = await getToolContext(ctx, args.boardId);
    const improvementSystemPrompt = systemPrompt + improvementToolContext;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: improvementSystemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          title: "Generation Failed",
          content: "",
          developerTodos: "",
          priority: "medium",
          structuredTodos: [],
          error: `API error (${response.status}): ${errorText.slice(0, 200)}`,
        };
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      let parsed: any;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          return {
            title: "Parse Error",
            content: "",
            developerTodos: "",
            priority: "medium",
            structuredTodos: [],
            error: "Failed to parse AI response.",
          };
        }
      }

      // Build content: prefer parsed.content, fall back to concatenating legacy fields
      let content = parsed.content || "";
      if (!content) {
        const parts: string[] = [];
        if (parsed.currentState || parsed.current_state) {
          parts.push(`## Problem / Current State\n${parsed.currentState || parsed.current_state}`);
        }
        if (parsed.proposedImprovement || parsed.proposed_improvement) {
          parts.push(`## Proposed Solution\n${parsed.proposedImprovement || parsed.proposed_improvement}`);
        }
        if (parsed.expectedImpact || parsed.expected_impact) {
          parts.push(`## Expected Impact\n${parsed.expectedImpact || parsed.expected_impact}`);
        }
        content = parts.join("\n\n");
      }

      // Parse structured todos
      const rawTodos = parsed.structuredTodos || parsed.structured_todos || [];
      const structuredTodos = rawTodos
        .filter((t: any) => t && t.text)
        .map((t: any) => ({
          text: String(t.text),
          phase: t.phase ? String(t.phase) : undefined,
        }));

      return {
        title: parsed.title || "Untitled Improvement",
        content,
        developerTodos: parsed.developerTodos || parsed.developer_todos || "",
        priority: parsed.priority || "medium",
        structuredTodos: structuredTodos.length > 0 ? structuredTodos : undefined,
      };
    } catch (error: any) {
      return {
        title: "Error",
        content: "",
        developerTodos: "",
        priority: "medium",
        structuredTodos: [],
        error: `Error: ${error.message}`,
      };
    }
  },
});

async function getToolContext(ctx: any, boardId: any): Promise<string> {
  try {
    const board = await ctx.runQuery(api.boards.get, { boardId });
    if (!board?.toolIds || board.toolIds.length === 0) return "";

    const tools = await ctx.runQuery(api.tools.getByIds, { toolIds: board.toolIds });
    if (!tools || tools.length === 0) return "";

    const sections = tools.map((t: any) =>
      `### ${t.name}${t.category ? ` (${t.category})` : ""}\n${t.description}`
    ).join("\n\n");

    return `\n\n## Tool / Product Context\nThe following tools are relevant to this journey. Use this background knowledge when analyzing screens and making suggestions:\n\n${sections}`;
  } catch {
    return "";
  }
}

function findNodeLabel(nodes: any[], nodeId: string): string {
  const node = nodes.find((n: any) => n.nodeId === nodeId);
  return node?.data?.label || node?.data?.text?.slice(0, 40) || nodeId;
}

function buildBoardContext(
  board: any,
  screenshotNodes: any[],
  textNodes: any[],
  attentionNodes: any[],
  edges: any[],
  personas: any[],
  nodePersonaMap: Record<string, string[]>,
  comments: any[]
): string {
  const screens = screenshotNodes.map((n: any) => {
    const ps = nodePersonaMap[n.nodeId] || [];
    return `- "${n.data?.label || n.nodeId}" (${n.data?.platform || "?"}, personas: ${ps.join(", ") || "none"})`;
  }).join("\n");

  const connections = edges.map((e: any) => {
    const src = findNodeLabel([...screenshotNodes, ...textNodes], e.source);
    const tgt = findNodeLabel([...screenshotNodes, ...textNodes], e.target);
    return `- "${src}" → "${tgt}" [${e.label || ""}]`;
  }).join("\n");

  const annotations = textNodes.map((n: any) =>
    `- ${n.data?.text?.slice(0, 100) || ""}`
  ).join("\n");

  const attention = attentionNodes.map((n: any) =>
    `- ⚠ ${n.data?.text?.slice(0, 100) || ""}`
  ).join("\n");

  const personaList = personas.map((p: any) =>
    `- ${p.name}: ${p.description.slice(0, 150)}...`
  ).join("\n");

  return `Screens:\n${screens}\n\nConnections:\n${connections}\n\nAnnotations:\n${annotations}\n\nAttention Flags:\n${attention}\n\nPersonas:\n${personaList}`;
}
