import '@xyflow/react/dist/style.css';
import './mindmap-master.css';

import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
} from '@xyflow/react';
import { useCallback, useEffect, useState, useRef, type MouseEvent } from 'react';
import dagre from '@dagrejs/dagre';

// ==================== TYPES ====================

interface MindmapNodeData {
  label: string;
  level: number;
  color?: string;
  emoji?: string;
}

type MindmapNode = Node<MindmapNodeData, 'mindmap'>;
type MindmapEdge = Edge;

// ==================== CONSTANTS ====================

const COLORS = [
  { name: 'Lavender', value: '#B4A7D6' },
  { name: 'Peach', value: '#FFB5A7' },
  { name: 'Mint', value: '#B8E6D5' },
  { name: 'Sky', value: '#A8D8EA' },
  { name: 'Blush', value: '#F8B4D9' },
  { name: 'Lemon', value: '#FFF4A3' },
  { name: 'Coral', value: '#FFCAB0' },
  { name: 'Sage', value: '#C5E1A5' },
  { name: 'Periwinkle', value: '#C5CAE9' },
  { name: 'Rose', value: '#F8BBD0' },
];

const EMOJIS = ['💡', '⭐', '🎯', '🚀', '💎', '🔥', '✨', '🎨', '📌', '🏆'];

let nodeIdCounter = 100;

// ==================== LAYOUT ALGORITHM ====================

const getLayoutedElements = (nodes: MindmapNode[], edges: MindmapEdge[]) => {
  // Find root nodes (level 0)
  const rootNodes = nodes.filter(n => n.data.level === 0);
  if (rootNodes.length === 0) return nodes;

  // Build parent-child map
  const childrenMap = new Map<string, MindmapNode[]>();
  edges.forEach(edge => {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, []);
    }
    const child = nodes.find(n => n.id === edge.target);
    if (child) {
      childrenMap.get(edge.source)!.push(child);
    }
  });

  const layoutedNodes: MindmapNode[] = [];
  const startX = 100;
  const horizontalSpacing = 400;
  const verticalSpacing = 120;

  // Calculate subtree height
  const getSubtreeHeight = (nodeId: string): number => {
    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) return 1;
    return children.reduce((sum, child) => sum + getSubtreeHeight(child.id), 0);
  };

  // Position nodes recursively
  let currentY = 0;

  const positionNode = (node: MindmapNode, x: number, yStart: number): number => {
    const children = childrenMap.get(node.id) || [];

    if (children.length === 0) {
      // Leaf node
      layoutedNodes.push({
        ...node,
        position: { x, y: yStart + currentY * verticalSpacing },
      });
      currentY += 1;
      return yStart + (currentY - 1) * verticalSpacing;
    }

    // Position children first
    const childYPositions: number[] = [];
    children.forEach(child => {
      const childY = positionNode(child, x + horizontalSpacing, yStart);
      childYPositions.push(childY);
    });

    // Center parent between children
    const parentY = (childYPositions[0] + childYPositions[childYPositions.length - 1]) / 2;

    layoutedNodes.push({
      ...node,
      position: { x, y: parentY },
    });

    return parentY;
  };

  // Layout each root separately
  rootNodes.forEach((root, index) => {
    currentY = 0;
    positionNode(root, startX, index * 500);
  });

  return layoutedNodes;
};

// ==================== MINDMAP NODE COMPONENT ====================

const MindmapNodeComponent = ({ data, id, selected }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => setIsEditing(true);

  const handleBlur = () => {
    setIsEditing(false);
    if (label.trim()) {
      window.dispatchEvent(new CustomEvent('update-node-label', {
        detail: { id, label: label.trim() }
      }));
    } else {
      setLabel(data.label);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setLabel(data.label);
      setIsEditing(false);
    }
  };

  const nodeClass = `mindmap-master-node level-${data.level}`;
  const style = data.color ? { background: data.color } : {};

  return (
    <div className={`${nodeClass} ${selected ? 'selected' : ''}`} style={style}>
      {/* ReactFlow Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="react-flow-handle handle-left"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="react-flow-handle handle-right"
      />

      <div className="node-content">
        {data.emoji && <span className="node-emoji">{data.emoji}</span>}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="node-input"
          />
        ) : (
          <div className="node-label" onDoubleClick={handleDoubleClick}>
            {label}
          </div>
        )}
      </div>

      <button
        className="node-add-btn"
        onClick={() => window.dispatchEvent(new CustomEvent('add-child', { detail: { parentId: id } }))}
        title="Add child"
      >
        +
      </button>
    </div>
  );
};

const nodeTypes = {
  mindmap: MindmapNodeComponent,
};

// ==================== TOOLBAR COMPONENT ====================

const Toolbar = ({
  onAddRoot,
  onExport,
  onImport,
  onClear,
  onAutoLayout,
  selectedNode,
  onColorChange,
  onEmojiChange,
}: any) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  return (
    <Panel position="top-left" className="mindmap-toolbar">
      <div className="toolbar-section">
        <button onClick={onAddRoot} className="toolbar-btn" title="Add root node">
          <span>➕ Root</span>
        </button>
        <button onClick={onAutoLayout} className="toolbar-btn" title="Auto-layout nodes">
          <span>🔄 Layout</span>
        </button>
        <button onClick={onExport} className="toolbar-btn" title="Export as JSON">
          <span>💾 Export</span>
        </button>
        <button onClick={onImport} className="toolbar-btn" title="Import JSON">
          <span>📂 Import</span>
        </button>
        <button onClick={onClear} className="toolbar-btn danger" title="Clear all">
          <span>🗑️ Clear</span>
        </button>
      </div>

      {selectedNode && (
        <div className="toolbar-section">
          <div className="toolbar-divider" />
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="toolbar-btn"
            title="Change color"
          >
            🎨
          </button>
          {showColorPicker && (
            <div className="color-picker">
              {COLORS.map(color => (
                <button
                  key={color.value}
                  className="color-option"
                  style={{ background: color.value }}
                  onClick={() => {
                    onColorChange(color.value);
                    setShowColorPicker(false);
                  }}
                  title={color.name}
                />
              ))}
            </div>
          )}

          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="toolbar-btn"
            title="Add emoji"
          >
            😀
          </button>
          {showEmojiPicker && (
            <div className="emoji-picker">
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  className="emoji-option"
                  onClick={() => {
                    onEmojiChange(emoji);
                    setShowEmojiPicker(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
              <button
                className="emoji-option"
                onClick={() => {
                  onEmojiChange('');
                  setShowEmojiPicker(false);
                }}
                title="Remove emoji"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
};

// ==================== MAIN APP ====================

const MindmapMasterFlow = () => {
  const initialNodes: MindmapNode[] = [
    {
      id: 'root',
      type: 'mindmap',
      position: { x: 0, y: 0 },
      data: { label: 'My Mindmap', level: 0, color: COLORS[0].value },
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState<MindmapNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<MindmapEdge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { fitView, getNodes, getEdges } = useReactFlow();

  // Create refs to always have current state
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const applyLayout = useCallback(
    (nextNodes: MindmapNode[], nextEdges: MindmapEdge[]) => {
      const layoutedNodes = getLayoutedElements(nextNodes, nextEdges);
      nodesRef.current = layoutedNodes;
      edgesRef.current = nextEdges;
      setNodes(layoutedNodes);
      setEdges(nextEdges);
      requestAnimationFrame(() => fitView({ duration: 300, padding: 0.2 }));
    },
    [fitView, setNodes, setEdges],
  );

  const relayout = useCallback(() => {
    applyLayout(nodesRef.current, edgesRef.current);
  }, [applyLayout]);

  // Initial layout
  useEffect(() => {
    applyLayout(initialNodes, []);
  }, [applyLayout]);

  // Add child node
  const addChild = useCallback((parentId: string) => {
    const parent = nodesRef.current.find((n) => n.id === parentId);
    if (!parent) return;

    const newId = `node-${nodeIdCounter++}`;
    const newNode: MindmapNode = {
      id: newId,
      type: 'mindmap',
      position: { x: 0, y: 0 },
      data: {
        label: 'New Topic',
        level: parent.data.level + 1,
        color: COLORS[(parent.data.level + 1) % COLORS.length].value,
      },
    };

    const newEdge: MindmapEdge = {
      id: `${parentId}-${newId}`,
      source: parentId,
      target: newId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'default',
      style: { stroke: '#cbd5e1', strokeWidth: 2.5 },
    };

    // Calculate layout with the new node to get its correct position
    const nextNodes = [...nodesRef.current, newNode];
    const nextEdges = [...edgesRef.current, newEdge];
    applyLayout(nextNodes, nextEdges);
  }, [applyLayout]);

  // Delete node and descendants
  const deleteNode = useCallback((nodeId: string) => {
    // Use refs to get current state
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    // Build a map of parent -> children for faster lookup
    const childrenMap = new Map<string, string[]>();
    currentEdges.forEach(edge => {
      if (!childrenMap.has(edge.source)) {
        childrenMap.set(edge.source, []);
      }
      childrenMap.get(edge.source)!.push(edge.target);
    });

    // Collect all nodes to delete (node + all descendants)
    const nodesToDelete = new Set<string>();
    const collectDescendants = (id: string) => {
      nodesToDelete.add(id);
      const children = childrenMap.get(id) || [];
      children.forEach(childId => collectDescendants(childId));
    };

    collectDescendants(nodeId);

    // Filter out deleted nodes and edges
    const newNodes = currentNodes.filter(n => !nodesToDelete.has(n.id));
    const newEdges = currentEdges.filter(e =>
      !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target)
    );

    // Update states
    applyLayout(newNodes, newEdges);
  }, [applyLayout]);

  // Update node label
  const updateNodeLabel = useCallback((id: string, label: string) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n));
  }, [setNodes]);

  // Change node color
  const changeNodeColor = useCallback((color: string) => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.map(n =>
      n.id === selectedNodeId ? { ...n, data: { ...n.data, color } } : n
    ));
  }, [selectedNodeId, setNodes]);

  // Change node emoji
  const changeNodeEmoji = useCallback((emoji: string) => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.map(n =>
      n.id === selectedNodeId ? { ...n, data: { ...n.data, emoji } } : n
    ));
  }, [selectedNodeId, setNodes]);

  // Add root node
  const addRootNode = useCallback(() => {
    const newId = `root-${nodeIdCounter++}`;
    const newNode: MindmapNode = {
      id: newId,
      type: 'mindmap',
      position: { x: 0, y: 0 },
      data: { label: 'New Root', level: 0, color: COLORS[0].value },
    };

    // Calculate layout with the new node to get its correct position
    const nextNodes = [...nodesRef.current, newNode];
    applyLayout(nextNodes, edgesRef.current);
  }, [applyLayout]);

  // Export
  const exportData = useCallback(() => {
    const data = {
      nodes: nodes.map(n => ({ id: n.id, data: n.data })),
      edges: edges.map(e => ({ source: e.source, target: e.target })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindmap.json';
    a.click();
  }, [nodes, edges]);

  // Import
  const importData = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          const importedNodes: MindmapNode[] = data.nodes.map((n: any) => ({
            id: n.id,
            type: 'mindmap',
            position: { x: 0, y: 0 },
            data: n.data,
          }));
          const importedEdges: MindmapEdge[] = data.edges.map((e: any) => ({
            id: `${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            sourceHandle: 'right',
            targetHandle: 'left',
            type: 'default',
            style: { stroke: '#cbd5e1', strokeWidth: 2.5 },
          }));
          applyLayout(importedNodes, importedEdges);
        } catch (err) {
          alert('Invalid file format');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges, relayout]);

  // Clear all
  const clearAll = useCallback(() => {
    if (confirm('Clear all nodes? This cannot be undone.')) {
      const resetNodes: MindmapNode[] = [{
        id: 'root',
        type: 'mindmap',
        position: { x: 0, y: 0 },
        data: { label: 'My Mindmap', level: 0, color: COLORS[0].value },
      }];
      applyLayout(resetNodes, []);
    }
  }, [addChild, deleteNode, updateNodeLabel, selectedNodeId, nodes, applyLayout]);

  // Event listeners
  useEffect(() => {
    const handleAddChild = (e: Event) => {
      const { parentId } = (e as CustomEvent).detail;
      addChild(parentId);
    };
    const handleDeleteNode = (e: Event) => {
      const { id } = (e as CustomEvent).detail;
      deleteNode(id);
    };
    const handleUpdateLabel = (e: Event) => {
      const { id, label } = (e as CustomEvent).detail;
      updateNodeLabel(id, label);
    };

    // Handle keyboard delete
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only delete if not editing and a node is selected
      const activeElement = document.activeElement;
      const isEditing = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditing && selectedNodeId) {
        const nodeToDelete = nodesRef.current.find((n) => n.id === selectedNodeId);
        // Don't delete root nodes (level 0)
        if (nodeToDelete && nodeToDelete.data.level > 0) {
          e.preventDefault();
          deleteNode(selectedNodeId);
          setSelectedNodeId(null);
        }
      }
    };

    window.addEventListener('add-child', handleAddChild);
    window.addEventListener('delete-node', handleDeleteNode);
    window.addEventListener('update-node-label', handleUpdateLabel);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('add-child', handleAddChild);
      window.removeEventListener('delete-node', handleDeleteNode);
      window.removeEventListener('update-node-label', handleUpdateLabel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addChild, deleteNode, updateNodeLabel, selectedNodeId]);

  // Track selection
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    const selectChange = changes.find(c => c.type === 'select');
    if (selectChange && 'selected' in selectChange) {
      setSelectedNodeId(selectChange.selected ? selectChange.id : null);
    }
  }, [onNodesChange]);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'default',
          style: { stroke: '#cbd5e1', strokeWidth: 2.5 },
        }}
      >
        <Background color="#bbb" variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap pannable zoomable nodeColor={(node: any) => {
          const color = node.data?.color;
          return color || '#4facfe';
        }} />

        <Toolbar
          onAddRoot={addRootNode}
          onAutoLayout={relayout}
          onExport={exportData}
          onImport={importData}
          onClear={clearAll}
          selectedNode={selectedNode}
          onColorChange={changeNodeColor}
          onEmojiChange={changeNodeEmoji}
        />
      </ReactFlow>
    </div>
  );
};

export const MindmapMaster = () => {
  return (
    <ReactFlowProvider>
      <MindmapMasterFlow />
    </ReactFlowProvider>
  );
};
