import { create } from "zustand";
import { temporal } from "zundo";
import type { Node, Edge } from "@xyflow/react";

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodePosition: (
    nodeId: string,
    position: { x: number; y: number }
  ) => void;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (edgeId: string) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
}

export const useFlowStore = create<FlowState>()(
  temporal(
    (set) => ({
      nodes: [],
      edges: [],
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      updateNodePosition: (nodeId, position) =>
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === nodeId ? { ...n, position } : n
          ),
        })),
      addNode: (node) =>
        set((state) => ({ nodes: [...state.nodes, node] })),
      removeNode: (nodeId) =>
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== nodeId),
          edges: state.edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          ),
        })),
      addEdge: (edge) =>
        set((state) => ({ edges: [...state.edges, edge] })),
      removeEdge: (edgeId) =>
        set((state) => ({
          edges: state.edges.filter((e) => e.id !== edgeId),
        })),
      updateEdgeLabel: (edgeId, label) =>
        set((state) => ({
          edges: state.edges.map((e) =>
            e.id === edgeId ? { ...e, label } : e
          ),
        })),
      updateNodeData: (nodeId, data) =>
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
          ),
        })),
    }),
    {
      limit: 50,
      equality: (pastState, currentState) =>
        JSON.stringify(pastState.nodes) ===
          JSON.stringify(currentState.nodes) &&
        JSON.stringify(pastState.edges) ===
          JSON.stringify(currentState.edges),
    }
  )
);
