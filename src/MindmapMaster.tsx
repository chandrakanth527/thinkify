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
import { useCallback, useEffect, useState, useRef, useMemo, type CSSProperties } from 'react';
import { useStore } from '@xyflow/react';

import {
  IconCollapse,
  IconDownload,
  IconExpand,
  IconLayout,
  IconMore,
  IconPalette,
  IconPlus,
  IconRedo,
  IconSparkle,
  IconTrash,
  IconUndo,
  IconUpload,
  IconMagicWand,
} from '@/icons';

// ==================== TYPES ====================

interface MindmapNodeData {
  label: string;
  level: number;
  color?: string;
  emoji?: string;
  collapsed?: boolean;
  hiddenChildCount?: number;
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

interface Snapshot {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
}

interface CollapseInfo {
  visibleIds: Set<string>;
  hiddenChildCount: Map<string, number>;
}

const cloneNodeForHistory = (node: MindmapNode): MindmapNode => ({
  ...node,
  data: { ...node.data },
  position: node.position ? { ...node.position } : node.position,
  positionAbsolute: node.positionAbsolute ? { ...node.positionAbsolute } : undefined,
  style: node.style ? { ...node.style } : undefined,
  measured: node.measured ? { ...node.measured } : undefined,
});

const cloneNodesForHistory = (nodes: MindmapNode[]): MindmapNode[] => nodes.map(cloneNodeForHistory);

const cloneEdgesForHistory = (edges: MindmapEdge[]): MindmapEdge[] =>
  edges.map((edge) => ({
    ...edge,
    data: edge.data ? { ...edge.data } : undefined,
    style: edge.style ? { ...edge.style } : undefined,
  }));

const computeCollapseInfo = (nodes: MindmapNode[], edges: MindmapEdge[]): CollapseInfo => {
  const nodeMap = new Map<string, MindmapNode>(nodes.map((node) => [node.id, node]));
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();

  edges.forEach((edge) => {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, []);
    }
    childrenMap.get(edge.source)!.push(edge.target);
    parentMap.set(edge.target, edge.source);
  });

  const subtreeSize = new Map<string, number>();
  const sizeVisited = new Set<string>();

  const computeSize = (nodeId: string): number => {
    if (subtreeSize.has(nodeId)) {
      return subtreeSize.get(nodeId)!;
    }
    if (sizeVisited.has(nodeId)) {
      return 0;
    }
    sizeVisited.add(nodeId);
    const children = childrenMap.get(nodeId) ?? [];
    let total = 0;
    for (const child of children) {
      total += 1 + computeSize(child);
    }
    subtreeSize.set(nodeId, total);
    return total;
  };

  nodes
    .filter((node) => !parentMap.has(node.id))
    .forEach((node) => computeSize(node.id));

  const visibleIds = new Set<string>();
  const hiddenChildCount = new Map<string, number>();
  const visited = new Set<string>();

  const traverse = (nodeId: string, ancestorCollapsed: boolean) => {
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) {
      return;
    }

    const collapsed = Boolean(node.data?.collapsed);
    const children = childrenMap.get(nodeId) ?? [];

    if (!ancestorCollapsed) {
      visibleIds.add(nodeId);
    }

    let hiddenTotal = 0;
    if (collapsed || ancestorCollapsed) {
      for (const childId of children) {
        hiddenTotal += 1 + (subtreeSize.get(childId) ?? 0);
        traverse(childId, true);
      }
    } else {
      for (const childId of children) {
        traverse(childId, false);
      }
    }

    hiddenChildCount.set(nodeId, collapsed ? hiddenTotal : 0);
  };

  nodes
    .filter((node) => !parentMap.has(node.id))
    .forEach((node) => traverse(node.id, false));

  nodes
    .filter((node) => !visited.has(node.id))
    .forEach((node) => traverse(node.id, false));

  if (visibleIds.size === 0) {
    nodes.forEach((node) => visibleIds.add(node.id));
  }

  return {
    visibleIds,
    hiddenChildCount,
  };
};

const applyCollapseState = (
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  info?: CollapseInfo,
): { nodes: MindmapNode[]; edges: MindmapEdge[] } => {
  const collapseInfo = info ?? computeCollapseInfo(nodes, edges);

  if (collapseInfo.visibleIds.size === 0) {
    nodes.forEach((node) => collapseInfo.visibleIds.add(node.id));
  }

  const nodeClones = nodes.map((node) => {
    const collapsed = Boolean(node.data?.collapsed);
    const nextData = { ...node.data };
    const hiddenCount = collapseInfo.hiddenChildCount.get(node.id) ?? 0;
    if (collapsed) {
      nextData.hiddenChildCount = hiddenCount;
    } else {
      delete nextData.hiddenChildCount;
    }

    return {
      ...node,
      data: nextData,
      hidden: !collapseInfo.visibleIds.has(node.id),
    };
  });

  const edgeClones = edges.map((edge) => ({
    ...edge,
    hidden:
      !collapseInfo.visibleIds.has(edge.source) || !collapseInfo.visibleIds.has(edge.target),
  }));

  return {
    nodes: nodeClones,
    edges: edgeClones,
  };
};

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
        type="button"
      >
        <IconPlus size={14} strokeWidth={2.2} />
      </button>

      {data.hiddenChildCount ? (
        <div className="node-collapse-count" title={`${data.hiddenChildCount} hidden child${data.hiddenChildCount === 1 ? '' : 'ren'}`}>
          {data.hiddenChildCount}
        </div>
      ) : null}
    </div>
  );
};

const nodeTypes = {
  mindmap: MindmapNodeComponent,
};

// ==================== TOOLBAR COMPONENT ====================

interface ToolbarProps {
  onAddRoot: () => void;
  onAutoLayout: () => void;
  onExport: () => void;
  onImport: () => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Toolbar = ({ onAddRoot, onAutoLayout, onExport, onImport, onClear, onUndo, onRedo, canUndo, canRedo }: ToolbarProps) => (
  <Panel position="top-left" className="mindmap-toolbar">
    <div className="toolbar-section">
      <button
        onClick={onAddRoot}
        className="toolbar-btn"
        title="Add root node"
        type="button"
      >
        <IconPlus size={18} />
        <span>Root</span>
      </button>
      <button
        onClick={onAutoLayout}
        className="toolbar-btn"
        title="Auto-layout nodes"
        type="button"
      >
        <IconLayout size={18} />
        <span>Layout</span>
      </button>
      <button
        onClick={onExport}
        className="toolbar-btn"
        title="Export as JSON"
        type="button"
      >
        <IconDownload size={18} />
        <span>Export</span>
      </button>
      <button
        onClick={onImport}
        className="toolbar-btn"
        title="Import JSON"
        type="button"
      >
        <IconUpload size={18} />
        <span>Import</span>
      </button>
      <button
        onClick={onClear}
        className="toolbar-btn danger"
        title="Clear all"
        type="button"
      >
        <IconTrash size={18} />
        <span>Clear</span>
      </button>
      <div className="toolbar-divider" />
      <button
        onClick={onUndo}
        className="toolbar-btn icon-only"
        title="Undo"
        type="button"
        disabled={!canUndo}
      >
        <IconUndo size={18} />
      </button>
      <button
        onClick={onRedo}
        className="toolbar-btn icon-only"
        title="Redo"
        type="button"
        disabled={!canRedo}
      >
        <IconRedo size={18} />
      </button>
    </div>
  </Panel>
);

interface NodeActionToolbarProps {
  node: MindmapNode | null;
  onAddChild: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
  onColorChange: (color: string) => void;
  onEmojiChange: (emoji: string) => void;
  onToggleCollapse: (nodeId: string, collapsed: boolean) => void;
}

const NodeActionToolbar = ({
  node,
  onAddChild,
  onDelete,
  onColorChange,
  onEmojiChange,
  onToggleCollapse,
}: NodeActionToolbarProps) => {
  const [showColors, setShowColors] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const transform = useStore((state) => state.transform);

  useEffect(() => {
    setShowColors(false);
    setShowEmojis(false);
  }, [node?.id]);

  const [viewportX, viewportY, zoom] = transform;
  const anchorStyle = useMemo(() => {
    if (!node) {
      return null;
    }

    const position = node.positionAbsolute ?? node.position;
    const baseWidth = node.measured?.width ?? node.width ?? 160;
    const baseHeight = node.measured?.height ?? node.height ?? 60;

    return {
      left: viewportX + ((position?.x ?? 0) + baseWidth / 2) * zoom,
      top: viewportY + (position?.y ?? 0) * zoom,
      '--toolbar-offset': `${(baseHeight + 16) * zoom}px`,
    } as CSSProperties;
  }, [node, viewportX, viewportY, zoom]);

  if (!node || !anchorStyle) {
    return null;
  }

  const isCollapsed = Boolean(node.data?.collapsed);

  return (
    <div className="floating-toolbar-anchor" style={anchorStyle}>
      <div className="mindmap-floating-toolbar">
        <button
          className="icon-btn"
          onClick={() => onToggleCollapse(node.id, !isCollapsed)}
          title={isCollapsed ? 'Expand children' : 'Collapse children'}
          type="button"
        >
          {isCollapsed ? <IconExpand size={18} /> : <IconCollapse size={18} />}
        </button>

        <div className="floating-divider" />

        <button
          className="icon-btn"
          onClick={() => onAddChild(node.id)}
          title="Add child node"
          type="button"
        >
          <IconPlus size={18} />
        </button>

        <div className="floating-divider" />

        <div className="floating-group">
          <button
            className="icon-btn"
            onClick={() => setShowColors((prev) => !prev)}
            title="Change color"
            type="button"
            aria-expanded={showColors}
          >
            <IconPalette size={18} />
          </button>
          {showColors && (
            <div className="floating-popover">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  className="color-option"
                  style={{ background: color.value }}
                  onClick={() => {
                    onColorChange(color.value);
                    setShowColors(false);
                  }}
                  title={color.name}
                  type="button"
                />
              ))}
            </div>
          )}
        </div>

        <div className="floating-group">
          <button
            className="icon-btn"
            onClick={() => setShowEmojis((prev) => !prev)}
            title="Add emoji"
            type="button"
            aria-expanded={showEmojis}
          >
            <IconSparkle size={18} />
          </button>
          {showEmojis && (
            <div className="floating-popover emoji-picker">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-option"
                  onClick={() => {
                    onEmojiChange(emoji);
                    setShowEmojis(false);
                  }}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
              <button
                className="emoji-option"
                onClick={() => {
                  onEmojiChange('');
                  setShowEmojis(false);
                }}
                type="button"
                title="Remove emoji"
              >
                <IconMore size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="floating-divider" />

        <button
          className="icon-btn ghost"
          title="More actions coming soon"
          type="button"
          disabled
        >
          <IconMagicWand size={18} />
        </button>

        <div className="floating-divider" />

        <button
          className="icon-btn danger"
          onClick={() => onDelete(node.id)}
          title="Delete node"
          type="button"
        >
          <IconTrash size={18} />
        </button>
      </div>
    </div>
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
  const { fitView, setCenter } = useReactFlow();
  const transformStore = useStore((state) => state.transform);
  const transformRef = useRef<[number, number, number]>([0, 0, 1]);

  // Canonical graph refs to avoid stale closures
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const historyRef = useRef<Snapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const isRestoringRef = useRef(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    transformRef.current = transformStore;
  }, [transformStore]);

  const syncHistoryMeta = useCallback(() => {
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current >= 0 && historyIndexRef.current < historyRef.current.length - 1,
    });
  }, []);

  const pushHistory = useCallback(
    (nodesSnapshot: MindmapNode[], edgesSnapshot: MindmapEdge[]) => {
      const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
      trimmed.push({
        nodes: cloneNodesForHistory(nodesSnapshot),
        edges: cloneEdgesForHistory(edgesSnapshot),
      });
      historyRef.current = trimmed;
      historyIndexRef.current = trimmed.length - 1;
      syncHistoryMeta();
    },
    [syncHistoryMeta],
  );

  const restoreSnapshot = useCallback(
    (snapshot: Snapshot) => {
      isRestoringRef.current = true;
      const nodesCopy = cloneNodesForHistory(snapshot.nodes);
      const edgesCopy = cloneEdgesForHistory(snapshot.edges);
      const { nodes: finalNodes, edges: finalEdges } = applyCollapseState(nodesCopy, edgesCopy);
      nodesRef.current = finalNodes;
      edgesRef.current = finalEdges;
      setNodes(finalNodes);
      setEdges(finalEdges);
      isRestoringRef.current = false;
    },
    [setEdges, setNodes],
  );

  const updateGraph = useCallback(
    (
      mutator: (
        currentNodes: MindmapNode[],
        currentEdges: MindmapEdge[],
      ) => { nodes: MindmapNode[]; edges: MindmapEdge[] } | null,
    ) => {
      const prevNodes = nodesRef.current;
      const prevEdges = edgesRef.current;
      const result = mutator(prevNodes, prevEdges);
      if (!result) {
        return;
      }

      const { nodes: nextNodesRaw, edges: nextEdges } = result;

      const collapseInfo = computeCollapseInfo(nextNodesRaw, nextEdges);
      const visibleNodeMap = new Map<string, MindmapNode>();
      nextNodesRaw.forEach((node) => {
        if (collapseInfo.visibleIds.has(node.id)) {
          visibleNodeMap.set(node.id, node);
        }
      });

      const visibleNodes = Array.from(visibleNodeMap.values());
      const visibleEdges = nextEdges.filter(
        (edge) => collapseInfo.visibleIds.has(edge.source) && collapseInfo.visibleIds.has(edge.target),
      );

      const layoutedVisibleNodes = getLayoutedElements(visibleNodes, visibleEdges);
      const positionMap = new Map<string, MindmapNode>(layoutedVisibleNodes.map((node) => [node.id, node]));

      const layoutedNodes = nextNodesRaw.map((node) => {
        const layoutNode = positionMap.get(node.id);
        if (!layoutNode) {
          return { ...node };
        }
        return {
          ...node,
          position: layoutNode.position,
          positionAbsolute: layoutNode.position,
        };
      });

      const { nodes: finalNodes, edges: finalEdges } = applyCollapseState(layoutedNodes, nextEdges, collapseInfo);

      nodesRef.current = finalNodes;
      edgesRef.current = finalEdges;

      setNodes(finalNodes);
      setEdges(finalEdges);

      if (!isRestoringRef.current) {
        pushHistory(finalNodes, finalEdges);
      }
    },
    [pushHistory, setEdges, setNodes],
  );

  const relayout = useCallback(() => {
    updateGraph((currentNodes, currentEdges) => ({
      nodes: [...currentNodes],
      edges: [...currentEdges],
    }));
  }, [updateGraph]);

  const focusNodes = useCallback(
    (nodeIds: string[]) => {
      const targets = nodesRef.current.filter((n) => nodeIds.includes(n.id));
      if (targets.length === 0) {
        return;
      }

      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      targets.forEach((node) => {
        const position = node.positionAbsolute ?? node.position ?? { x: 0, y: 0 };
        const width = node.measured?.width ?? node.width ?? 160;
        const height = node.measured?.height ?? node.height ?? 60;
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
        maxX = Math.max(maxX, position.x + width);
        maxY = Math.max(maxY, position.y + height);
      });

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const [, , zoom] = transformRef.current;

      setCenter(centerX, centerY, {
        zoom,
        duration: 250,
      });
    },
    [setCenter],
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) {
      return;
    }

    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    restoreSnapshot(snapshot);
    syncHistoryMeta();
    setSelectedNodeId(null);
  }, [restoreSnapshot, syncHistoryMeta, setSelectedNodeId]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < 0 || historyIndexRef.current >= historyRef.current.length - 1) {
      return;
    }

    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    restoreSnapshot(snapshot);
    syncHistoryMeta();
    setSelectedNodeId(null);
  }, [restoreSnapshot, syncHistoryMeta, setSelectedNodeId]);

  useEffect(() => {
    updateGraph((currentNodes, currentEdges) => ({
      nodes: [...currentNodes],
      edges: [...currentEdges],
    }));

    const timeout = setTimeout(() => {
      fitView({ padding: 0.25, duration: 300 });
    }, 0);

    return () => clearTimeout(timeout);
  }, [fitView, updateGraph]);

  // Add child node
  const addChild = useCallback(
    (parentId: string) => {
      const newId = `node-${nodeIdCounter++}`;

      updateGraph((currentNodes, currentEdges) => {
        const parent = currentNodes.find((n) => n.id === parentId);
        if (!parent) {
          return null;
        }

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

        return {
          nodes: [...currentNodes, newNode],
          edges: [...currentEdges, newEdge],
        };
      });

      requestAnimationFrame(() => {
        focusNodes([parentId, newId]);
      });
    },
    [focusNodes, updateGraph],
  );

  // Delete node and descendants
  const deleteNode = useCallback(
    (nodeId: string) => {
      updateGraph((currentNodes, currentEdges) => {
        const childrenMap = new Map<string, string[]>();
        currentEdges.forEach((edge) => {
          if (!childrenMap.has(edge.source)) {
            childrenMap.set(edge.source, []);
          }
          childrenMap.get(edge.source)!.push(edge.target);
        });

        const nodesToDelete = new Set<string>();
        const collectDescendants = (id: string) => {
          nodesToDelete.add(id);
          const children = childrenMap.get(id) || [];
          children.forEach((childId) => collectDescendants(childId));
        };

        collectDescendants(nodeId);

        const filteredNodes = currentNodes.filter((n) => !nodesToDelete.has(n.id));
        const filteredEdges = currentEdges.filter(
          (e) => !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target),
        );

        return {
          nodes: filteredNodes,
          edges: filteredEdges,
        };
      });
    },
    [updateGraph],
  );

  // Update node label
  const updateNodeLabel = useCallback(
    (id: string, label: string) => {
      updateGraph((nodesState, edgesState) => ({
        nodes: nodesState.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  label,
                },
              }
            : n,
        ),
        edges: edgesState,
      }));
    },
    [updateGraph],
  );

  // Change node color
  const changeNodeColor = useCallback(
    (color: string) => {
      if (!selectedNodeId) return;
      updateGraph((nodesState, edgesState) => ({
        nodes: nodesState.map((n) =>
          n.id === selectedNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  color,
                },
              }
            : n,
        ),
        edges: edgesState,
      }));
    },
    [selectedNodeId, updateGraph],
  );

  // Change node emoji
  const changeNodeEmoji = useCallback(
    (emoji: string) => {
      if (!selectedNodeId) return;
      updateGraph((nodesState, edgesState) => ({
        nodes: nodesState.map((n) =>
          n.id === selectedNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  emoji,
                },
              }
            : n,
        ),
        edges: edgesState,
      }));
    },
    [selectedNodeId, updateGraph],
  );

  const toggleCollapse = useCallback(
    (nodeId: string, collapsed: boolean) => {
      updateGraph((nodesState, edgesState) => ({
        nodes: nodesState.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  collapsed,
                },
              }
            : node,
        ),
        edges: edgesState,
      }));

      requestAnimationFrame(() => {
        focusNodes([nodeId]);
      });
    },
    [focusNodes, updateGraph],
  );

  // Add root node
  const addRootNode = useCallback(() => {
    updateGraph((currentNodes, currentEdges) => {
      const newId = `root-${nodeIdCounter++}`;
      const newNode: MindmapNode = {
        id: newId,
        type: 'mindmap',
        position: { x: 0, y: 0 },
        data: { label: 'New Root', level: 0, color: COLORS[0].value },
      };

      return {
        nodes: [...currentNodes, newNode],
        edges: currentEdges,
      };
    });
  }, [updateGraph]);

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
          updateGraph(() => ({ nodes: importedNodes, edges: importedEdges }));
        } catch (err) {
          alert('Invalid file format');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [updateGraph]);

  // Clear all
  const clearAll = useCallback(() => {
    if (confirm('Clear all nodes? This cannot be undone.')) {
      const resetNodes: MindmapNode[] = [{
        id: 'root',
        type: 'mindmap',
        position: { x: 0, y: 0 },
        data: { label: 'My Mindmap', level: 0, color: COLORS[0].value },
      }];
      updateGraph(() => ({ nodes: resetNodes, edges: [] }));
      setSelectedNodeId(null);
    }
  }, [setSelectedNodeId, updateGraph]);

  // Event listeners
  useEffect(() => {
    const handleAddChild = (e: Event) => {
      const { parentId } = (e as CustomEvent).detail;
      addChild(parentId);
    };
    const handleDeleteNode = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: string; nodeId?: string };
      const nodeId = detail?.id ?? detail?.nodeId;
      if (nodeId) {
        deleteNode(nodeId);
      }
    };
    const handleUpdateLabel = (e: Event) => {
      const { id, label } = (e as CustomEvent).detail;
      updateNodeLabel(id, label);
    };

    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only delete if not editing and a node is selected
      const activeElement = document.activeElement;
      const isEditing = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      if ((e.metaKey || e.ctrlKey) && !isEditing) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          redo();
          return;
        }
      }

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
  }, [addChild, deleteNode, updateNodeLabel, redo, selectedNodeId, undo]);

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
          onUndo={undo}
          onRedo={redo}
          canUndo={historyState.canUndo}
          canRedo={historyState.canRedo}
        />

        <NodeActionToolbar
          node={selectedNode}
          onAddChild={addChild}
          onDelete={deleteNode}
          onColorChange={changeNodeColor}
          onEmojiChange={changeNodeEmoji}
          onToggleCollapse={toggleCollapse}
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
