import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getVersionHistory = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const board = await ctx.db.get(args.boardId);
    if (!board) return [];

    const rootId = board.rootBoardId || args.boardId;

    // Get all boards sharing the same rootBoardId
    const versionedBoards = await ctx.db
      .query("boards")
      .withIndex("by_root", (q) => q.eq("rootBoardId", rootId))
      .collect();

    // Also include the root board itself
    const rootBoard = await ctx.db.get(rootId);
    const allVersions = rootBoard ? [rootBoard, ...versionedBoards] : versionedBoards;

    // Deduplicate (root board may appear in both)
    const seen = new Set<string>();
    const unique = allVersions.filter((b) => {
      if (seen.has(b._id)) return false;
      seen.add(b._id);
      return true;
    });

    return unique.sort((a, b) => {
      const vA = a.version || "1.0";
      const vB = b.version || "1.0";
      return vA.localeCompare(vB, undefined, { numeric: true });
    });
  },
});

export const cloneBoard = mutation({
  args: {
    sourceBoardId: v.id("boards"),
    versionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sourceBoard = await ctx.db.get(args.sourceBoardId);
    if (!sourceBoard) throw new Error("Board not found");

    // Determine root board ID and next version
    const rootId = sourceBoard.rootBoardId || args.sourceBoardId;
    const currentVersion = sourceBoard.version || "1.0";

    // Parse and increment version
    const parts = currentVersion.split(".");
    const minor = parseInt(parts[1] || "0") + 1;
    const newVersion = `${parts[0]}.${minor}`;

    const now = Date.now();

    // Create the new board
    const newBoardId = await ctx.db.insert("boards", {
      name: sourceBoard.name,
      description: sourceBoard.description,
      ownerId: sourceBoard.ownerId,
      createdAt: now,
      updatedAt: now,
      version: newVersion,
      parentBoardId: args.sourceBoardId,
      rootBoardId: rootId,
      versionNote: args.versionNote,
      toolIds: sourceBoard.toolIds,
    });

    // If source board doesn't have rootBoardId, update it to point to itself
    if (!sourceBoard.rootBoardId && !sourceBoard.version) {
      await ctx.db.patch(args.sourceBoardId, {
        rootBoardId: args.sourceBoardId,
        version: "1.0",
      });
    }

    // Clone all nodes
    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.sourceBoardId))
      .collect();
    for (const node of nodes) {
      await ctx.db.insert("nodes", {
        boardId: newBoardId,
        nodeId: node.nodeId,
        type: node.type,
        position: node.position,
        data: node.data,
        width: node.width,
        height: node.height,
      });
    }

    // Clone all edges
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", args.sourceBoardId))
      .collect();
    for (const edge of edges) {
      await ctx.db.insert("edges", {
        boardId: newBoardId,
        edgeId: edge.edgeId,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: edge.label,
        type: edge.type,
      });
    }

    // Clone personas (track old -> new ID mapping)
    const personas = await ctx.db
      .query("personas")
      .withIndex("by_board", (q) => q.eq("boardId", args.sourceBoardId))
      .collect();
    const personaIdMap = new Map<string, string>();
    for (const persona of personas) {
      const newPersonaId = await ctx.db.insert("personas", {
        boardId: newBoardId,
        name: persona.name,
        description: persona.description,
        color: persona.color,
        order: persona.order,
      });
      personaIdMap.set(persona._id, newPersonaId);
    }

    // Clone personaNodes with mapped IDs
    const personaNodes = await ctx.db
      .query("personaNodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.sourceBoardId))
      .collect();
    for (const pn of personaNodes) {
      const newPersonaId = personaIdMap.get(pn.personaId);
      if (newPersonaId) {
        await ctx.db.insert("personaNodes", {
          boardId: newBoardId,
          personaId: newPersonaId as any,
          nodeId: pn.nodeId,
        });
      }
    }

    // Clone screenshots references (storage IDs are shared, not duplicated)
    const screenshots = await ctx.db
      .query("screenshots")
      .withIndex("by_board", (q) => q.eq("boardId", args.sourceBoardId))
      .collect();
    for (const screenshot of screenshots) {
      await ctx.db.insert("screenshots", {
        boardId: newBoardId,
        storageId: screenshot.storageId,
        filename: screenshot.filename,
        contentType: screenshot.contentType,
        label: screenshot.label,
        platform: screenshot.platform,
        folder: screenshot.folder,
        tags: screenshot.tags,
        createdAt: screenshot.createdAt,
      });
    }

    // Clone improvements (with all fields) — track old→new ID for todos
    const improvements = await ctx.db
      .query("improvements")
      .withIndex("by_board", (q) => q.eq("boardId", args.sourceBoardId))
      .collect();
    const improvementIdMap = new Map<string, string>();
    for (const imp of improvements) {
      const newImpId = await ctx.db.insert("improvements", {
        boardId: newBoardId,
        nodeId: imp.nodeId,
        number: imp.number,
        title: imp.title,
        content: imp.content,
        currentState: imp.currentState,
        proposedImprovement: imp.proposedImprovement,
        expectedImpact: imp.expectedImpact,
        developerTodos: imp.developerTodos,
        priority: imp.priority,
        status: imp.status,
        connectedNodeIds: imp.connectedNodeIds,
        generatedByAI: imp.generatedByAI,
        createdAt: imp.createdAt,
        assigneeId: imp.assigneeId,
        assigneeName: imp.assigneeName,
        createdById: imp.createdById,
        createdByName: imp.createdByName,
        closedAt: imp.closedAt,
        statusHistory: imp.statusHistory,
      });
      improvementIdMap.set(imp._id, newImpId);
    }

    // Clone improvement todos with mapped improvement IDs
    const allTodos = await ctx.db
      .query("improvementTodos")
      .withIndex("by_board", (q) => q.eq("boardId", args.sourceBoardId))
      .collect();
    for (const todo of allTodos) {
      const newImpId = improvementIdMap.get(todo.improvementId);
      if (newImpId) {
        await ctx.db.insert("improvementTodos", {
          improvementId: newImpId as any,
          boardId: newBoardId,
          text: todo.text,
          completed: todo.completed,
          completedAt: todo.completedAt,
          completedBy: todo.completedBy,
          completedByName: todo.completedByName,
          completionNote: todo.completionNote,
          order: todo.order,
          phase: todo.phase,
          createdAt: todo.createdAt,
          createdBy: todo.createdBy,
          createdByName: todo.createdByName,
        });
      }
    }

    return newBoardId;
  },
});

export const applyProposals = mutation({
  args: {
    sourceBoardId: v.id("boards"),
    proposals: v.array(v.any()),
    versionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Step 1: Clone the board (reuse cloneBoard logic inline)
    const sourceBoard = await ctx.db.get(args.sourceBoardId);
    if (!sourceBoard) throw new Error("Board not found");

    const rootId = sourceBoard.rootBoardId || args.sourceBoardId;
    const currentVersion = sourceBoard.version || "1.0";
    const parts = currentVersion.split(".");
    const minor = parseInt(parts[1] || "0") + 1;
    const newVersion = `${parts[0]}.${minor}`;
    const now = Date.now();

    const newBoardId = await ctx.db.insert("boards", {
      name: sourceBoard.name,
      description: sourceBoard.description,
      ownerId: sourceBoard.ownerId,
      createdAt: now,
      updatedAt: now,
      version: newVersion,
      parentBoardId: args.sourceBoardId,
      rootBoardId: rootId,
      versionNote: args.versionNote || "AI-proposed changes applied",
      toolIds: sourceBoard.toolIds,
    });

    if (!sourceBoard.rootBoardId && !sourceBoard.version) {
      await ctx.db.patch(args.sourceBoardId, {
        rootBoardId: args.sourceBoardId,
        version: "1.0",
      });
    }

    // Clone existing data
    const nodes = await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.sourceBoardId))
      .collect();
    for (const node of nodes) {
      await ctx.db.insert("nodes", {
        boardId: newBoardId,
        nodeId: node.nodeId,
        type: node.type,
        position: node.position,
        data: node.data,
        width: node.width,
        height: node.height,
      });
    }

    const edges = await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", args.sourceBoardId))
      .collect();
    for (const edge of edges) {
      await ctx.db.insert("edges", {
        boardId: newBoardId,
        edgeId: edge.edgeId,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: edge.label,
        type: edge.type,
      });
    }

    const personas = await ctx.db
      .query("personas")
      .withIndex("by_board", (q) => q.eq("boardId", args.sourceBoardId))
      .collect();
    const applyPersonaIdMap = new Map<string, string>();
    for (const persona of personas) {
      const newPersonaId = await ctx.db.insert("personas", {
        boardId: newBoardId,
        name: persona.name,
        description: persona.description,
        color: persona.color,
        order: persona.order,
      });
      applyPersonaIdMap.set(persona._id, newPersonaId);
    }

    // Clone personaNodes with mapped IDs
    const applyPersonaNodes = await ctx.db
      .query("personaNodes")
      .withIndex("by_board", (q) => q.eq("boardId", args.sourceBoardId))
      .collect();
    for (const pn of applyPersonaNodes) {
      const newPersonaId = applyPersonaIdMap.get(pn.personaId);
      if (newPersonaId) {
        await ctx.db.insert("personaNodes", {
          boardId: newBoardId,
          personaId: newPersonaId as any,
          nodeId: pn.nodeId,
        });
      }
    }

    const screenshots = await ctx.db
      .query("screenshots")
      .withIndex("by_board", (q) => q.eq("boardId", args.sourceBoardId))
      .collect();
    for (const screenshot of screenshots) {
      await ctx.db.insert("screenshots", {
        boardId: newBoardId,
        storageId: screenshot.storageId,
        filename: screenshot.filename,
        contentType: screenshot.contentType,
        label: screenshot.label,
        platform: screenshot.platform,
        folder: screenshot.folder,
        tags: screenshot.tags,
        createdAt: screenshot.createdAt,
      });
    }

    // Step 2: Apply proposals to the NEW board
    // Re-fetch the cloned nodes/edges so we can reference them
    const clonedNodes = await ctx.db
      .query("nodes")
      .withIndex("by_board", (q) => q.eq("boardId", newBoardId))
      .collect();
    const clonedEdges = await ctx.db
      .query("edges")
      .withIndex("by_board", (q) => q.eq("boardId", newBoardId))
      .collect();

    let addedNodeCount = 0;

    for (const proposal of args.proposals) {
      if (proposal.action === "addNode") {
        // Find the "afterNode" to position relative to it
        let position = { x: 200 + addedNodeCount * 300, y: 400 };
        if (proposal.afterNode) {
          const refNode = clonedNodes.find((n) => n.nodeId === proposal.afterNode);
          if (refNode) {
            position = {
              x: refNode.position.x,
              y: refNode.position.y + 300,
            };
          }
        }

        const nodeId = `ai-${Date.now()}-${addedNodeCount}`;
        await ctx.db.insert("nodes", {
          boardId: newBoardId,
          nodeId,
          type: "text",
          position,
          data: {
            text: `[AI Proposed] ${proposal.label || "New Screen"}${proposal.platform ? ` (${proposal.platform})` : ""}`,
          },
        });

        // Track so later proposals can reference this node
        clonedNodes.push({
          _id: "" as any,
          _creationTime: 0,
          boardId: newBoardId,
          nodeId,
          type: "text",
          position,
          data: { text: proposal.label },
        });

        // Auto-connect from afterNode if specified
        if (proposal.afterNode) {
          const edgeId = `ai-edge-${Date.now()}-${addedNodeCount}`;
          await ctx.db.insert("edges", {
            boardId: newBoardId,
            edgeId,
            source: proposal.afterNode,
            target: nodeId,
            label: proposal.connectionLabel || "",
            type: "labeled",
          });
        }

        addedNodeCount++;
      } else if (proposal.action === "addEdge") {
        // Resolve node IDs — proposals may use nodeId or label
        let sourceId = proposal.source;
        let targetId = proposal.target;

        // If source/target look like labels, try to find matching nodes
        if (sourceId && !clonedNodes.find((n) => n.nodeId === sourceId)) {
          const byLabel = clonedNodes.find(
            (n) => n.data?.label?.toLowerCase() === sourceId.toLowerCase() ||
                   n.data?.text?.toLowerCase() === sourceId.toLowerCase()
          );
          if (byLabel) sourceId = byLabel.nodeId;
        }
        if (targetId && !clonedNodes.find((n) => n.nodeId === targetId)) {
          const byLabel = clonedNodes.find(
            (n) => n.data?.label?.toLowerCase() === targetId.toLowerCase() ||
                   n.data?.text?.toLowerCase() === targetId.toLowerCase()
          );
          if (byLabel) targetId = byLabel.nodeId;
        }

        if (sourceId && targetId) {
          const edgeId = `ai-edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await ctx.db.insert("edges", {
            boardId: newBoardId,
            edgeId,
            source: sourceId,
            target: targetId,
            label: proposal.label || "",
            type: "labeled",
          });
        }
      } else if (proposal.action === "relabelEdge") {
        // Find edge by source + target
        const edge = clonedEdges.find(
          (e) => e.source === proposal.edgeSource && e.target === proposal.edgeTarget
        );
        if (edge) {
          await ctx.db.patch(edge._id, { label: proposal.newLabel || "" });
        }
      } else if (proposal.action === "removeNode") {
        const node = clonedNodes.find((n) => n.nodeId === proposal.nodeId);
        if (node && node._id) {
          await ctx.db.delete(node._id);
          // Delete connected edges
          for (const e of clonedEdges) {
            if (e.source === proposal.nodeId || e.target === proposal.nodeId) {
              await ctx.db.delete(e._id);
            }
          }
        }
      } else if (proposal.action === "removeEdge") {
        const edge = clonedEdges.find(
          (e) => e.source === proposal.source && e.target === proposal.target
        );
        if (edge) {
          await ctx.db.delete(edge._id);
        }
      }
    }

    await ctx.db.patch(newBoardId, { updatedAt: Date.now() });

    return newBoardId;
  },
});
