"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  reconnectEdge,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { nanoid } from "nanoid";

import ScreenshotNode from "@/components/nodes/ScreenshotNode";
import TextNode from "@/components/nodes/TextNode";
import AttentionNode from "@/components/nodes/AttentionNode";
import ImprovementNode from "@/components/nodes/ImprovementNode";
import LabeledEdge from "@/components/edges/LabeledEdge";
import Toolbar from "./Toolbar";
import ScreenshotSidebar from "./ScreenshotSidebar";
import RightPanel from "./RightPanel";
import VersionBanner from "./VersionBanner";
import { useFlowStore } from "@/store/flowStore";

const nodeTypes = {
  screenshot: ScreenshotNode,
  text: TextNode,
  attention: AttentionNode,
  improvement: ImprovementNode,
};

const edgeTypes = {
  labeled: LabeledEdge,
};

const DEFAULT_SCREENSHOT_WIDTH = 220;

interface FlowCanvasProps {
  boardId: Id<"boards">;
  boardName: string;
}

export default function FlowCanvas({ boardId, boardName }: FlowCanvasProps) {
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Convex queries
  const board = useQuery(api.boards.get, { boardId });
  const dbNodes = useQuery(api.nodes.getByBoard, { boardId });
  const dbEdges = useQuery(api.edges.getByBoard, { boardId });
  const personas = useQuery(api.personas.getByBoard, { boardId });
  const comments = useQuery(api.comments.getByBoard, { boardId });
  const personaNodeAssignments = useQuery(api.personaNodes.getByBoard, { boardId });
  const improvements = useQuery(api.improvements.getByBoard, { boardId });

  // Convex mutations
  const addNodeMutation = useMutation(api.nodes.addNode);
  const updatePositionMutation = useMutation(api.nodes.updatePosition);
  const bulkUpdatePositionsMutation = useMutation(api.nodes.bulkUpdatePositions);
  const updateNodeDataMutation = useMutation(api.nodes.updateData);
  const updateDimensionsMutation = useMutation(api.nodes.updateDimensions);
  const deleteNodeMutation = useMutation(api.nodes.deleteNode);
  const addEdgeMutation = useMutation(api.edges.addEdge);
  const updateEdgeLabelMutation = useMutation(api.edges.updateLabel);
  const deleteEdgeMutation = useMutation(api.edges.deleteEdge);
  const linkToBoard = useMutation(api.globalScreenshots.linkToBoard);
  const convertToScreenshotMutation = useMutation(api.nodes.convertToScreenshot);
  const updateConnectionMutation = useMutation(api.edges.updateConnection);
  const updateBoardTools = useMutation(api.boards.updateTools);
  const createImprovement = useMutation(api.improvements.create);
  const updateImprovement = useMutation(api.improvements.update);
  const clearImprovementContent = useMutation(api.improvements.clearContent);
  const generateImprovementAction = useAction(api.gemini.generateImprovement);
  const slackNotifyNewImprovement = useAction(api.slack.notifyNewImprovement);
  const bulkCreateTodos = useMutation(api.improvementTodos.bulkCreate);

  // Local React Flow state
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [openCommentsForNode, setOpenCommentsForNode] = useState<string | null>(null);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [improvementFilter, setImprovementFilter] = useState<"all" | "open" | "in_progress" | "closed" | "hidden">("all");
  const [generatingNodeIds, setGeneratingNodeIds] = useState<Set<string>>(new Set());

  // Sync blocking: prevents Convex from overwriting local state during/after operations
  const isDragging = useRef(false);
  const syncBlockedUntil = useRef(0);
  const hasInitialized = useRef(false);

  // Block sync for a given duration (ms) after a local mutation
  const blockSync = useCallback((durationMs: number = 2000) => {
    syncBlockedUntil.current = Date.now() + durationMs;
  }, []);

  // Zustand store for undo/redo
  const store = useFlowStore();

  // Build persona lookup map
  const personaMap = new Map<string, { name: string; color: string }>();
  if (personas) {
    for (const p of personas) {
      personaMap.set(p._id, { name: p.name, color: p.color });
    }
  }

  // Build many-to-many persona-node map: nodeId -> [{ personaId, name, color }]
  const nodePersonaMap = new Map<string, { personaId: string; name: string; color: string }[]>();
  if (personaNodeAssignments && personas) {
    for (const pn of personaNodeAssignments) {
      const persona = personaMap.get(pn.personaId);
      if (persona) {
        const existing = nodePersonaMap.get(pn.nodeId) || [];
        existing.push({ personaId: pn.personaId, name: persona.name, color: persona.color });
        nodePersonaMap.set(pn.nodeId, existing);
      }
    }
  }

  // Build set of highlighted node IDs when a persona is active
  const highlightedNodeIds = new Set<string>();
  if (activePersonaId && personaNodeAssignments) {
    for (const pn of personaNodeAssignments) {
      if (pn.personaId === activePersonaId) {
        highlightedNodeIds.add(pn.nodeId);
      }
    }
  }

  // Build comment count map (unresolved comments per node)
  const commentCountMap = new Map<string, number>();
  if (comments) {
    for (const c of comments) {
      if (c.nodeId && !c.resolved) {
        commentCountMap.set(c.nodeId, (commentCountMap.get(c.nodeId) || 0) + 1);
      }
    }
  }

  // Build improvement lookup: nodeId -> improvement record
  const improvementMap = new Map<string, any>();
  if (improvements) {
    for (const imp of improvements) {
      improvementMap.set(imp.nodeId, imp);
    }
  }

  // Sync from Convex -> local state (blocked during drag/resize/mutation)
  useEffect(() => {
    if (!dbNodes || isDragging.current || Date.now() < syncBlockedUntil.current) return;

    const flowNodes: Node[] = dbNodes.map((n: any) => {
      // Look up multi-persona info
      const assignedPersonas = nodePersonaMap.get(n.nodeId) || [];
      const commentCount = commentCountMap.get(n.nodeId) || 0;

      // Highlight styling
      let highlightStyle: Record<string, unknown> | undefined;
      if (activePersonaId) {
        const isHighlighted = highlightedNodeIds.has(n.nodeId);
        if (isHighlighted) {
          const activePersona = personaMap.get(activePersonaId);
          highlightStyle = {
            opacity: 1,
            boxShadow: `0 0 0 3px ${activePersona?.color || "#3b82f6"}40`,
            borderRadius: "8px",
          };
        } else {
          highlightStyle = { opacity: 0.15 };
        }
      }

      // Improvement filter styling
      let improvementHidden = false;
      if (n.type === "improvement" && improvementFilter !== "all") {
        const imp = improvementMap.get(n.nodeId);
        if (improvementFilter === "hidden") {
          improvementHidden = true;
        } else if (improvementFilter === "open" && imp?.status !== "open") {
          highlightStyle = { ...highlightStyle, opacity: 0.2 };
        } else if (improvementFilter === "in_progress" && imp?.status !== "in_progress") {
          highlightStyle = { ...highlightStyle, opacity: 0.2 };
        } else if (improvementFilter === "closed" && imp?.status !== "closed") {
          highlightStyle = { ...highlightStyle, opacity: 0.2 };
        }
      }

      // Enrich improvement nodes with data from improvements table
      let improvementData: Record<string, unknown> = {};
      if (n.type === "improvement") {
        const imp = improvementMap.get(n.nodeId);
        // Count connected screenshot nodes via edges
        const connectedIds = new Set<string>();
        if (dbEdges) {
          for (const e of dbEdges) {
            if (e.source === n.nodeId) connectedIds.add(e.target);
            if (e.target === n.nodeId) connectedIds.add(e.source);
          }
        }
        const screenshotConnections = dbNodes
          ? Array.from(connectedIds).filter((id) =>
              dbNodes.some((dn: any) => dn.nodeId === id && (dn.type === "screenshot" || dn.type === "text"))
            )
          : [];

        // Build connected screen labels for rich text rendering
        const connectedScreenLabels = screenshotConnections.map((cid) => {
          const cNode = dbNodes?.find((dn: any) => dn.nodeId === cid);
          return {
            nodeId: cid,
            label: cNode?.data?.label || cNode?.data?.text || cid,
          };
        });

        improvementData = {
          improvementNumber: imp?.number || 0,
          status: imp?.status || "open",
          content: imp?.content || "",
          currentState: imp?.currentState || "",
          proposedImprovement: imp?.proposedImprovement || "",
          expectedImpact: imp?.expectedImpact || "",
          developerTodos: imp?.developerTodos || "",
          priority: imp?.priority || "",
          generatedByAI: imp?.generatedByAI || false,
          assigneeName: imp?.assigneeName || "",
          createdByName: imp?.createdByName || "",
          connectedScreenshotCount: screenshotConnections.length,
          connectedScreens: connectedScreenLabels,
          generating: generatingNodeIds.has(n.nodeId),
          onGenerate: () => handleGenerateImprovement(n.nodeId),
          onClear: () => {
            const impRecord = improvementMap.get(n.nodeId);
            if (impRecord) {
              clearImprovementContent({ improvementId: impRecord._id });
              updateNodeDataMutation({ boardId, nodeId: n.nodeId, data: { text: "New improvement" } });
            }
          },
          onUpdateField: (field: string, value: string) => {
            const impRecord = improvementMap.get(n.nodeId);
            if (impRecord) {
              updateImprovement({
                improvementId: impRecord._id,
                [field]: value,
              });
              // Also update title on canvas node if that's the field
              if (field === "title") {
                updateNodeDataMutation({ boardId, nodeId: n.nodeId, data: { text: value } });
              }
            }
          },
          onFocusNode: (nodeId: string) => {
            fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.5 });
          },
        };
      }

      return {
        id: n.nodeId,
        type: n.type,
        position: n.position,
        hidden: improvementHidden,
        style: {
          ...(n.type === "screenshot"
            ? { width: n.width || DEFAULT_SCREENSHOT_WIDTH }
            : n.type === "improvement"
              ? { width: n.width || 380 }
              : {
                  ...(n.width ? { width: n.width } : {}),
                  ...(n.height ? { height: n.height } : {}),
                }),
          ...highlightStyle,
        },
        data: {
          ...n.data,
          assignedPersonas,
          commentCount,
          onOpenComments: () => setOpenCommentsForNode(n.nodeId),
          // Resize callback — persists dimensions to Convex
          // Improvement nodes only persist width (height auto-sizes to content)
          onNodeResized: (width: number, height: number) => {
            blockSync(2000);
            updateDimensionsMutation({
              boardId,
              nodeId: n.nodeId,
              width: Math.round(width),
              ...(n.type !== "improvement" ? { height: Math.round(height) } : {}),
            });
          },
          ...((n.type === "text" || n.type === "attention" || n.type === "improvement")
            ? {
                onTextChange: (text: string) => {
                  updateNodeDataMutation({
                    boardId,
                    nodeId: n.nodeId,
                    data: { ...n.data, text },
                  });
                  // Also update improvement title
                  if (n.type === "improvement") {
                    const imp = improvementMap.get(n.nodeId);
                    if (imp) {
                      updateImprovement({ improvementId: imp._id, title: text });
                    }
                  }
                },
              }
            : {}),
          ...improvementData,
        },
      };
    });

    setNodes(flowNodes);
    store.setNodes(flowNodes);

    // Fit view only on first load
    if (!hasInitialized.current && flowNodes.length > 0) {
      hasInitialized.current = true;
      setTimeout(() => fitView({ padding: 0.2 }), 100);
    }
  }, [dbNodes, dbEdges, personas, comments, personaNodeAssignments, activePersonaId, improvements, improvementFilter, generatingNodeIds]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dbEdges) return;

    const flowEdges: Edge[] = dbEdges.map((e: any) => {
      // Highlight styling for edges
      let edgeStyle: Record<string, unknown> | undefined;
      if (activePersonaId) {
        const sourceHighlighted = highlightedNodeIds.has(e.source);
        const targetHighlighted = highlightedNodeIds.has(e.target);
        if (sourceHighlighted && targetHighlighted) {
          edgeStyle = { opacity: 1 };
        } else {
          edgeStyle = { opacity: 0.15 };
        }
      }

      return {
        id: e.edgeId,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
        label: e.label || "",
        type: "labeled",
        style: edgeStyle,
        data: {
          onLabelChange: (label: string) => {
            updateEdgeLabelMutation({ boardId, edgeId: e.edgeId, label });
          },
          onDelete: () => {
            deleteEdgeMutation({ boardId, edgeId: e.edgeId });
          },
        },
      };
    });
    setEdges(flowEdges);
    store.setEdges(flowEdges);
  }, [dbEdges, activePersonaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle node changes (position, selection, removal, resize)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));

      for (const change of changes) {
        if (change.type === "remove") {
          deleteNodeMutation({ boardId, nodeId: change.id });
        }
      }
    },
    [deleteNodeMutation, boardId]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));

      for (const change of changes) {
        if (change.type === "remove") {
          deleteEdgeMutation({ boardId, edgeId: change.id });
        }
      }
    },
    [deleteEdgeMutation, boardId]
  );

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      const edgeId = `e-${nanoid(8)}`;
      const newEdge: Edge = {
        ...connection,
        id: edgeId,
        type: "labeled",
        label: "",
        data: {
          onLabelChange: (label: string) => {
            updateEdgeLabelMutation({ boardId, edgeId, label });
          },
          onDelete: () => {
            deleteEdgeMutation({ boardId, edgeId });
          },
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
      addEdgeMutation({
        boardId,
        edgeId,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        type: "labeled",
      });
    },
    [boardId, addEdgeMutation, updateEdgeLabelMutation, deleteEdgeMutation]
  );

  // Handle edge reconnection (drag an edge endpoint to a new handle)
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
      updateConnectionMutation({
        boardId,
        edgeId: oldEdge.id,
        source: newConnection.source,
        target: newConnection.target,
        sourceHandle: newConnection.sourceHandle ?? undefined,
        targetHandle: newConnection.targetHandle ?? undefined,
      });
    },
    [boardId, updateConnectionMutation]
  );

  // Dragging: block Convex sync while dragging, persist ALL dragged nodes on stop
  const onNodeDragStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, _node: Node, draggedNodes: Node[]) => {
      // Save ALL dragged nodes (handles multi-select drag)
      if (draggedNodes.length === 1) {
        // Single node drag — use simple mutation
        updatePositionMutation({
          boardId,
          nodeId: draggedNodes[0].id,
          position: draggedNodes[0].position,
        });
        store.updateNodePosition(draggedNodes[0].id, draggedNodes[0].position);
      } else if (draggedNodes.length > 1) {
        // Multi-node drag — use bulk mutation
        bulkUpdatePositionsMutation({
          boardId,
          updates: draggedNodes.map((n) => ({
            nodeId: n.id,
            position: n.position,
          })),
        });
        for (const n of draggedNodes) {
          store.updateNodePosition(n.id, n.position);
        }
      }

      isDragging.current = false;
      // Block sync for 2s to let mutations propagate before Convex overwrites
      blockSync(2000);
    },
    [boardId, updatePositionMutation, bulkUpdatePositionsMutation, store, blockSync]
  );

  // Handle drag-and-drop from sidebar
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      // Block sync to prevent overwriting existing node positions/sizes
      blockSync(2000);

      try {
        const jsonData = e.dataTransfer.getData("application/json");
        if (!jsonData) return;
        const data = JSON.parse(jsonData);

        if (data.type === "screenshot") {
          const position = screenToFlowPosition({
            x: e.clientX,
            y: e.clientY,
          });

          // Check if dropped on an existing text node (for conversion)
          const targetNode = nodes.find((n) => {
            if (n.type !== "text") return false;
            const nx = n.position.x;
            const ny = n.position.y;
            const nw = (n.style?.width as number) || 300;
            const nh = 80;
            return position.x >= nx && position.x <= nx + nw && position.y >= ny && position.y <= ny + nh;
          });

          if (targetNode) {
            // Convert existing text node to screenshot node
            convertToScreenshotMutation({
              boardId,
              nodeId: targetNode.id,
              imageUrl: data.imageUrl,
              label: data.label || "",
              platform: data.platform || "",
              globalScreenshotId: data.globalScreenshotId,
            });

            // Link to board if from global repo
            if (data.source === "global" && data.globalScreenshotId) {
              linkToBoard({
                globalScreenshotId: data.globalScreenshotId,
                boardId,
              });
            }
            return;
          }

          const nodeId = `screenshot-${nanoid(8)}`;

          const newNode: Node = {
            id: nodeId,
            type: "screenshot",
            position,
            style: { width: DEFAULT_SCREENSHOT_WIDTH },
            data: {
              imageUrl: data.imageUrl,
              label: data.label,
              platform: data.platform,
              screenshotId: data.screenshotId,
              globalScreenshotId: data.globalScreenshotId,
            },
          };

          setNodes((nds) => [...nds, newNode]);
          addNodeMutation({
            boardId,
            nodeId,
            type: "screenshot",
            position,
            data: {
              imageUrl: data.imageUrl,
              label: data.label,
              platform: data.platform,
              screenshotId: data.screenshotId,
              globalScreenshotId: data.globalScreenshotId,
            },
            width: DEFAULT_SCREENSHOT_WIDTH,
          });

          // Link global screenshot to this board
          if (data.source === "global" && data.globalScreenshotId) {
            linkToBoard({
              globalScreenshotId: data.globalScreenshotId,
              boardId,
            });
          }
        }
      } catch {
        // Ignore invalid drops
      }
    },
    [boardId, screenToFlowPosition, addNodeMutation, linkToBoard, convertToScreenshotMutation, nodes, blockSync]
  );

  // Add text node
  const handleAddText = useCallback(() => {
    const nodeId = `text-${nanoid(8)}`;
    const position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };

    const newNode: Node = {
      id: nodeId,
      type: "text",
      position,
      data: {
        text: "New annotation",
        onTextChange: (text: string) => {
          updateNodeDataMutation({
            boardId,
            nodeId,
            data: { text },
          });
        },
      },
    };

    setNodes((nds) => [...nds, newNode]);
    addNodeMutation({
      boardId,
      nodeId,
      type: "text",
      position,
      data: { text: "New annotation" },
    });
  }, [boardId, addNodeMutation, updateNodeDataMutation]);

  // Add attention node
  const handleAddAttention = useCallback(() => {
    const nodeId = `attention-${nanoid(8)}`;
    const position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };

    const newNode: Node = {
      id: nodeId,
      type: "attention",
      position,
      data: {
        text: "Needs investigation",
        onTextChange: (text: string) => {
          updateNodeDataMutation({
            boardId,
            nodeId,
            data: { text },
          });
        },
      },
    };

    setNodes((nds) => [...nds, newNode]);
    addNodeMutation({
      boardId,
      nodeId,
      type: "attention",
      position,
      data: { text: "Needs investigation" },
    });
  }, [boardId, addNodeMutation, updateNodeDataMutation]);

  // Add improvement node
  const handleAddImprovement = useCallback(async () => {
    const nodeId = `improvement-${nanoid(8)}`;
    const position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };

    // Create improvement record first to get the number
    const result = await createImprovement({
      boardId,
      nodeId,
      title: "New improvement",
    });

    const newNode: Node = {
      id: nodeId,
      type: "improvement",
      position,
      data: {
        text: "New improvement",
        improvementNumber: result.number,
        status: "open",
        connectedScreenshotCount: 0,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    addNodeMutation({
      boardId,
      nodeId,
      type: "improvement",
      position,
      data: { text: "New improvement" },
    });

    // Fire-and-forget Slack notification
    slackNotifyNewImprovement({ improvementId: result.id, boardId }).catch(() => {});
  }, [boardId, addNodeMutation, createImprovement, slackNotifyNewImprovement]);

  // Generate improvement via AI
  const handleGenerateImprovement = useCallback(async (nodeId: string) => {
    setGeneratingNodeIds((prev) => new Set(prev).add(nodeId));
    try {
      // Find connected nodes via edges
      const connectedIds: string[] = [];
      if (dbEdges) {
        for (const e of dbEdges) {
          if ((e as any).source === nodeId) connectedIds.push((e as any).target);
          if ((e as any).target === nodeId) connectedIds.push((e as any).source);
        }
      }

      if (connectedIds.length === 0) {
        alert("Connect this improvement node to screenshot or text nodes first, then generate.");
        return;
      }

      const result = await generateImprovementAction({
        boardId,
        connectedNodeIds: connectedIds,
      });

      if (result.error) {
        alert(`AI generation error: ${result.error}`);
        return;
      }

      // Update the improvement record
      const imp = improvementMap.get(nodeId);
      if (imp) {
        await updateImprovement({
          improvementId: imp._id,
          title: result.title,
          content: result.content,
          developerTodos: result.developerTodos,
          priority: result.priority,
          connectedNodeIds: connectedIds,
          generatedByAI: true,
        });
        // Update the node title on canvas
        updateNodeDataMutation({
          boardId,
          nodeId,
          data: { text: result.title },
        });
        // Create structured todos if AI returned them
        if (result.structuredTodos && result.structuredTodos.length > 0) {
          bulkCreateTodos({
            improvementId: imp._id,
            boardId,
            todos: result.structuredTodos,
          }).catch(() => {});
        }
      }
    } finally {
      setGeneratingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }
  }, [boardId, dbEdges, generateImprovementAction, updateImprovement, updateNodeDataMutation, improvementMap, bulkCreateTodos]);

  // Undo/Redo keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          const future = useFlowStore.temporal.getState().futureStates;
          if (future.length > 0) {
            useFlowStore.temporal.getState().redo();
            const state = useFlowStore.getState();
            setNodes(state.nodes);
            setEdges(state.edges);
          }
        } else {
          const past = useFlowStore.temporal.getState().pastStates;
          if (past.length > 0) {
            useFlowStore.temporal.getState().undo();
            const state = useFlowStore.getState();
            setNodes(state.nodes);
            setEdges(state.edges);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Track node selection
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      if (selectedNodes.length === 1) {
        setSelectedNodeId(selectedNodes[0].id);
      } else {
        setSelectedNodeId(null);
      }
    },
    []
  );

  // Focus/pan to a specific node (used by RightPanel FlowView)
  const handleFocusNode = useCallback(
    (nodeId: string) => {
      fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.5 });
    },
    [fitView]
  );

  // Collect screenshotIds that are on the canvas for the sidebar "used" tracking
  const usedScreenshotIds = new Set(
    nodes
      .filter((n) => n.type === "screenshot")
      .map((n) => (n.data as any)?.screenshotId)
      .filter(Boolean)
  );

  return (
    <div className="flex h-full w-full">
      <ScreenshotSidebar boardId={boardId} usedScreenshotIds={usedScreenshotIds} />
      <div className="relative flex flex-1 flex-col">
        <Toolbar
          boardId={boardId}
          boardName={boardName}
          onAddText={handleAddText}
          onAddAttention={handleAddAttention}
          onAddImprovement={handleAddImprovement}
          onFitView={() => fitView({ padding: 0.2 })}
          currentVersion={board?.version}
          improvementFilter={improvementFilter}
          onSetImprovementFilter={setImprovementFilter}
          boardToolIds={board?.toolIds as string[] | undefined}
          onUpdateTools={(toolIds) => updateBoardTools({ boardId, toolIds: toolIds as any })}
        />
        <VersionBanner
          version={board?.version}
          versionNote={board?.versionNote}
          parentBoardId={board?.parentBoardId}
        />
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            edgesReconnectable
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: "labeled" }}
            minZoom={0.05}
            maxZoom={4}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
            className="bg-zinc-50 dark:bg-zinc-950"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#d4d4d8"
            />
            <Controls className="!bg-white !border-zinc-200 !shadow-sm dark:!bg-zinc-900 dark:!border-zinc-700" />
            <MiniMap
              className="!bg-white !border-zinc-200 !shadow-sm dark:!bg-zinc-900 dark:!border-zinc-700"
              nodeColor={(node) => {
                if (node.type === "screenshot") {
                  const platform = (node.data as any)?.platform;
                  if (platform === "desktop") return "#3b82f6";
                  if (platform === "mobile") return "#22c55e";
                  if (platform === "admin") return "#a855f7";
                  return "#94a3b8";
                }
                if (node.type === "attention") return "#ef4444";
                if (node.type === "improvement") return "#10b981";
                return "#f59e0b";
              }}
              maskColor="rgba(0,0,0,0.1)"
            />
          </ReactFlow>
        </div>
      </div>
      <RightPanel
        boardId={boardId}
        nodes={nodes}
        edges={edges}
        onFocusNode={handleFocusNode}
        openCommentsForNode={openCommentsForNode}
        onClearOpenComments={() => setOpenCommentsForNode(null)}
        activePersonaId={activePersonaId}
        onSetActivePersonaId={setActivePersonaId}
        selectedNodeId={selectedNodeId}
        onDeselectNode={() => setSelectedNodeId(null)}
      />
    </div>
  );
}
