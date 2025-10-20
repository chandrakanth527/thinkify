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

interface MindmapNodeData extends Record<string, unknown> {
  label: string;
  level: number;
  color?: string;
  emoji?: string;
  collapsed?: boolean;
  hiddenChildCount?: number;

  // AI Planning fields
  description?: string;
  status?: 'not-started' | 'in-progress' | 'completed' | 'blocked';
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

// Zoom configuration
const ZOOM_LIMITS = {
  min: 0.1,
  max: 2.0,
  comfortable: {
    min: 0.4,
    max: 1.2,
  },
  autoAdjust: {
    threshold: 0.3,
    targetPadding: 0.15,
  },
};

const ZOOM_DURATIONS = {
  initial: 300,
  addNode: 400,
  expand: 500,
  collapse: 300,
  selection: 350,
  autoLayout: 600,
  delete: 300,
  undo: 400,
};

let nodeIdCounter = 100;

interface Snapshot {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

interface CollapseInfo {
  visibleIds: Set<string>;
  hiddenChildCount: Map<string, number>;
}

const cloneNodeForHistory = (node: MindmapNode): MindmapNode => {
  const cloned: MindmapNode = {
    ...node,
    data: { ...node.data },
    position: node.position ? { ...node.position } : node.position,
  };

  if (node.style) cloned.style = { ...node.style };
  if (node.measured) cloned.measured = { ...node.measured };

  return cloned;
};

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

  // Layout each root separately, preserving root positions
  rootNodes.forEach((root) => {
    currentY = 0;
    // Use the root's existing position instead of calculating a new one
    const rootX = root.position.x;
    const rootY = root.position.y;

    // Position the tree, but we'll adjust to keep root at its current position
    positionNode(root, rootX, rootY);
  });

  return layoutedNodes;
};

// ==================== MINDMAP NODE COMPONENT ====================

const MindmapNodeComponent = ({ data, id, selected }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [label, setLabel] = useState(data.label);
  const [description, setDescription] = useState(data.description || '');
  const [status, setStatus] = useState(data.status || 'not-started');
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditingDescription && descriptionRef.current) {
      descriptionRef.current.focus();
      descriptionRef.current.select();
    }
  }, [isEditingDescription]);

  // Handle click outside to collapse
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicking on input/textarea or if actively editing
      if (isEditing || isEditingDescription || isEditingStatus) {
        return;
      }

      const target = e.target as HTMLElement;
      if (nodeRef.current && !nodeRef.current.contains(target)) {
        setIsExpanded(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditing && !isEditingDescription && !isEditingStatus) {
        setIsExpanded(false);
      }
    };

    // Use capture phase to ensure we get the event before ReactFlow
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isExpanded, isEditing, isEditingDescription, isEditingStatus]);

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

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false);
    window.dispatchEvent(new CustomEvent('update-node-description', {
      detail: { id, description: description.trim() }
    }));
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    setIsEditingStatus(false);
    window.dispatchEvent(new CustomEvent('update-node-status', {
      detail: { id, status: newStatus }
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setLabel(data.label);
      setIsEditing(false);
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDescription(data.description || '');
      setIsEditingDescription(false);
    }
    // Allow Ctrl/Cmd+Enter to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleDescriptionBlur();
    }
  };

  const nodeClass = `mindmap-master-node level-${data.level}`;

  // Status indicator mapping with colors
  const statusConfig = {
    'not-started': { icon: '○', label: 'Not Started', color: '#94a3b8', bg: '#f1f5f9' },
    'in-progress': { icon: '◐', label: 'In Progress', color: '#3b82f6', bg: '#dbeafe' },
    'completed': { icon: '●', label: 'Completed', color: '#10b981', bg: '#d1fae5' },
    'blocked': { icon: '✕', label: 'Blocked', color: '#ef4444', bg: '#fee2e2' },
  };

  const currentStatus = data.status ? statusConfig[data.status as keyof typeof statusConfig] : null;

  // Status only affects left border, background is for categorization
  const style: React.CSSProperties = {
    ...(data.color ? { background: data.color } : {}),
    ...(currentStatus ? { borderLeft: `3px solid ${currentStatus.color}` } : {}),
  };

  return (
    <div ref={nodeRef} className={`${nodeClass} ${selected ? 'selected' : ''}`} style={style}>
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
        {/* Compact view - entire area clickable to expand */}
        {!isExpanded && !isEditing && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
            title="Click to expand details"
          >
            {/* Title only */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {data.emoji && <span className="node-emoji">{data.emoji}</span>}
              <div
                className="node-label"
                onDoubleClick={handleDoubleClick}
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1a1a1a',
                  lineHeight: '1.3',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {label}
              </div>
            </div>

            {/* Expand hint if has description */}
            {data.description && (
              <div
                style={{
                  fontSize: '10px',
                  color: '#94a3b8',
                  lineHeight: '1'
                }}
              >
                ⋯
              </div>
            )}
          </div>
        )}

        {/* Expanded view */}
        {isExpanded && (
          <div style={{ maxWidth: '320px', minWidth: '200px' }}>
            {/* Close button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                style={{
                  fontSize: '16px',
                  color: '#94a3b8',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: '1'
                }}
                title="Close (or click outside)"
                type="button"
              >
                ✕
              </button>
            </div>

            {/* Title - editable on double click */}
            <div style={{ marginBottom: '10px' }}>
              {!isEditing ? (
                <div
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1a1a1a',
                    lineHeight: '1.4',
                    wordBreak: 'break-word',
                    padding: '2px 0'
                  }}
                  title="Double-click to edit title"
                >
                  {label}
                </div>
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="node-input"
                  style={{ width: '100%', fontSize: '14px', fontWeight: 600 }}
                />
              )}
            </div>

            {/* Description - editable on double click */}
            <div>
              {!isEditingDescription ? (
                <div
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsEditingDescription(true);
                  }}
                  style={{
                    fontSize: '12px',
                    color: description ? '#64748b' : '#cbd5e1',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    padding: '4px',
                    borderRadius: '4px',
                    minHeight: '40px'
                  }}
                  title="Double-click to edit description"
                >
                  {description || 'Double-click to add description...'}
                </div>
              ) : (
                <textarea
                  ref={descriptionRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  onKeyDown={handleDescriptionKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Add description... (Ctrl+Enter to save)"
                  style={{
                    width: '100%',
                    minHeight: '60px',
                    fontSize: '12px',
                    padding: '6px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    lineHeight: '1.5'
                  }}
                />
              )}
            </div>
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
  onStatusChange: (nodeId: string, status: string) => void;
}

const NodeActionToolbar = ({
  node,
  onAddChild,
  onDelete,
  onColorChange,
  onEmojiChange,
  onToggleCollapse,
  onStatusChange,
}: NodeActionToolbarProps) => {
  const [showColors, setShowColors] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const transform = useStore((state) => state.transform);

  useEffect(() => {
    setShowColors(false);
    setShowEmojis(false);
    setShowStatus(false);
  }, [node?.id]);

  const [viewportX, viewportY, zoom] = transform;

  // Force recalculation on every render when node is selected
  // This ensures toolbar position updates during zoom/pan animations
  const anchorStyle = useMemo(() => {
    if (!node) {
      return null;
    }

    const position = (node as any).positionAbsolute ?? node.position;
    const baseWidth = node.measured?.width ?? node.width ?? 160;
    const baseHeight = node.measured?.height ?? node.height ?? 60;

    return {
      left: viewportX + ((position?.x ?? 0) + baseWidth / 2) * zoom,
      top: viewportY + (position?.y ?? 0) * zoom,
      '--toolbar-offset': `${(baseHeight + 16) * zoom}px`,
    } as CSSProperties;
  }, [node, node?.position, node?.measured, viewportX, viewportY, zoom]);

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

        {/* Status dropdown */}
        <div className="floating-group">
          <button
            className="icon-btn"
            onClick={() => setShowStatus((prev) => !prev)}
            title="Change status"
            type="button"
            aria-expanded={showStatus}
            style={{
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {node.data.status ?
              ({'not-started': '○', 'in-progress': '◐', 'completed': '●', 'blocked': '✕'}[node.data.status] || '○')
              : '○'}
          </button>
          {showStatus && (
            <div className="floating-popover" style={{ minWidth: '140px' }}>
              {[
                { key: 'not-started', icon: '○', label: 'Not Started', color: '#94a3b8' },
                { key: 'in-progress', icon: '◐', label: 'In Progress', color: '#3b82f6' },
                { key: 'completed', icon: '●', label: 'Completed', color: '#10b981' },
                { key: 'blocked', icon: '✕', label: 'Blocked', color: '#ef4444' },
              ].map((statusOption) => (
                <button
                  key={statusOption.key}
                  className="status-option"
                  onClick={() => {
                    onStatusChange(node.id, statusOption.key);
                    setShowStatus(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    width: '100%',
                    background: node.data.status === statusOption.key ? '#f0f0f0' : 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                  type="button"
                >
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: statusOption.color }}>
                    {statusOption.icon}
                  </span>
                  <span>{statusOption.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
      data: {
        label: 'My Mindmap',
        level: 0,
        color: COLORS[0].value,
        // AI Planning fields example
        status: 'in-progress',
        description: 'Build an AI-powered mindmap tool for structured problem-solving. This tool will help break down complex tasks into manageable pieces and track progress.',
      },
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
      const [x, y, zoom] = transformRef.current;
      const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
      trimmed.push({
        nodes: cloneNodesForHistory(nodesSnapshot),
        edges: cloneEdgesForHistory(edgesSnapshot),
        viewport: { x, y, zoom },
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

      // Restore viewport state if available
      if (snapshot.viewport) {
        requestAnimationFrame(() => {
          setCenter(snapshot.viewport!.x, snapshot.viewport!.y, {
            zoom: snapshot.viewport!.zoom,
            duration: ZOOM_DURATIONS.undo,
          });
        });
      }

      isRestoringRef.current = false;
    },
    [setEdges, setNodes, setCenter],
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

    // After relayout, fit all visible nodes
    requestAnimationFrame(() => {
      fitView({
        padding: 0.25,
        duration: ZOOM_DURATIONS.autoLayout,
        maxZoom: ZOOM_LIMITS.comfortable.max,
      });
    });
  }, [updateGraph, fitView]);

  const focusNodes = useCallback(
    (nodeIds: string[], options?: { zoomToFit?: boolean; duration?: number; padding?: number }) => {
      const targets = nodesRef.current.filter((n) => nodeIds.includes(n.id));
      if (targets.length === 0) {
        return;
      }

      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      targets.forEach((node) => {
        const position = (node as any).positionAbsolute ?? node.position ?? { x: 0, y: 0 };
        const width = node.measured?.width ?? node.width ?? 160;
        const height = node.measured?.height ?? node.height ?? 60;
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
        maxX = Math.max(maxX, position.x + width);
        maxY = Math.max(maxY, position.y + height);
      });

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const [, , currentZoom] = transformRef.current;

      let targetZoom = currentZoom;

      if (options?.zoomToFit) {
        // Calculate optimal zoom to fit the nodes
        const width = maxX - minX;
        const height = maxY - minY;
        const padding = options.padding ?? ZOOM_LIMITS.autoAdjust.targetPadding;

        // Assume viewport is roughly 1200x800 (will be more precise with actual viewport)
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const zoomX = (viewportWidth * (1 - padding * 2)) / width;
        const zoomY = (viewportHeight * (1 - padding * 2)) / height;

        targetZoom = Math.min(zoomX, zoomY);
        targetZoom = Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, targetZoom));

        // Prefer comfortable zoom range
        if (targetZoom > ZOOM_LIMITS.comfortable.max) {
          targetZoom = ZOOM_LIMITS.comfortable.max;
        }
      } else if (currentZoom < ZOOM_LIMITS.comfortable.min) {
        // If too zoomed out, zoom in to comfortable level
        targetZoom = ZOOM_LIMITS.comfortable.min * 1.5;
      }

      setCenter(centerX, centerY, {
        zoom: targetZoom,
        duration: options?.duration ?? 250,
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
      fitView({ padding: 0.2, duration: ZOOM_DURATIONS.initial, maxZoom: ZOOM_LIMITS.comfortable.max });
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
            status: 'not-started',
            description: '',
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
        // Smart zoom: fit to show both parent and new child with some padding
        focusNodes([parentId, newId], {
          zoomToFit: true,
          duration: ZOOM_DURATIONS.addNode,
          padding: 0.2,
        });
      });
    },
    [focusNodes, updateGraph],
  );

  // Delete node and descendants
  const deleteNode = useCallback(
    (nodeId: string) => {
      // Find parent before deletion
      const parentEdge = edgesRef.current.find((e) => e.target === nodeId);
      const parentId = parentEdge?.source;

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

      // Focus on parent if exists
      if (parentId) {
        requestAnimationFrame(() => {
          focusNodes([parentId], { duration: ZOOM_DURATIONS.delete });
        });
      }
    },
    [updateGraph, focusNodes],
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

  // Update node description
  const updateNodeDescription = useCallback(
    (id: string, description: string) => {
      updateGraph((nodesState, edgesState) => ({
        nodes: nodesState.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  description,
                },
              }
            : n,
        ),
        edges: edgesState,
      }));
    },
    [updateGraph],
  );

  // Update node status
  const updateNodeStatus = useCallback(
    (id: string, status: string) => {
      updateGraph((nodesState, edgesState) => ({
        nodes: nodesState.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  status,
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
        if (collapsed) {
          // Collapsing: just center on the node, keep zoom
          focusNodes([nodeId], { duration: ZOOM_DURATIONS.collapse });
        } else {
          // Expanding: zoom to fit the revealed subtree
          // Get all children of this node
          const childrenMap = new Map<string, string[]>();
          edgesRef.current.forEach((edge) => {
            if (!childrenMap.has(edge.source)) {
              childrenMap.set(edge.source, []);
            }
            childrenMap.get(edge.source)!.push(edge.target);
          });

          const getDescendants = (id: string): string[] => {
            const children = childrenMap.get(id) || [];
            const descendants = [...children];
            children.forEach((childId) => {
              descendants.push(...getDescendants(childId));
            });
            return descendants;
          };

          const descendants = getDescendants(nodeId);
          const nodesToFocus = [nodeId, ...descendants];

          focusNodes(nodesToFocus, {
            zoomToFit: true,
            duration: ZOOM_DURATIONS.expand,
            padding: 0.15,
          });
        }
      });
    },
    [focusNodes, updateGraph],
  );

  // Add root node
  const addRootNode = useCallback(() => {
    // Get current viewport center
    const [x, y, zoom] = transformRef.current;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate the center point in flow coordinates
    const centerX = (viewportWidth / 2 - x) / zoom;
    const centerY = (viewportHeight / 2 - y) / zoom;

    updateGraph((currentNodes, currentEdges) => {
      const newId = `root-${nodeIdCounter++}`;
      const newNode: MindmapNode = {
        id: newId,
        type: 'mindmap',
        position: { x: centerX, y: centerY },
        data: {
          label: 'New Root',
          level: 0,
          color: COLORS[0].value,
          status: 'not-started',
          description: '',
        },
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
    const handleUpdateDescription = (e: Event) => {
      const { id, description } = (e as CustomEvent).detail;
      updateNodeDescription(id, description);
    };
    const handleUpdateStatus = (e: Event) => {
      const { id, status } = (e as CustomEvent).detail;
      updateNodeStatus(id, status);
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
    window.addEventListener('update-node-description', handleUpdateDescription);
    window.addEventListener('update-node-status', handleUpdateStatus);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('add-child', handleAddChild);
      window.removeEventListener('delete-node', handleDeleteNode);
      window.removeEventListener('update-node-label', handleUpdateLabel);
      window.removeEventListener('update-node-description', handleUpdateDescription);
      window.removeEventListener('update-node-status', handleUpdateStatus);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addChild, deleteNode, updateNodeLabel, updateNodeDescription, updateNodeStatus, redo, selectedNodeId, undo]);

  // Track selection and handle root node dragging
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // Check if this is a root node being dragged
    const positionChange = changes.find(c => c.type === 'position' && 'dragging' in c && c.dragging);

    if (positionChange && 'position' in positionChange && positionChange.position) {
      const draggedNode = nodesRef.current.find(n => n.id === positionChange.id);

      // If dragging a root node (level 0), move only its tree (root + descendants)
      if (draggedNode && draggedNode.data.level === 0) {
        const oldPosition = draggedNode.position;
        const newPosition = positionChange.position;
        const deltaX = newPosition.x - oldPosition.x;
        const deltaY = newPosition.y - oldPosition.y;

        // Build children map to find descendants
        const childrenMap = new Map<string, string[]>();
        edgesRef.current.forEach(edge => {
          if (!childrenMap.has(edge.source)) {
            childrenMap.set(edge.source, []);
          }
          childrenMap.get(edge.source)!.push(edge.target);
        });

        // Get all descendants of this root node
        const getDescendants = (nodeId: string): Set<string> => {
          const descendants = new Set<string>();
          const children = childrenMap.get(nodeId) || [];
          children.forEach(childId => {
            descendants.add(childId);
            const childDescendants = getDescendants(childId);
            childDescendants.forEach(desc => descendants.add(desc));
          });
          return descendants;
        };

        const treeNodeIds = new Set<string>([draggedNode.id, ...getDescendants(draggedNode.id)]);

        // Apply delta only to nodes in this tree
        const modifiedChanges: NodeChange<MindmapNode>[] = nodesRef.current
          .filter(node => treeNodeIds.has(node.id))
          .map(node => ({
            type: 'position' as const,
            id: node.id,
            position: {
              x: node.position.x + deltaX,
              y: node.position.y + deltaY,
            },
            dragging: positionChange.id === node.id,
          }));

        onNodesChange(modifiedChanges as NodeChange<MindmapNode>[] as NodeChange[]);
        return;
      }
    }

    onNodesChange(changes as NodeChange<MindmapNode>[] as NodeChange[]);

    const selectChange = changes.find(c => c.type === 'select');
    if (selectChange && 'selected' in selectChange) {
      const nodeId = selectChange.selected ? selectChange.id : null;
      setSelectedNodeId(nodeId);

      // Smart zoom on selection
      if (nodeId && selectChange.selected) {
        requestAnimationFrame(() => {
          focusNodes([nodeId], {
            duration: ZOOM_DURATIONS.selection,
          });
        });
      }
    }
  }, [onNodesChange, focusNodes]);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) ?? null : null;

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
