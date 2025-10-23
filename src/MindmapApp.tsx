import '@xyflow/react/dist/style.css';

import { jsonDecode } from '@del-wang/utils';
import {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { useCallback, useEffect, useId } from 'react';

import { ControlPanel } from './components/ControlPanel';
import { kEdgeTypes } from './components/Edges';
import { ColorfulMarkerDefinitions } from './components/Edges/Marker';
import { kNodeTypes } from './components/Nodes';
import { ReactflowInstance } from './components/ReactflowInstance';
import { workflow2reactflow } from './data/convert';
import mindmapData from './data/mindmap-data.json';
import type {
  ReactflowEdgeWithData,
  ReactflowNodeWithData,
} from './data/types';
import {
  kDefaultLayoutConfig,
  type ReactflowLayoutConfig,
} from './layout/node';
import { useAutoLayout } from './layout/useAutoLayout';

let nodeIdCounter = 1000;

const EditMindmap = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { setCenter } = useReactFlow();

  const { layout, isDirty } = useAutoLayout();

  const layoutReactflow = async (
    props: ReactflowLayoutConfig & {
      workflow: string;
    },
  ) => {
    if (isDirty) {
      return;
    }
    const input = props.workflow;
    const data = jsonDecode(input);
    if (!data) {
      alert('Invalid workflow JSON data');
      return;
    }
    const workflow = workflow2reactflow(data);
    layout({ ...workflow, ...props });
  };

  // Add child node to a parent
  const addChildNode = useCallback(
    (parentId: string) => {
      const parentNode = nodes.find((n) => n.id === parentId) as
        | ReactflowNodeWithData
        | undefined;
      if (!parentNode) return;

      const parentLevel = (parentNode.data.level as number) || 0;
      const newNodeId = `node-${nodeIdCounter++}`;
      const newLevel = parentLevel + 1;

      // Create new node
      const newNode: ReactflowNodeWithData = {
        id: newNodeId,
        type: 'mindmap',
        position: { x: 0, y: 0 }, // Will be positioned by layout
        data: {
          id: newNodeId,
          label: 'New Topic',
          level: newLevel,
          sourceHandles: [`${newNodeId}#source#0`],
          targetHandles: [`${newNodeId}#target#0`],
          type: 'mindmap',
        },
      };

      // Create edge from parent to new node
      const newEdge: ReactflowEdgeWithData = {
        id: `${parentId}-${newNodeId}`,
        source: parentId,
        target: newNodeId,
        sourceHandle: `${parentId}#source#${parentNode.data.sourceHandles.length}`,
        targetHandle: `${newNodeId}#target#0`,
        type: 'mindmap',
        data: {
          sourcePort: {
            edges: 0,
            portCount: 1,
            portIndex: 0,
            edgeCount: 1,
            edgeIndex: 0,
          },
          targetPort: {
            edges: 0,
            portCount: 1,
            portIndex: 0,
            edgeCount: 1,
            edgeIndex: 0,
          },
        },
      } as any;

      // Update parent's source handles
      const updatedParent = {
        ...parentNode,
        data: {
          ...parentNode.data,
          sourceHandles: [
            ...parentNode.data.sourceHandles,
            `${parentId}#source#${parentNode.data.sourceHandles.length}`,
          ],
        },
      };

      setNodes((nds) =>
        nds.map((n) => (n.id === parentId ? updatedParent : n)).concat(newNode),
      );
      setEdges((eds) => eds.concat(newEdge));

      // Re-layout after adding node
      setTimeout(() => {
        const workflow = workflow2reactflow({
          nodes: nodes.concat(newNode).map((n) => ({
            id: n.id,
            type: n.type as 'base' | 'start' | 'mindmap',
            label: (n.data as any).label,
            level: (n.data as any).level,
          })),
          edges: edges.concat(newEdge).map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle || '',
            targetHandle: e.targetHandle || '',
          })),
        });
        layout({ ...workflow, ...kDefaultLayoutConfig });
      }, 100);
    },
    [nodes, edges, setNodes, setEdges, layout],
  );

  // Delete node and its children
  const deleteNode = useCallback(
    (nodeId: string) => {
      const getDescendants = (id: string): string[] => {
        const children = edges
          .filter((e) => e.source === id)
          .map((e) => e.target);
        return [id, ...children.flatMap(getDescendants)];
      };

      const nodesToDelete = getDescendants(nodeId);

      setNodes((nds) => nds.filter((n) => !nodesToDelete.includes(n.id)));
      setEdges((eds) =>
        eds.filter(
          (e) =>
            !nodesToDelete.includes(e.source) &&
            !nodesToDelete.includes(e.target),
        ),
      );

      // Re-layout after deleting
      setTimeout(() => {
        const remainingNodes = nodes.filter(
          (n) => !nodesToDelete.includes(n.id),
        );
        const remainingEdges = edges.filter(
          (e) =>
            !nodesToDelete.includes(e.source) &&
            !nodesToDelete.includes(e.target),
        );

        if (remainingNodes.length > 0) {
          const workflow = workflow2reactflow({
            nodes: remainingNodes.map((n) => ({
              id: n.id,
              type: n.type as 'base' | 'start' | 'mindmap',
              label: (n.data as any).label,
              level: (n.data as any).level,
            })),
            edges: remainingEdges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle || '',
              targetHandle: e.targetHandle || '',
            })),
          });
          layout({ ...workflow, ...kDefaultLayoutConfig });
        }
      }, 100);
    },
    [nodes, edges, setNodes, setEdges, layout],
  );

  // Listen for custom events from node components
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
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  useEffect(() => {
    const { nodes: initialNodes, edges: initialEdges } = workflow2reactflow(
      mindmapData as any,
    );
    layout({
      nodes: initialNodes,
      edges: initialEdges,
      ...kDefaultLayoutConfig,
    });

    // Center on root node after initial layout
    setTimeout(() => {
      const rootNode = initialNodes.find((n) => (n.data as any).level === 0);
      if (rootNode) {
        setCenter(rootNode.position.x + 100, rootNode.position.y + 50, {
          zoom: 1,
          duration: 800,
        });
      }
    }, 500);
  }, []);

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
      <ColorfulMarkerDefinitions />
      <ReactFlow
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
        <ReactflowInstance />
        <Controls />
        <MiniMap pannable zoomable />
        <ControlPanel layoutReactflow={layoutReactflow} />
      </ReactFlow>
    </div>
  );
};

export const MindmapApp = () => {
  return (
    <ReactFlowProvider>
      <EditMindmap />
    </ReactFlowProvider>
  );
};
