import "@xyflow/react/dist/style.css";

import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type OnEdgesChange,
  type OnNodesChange,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MindmapNodeComponent } from "./components/Nodes/MindmapNode";
import {
  cloneEdges,
  cloneNodes,
  collectBranch,
  createEdge,
  getNextChildOrder,
  layoutMindmap,
} from "./mindmap/layout";
import {
  EDGE_STYLE,
  type MindmapEdge,
  type MindmapNode,
} from "./mindmap/types";

const RAW_INITIAL_NODES: MindmapNode[] = [
  {
    id: "root",
    type: "mindmap",
    position: { x: 0, y: 0 },
    draggable: false,
    data: {
      id: "root",
      label: "Central Topic",
      level: 0,
      parentId: null,
      order: 0,
    },
  },
  {
    id: "ideas",
    type: "mindmap",
    position: { x: 0, y: 0 },
    draggable: false,
    data: {
      id: "ideas",
      label: "Ideas",
      level: 1,
      parentId: "root",
      order: 0,
    },
  },
  {
    id: "projects",
    type: "mindmap",
    position: { x: 0, y: 0 },
    draggable: false,
    data: {
      id: "projects",
      label: "Projects",
      level: 1,
      parentId: "root",
      order: 1,
    },
  },
  {
    id: "learning",
    type: "mindmap",
    position: { x: 0, y: 0 },
    draggable: false,
    data: {
      id: "test",
      label: "test",
      level: 1,
      parentId: "root",
      order: 2,
    },
  },
  {
    id: "ideas-creative",
    type: "mindmap",
    position: { x: 0, y: 0 },
    draggable: false,
    data: {
      id: "ideas-creative",
      label: "Creative",
      level: 2,
      parentId: "ideas",
      order: 0,
    },
  },
  {
    id: "ideas-business",
    type: "mindmap",
    position: { x: 0, y: 0 },
    draggable: false,
    data: {
      id: "ideas-business",
      label: "Business",
      level: 2,
      parentId: "ideas",
      order: 1,
    },
  },
  {
    id: "projects-open-source",
    type: "mindmap",
    position: { x: 0, y: 0 },
    draggable: true,
    data: {
      id: "projects-open-source",
      label: "Open Source",
      level: 2,
      parentId: "projects",
      order: 0,
    },
  },
  {
    id: "learning-research",
    type: "mindmap",
    position: { x: 0, y: 0 },
    draggable: true,
    data: {
      id: "learning-research",
      label: "Research",
      level: 2,
      parentId: "learning",
      order: 0,
    },
  },
];

const RAW_INITIAL_EDGES: MindmapEdge[] = [
  createEdge("root", "ideas"),
  createEdge("root", "projects"),
  createEdge("root", "learning"),
  createEdge("ideas", "ideas-creative"),
  createEdge("ideas", "ideas-business"),
  createEdge("projects", "projects-open-source"),
  createEdge("learning", "learning-research"),
];

const MindmapCanvas = () => {
  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      mindmap: MindmapNodeComponent,
    }),
    []
  );

  const initialEdges = useMemo(() => cloneEdges(RAW_INITIAL_EDGES), []);
  const [edges, setEdges] = useState<MindmapEdge[]>(initialEdges);
  const [nodes, setNodes] = useState<MindmapNode[]>(() =>
    layoutMindmap(cloneNodes(RAW_INITIAL_NODES), initialEdges)
  );

  const { fitView } = useReactFlow();

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const counterRef = useRef<number>(RAW_INITIAL_NODES.length);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    if (nodes.length === 0) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      fitView({ padding: 0.25, duration: 300 });
    });

    return () => cancelAnimationFrame(frame);
  }, [fitView, nodes]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const addChild = useCallback((parentId: string) => {
    const parent = nodesRef.current.find((node) => node.id === parentId);
    if (!parent) {
      return;
    }

    counterRef.current += 1;
    const newNodeId = `node-${counterRef.current}`;
    const nextOrder = getNextChildOrder(
      parentId,
      nodesRef.current,
      edgesRef.current
    );

    const newNode: MindmapNode = {
      id: newNodeId,
      type: "mindmap",
      position: { x: 0, y: 0 },
      draggable: false,
      data: {
        id: newNodeId,
        label: "New Topic",
        level: parent.data.level + 1,
        parentId,
        order: nextOrder,
      },
    };

    const nextNodes = [...nodesRef.current, newNode];
    const nextEdges = [...edgesRef.current, createEdge(parentId, newNodeId)];

    const laidOutNodes = layoutMindmap(nextNodes, nextEdges);

    nodesRef.current = laidOutNodes;
    edgesRef.current = nextEdges;
    setNodes(laidOutNodes);
    setEdges(nextEdges);
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    const targetNode = nodesRef.current.find((node) => node.id === nodeId);
    if (!targetNode || targetNode.data.parentId === null) {
      return;
    }

    const toRemove = collectBranch(nodeId, edgesRef.current);
    const nextNodes = nodesRef.current.filter((node) => !toRemove.has(node.id));
    const nextEdges = edgesRef.current.filter(
      (edge) => !toRemove.has(edge.source) && !toRemove.has(edge.target)
    );

    const laidOutNodes = layoutMindmap(nextNodes, nextEdges);

    nodesRef.current = laidOutNodes;
    edgesRef.current = nextEdges;
    setNodes(laidOutNodes);
    setEdges(nextEdges);
  }, []);

  const renameNode = useCallback((nodeId: string, label: string) => {
    const nextNodes = nodesRef.current.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            data: {
              ...node.data,
              label,
            },
          }
        : node
    );

    nodesRef.current = nextNodes;
    setNodes(nextNodes);
  }, []);

  const handleAddChild = useCallback(
    (event: Event) => {
      const { parentId } =
        (event as CustomEvent<{ parentId?: string }>).detail ?? {};
      if (!parentId) {
        return;
      }
      addChild(parentId);
    },
    [addChild]
  );

  const handleDeleteNode = useCallback(
    (event: Event) => {
      const { nodeId } =
        (event as CustomEvent<{ nodeId?: string }>).detail ?? {};
      if (!nodeId) {
        return;
      }
      deleteNode(nodeId);
    },
    [deleteNode]
  );

  const handleRenameNode = useCallback(
    (event: Event) => {
      const { nodeId, label } =
        (event as CustomEvent<{ nodeId?: string; label?: string }>).detail ??
        {};
      if (!nodeId || !label) {
        return;
      }
      renameNode(nodeId, label);
    },
    [renameNode]
  );

  useEffect(() => {
    window.addEventListener("add-child-node", handleAddChild);
    window.addEventListener("delete-node", handleDeleteNode);
    window.addEventListener("rename-node", handleRenameNode);

    return () => {
      window.removeEventListener("add-child-node", handleAddChild);
      window.removeEventListener("delete-node", handleDeleteNode);
      window.removeEventListener("rename-node", handleRenameNode);
    };
  }, [handleAddChild, handleDeleteNode, handleRenameNode]);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          background: "white",
          padding: "14px 18px",
          borderRadius: 10,
          boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
          fontSize: 14,
          lineHeight: 1.5,
          maxWidth: 260,
        }}
      >
        <strong style={{ display: "block", marginBottom: 6 }}>
          Mindmap Tutor
        </strong>
        • Click the green + on a node to append a child below the right handle.
        <br />• Click the red × to prune a branch (root is protected).
        <br />• Double-click text to rename nodes in place.
        <br />• Use scroll or pinch to zoom (panning starts disabled).
      </div>

      <ReactFlow
        defaultEdgeOptions={{
          type: "simplebezier",
          style: EDGE_STYLE,
        }}
        edges={edges}
        elementsSelectable={false}
        fitView
        nodes={nodes}
        nodesDraggable={false}
        nodeTypes={nodeTypes}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnPinch
        zoomOnScroll
      >
        <Background color="#ccc" variant={BackgroundVariant.Dots} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
};

export const FinalMindmapApp = () => (
  <ReactFlowProvider>
    <MindmapCanvas />
  </ReactFlowProvider>
);
