import '@xyflow/react/dist/style.css';

import {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { useCallback, useEffect, useId } from 'react';

import { kEdgeTypes } from './components/Edges';
import { kNodeTypes } from './components/Nodes';
import type {
  ReactflowEdgeWithData,
  ReactflowNodeWithData,
} from './data/types';

let nodeIdCounter = 1000;

const initialNodes: ReactflowNodeWithData[] = [
  {
    id: 'root',
    type: 'mindmap',
    position: { x: 250, y: 250 },
    data: {
      id: 'root',
      label: 'My Mindmap',
      level: 0,
      type: 'mindmap',
      sourceHandles: [],
      targetHandles: [],
    },
  },
  {
    id: 'topic1',
    type: 'mindmap',
    position: { x: 500, y: 100 },
    data: {
      id: 'topic1',
      label: 'Ideas',
      level: 1,
      type: 'mindmap',
      sourceHandles: [],
      targetHandles: [],
    },
  },
  {
    id: 'topic2',
    type: 'mindmap',
    position: { x: 500, y: 250 },
    data: {
      id: 'topic2',
      label: 'Projects',
      level: 1,
      type: 'mindmap',
      sourceHandles: [],
      targetHandles: [],
    },
  },
  {
    id: 'topic3',
    type: 'mindmap',
    position: { x: 500, y: 400 },
    data: {
      id: 'topic3',
      label: 'Learning',
      level: 1,
      type: 'mindmap',
      sourceHandles: [],
      targetHandles: [],
    },
  },
  {
    id: 'subtopic1-1',
    type: 'mindmap',
    position: { x: 750, y: 50 },
    data: {
      id: 'subtopic1-1',
      label: 'Creative Ideas',
      level: 2,
      type: 'mindmap',
      sourceHandles: [],
      targetHandles: [],
    },
  },
  {
    id: 'subtopic1-2',
    type: 'mindmap',
    position: { x: 750, y: 150 },
    data: {
      id: 'subtopic1-2',
      label: 'Business Ideas',
      level: 2,
      type: 'mindmap',
      sourceHandles: [],
      targetHandles: [],
    },
  },
];

const initialEdges: ReactflowEdgeWithData[] = [
  {
    id: 'root-topic1',
    source: 'root',
    target: 'topic1',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'default',
    style: { stroke: '#b1b1b7', strokeWidth: 2 },
  },
  {
    id: 'root-topic2',
    source: 'root',
    target: 'topic2',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'default',
    style: { stroke: '#b1b1b7', strokeWidth: 2 },
  },
  {
    id: 'root-topic3',
    source: 'root',
    target: 'topic3',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'default',
    style: { stroke: '#b1b1b7', strokeWidth: 2 },
  },
  {
    id: 'topic1-subtopic1-1',
    source: 'topic1',
    target: 'subtopic1-1',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'default',
    style: { stroke: '#b1b1b7', strokeWidth: 2 },
  },
  {
    id: 'topic1-subtopic1-2',
    source: 'topic1',
    target: 'subtopic1-2',
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'default',
    style: { stroke: '#b1b1b7', strokeWidth: 2 },
  },
] as ReactflowEdgeWithData[];

// Hierarchical tree layout like Miro - all children branch from single point
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  // Find root node (level 0)
  const rootNode = nodes.find((n) => (n.data as any).level === 0);
  if (!rootNode) return { nodes, edges };

  // Build parent-child relationships
  const childrenMap: Map<string, Node[]> = new Map();
  edges.forEach((edge) => {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, []);
    }
    const childNode = nodes.find((n) => n.id === edge.target);
    if (childNode) {
      childrenMap.get(edge.source)!.push(childNode);
    }
  });

  const layoutedNodes: Node[] = [];
  const startX = 100;
  const startY = 300;
  const horizontalSpacing = 250; // Distance between levels
  const verticalSpacing = 100; // Distance between siblings

  // Position nodes recursively
  let currentYOffset = 0;

  const positionNode = (node: Node, x: number, yStart: number): number => {
    const children = childrenMap.get(node.id) || [];

    if (children.length === 0) {
      // Leaf node - position at current Y offset
      layoutedNodes.push({
        ...node,
        position: { x, y: yStart + currentYOffset * verticalSpacing },
      });
      currentYOffset += 1;
      return yStart + (currentYOffset - 1) * verticalSpacing;
    }

    // Position all children first
    const childYPositions: number[] = [];
    children.forEach((child) => {
      const childY = positionNode(child, x + horizontalSpacing, yStart);
      childYPositions.push(childY);
    });

    // Position parent at the midpoint of children
    const firstChildY = childYPositions[0];
    const lastChildY = childYPositions[childYPositions.length - 1];
    const parentY = (firstChildY + lastChildY) / 2;

    layoutedNodes.push({
      ...node,
      position: { x, y: parentY },
    });

    return parentY;
  };

  // Start positioning from root
  positionNode(rootNode, startX, startY);

  return { nodes: layoutedNodes, edges };
};

const SimpleMindmapFlow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { fitView } = useReactFlow();

  // Auto-layout on mount
  useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges,
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setTimeout(() => fitView(), 50);
  }, []);

  // Add child node
  const addChildNode = useCallback(
    (parentId: string) => {
      const parentNode = nodes.find((n) => n.id === parentId);
      if (!parentNode) return;

      const parentLevel = (parentNode.data as any).level || 0;
      const newNodeId = `node-${nodeIdCounter++}`;

      const newNode: ReactflowNodeWithData = {
        id: newNodeId,
        type: 'mindmap',
        position: { x: 0, y: 0 },
        data: {
          id: newNodeId,
          label: 'New Topic',
          level: parentLevel + 1,
          type: 'mindmap',
          sourceHandles: [],
          targetHandles: [],
        },
      };

      const newEdge: ReactflowEdgeWithData = {
        id: `${parentId}-${newNodeId}`,
        source: parentId,
        target: newNodeId,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'default',
        style: { stroke: '#b1b1b7', strokeWidth: 2 },
      } as any;

      const updatedNodes = [...nodes, newNode];
      const updatedEdges = [...edges, newEdge];

      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(updatedNodes, updatedEdges);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setTimeout(() => fitView({ duration: 300 }), 50);
    },
    [nodes, edges, setNodes, setEdges, fitView],
  );

  // Delete node
  const deleteNode = useCallback(
    (nodeId: string) => {
      const getDescendants = (id: string): string[] => {
        const children = edges
          .filter((e) => e.source === id)
          .map((e) => e.target);
        return [id, ...children.flatMap(getDescendants)];
      };

      const nodesToDelete = getDescendants(nodeId);
      const updatedNodes = nodes.filter((n) => !nodesToDelete.includes(n.id));
      const updatedEdges = edges.filter(
        (e) =>
          !nodesToDelete.includes(e.source) &&
          !nodesToDelete.includes(e.target),
      );

      if (updatedNodes.length > 0) {
        const { nodes: layoutedNodes, edges: layoutedEdges } =
          getLayoutedElements(updatedNodes, updatedEdges);

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setTimeout(() => fitView({ duration: 300 }), 50);
      }
    },
    [nodes, edges, setNodes, setEdges, fitView],
  );

  // Listen for events
  useEffect(() => {
    const handleAddChild = (e: Event) => {
      const customEvent = e as CustomEvent;
      addChildNode(customEvent.detail.parentId);
    };

    const handleDeleteNode = (e: Event) => {
      const customEvent = e as CustomEvent;
      deleteNode(customEvent.detail.nodeId);
    };

    window.addEventListener('add-child-node', handleAddChild);
    window.addEventListener('delete-node', handleDeleteNode);

    return () => {
      window.removeEventListener('add-child-node', handleAddChild);
      window.removeEventListener('delete-node', handleDeleteNode);
    };
  }, [addChildNode, deleteNode]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdges = addEdge(
        {
          ...params,
          type: 'default',
          style: { stroke: '#b1b1b7', strokeWidth: 2 },
        },
        edges,
      );
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(nodes, newEdges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setTimeout(() => fitView({ duration: 300 }), 50);
    },
    [edges, nodes, setEdges, setNodes, fitView],
  );

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <ReactFlow
        defaultEdgeOptions={{
          type: 'default',
          style: { stroke: '#b1b1b7', strokeWidth: 2 },
        }}
        edges={edges}
        edgeTypes={kEdgeTypes}
        fitView
        maxZoom={4}
        minZoom={0.2}
        nodes={nodes}
        nodeTypes={kNodeTypes}
        onConnect={onConnect}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
      >
        <Background
          color="#ccc"
          id={useId()}
          variant={BackgroundVariant.Dots}
        />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
};

export const SimpleMindmapApp = () => {
  return (
    <ReactFlowProvider>
      <SimpleMindmapFlow />
    </ReactFlowProvider>
  );
};
