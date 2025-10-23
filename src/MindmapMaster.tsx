import "@xyflow/react/dist/style.css";
import "./mindmap-master.css";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  Handle,
  MiniMap,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
} from "@xyflow/react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { generateMindmapSuggestions, MindmapAiError } from "@/ai/client";
import type { MindmapAiSuggestion, MindmapContextPayload } from "@/ai/types";
import {
  AIChatPanel,
  type AIChatPanelMessage,
  type AIChatPanelNodeSummary,
  type AIChatPanelPhase,
  type AIChatPanelQuickAction,
  type AIIntent,
} from "@/components/AIChatPanel";
import {
  IconCollapse,
  IconDownload,
  IconExpand,
  IconLayout,
  IconMagicWand,
  IconMore,
  IconNote,
  IconPalette,
  IconPlus,
  IconRedo,
  IconSparkle,
  IconTrash,
  IconUndo,
  IconUpload,
} from "@/icons";

// ==================== TYPES ====================

interface MindmapNodeData extends Record<string, unknown> {
  label: string;
  level: number;
  color?: string;
  emoji?: string;
  collapsed?: boolean;
  hiddenChildCount?: number;
  variant?: "topic" | "edge-note";
  noteContent?: string;
  noteCollapsed?: boolean;

  // AI Planning fields
  description?: string;
  status?: "not-started" | "in-progress" | "completed" | "blocked";
}

type MindmapNode = Node<MindmapNodeData, "mindmap" | "edge-note"> & {
  positionAbsolute?: { x: number; y: number };
};
type MindmapEdge = Edge;

// ==================== CONSTANTS ====================

const COLORS = [
  { name: "Lavender", value: "#B4A7D6" },
  { name: "Peach", value: "#FFB5A7" },
  { name: "Mint", value: "#B8E6D5" },
  { name: "Sky", value: "#A8D8EA" },
  { name: "Blush", value: "#F8B4D9" },
  { name: "Lemon", value: "#FFF4A3" },
  { name: "Coral", value: "#FFCAB0" },
  { name: "Sage", value: "#C5E1A5" },
  { name: "Periwinkle", value: "#C5CAE9" },
  { name: "Rose", value: "#F8BBD0" },
];

const EMOJIS = ["💡", "⭐", "🎯", "🚀", "💎", "🔥", "✨", "🎨", "📌", "🏆"];

const STATUS_OPTIONS = [
  {
    value: "not-started",
    icon: "○",
    label: "Not Started",
    color: "#64748b",
    bg: "rgba(100, 116, 139, 0.16)",
  },
  {
    value: "in-progress",
    icon: "◐",
    label: "In Progress",
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.16)",
  },
  {
    value: "completed",
    icon: "●",
    label: "Completed",
    color: "#16a34a",
    bg: "rgba(22, 163, 74, 0.16)",
  },
  {
    value: "blocked",
    icon: "✕",
    label: "Blocked",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.16)",
  },
] as const;

type StatusValue = (typeof STATUS_OPTIONS)[number]["value"];

const normalizeStatus = (value?: MindmapNodeData["status"]): StatusValue =>
  (STATUS_OPTIONS.find((option) => option.value === value)?.value ??
    "not-started") as StatusValue;

const FLOW_STORAGE_KEY = "mindmap-flow-state.v1";
const AI_CONVERSATION_STORAGE_KEY = "mindmap-ai-conversations.v1";

const AI_INTENT_META: Record<
  AIIntent,
  {
    label: string;
    tagline: string;
    addLabel: string;
    replaceLabel: string;
    placeholder: (nodeLabel?: string) => string;
    quickHint?: string;
    quickActions: AIChatPanelQuickAction[];
  }
> = {
  spark: {
    label: "Spark Ideas",
    tagline: "Generate alternative ideas or answers for this node.",
    addLabel: "Add ideas",
    replaceLabel: "Replace ideas",
    placeholder: (nodeLabel) =>
      nodeLabel
        ? `Ask for fresh ideas for “${nodeLabel}”…`
        : "Ask for fresh ideas…",
    quickHint: "Choose a shortcut to brainstorm new ideas instantly.",
    quickActions: [
      {
        id: "children",
        label: "Fresh ideas",
        description: "Suggest a handful of candidate ideas for this topic.",
      },
      {
        id: "expand",
        label: "Different angles",
        description: "Explore alternative perspectives or niches to consider.",
      },
      {
        id: "replace",
        label: "Reimagine ideas",
        description: "Swap current ideas for a refreshed, more varied batch.",
      },
    ],
  },
  deepen: {
    label: "Deepen Structure",
    tagline: "Break the node into research areas, tasks, or subtopics.",
    addLabel: "Add subtopics",
    replaceLabel: "Replace subtopics",
    placeholder: (nodeLabel) =>
      nodeLabel
        ? `Ask how to deepen “${nodeLabel}”…`
        : "Ask how to deepen this branch…",
    quickHint: "Pick a shortcut to outline research steps or supporting tasks.",
    quickActions: [
      {
        id: "children",
        label: "Core subtopics",
        description:
          "Outline the foundational subtopics that should live here.",
      },
      {
        id: "expand",
        label: "Research plan",
        description: "List research tasks, experiments, or analyses to run.",
      },
      {
        id: "replace",
        label: "Rebuild branch",
        description: "Replace existing subtopics with a stronger structure.",
      },
    ],
  },
};

interface StoredAIMessage extends AIChatPanelMessage {
  kind?: "manual" | "quick" | "ai";
  suggestion?: MindmapAiSuggestion;
  intent?: AIIntent;
}

const createMessageId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

interface StoredFlowState {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

const serializeNodesForStorage = (entries: MindmapNode[]) =>
  entries.map((entry) => ({
    id: entry.id,
    type: entry.type,
    position: entry.position,
    positionAbsolute: entry.positionAbsolute,
    data: entry.data,
    style: entry.style,
    width: entry.width,
    height: entry.height,
    measured: entry.measured,
  }));

const serializeEdgesForStorage = (entries: MindmapEdge[]) =>
  entries.map((entry) => ({
    id: entry.id,
    source: entry.source,
    target: entry.target,
    sourceHandle: entry.sourceHandle,
    targetHandle: entry.targetHandle,
    type: entry.type,
    data: entry.data,
    style: entry.style,
    animated: entry.animated,
  }));

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

// Virtual canvas configuration – keep the graph centered within a generous stage
const CANVAS_DIMENSIONS = {
  width: 16000,
  height: 9000,
};

const DEFAULT_VIEWPORT_CENTER = {
  x: CANVAS_DIMENSIONS.width / 2,
  y: CANVAS_DIMENSIONS.height / 2,
};

const DEFAULT_VIEWPORT_ZOOM = 1.1;

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

const cloneNodesForHistory = (nodes: MindmapNode[]): MindmapNode[] =>
  nodes.map(cloneNodeForHistory);

const cloneEdgesForHistory = (edges: MindmapEdge[]): MindmapEdge[] =>
  edges.map((edge) => ({
    ...edge,
    data: edge.data ? { ...edge.data } : undefined,
    style: edge.style ? { ...edge.style } : undefined,
  }));

const hexToRgba = (hex: string, alpha: number): string => {
  const sanitized = hex.replace("#", "");
  const expanded =
    sanitized.length === 3
      ? sanitized
          .split("")
          .map((char) => char + char)
          .join("")
      : sanitized;

  if (expanded.length !== 6) {
    return `rgba(148, 163, 184, ${alpha})`;
  }

  const value = Number.parseInt(expanded, 16);
  // eslint-disable-next-line no-bitwise -- simple bitmask to compute rgb components
  const r = (value >> 16) & 255;
  // eslint-disable-next-line no-bitwise -- simple bitmask to compute rgb components
  const g = (value >> 8) & 255;
  // eslint-disable-next-line no-bitwise -- simple bitmask to compute rgb components
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

type MarkdownBlock =
  | { type: "h2" | "h3" | "p" | "blockquote"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "spacer" };

const renderInlineNodes = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const inner =
      token.startsWith("**") || token.startsWith("__")
        ? token.slice(2, -2)
        : token.slice(1, -1);
    const children = renderInlineNodes(inner);
    const key = `${match.index}-${token.length}`;

    if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(
        <strong key={`strong-${key}`}>
          {children.length ? children : inner}
        </strong>
      );
    } else {
      nodes.push(
        <em key={`em-${key}`}>{children.length ? children : inner}</em>
      );
    }

    lastIndex = regex.lastIndex;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const parseMarkdownBlocks = (input: string): MarkdownBlock[] => {
  const lines = input.replace(/\r?\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushList = () => {
    if (currentList) {
      blocks.push({ type: currentList.type, items: currentList.items });
      currentList = null;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      const last = blocks[blocks.length - 1];
      if (!last || last.type !== "spacer") {
        blocks.push({ type: "spacer" });
      }
      return;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      blocks.push({ type: "h3", text: trimmed.slice(4) });
      return;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      blocks.push({ type: "h2", text: trimmed.slice(3) });
      return;
    }

    if (trimmed.startsWith("> ")) {
      flushList();
      blocks.push({ type: "blockquote", text: trimmed.slice(2) });
      return;
    }

    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(olMatch[2]);
      return;
    }

    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(ulMatch[1]);
      return;
    }

    flushList();
    blocks.push({ type: "p", text: trimmed });
  });

  flushList();

  if (blocks.length > 0 && blocks[blocks.length - 1].type === "spacer") {
    blocks.pop();
  }

  return blocks;
};

const renderEdgeNoteMarkdown = (input: string): ReactNode[] => {
  const trimmed = input.trim();
  if (!trimmed) {
    return [
      <p className="edge-note-empty" key="empty">
        Start drafting…
      </p>,
    ];
  }

  const blocks = parseMarkdownBlocks(input);

  return blocks.map((block, index) => {
    const blockKey =
      block.type === "spacer"
        ? `spacer-${index}`
        : block.type === "ul" || block.type === "ol"
        ? `${block.type}-${block.items.join("|")}`
        : `${block.type}-${"text" in block ? block.text : ""}`;

    switch (block.type) {
      case "h2":
        return (
          <h2 key={`block-${index}-${blockKey}`}>
            {renderInlineNodes(block.text)}
          </h2>
        );
      case "h3":
        return (
          <h3 key={`block-${index}-${blockKey}`}>
            {renderInlineNodes(block.text)}
          </h3>
        );
      case "blockquote":
        return (
          <blockquote key={`block-${index}-${blockKey}`}>
            {renderInlineNodes(block.text)}
          </blockquote>
        );
      case "ul":
        return (
          <ul key={`block-${index}-${blockKey}`}>
            {block.items.map((item, itemIndex) => (
              <li key={`ul-${index}-${blockKey}-${itemIndex}-${item}`}>
                {renderInlineNodes(item)}
              </li>
            ))}
          </ul>
        );
      case "ol":
        return (
          <ol key={`block-${index}-${blockKey}`}>
            {block.items.map((item, itemIndex) => (
              <li key={`ol-${index}-${blockKey}-${itemIndex}-${item}`}>
                {renderInlineNodes(item)}
              </li>
            ))}
          </ol>
        );
      case "spacer":
        return (
          <div
            className="edge-note-spacer"
            key={`spacer-${index}-${blockKey}`}
          />
        );
      case "p":
      default:
        return (
          <p key={`block-${index}-${blockKey}`}>
            {renderInlineNodes(block.text)}
          </p>
        );
    }
  });
};
const computeCollapseInfo = (
  nodes: MindmapNode[],
  edges: MindmapEdge[]
): CollapseInfo => {
  const visibleIds = new Set<string>();
  const hiddenChildCount = new Map<string, number>();

  nodes.forEach((node) => {
    visibleIds.add(node.id);
  });

  const childMap = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!childMap.has(edge.source)) {
      childMap.set(edge.source, []);
    }
    childMap.get(edge.source)!.push(edge.target);
  });

  const collectDescendants = (id: string): string[] => {
    const children = childMap.get(id) ?? [];
    const descendants: string[] = [];
    children.forEach((childId) => {
      descendants.push(childId);
      descendants.push(...collectDescendants(childId));
    });
    return descendants;
  };

  nodes.forEach((node) => {
    if (node.data?.collapsed) {
      const descendants = collectDescendants(node.id);
      hiddenChildCount.set(node.id, descendants.length);
      descendants.forEach((descId) => visibleIds.delete(descId));
    }
  });

  return { visibleIds, hiddenChildCount };
};

// Hierarchical tree layout - positions nodes based on parent-child relationships
const getLayoutedElements = (
  nodes: MindmapNode[],
  edges: MindmapEdge[]
): { nodes: MindmapNode[]; edges: MindmapEdge[] } => {
  // Find root node (level 0)
  const rootNode = nodes.find((n) => n.data.level === 0);
  if (!rootNode) return { nodes, edges };

  // Build parent-child relationships
  const childrenMap: Map<string, MindmapNode[]> = new Map();
  edges.forEach((edge) => {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, []);
    }
    const childNode = nodes.find((n) => n.id === edge.target);
    if (childNode) {
      childrenMap.get(edge.source)!.push(childNode);
    }
  });

  const layoutedNodes: MindmapNode[] = [];
  const startX = 100;
  const startY = 300;
  const horizontalSpacing = 400; // Distance between levels
  const verticalSpacing = 150; // Distance between siblings

  // Position nodes recursively
  let currentYOffset = 0;

  const positionNode = (
    node: MindmapNode,
    x: number,
    yStart: number
  ): number => {
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

// Apply collapse state to nodes and edges - filters out hidden nodes and their edges
const applyCollapseState = (
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  collapseInfo?: CollapseInfo
): { nodes: MindmapNode[]; edges: MindmapEdge[] } => {
  const info = collapseInfo ?? computeCollapseInfo(nodes, edges);

  // Update nodes with hidden child counts
  const updatedNodes = nodes.map((node) => {
    const hiddenCount = info.hiddenChildCount.get(node.id) ?? 0;
    return {
      ...node,
      data: {
        ...node.data,
        hiddenChildCount: hiddenCount > 0 ? hiddenCount : undefined,
      },
    };
  });

  // Filter visible nodes and edges
  const visibleNodes = updatedNodes.filter((node) =>
    info.visibleIds.has(node.id)
  );
  const visibleEdges = edges.filter(
    (edge) =>
      info.visibleIds.has(edge.source) && info.visibleIds.has(edge.target)
  );

  return { nodes: visibleNodes, edges: visibleEdges };
};

// ==================== MINDMAP NODE COMPONENT ====================

const MindmapNodeComponent = ({ data, id, selected }: any) => {
  const [label, setLabel] = useState(data.label);
  const [description, setDescription] = useState(data.description || "");
  const [isExpanded, setIsExpanded] = useState(Boolean(selected));
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const leftHandleId = `${id}-left`;
  const rightHandleId = `${id}-right`;
  const updateNodeInternals = useUpdateNodeInternals();
  const emitResize = useCallback(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  useEffect(() => {
    if (!isTitleFocused) {
      setLabel(data.label);
    }
  }, [data.label, isTitleFocused]);

  useEffect(() => {
    if (!isDescriptionFocused) {
      setDescription(data.description || "");
    }
  }, [data.description, isDescriptionFocused]);

  useEffect(() => {
    if (!selected) {
      setIsExpanded(false);
    }
  }, [selected]);

  useEffect(() => {
    emitResize();
  }, [emitResize]);

  const commitLabel = () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setLabel(data.label);
      return;
    }

    window.dispatchEvent(
      new CustomEvent("update-node-label", {
        detail: { id, label: trimmed },
      })
    );
    emitResize();
  };

  const commitDescription = () => {
    const next = description.trim();
    window.dispatchEvent(
      new CustomEvent("update-node-description", {
        detail: { id, description: next },
      })
    );
    emitResize();
  };

  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitLabel();
      inputRef.current?.blur();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setLabel(data.label);
      inputRef.current?.blur();
    }
  };

  const handleDescriptionKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setDescription(data.description || "");
      descriptionRef.current?.blur();
    }

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commitDescription();
      descriptionRef.current?.blur();
    }
  };

  const statusMeta =
    STATUS_OPTIONS.find(
      (option) => option.value === normalizeStatus(data.status)
    ) ?? STATUS_OPTIONS[0];
  const accentTint = hexToRgba(data.color || statusMeta.color, 0.16);
  const borderTint = hexToRgba(statusMeta.color, 0.35);
  const focusRing = hexToRgba(statusMeta.color, 0.25);

  const emitNodeFocus = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("focus-node", {
        detail: { nodeId: id },
      })
    );
  }, [id]);

  const nodeClass = `mindmap-master-node level-${data.level}`;

  const style: React.CSSProperties = {
    background: `linear-gradient(180deg, ${accentTint} 0%, #ffffff 85%)`,
    border: `1px solid ${borderTint}`,
    boxShadow: selected
      ? "0 18px 36px rgba(15, 23, 42, 0.18)"
      : "0 8px 18px rgba(15, 23, 42, 0.1)",
    "--node-status-color": statusMeta.color,
    "--node-status-bg": statusMeta.bg,
    "--node-focus-ring": focusRing,
  } as React.CSSProperties;

  return (
    <div
      className={`${nodeClass} ${selected ? "selected" : ""}`}
      ref={nodeRef}
      style={style}
    >
      <Handle
        className="react-flow-handle handle-left"
        id={leftHandleId}
        position={Position.Left}
        type="target"
      />
      <Handle
        className="react-flow-handle handle-right"
        id={rightHandleId}
        position={Position.Right}
        type="source"
      />

      <div className="node-content">
        {!isExpanded ? (
          <button
            className="node-collapsed"
            onClick={() => {
              setIsExpanded(true);
              requestAnimationFrame(() => {
                inputRef.current?.focus();
              });
            }}
            title="Click to edit details"
            type="button"
          >
            {data.emoji ? (
              <span className="node-emoji">{data.emoji}</span>
            ) : null}
            <span className="node-title-text">{label}</span>
            <span
              aria-hidden
              className="node-status-compact"
              style={{ color: statusMeta.color }}
              title={statusMeta.label}
            >
              <span
                className="node-status-compact-dot"
                style={{ background: statusMeta.color }}
              />
              <span className="node-status-compact-icon">
                {statusMeta.icon}
              </span>
            </span>
          </button>
        ) : (
          <>
            <div className="node-header">
              <div className="node-title-group">
                {data.emoji ? (
                  <span className="node-emoji">{data.emoji}</span>
                ) : null}
                <input
                  className="node-title-input"
                  onBlur={() => {
                    setIsTitleFocused(false);
                    commitLabel();
                  }}
                  onChange={(event) => setLabel(event.target.value)}
                  onFocus={() => {
                    emitNodeFocus();
                    setIsTitleFocused(true);
                  }}
                  onKeyDown={handleTitleKeyDown}
                  onPointerDown={(event) => {
                    emitNodeFocus();
                    event.stopPropagation();
                  }}
                  placeholder="Give this idea a name"
                  ref={inputRef}
                  type="text"
                  value={label}
                />
              </div>

              <div
                aria-label={statusMeta.label}
                className="node-status-chip"
                title={statusMeta.label}
              >
                <span
                  className="node-status-chip-dot"
                  style={{ background: statusMeta.color }}
                />
                <span className="node-status-chip-icon">{statusMeta.icon}</span>
              </div>
            </div>

            <textarea
              className="node-description"
              onBlur={() => {
                setIsDescriptionFocused(false);
                commitDescription();
              }}
              onChange={(event) => setDescription(event.target.value)}
              onFocus={() => {
                emitNodeFocus();
                setIsDescriptionFocused(true);
              }}
              onKeyDown={handleDescriptionKeyDown}
              onPointerDown={(event) => {
                emitNodeFocus();
                event.stopPropagation();
              }}
              placeholder="Describe what should happen here"
              ref={descriptionRef}
              rows={3}
              value={description}
            />
          </>
        )}
      </div>

      <button
        className="node-add-btn"
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("add-child", { detail: { parentId: id } })
          )
        }
        onPointerDown={(event) => event.stopPropagation()}
        title="Add child"
        type="button"
      >
        <IconPlus size={16} strokeWidth={2} />
      </button>

      {data.hiddenChildCount ? (
        <div
          className="node-collapse-count"
          title={`${data.hiddenChildCount} hidden child${
            data.hiddenChildCount === 1 ? "" : "ren"
          }`}
        >
          {data.hiddenChildCount}
        </div>
      ) : null}
    </div>
  );
};

const EdgeNoteNodeComponent = ({ data, id, selected }: any) => {
  const [label, setLabel] = useState(data.label ?? "Content Note");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [content, setContent] = useState<string>(data.noteContent ?? "");
  const [isCollapsed, setIsCollapsed] = useState<boolean>(
    typeof data.noteCollapsed === "boolean" ? data.noteCollapsed : false
  );
  const [isEditingMarkdown, setIsEditingMarkdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const leftHandleId = `${id}-left`;
  const rightHandleId = `${id}-right`;

  useEffect(() => {
    setLabel(data.label ?? "Content Note");
  }, [data.label]);

  useEffect(() => {
    setContent(data.noteContent ?? "");
  }, [data.noteContent]);

  useEffect(() => {
    setIsCollapsed(
      typeof data.noteCollapsed === "boolean" ? data.noteCollapsed : false
    );
  }, [data.noteCollapsed]);

  useEffect(() => {
    if (!isCollapsed && selected && isEditingMarkdown) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [isCollapsed, isEditingMarkdown, selected]);

  // Auto-collapse when clicked outside (deselected)
  useEffect(() => {
    if (!selected && !isCollapsed) {
      setIsCollapsed(true);
    }
  }, [selected, isCollapsed]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, isCollapsed, isEditingMarkdown, content, updateNodeInternals]);

  const emitFocus = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("focus-node", {
        detail: { nodeId: id },
      })
    );
  }, [id]);

  const commitTitle = useCallback(() => {
    const trimmed = label.trim();
    const nextLabel = trimmed === "" ? data.label ?? "Content Note" : trimmed;
    setLabel(nextLabel);
    setIsEditingTitle(false);

    if (nextLabel !== data.label) {
      window.dispatchEvent(
        new CustomEvent("update-node-label", {
          detail: { id, label: nextLabel },
        })
      );
    }
  }, [data.label, id, label]);

  const handleTitleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitTitle();
        titleInputRef.current?.blur();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setLabel(data.label ?? "Content Note");
        setIsEditingTitle(false);
      }
    },
    [commitTitle, data.label]
  );

  const emitContentChange = useCallback(
    (value: string) => {
      setContent(value);
      window.dispatchEvent(
        new CustomEvent("update-note-content", {
          detail: { nodeId: id, content: value },
        })
      );
    },
    [id]
  );

  const toggleCollapsed = useCallback(() => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    if (next) {
      setIsEditingMarkdown(false);
    }
    window.dispatchEvent(
      new CustomEvent("toggle-note-collapsed", {
        detail: { nodeId: id, collapsed: next },
      })
    );
  }, [id, isCollapsed]);

  const applyTextMutation = useCallback(
    (
      updater: (
        value: string,
        selectionStart: number,
        selectionEnd: number
      ) => {
        text: string;
        selectionStart: number;
        selectionEnd: number;
      }
    ) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      const { selectionStart, selectionEnd, value } = textarea;
      const result = updater(value, selectionStart, selectionEnd);
      emitContentChange(result.text);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    },
    [emitContentChange]
  );

  const insertInline = useCallback(
    (wrap: { prefix: string; suffix?: string; placeholder: string }) => {
      applyTextMutation((value, start, end) => {
        const selected = value.slice(start, end);
        const hasSelection = selected.length > 0;
        const replacement = hasSelection ? selected : wrap.placeholder;
        const snippet = `${wrap.prefix}${replacement}${
          wrap.suffix ?? wrap.prefix
        }`;
        const nextText = `${value.slice(0, start)}${snippet}${value.slice(
          end
        )}`;
        const cursorStart = hasSelection
          ? start + wrap.prefix.length
          : start + wrap.prefix.length;
        const cursorEnd = cursorStart + replacement.length;

        return {
          text: nextText,
          selectionStart: cursorStart,
          selectionEnd: cursorEnd,
        };
      });
    },
    [applyTextMutation]
  );

  const insertBlockPrefix = useCallback(
    (prefix: string, placeholder: string) => {
      applyTextMutation((value, start, end) => {
        const before = value.slice(0, start);
        const after = value.slice(end);
        const needsNewline = before.length > 0 && !before.endsWith("\n");
        const selection = value.slice(start, end) || placeholder;
        const block = `${needsNewline ? "\n" : ""}${prefix}${selection}`;
        const nextText = `${before}${block}${after}`;
        const cursorStart =
          before.length + (needsNewline ? 1 : 0) + prefix.length;
        const cursorEnd = cursorStart + selection.length;
        return {
          text: nextText,
          selectionStart: cursorStart,
          selectionEnd: cursorEnd,
        };
      });
    },
    [applyTextMutation]
  );

  const insertList = useCallback(
    (type: "ul" | "ol") => {
      applyTextMutation((value, start, end) => {
        const before = value.slice(0, start);
        const selection = value.slice(start, end);
        const after = value.slice(end);
        const lines = selection ? selection.split("\n") : [""];
        const formatted = lines
          .map((line, index) => {
            const clean =
              line.trim() ||
              (type === "ol" ? `Item ${index + 1}` : "List item");
            return type === "ol" ? `${index + 1}. ${clean}` : `- ${clean}`;
          })
          .join("\n");
        const needsNewline = before.length > 0 && !before.endsWith("\n");
        const snippet = `${needsNewline ? "\n" : ""}${formatted}`;
        const nextText = `${before}${snippet}${after}`;
        const cursorStart = before.length + (needsNewline ? 1 : 0);
        const cursorEnd = cursorStart + formatted.length;
        return {
          text: nextText,
          selectionStart: cursorStart,
          selectionEnd: cursorEnd,
        };
      });
    },
    [applyTextMutation]
  );

  const handleFormat = useCallback(
    (format: "h2" | "h3" | "bold" | "italic" | "ul" | "ol" | "quote") => {
      switch (format) {
        case "h2":
          insertBlockPrefix("## ", "Heading");
          return;
        case "h3":
          insertBlockPrefix("### ", "Subheading");
          return;
        case "bold":
          insertInline({
            prefix: "**",
            suffix: "**",
            placeholder: "bold text",
          });
          return;
        case "italic":
          insertInline({
            prefix: "_",
            suffix: "_",
            placeholder: "italic text",
          });
          return;
        case "ul":
          insertList("ul");
          return;
        case "ol":
          insertList("ol");
          return;
        case "quote":
          insertBlockPrefix("> ", "Quote or insight");
          return;
        default:
          return;
      }
    },
    [insertBlockPrefix, insertInline, insertList]
  );

  const titleClass = isEditingTitle
    ? "edge-note-title is-editing"
    : "edge-note-title";
  const containerClass = `edge-note-node ${
    isCollapsed ? "is-collapsed" : "is-expanded"
  } ${selected ? "selected" : ""}`;
  const renderedContent = useMemo(
    () => renderEdgeNoteMarkdown(content),
    [content]
  );
  // Preview shows first 2-3 blocks of rendered markdown
  const previewContent = useMemo(() => {
    if (!content.trim().length) {
      return <span className="edge-note-empty">No content yet.</span>;
    }
    // Take first 2-3 elements from rendered content for preview
    const previewBlocks = renderedContent.slice(0, 3);
    return <>{previewBlocks}</>;
  }, [renderedContent, content]);

  // Helper functions for markdown conversion (must be defined before useEditor)
  const markdownToHtml = useCallback((markdown: string): string => {
    let html = markdown;

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`);

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Paragraphs
    html = html.split('\n\n').map(para => {
      if (!para.trim()) return '';
      if (para.startsWith('<')) return para;
      return `<p>${para}</p>`;
    }).join('');

    return html;
  }, []);

  const htmlToMarkdown = useCallback((html: string): string => {
    let markdown = html;

    // Headers
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');

    // Bold
    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');

    // Italic
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '_$1_');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '_$1_');

    // Blockquote
    markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
      const cleaned = content.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1');
      return cleaned.split('\n').map((line: string) => `> ${line.trim()}`).filter((l: string) => l.trim() !== '>').join('\n') + '\n\n';
    });

    // Lists
    markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_, items) => {
      return items.replace(/<li[^>]*>(.*?)<\/li>/gi, (_: any, item: string) => `- ${item.trim()}\n`) + '\n';
    });
    markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_, items) => {
      let counter = 1;
      return items.replace(/<li[^>]*>(.*?)<\/li>/gi, (_: any, item: string) => `${counter++}. ${item.trim()}\n`) + '\n';
    });

    // Paragraphs
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');

    // Clean up extra whitespace
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    return markdown.trim();
  }, []);

  const toggleMarkdownMode = () => {
    const next = !isEditingMarkdown;
    setIsEditingMarkdown(next);
    if (next) {
      emitFocus();
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } else {
      // When switching to preview, update TipTap editor
      if (editor) {
        editor.commands.setContent(markdownToHtml(content));
        editor.commands.focus();
      }
    }
  };

  // TipTap editor for WYSIWYG editing
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    content: markdownToHtml(content),
    onUpdate: ({ editor }) => {
      // Debounce the conversion to avoid interfering with editing
      // We'll convert to markdown only when needed, not on every keystroke
    },
    editorProps: {
      attributes: {
        class: 'edge-note-editable',
      },
    },
  });

  // Update editor content only when switching from markdown mode
  useEffect(() => {
    if (editor && !isEditingMarkdown) {
      // Only update if the markdown content actually changed from external source
      // Don't update during normal editing to avoid disrupting TipTap's state
      const currentHtml = editor.getHTML();
      const newHtml = markdownToHtml(content);

      // Compare without TipTap's wrapper tags to avoid false positives
      const normalizeHtml = (html: string) => html.replace(/<\/?p>/g, '').trim();

      if (normalizeHtml(currentHtml) !== normalizeHtml(newHtml)) {
        editor.commands.setContent(newHtml);
      }
    }
  }, [isEditingMarkdown]);

  // Save HTML to markdown when user stops typing (debounced)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!editor || isEditingMarkdown) return;

    const handleUpdate = () => {
      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Set new timeout
      debounceTimeoutRef.current = setTimeout(() => {
        const html = editor.getHTML();
        const markdown = htmlToMarkdown(html);

        // Only emit if content actually changed
        if (markdown !== content) {
          emitContentChange(markdown);
        }
      }, 500); // 500ms debounce
    };

    // Listen to TipTap's update event
    editor.on('update', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [editor, isEditingMarkdown, content, htmlToMarkdown, emitContentChange]);

  return (
    <div
      className={containerClass}
      onClick={() => {
        if (isCollapsed) {
          setIsCollapsed(false);
        }
      }}
    >
      <Handle
        className="edge-note-handle edge-note-handle-left"
        id={leftHandleId}
        position={Position.Left}
        style={{ top: "50%", transform: "translateY(-50%)" }}
        type="target"
      />

      <div className="edge-note-body">
        <div className="edge-note-header">
          <button
            className="edge-note-icon"
            onClick={emitFocus}
            title="Edge note"
            type="button"
          >
            <IconNote size={16} strokeWidth={1.6} />
          </button>
          {isEditingTitle ? (
            <input
              className={titleClass}
              onBlur={commitTitle}
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={handleTitleKeyDown}
              ref={titleInputRef}
              value={label}
            />
          ) : (
            <button
              className={titleClass}
              onClick={() => {
                if (isCollapsed) {
                  setIsCollapsed(false);
                }
              }}
              onDoubleClick={() => {
                if (!isCollapsed) {
                  setIsEditingTitle(true);
                  requestAnimationFrame(() => {
                    titleInputRef.current?.focus();
                    titleInputRef.current?.select();
                  });
                }
              }}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            >
              {label}
            </button>
          )}
          {!isCollapsed && (
            <button
              aria-pressed={isEditingMarkdown}
              className={
                isEditingMarkdown
                  ? "edge-note-mode-btn is-active"
                  : "edge-note-mode-btn"
              }
              onClick={toggleMarkdownMode}
              type="button"
            >
              {isEditingMarkdown ? "Preview" : "Markdown"}
            </button>
          )}
        </div>

        {!isCollapsed && (isEditingMarkdown ? (
          <div className="edge-note-editor" onPointerDown={emitFocus}>
            <div className="edge-note-toolbar">
              <button onClick={() => handleFormat("h2")} type="button">
                H2
              </button>
              <button onClick={() => handleFormat("h3")} type="button">
                H3
              </button>
              <button onClick={() => handleFormat("bold")} type="button">
                **B**
              </button>
              <button onClick={() => handleFormat("italic")} type="button">
                _I_
              </button>
              <button onClick={() => handleFormat("ul")} type="button">
                • List
              </button>
              <button onClick={() => handleFormat("ol")} type="button">
                1. List
              </button>
              <button onClick={() => handleFormat("quote")} type="button">
                “ ”
              </button>
            </div>
            <textarea
              className="edge-note-textarea"
              onChange={(event) => emitContentChange(event.target.value)}
              onFocus={emitFocus}
              ref={textareaRef}
              value={content}
            />
          </div>
        ) : (
          <div className="edge-note-editor" onPointerDown={emitFocus}>
            <div className="edge-note-toolbar">
              <button
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                className={editor?.isActive('heading', { level: 2 }) ? 'is-active' : ''}
                type="button"
                title="Heading 2"
              >
                H2
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                className={editor?.isActive('heading', { level: 3 }) ? 'is-active' : ''}
                type="button"
                title="Heading 3"
              >
                H3
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={editor?.isActive('bold') ? 'is-active' : ''}
                type="button"
                title="Bold (Ctrl+B)"
              >
                <strong>B</strong>
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={editor?.isActive('italic') ? 'is-active' : ''}
                type="button"
                title="Italic (Ctrl+I)"
              >
                <em>I</em>
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className={editor?.isActive('bulletList') ? 'is-active' : ''}
                type="button"
                title="Bullet List"
              >
                • List
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                className={editor?.isActive('orderedList') ? 'is-active' : ''}
                type="button"
                title="Numbered List"
              >
                1. List
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                className={editor?.isActive('blockquote') ? 'is-active' : ''}
                type="button"
                title="Quote"
              >
                " "
              </button>
            </div>
            <EditorContent editor={editor} />
          </div>
        ))}
      </div>

      <button
        className="node-add-btn"
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("add-child", { detail: { parentId: id } })
          )
        }
        onPointerDown={(event) => event.stopPropagation()}
        title="Add child"
        type="button"
      >
        <IconPlus size={16} strokeWidth={2} />
      </button>

      <Handle
        className="edge-note-handle edge-note-handle-right"
        id={rightHandleId}
        position={Position.Right}
        style={{ top: "50%", transform: "translateY(-50%)" }}
        type="source"
      />
    </div>
  );
};

const nodeTypes = {
  mindmap: MindmapNodeComponent,
  "edge-note": EdgeNoteNodeComponent,
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

const Toolbar = ({
  onAddRoot,
  onAutoLayout,
  onExport,
  onImport,
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolbarProps) => (
  <Panel className="mindmap-toolbar" position="top-left">
    <div className="toolbar-section">
      <button
        className="toolbar-btn"
        onClick={onAddRoot}
        title="Add root node"
        type="button"
      >
        <IconPlus size={18} />
        <span>Root</span>
      </button>
      <button
        className="toolbar-btn"
        onClick={onAutoLayout}
        title="Auto-layout nodes"
        type="button"
      >
        <IconLayout size={18} />
        <span>Layout</span>
      </button>
      <button
        className="toolbar-btn"
        onClick={onExport}
        title="Export as JSON"
        type="button"
      >
        <IconDownload size={18} />
        <span>Export</span>
      </button>
      <button
        className="toolbar-btn"
        onClick={onImport}
        title="Import JSON"
        type="button"
      >
        <IconUpload size={18} />
        <span>Import</span>
      </button>

      <button
        className="toolbar-btn danger"
        onClick={onClear}
        title="Clear all"
        type="button"
      >
        <IconTrash size={18} />
        <span>Clear</span>
      </button>
      <div className="toolbar-divider" />
      <button
        className="toolbar-btn icon-only"
        disabled={!canUndo}
        onClick={onUndo}
        title="Undo"
        type="button"
      >
        <IconUndo size={18} />
      </button>
      <button
        className="toolbar-btn icon-only"
        disabled={!canRedo}
        onClick={onRedo}
        title="Redo"
        type="button"
      >
        <IconRedo size={18} />
      </button>
    </div>
  </Panel>
);

interface NodeActionToolbarProps {
  node: MindmapNode | null;
  onAddChild: (parentId: string) => void;
  onAddEdgeNote: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
  onColorChange: (color: string) => void;
  onEmojiChange: (emoji: string) => void;
  onToggleCollapse: (nodeId: string, collapsed: boolean) => void;
  onStatusChange: (nodeId: string, status: StatusValue) => void;
  onOpenAI: (nodeId: string, intentOverride?: AIIntent) => void;
  onRunAiQuickAction: (
    nodeId: string,
    intent: AIIntent,
    mode: "add" | "replace"
  ) => void;
  isAiActive: boolean;
}

interface AiMenuProps {
  isActive: boolean;
  nodeId: string;
  onOpenChat: (nodeId: string, intentOverride?: AIIntent) => void;
  onQuickAction: (
    nodeId: string,
    intent: AIIntent,
    mode: "add" | "replace"
  ) => void;
}

const AiMenu = ({
  isActive,
  nodeId,
  onOpenChat,
  onQuickAction,
}: AiMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && event.target instanceof globalThis.Node) {
        if (!containerRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const triggerClassName = [
    "icon-btn",
    isActive ? "is-active" : "",
    isOpen ? "is-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleSparkAdd = () => {
    onQuickAction(nodeId, "spark", "add");
    setIsOpen(false);
  };

  const handleSparkReplace = () => {
    onQuickAction(nodeId, "spark", "replace");
    setIsOpen(false);
  };

  const handleDeepenAdd = () => {
    onQuickAction(nodeId, "deepen", "add");
    setIsOpen(false);
  };

  const handleDeepenReplace = () => {
    onQuickAction(nodeId, "deepen", "replace");
    setIsOpen(false);
  };

  const handleOpenChat = () => {
    onOpenChat(nodeId);
    setIsOpen(false);
  };

  return (
    <div
      className="ai-toolbar-menu"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      ref={containerRef}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={triggerClassName}
        onClick={() => setIsOpen((prev) => !prev)}
        title="AI actions"
        type="button"
      >
        <IconMagicWand size={18} />
      </button>
      {isOpen ? (
        <div className="ai-toolbar-menu-popover" role="menu">
          <button
            className="ai-toolbar-menu-item"
            onClick={handleSparkAdd}
            role="menuitem"
            type="button"
          >
            <IconSparkle size={16} />
            <div>
              <span className="ai-toolbar-menu-title">Spark ideas</span>
              <span className="ai-toolbar-menu-caption">Add as new ideas</span>
            </div>
          </button>
          <button
            className="ai-toolbar-menu-item"
            onClick={handleSparkReplace}
            role="menuitem"
            type="button"
          >
            <IconSparkle size={16} />
            <div>
              <span className="ai-toolbar-menu-title">
                Replace with spark ideas
              </span>
              <span className="ai-toolbar-menu-caption">
                Swap out existing ideas
              </span>
            </div>
          </button>
          <button
            className="ai-toolbar-menu-item"
            onClick={handleDeepenAdd}
            role="menuitem"
            type="button"
          >
            <IconLayout size={16} />
            <div>
              <span className="ai-toolbar-menu-title">Deepen structure</span>
              <span className="ai-toolbar-menu-caption">
                Add supporting subtopics
              </span>
            </div>
          </button>
          <button
            className="ai-toolbar-menu-item"
            onClick={handleDeepenReplace}
            role="menuitem"
            type="button"
          >
            <IconLayout size={16} />
            <div>
              <span className="ai-toolbar-menu-title">
                Replace with deeper structure
              </span>
              <span className="ai-toolbar-menu-caption">
                Rebuild current subtopics
              </span>
            </div>
          </button>
          <button
            className="ai-toolbar-menu-item"
            onClick={handleOpenChat}
            role="menuitem"
            type="button"
          >
            <IconMagicWand size={16} />
            <div>
              <span className="ai-toolbar-menu-title">Open AI chat</span>
              <span className="ai-toolbar-menu-caption">
                Switch to conversational mode
              </span>
            </div>
          </button>
        </div>
      ) : null}
    </div>
  );
};

const NodeActionToolbar = ({
  node,
  onAddChild,
  onAddEdgeNote,
  onDelete,
  onColorChange,
  onEmojiChange,
  onToggleCollapse,
  onStatusChange,
  onOpenAI,
  onRunAiQuickAction,
  isAiActive,
}: NodeActionToolbarProps) => {
  const [showColors, setShowColors] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const transform = useStore((state) => state.transform);
  const storeNode = useStore(
    useCallback(
      (state) =>
        node ? (state as any).nodeInternals?.get?.(node.id) ?? null : null,
      [node?.id]
    )
  );
  const selectedNodeId = node?.id;

  useEffect(() => {
    setShowColors(false);
    setShowEmojis(false);
    setShowStatus(false);
  }, [selectedNodeId]);

  const [viewportX, viewportY, zoom] = transform;

  // Force recalculation on every render when node is selected
  // This ensures toolbar position updates during zoom/pan animations
  const anchorStyle = useMemo(() => {
    if (!node) {
      return null;
    }

    const referenceNode = storeNode ?? node;
    const position =
      referenceNode?.positionAbsolute ?? node.positionAbsolute ?? node.position;
    if (!position) {
      return null;
    }

    const baseWidth =
      referenceNode?.measured?.width ??
      node.measured?.width ??
      referenceNode?.width ??
      node.width ??
      160;
    const baseHeight =
      referenceNode?.measured?.height ??
      node.measured?.height ??
      referenceNode?.height ??
      node.height ??
      60;

    return {
      left: viewportX + ((position?.x ?? 0) + baseWidth / 2) * zoom,
      top: viewportY + (position?.y ?? 0) * zoom,
      "--toolbar-offset": `${(baseHeight + 16) * zoom}px`,
    } as CSSProperties;
  }, [node, storeNode, viewportX, viewportY, zoom]);

  if (!node || !anchorStyle) {
    return null;
  }

  const isCollapsed = Boolean(node.data?.collapsed);
  const currentStatusMeta = node?.data?.status
    ? STATUS_OPTIONS.find((option) => option.value === node.data.status)
    : null;

  return (
    <div className="floating-toolbar-anchor" style={anchorStyle}>
      <div className="mindmap-floating-toolbar">
        <button
          className="icon-btn"
          onClick={() => onToggleCollapse(node.id, !isCollapsed)}
          title={isCollapsed ? "Expand children" : "Collapse children"}
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

        <button
          className="icon-btn"
          onClick={() => onAddEdgeNote(node.id)}
          title="Add content note"
          type="button"
        >
          <IconNote size={18} />
        </button>

        <AiMenu
          isActive={isAiActive}
          nodeId={node.id}
          onOpenChat={onOpenAI}
          onQuickAction={onRunAiQuickAction}
        />

        <div className="floating-divider" />

        <div className="floating-group">
          <button
            aria-expanded={showColors}
            className="icon-btn"
            onClick={() => setShowColors((prev) => !prev)}
            title="Change color"
            type="button"
          >
            <IconPalette size={18} />
          </button>
          {showColors && (
            <div className="floating-popover">
              {COLORS.map((color) => (
                <button
                  className="color-option"
                  key={color.value}
                  onClick={() => {
                    onColorChange(color.value);
                    setShowColors(false);
                  }}
                  style={{ background: color.value }}
                  title={color.name}
                  type="button"
                />
              ))}
            </div>
          )}
        </div>

        <div className="floating-group">
          <button
            aria-expanded={showEmojis}
            className="icon-btn"
            onClick={() => setShowEmojis((prev) => !prev)}
            title="Add emoji"
            type="button"
          >
            <IconSparkle size={18} />
          </button>
          {showEmojis && (
            <div className="floating-popover emoji-picker">
              {EMOJIS.map((emoji) => (
                <button
                  className="emoji-option"
                  key={emoji}
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
                  onEmojiChange("");
                  setShowEmojis(false);
                }}
                title="Remove emoji"
                type="button"
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
            aria-expanded={showStatus}
            className="icon-btn"
            onClick={() => setShowStatus((prev) => !prev)}
            style={{
              fontSize: "14px",
              fontWeight: "bold",
            }}
            title="Change status"
            type="button"
          >
            {currentStatusMeta?.icon ?? "○"}
          </button>
          {showStatus && (
            <div
              className="floating-popover status-picker"
              style={{ minWidth: "180px" }}
            >
              {STATUS_OPTIONS.map((statusOption) => {
                const isActive = node.data.status === statusOption.value;
                return (
                  <button
                    aria-pressed={isActive}
                    className={
                      isActive ? "active status-option" : "status-option"
                    }
                    key={statusOption.value}
                    onClick={() => {
                      onStatusChange(node.id, statusOption.value);
                      setShowStatus(false);
                    }}
                    title={statusOption.label}
                    type="button"
                  >
                    <span
                      className="status-option-icon"
                      style={{ color: statusOption.color }}
                    >
                      {statusOption.icon}
                    </span>
                    <span className="status-option-label">
                      {statusOption.label}
                    </span>
                  </button>
                );
              })}
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
      id: "root",
      type: "mindmap",
      position: { ...DEFAULT_VIEWPORT_CENTER },
      positionAbsolute: { ...DEFAULT_VIEWPORT_CENTER },
      data: {
        label: "My Mindmap",
        level: 0,
        variant: "topic",
        color: COLORS[0].value,
        // AI Planning fields example
        status: "in-progress",
        description:
          "Build an AI-powered mindmap tool for structured problem-solving. This tool will help break down complex tasks into manageable pieces and track progress.",
      },
    },
  ];

  const savedFlow = useMemo<StoredFlowState | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(FLOW_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as StoredFlowState;
      if (
        !parsed ||
        !Array.isArray(parsed.nodes) ||
        !Array.isArray(parsed.edges)
      ) {
        return null;
      }

      const sanitizedNodes = parsed.nodes
        .map((rawNode: any) => {
          if (!rawNode?.id) {
            return null;
          }

          const label =
            typeof rawNode?.data?.label === "string"
              ? rawNode.data.label
              : "Untitled";

          const nodePosition = rawNode.position ?? { x: 0, y: 0 };
          const positionAbsolute =
            rawNode.positionAbsolute ?? rawNode.position ?? nodePosition;

          const rawVariant = rawNode?.data?.variant;
          const nodeType =
            rawNode?.type === "edge-note" || rawVariant === "edge-note"
              ? "edge-note"
              : "mindmap";
          const variant: MindmapNodeData["variant"] =
            rawVariant === "edge-note" ? "edge-note" : "topic";
          const isEdgeNote = variant === "edge-note";

          const sanitized: MindmapNode = {
            ...rawNode,
            id: String(rawNode.id),
            type: nodeType,
            position: nodePosition,
            positionAbsolute,
            data: {
              ...rawNode.data,
              label,
              level:
                typeof rawNode?.data?.level === "number"
                  ? rawNode.data.level
                  : 0,
              variant,
              noteContent: isEdgeNote
                ? typeof rawNode?.data?.noteContent === "string"
                  ? rawNode.data.noteContent
                  : ""
                : rawNode.data?.noteContent,
              noteCollapsed: isEdgeNote
                ? typeof rawNode?.data?.noteCollapsed === "boolean"
                  ? rawNode.data.noteCollapsed
                  : false
                : rawNode.data?.noteCollapsed,
            },
          };

          return sanitized;
        })
        .filter(Boolean) as MindmapNode[];

      const sanitizedEdges = parsed.edges
        .map((rawEdge: any) => {
          if (!rawEdge?.source || !rawEdge?.target) {
            return null;
          }

          const id = rawEdge?.id
            ? String(rawEdge.id)
            : `${String(rawEdge.source)}-${String(rawEdge.target)}`;

          const sanitized: MindmapEdge = {
            id,
            source: String(rawEdge.source),
            target: String(rawEdge.target),
            sourceHandle:
              rawEdge.sourceHandle ?? `${String(rawEdge.source)}-right`,
            targetHandle:
              rawEdge.targetHandle ?? `${String(rawEdge.target)}-left`,
            type: rawEdge.type ?? "default",
            data: rawEdge.data,
            style: rawEdge.style ?? {
              stroke: "#cbd5e1",
              strokeWidth: 2.5,
            },
            animated: rawEdge.animated,
          };

          return sanitized;
        })
        .filter(Boolean) as MindmapEdge[];

      return {
        nodes: sanitizedNodes,
        edges: sanitizedEdges,
        viewport: parsed.viewport,
      };
    } catch (_error) {
      return null;
    }
  }, []);

  const hasSavedFlow = Boolean(savedFlow);
  const savedViewport = savedFlow?.viewport ?? null;

  const [nodes, setNodes, onNodesChange] = useNodesState<MindmapNode>(
    savedFlow?.nodes?.length ? savedFlow.nodes : initialNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<MindmapEdge>(
    savedFlow?.edges ?? []
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isAiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelNodeId, setAiPanelNodeId] = useState<string | null>(null);
  const [aiPanelPhase, setAiPanelPhase] = useState<AIChatPanelPhase>("idle");
  const [aiPanelMode, setAiPanelMode] = useState<AIIntent>("spark");
  const [aiIntentPreference, setAiIntentPreference] = useState<
    Record<string, AIIntent>
  >({});
  const [aiConversations, setAiConversations] = useState<
    Record<string, StoredAIMessage[]>
  >(() => {
    if (typeof window === "undefined") {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(AI_CONVERSATION_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as Record<string, StoredAIMessage[]>;
      return parsed ?? {};
    } catch (_error) {
      return {};
    }
  });
  const { setCenter, setViewport } = useReactFlow();
  const transformStore = useStore((state) => state.transform);
  const transformRef = useRef<[number, number, number]>([0, 0, 1]);

  // Canonical graph refs to avoid stale closures
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const historyRef = useRef<Snapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const isRestoringRef = useRef(false);
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    if (!hasSavedFlow || !savedFlow) {
      return;
    }

    let maxId = nodeIdCounter;
    savedFlow.nodes.forEach((node) => {
      const match = /^node-(\d+)$/i.exec(node.id);
      if (!match) {
        return;
      }

      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value)) {
        maxId = Math.max(maxId, value + 1);
      }
    });

    nodeIdCounter = Math.max(nodeIdCounter, maxId);
  }, [hasSavedFlow, savedFlow]);

  useEffect(() => {
    transformRef.current = transformStore;
  }, [transformStore]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const [x, y, zoom] = transformRef.current;
    const payload: StoredFlowState = {
      nodes: serializeNodesForStorage(nodesRef.current),
      edges: serializeEdgesForStorage(edgesRef.current),
      viewport: { x, y, zoom },
    };

    window.localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(payload));
  }, [nodes, edges, transformStore]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      AI_CONVERSATION_STORAGE_KEY,
      JSON.stringify(aiConversations)
    );
  }, [aiConversations]);

  const syncHistoryMeta = useCallback(() => {
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo:
        historyIndexRef.current >= 0 &&
        historyIndexRef.current < historyRef.current.length - 1,
    });
  }, []);

  const appendConversation = useCallback(
    (nodeId: string, additions: StoredAIMessage[]) => {
      if (!nodeId || additions.length === 0) {
        return;
      }
      setAiConversations((prev) => {
        const previous = prev[nodeId] ?? [];
        return {
          ...prev,
          [nodeId]: [...previous, ...additions],
        };
      });
    },
    []
  );

  const updateSuggestionStatus = useCallback(
    (
      nodeId: string,
      messageId: string,
      status: MindmapAiSuggestion["status"],
      appliedMode?: "add" | "replace"
    ) => {
      setAiConversations((prev) => {
        const entries = prev[nodeId] ?? [];
        const updated = entries.map((message) => {
          if (message.id !== messageId || !message.suggestion) {
            return message;
          }
          return {
            ...message,
            suggestion: {
              ...message.suggestion,
              status,
              appliedMode: status === "accepted" ? appliedMode : undefined,
            },
          };
        });

        return {
          ...prev,
          [nodeId]: updated,
        };
      });
    },
    []
  );

  const buildContextPayload = useCallback(
    (
      nodeId: string,
      intent: AIIntent,
      options: { manualPrompt?: string; quickActionId?: string } = {}
    ): MindmapContextPayload | null => {
      const selected = nodesRef.current.find((node) => node.id === nodeId);
      if (!selected) {
        return null;
      }

      const LINEAGE_LIMIT = 6;
      const SIBLING_LIMIT = 6;
      const CHILD_LIMIT = 6;

      const lineage: MindmapContextPayload["lineage"] = [];
      let currentId = nodeId;
      const visited = new Set<string>();

      while (lineage.length < LINEAGE_LIMIT) {
        const parentEdge = edgesRef.current.find(
          (edge) => edge.target === currentId
        );
        if (!parentEdge) {
          break;
        }

        const parentNode = nodesRef.current.find(
          (node) => node.id === parentEdge.source
        );
        if (!parentNode || visited.has(parentNode.id)) {
          break;
        }

        lineage.unshift({
          id: parentNode.id,
          label: parentNode.data.label,
          level: parentNode.data.level,
          description:
            typeof parentNode.data.description === "string"
              ? parentNode.data.description
              : undefined,
        });

        visited.add(parentNode.id);
        currentId = parentNode.id;
      }

      const parentEdge = edgesRef.current.find(
        (edge) => edge.target === nodeId
      );
      const parentId = parentEdge?.source ?? null;

      const siblings: MindmapContextPayload["siblings"] = parentId
        ? edgesRef.current
            .filter(
              (edge) => edge.source === parentId && edge.target !== nodeId
            )
            .map((edge) =>
              nodesRef.current.find((node) => node.id === edge.target)
            )
            .filter(
              (node): node is MindmapNode =>
                node != null &&
                node.data != null &&
                node.data.variant !== "edge-note"
            )
            .slice(0, SIBLING_LIMIT)
            .map((node) => ({
              id: node.id,
              label: node.data.label,
              description:
                typeof node.data.description === "string"
                  ? node.data.description
                  : undefined,
              status: node.data.status,
              emoji: node.data.emoji,
            }))
        : [];

      const children: MindmapContextPayload["children"] = edgesRef.current
        .filter((edge) => edge.source === nodeId)
        .map((edge) => nodesRef.current.find((node) => node.id === edge.target))
        .filter(
          (node): node is MindmapNode =>
            node != null &&
            node.data != null &&
            node.data.variant !== "edge-note"
        )
        .slice(0, CHILD_LIMIT)
        .map((node) => ({
          id: node.id,
          label: node.data.label,
          description:
            typeof node.data.description === "string"
              ? node.data.description
              : undefined,
          status: node.data.status,
          emoji: node.data.emoji,
        }));

      const recentMessages = (aiConversations[nodeId] ?? [])
        .slice(-4)
        .map((entry) => {
          const label = entry.role === "user" ? "User" : "Assistant";
          return `${label}: ${entry.content}`;
        })
        .join("\n");

      return {
        selectedNodeId: selected.id,
        selectedLabel: selected.data.label,
        selectedDescription:
          typeof selected.data.description === "string"
            ? selected.data.description
            : undefined,
        selectedLevel: selected.data.level,
        lineage,
        siblings,
        children,
        manualPrompt: options.manualPrompt,
        quickActionId: options.quickActionId,
        conversationSummary: recentMessages || undefined,
        intent,
      };
    },
    [aiConversations]
  );

  const resolveIntentForNode = useCallback(
    (nodeId: string): AIIntent => {
      const saved = aiIntentPreference[nodeId];
      if (saved) {
        return saved;
      }

      const hasChildren = edgesRef.current.some(
        (edge) => edge.source === nodeId
      );
      return hasChildren ? "deepen" : "spark";
    },
    [aiIntentPreference]
  );

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }
    const nextIntent = resolveIntentForNode(selectedNodeId);
    setAiPanelMode(nextIntent);
  }, [resolveIntentForNode, selectedNodeId]);

  const openAiPanel = useCallback(
    (nodeId: string, intentOverride?: AIIntent) => {
      setAiPanelOpen(true);
      setAiPanelNodeId(nodeId);
      const nextIntent = intentOverride ?? resolveIntentForNode(nodeId);
      setAiPanelMode(nextIntent);
      setAiIntentPreference((prev) => ({ ...prev, [nodeId]: nextIntent }));
    },
    [resolveIntentForNode]
  );

  const closeAiPanel = useCallback(() => {
    setAiPanelOpen(false);
  }, []);

  useEffect(() => {
    if (!isAiPanelOpen) {
      return;
    }
    if (selectedNodeId) {
      setAiPanelNodeId(selectedNodeId);
      return;
    }
    setAiPanelNodeId(null);
  }, [isAiPanelOpen, selectedNodeId]);

  const handleSelectionChange = useCallback(
    ({ nodes: selection }: OnSelectionChangeParams<MindmapNode>) => {
      if (selection.length === 0) {
        setSelectedNodeId(null);
        return;
      }

      const primary = selection[selection.length - 1];
      setSelectedNodeId(primary.id);
    },
    []
  );

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
    [syncHistoryMeta]
  );

  const restoreSnapshot = useCallback(
    (snapshot: Snapshot) => {
      isRestoringRef.current = true;
      const nodesCopy = cloneNodesForHistory(snapshot.nodes);
      const edgesCopy = cloneEdgesForHistory(snapshot.edges);
      const { nodes: finalNodes, edges: finalEdges } = applyCollapseState(
        nodesCopy,
        edgesCopy
      );
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
    [setEdges, setNodes, setCenter]
  );

  const updateGraph = useCallback(
    (
      mutator: (
        currentNodes: MindmapNode[],
        currentEdges: MindmapEdge[]
      ) => { nodes: MindmapNode[]; edges: MindmapEdge[] } | null,
      options?: { relayout?: boolean }
    ) => {
      const { relayout = true } = options ?? {};
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

      let processedNodes: MindmapNode[];

      if (relayout) {
        const visibleNodes = Array.from(visibleNodeMap.values());
        const visibleEdges = nextEdges.filter(
          (edge) =>
            collapseInfo.visibleIds.has(edge.source) &&
            collapseInfo.visibleIds.has(edge.target)
        );

        const layoutedResult = getLayoutedElements(visibleNodes, visibleEdges);
        const positionMap = new Map<string, MindmapNode>(
          layoutedResult.nodes.map((node) => [node.id, node])
        );

        processedNodes = nextNodesRaw.map((node) => {
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
      } else {
        processedNodes = nextNodesRaw.map((node) => {
          const prevNode = prevNodes.find(
            (existing) => existing.id === node.id
          );
          if (!prevNode) {
            return { ...node };
          }

          return {
            ...node,
            position: prevNode.position,
            positionAbsolute: prevNode.positionAbsolute ?? prevNode.position,
          };
        });
      }

      const { nodes: finalNodes, edges: finalEdgesRaw } = applyCollapseState(
        processedNodes,
        nextEdges,
        collapseInfo
      );

      const normalizedEdges = finalEdgesRaw.map((edge) => ({
        ...edge,
        sourceHandle: `${edge.source}-right`,
        targetHandle: `${edge.target}-left`,
      }));

      nodesRef.current = finalNodes;
      edgesRef.current = normalizedEdges;

      setNodes(finalNodes);
      setEdges(normalizedEdges);

      if (!isRestoringRef.current) {
        pushHistory(finalNodes, normalizedEdges);
      }
    },
    [pushHistory, setEdges, setNodes]
  );

  const updateNoteContent = useCallback(
    (nodeId: string, content: string) => {
      updateGraph(
        (nodesState, edgesState) => ({
          nodes: nodesState.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    noteContent: content,
                  },
                }
              : node
          ),
          edges: edgesState,
        }),
        { relayout: false }
      );
    },
    [updateGraph]
  );

  const setNoteCollapsed = useCallback(
    (nodeId: string, collapsed: boolean) => {
      updateGraph(
        (nodesState, edgesState) => ({
          nodes: nodesState.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    noteCollapsed: collapsed,
                  },
                }
              : node
          ),
          edges: edgesState,
        }),
        { relayout: false }
      );
    },
    [updateGraph]
  );

  const applyAiSuggestion = useCallback(
    (messageId: string, mode: "add" | "replace") => {
      if (!aiPanelNodeId) {
        return;
      }

      const conversation = aiConversations[aiPanelNodeId] ?? [];
      const targetMessage = conversation.find(
        (entry) => entry.id === messageId
      );
      const suggestion = targetMessage?.suggestion;

      if (!suggestion || suggestion.status !== "pending") {
        return;
      }

      const parentNode = nodesRef.current.find(
        (node) => node.id === aiPanelNodeId
      );
      if (!parentNode) {
        appendConversation(aiPanelNodeId, [
          {
            id: createMessageId("assistant"),
            role: "assistant",
            content:
              "Could not locate the selected node when applying the suggestion.",
            createdAt: Date.now(),
            kind: "ai",
            intent: suggestion.intent,
          },
        ]);
        return;
      }

      if (suggestion.additions.length === 0 && !suggestion.updates?.length) {
        updateSuggestionStatus(aiPanelNodeId, messageId, "accepted", mode);
        appendConversation(aiPanelNodeId, [
          {
            id: createMessageId("assistant"),
            role: "assistant",
            content: "Suggestion accepted. Nothing to change right now.",
            createdAt: Date.now(),
            kind: "ai",
            intent: suggestion.intent,
          },
        ]);
        return;
      }

      updateGraph((currentNodes, currentEdges) => {
        let nodesDraft = [...currentNodes];
        let edgesDraft = [...currentEdges];

        if (mode === "replace") {
          const childIds = new Set<string>();
          const visit = (id: string) => {
            currentEdges.forEach((edge) => {
              if (edge.source === id && !childIds.has(edge.target)) {
                childIds.add(edge.target);
                visit(edge.target);
              }
            });
          };
          visit(parentNode.id);

          if (childIds.size > 0) {
            nodesDraft = nodesDraft.filter((node) => !childIds.has(node.id));
            edgesDraft = edgesDraft.filter(
              (edge) => !childIds.has(edge.source) && !childIds.has(edge.target)
            );
          }
        }

        const level = parentNode.data.level + 1;

        suggestion.additions.forEach((draft, index) => {
          const newId = `node-${nodeIdCounter++}`;
          const newNode: MindmapNode = {
            id: newId,
            type: "mindmap",
            position: { x: parentNode.position.x, y: parentNode.position.y },
            data: {
              label: draft.label,
              level,
              variant: "topic",
              color: COLORS[(level + index) % COLORS.length].value,
              status: "not-started",
              description: draft.description ?? "",
              emoji: draft.emoji,
            },
          };

          nodesDraft.push(newNode);
          edgesDraft.push({
            id: `${parentNode.id}-${newId}`,
            source: parentNode.id,
            target: newId,
            sourceHandle: `${parentNode.id}-right`,
            targetHandle: `${newId}-left`,
            type: "default",
            style: { stroke: "#cbd5e1", strokeWidth: 2.5 },
          });
        });

        if (suggestion.updates?.length) {
          const latestUpdate =
            suggestion.updates[suggestion.updates.length - 1];
          const parentIndex = nodesDraft.findIndex(
            (node) => node.id === parentNode.id
          );
          if (parentIndex >= 0) {
            const existing = nodesDraft[parentIndex];
            nodesDraft[parentIndex] = {
              ...existing,
              data: {
                ...existing.data,
                description: latestUpdate.description,
              },
            };
          }
        }

        return {
          nodes: nodesDraft,
          edges: edgesDraft,
        };
      });

      updateSuggestionStatus(aiPanelNodeId, messageId, "accepted", mode);

      const summaryParts: string[] = [];
      if (suggestion.additions.length > 0) {
        summaryParts.push(
          `Added ${suggestion.additions.length} new node${
            suggestion.additions.length === 1 ? "" : "s"
          } under “${parentNode.data.label}”.`
        );
      }
      if (suggestion.updates?.length) {
        summaryParts.push("Updated the description.");
      }
      if (mode === "replace") {
        summaryParts.unshift(
          "Replaced earlier children before applying updates."
        );
      }

      appendConversation(aiPanelNodeId, [
        {
          id: createMessageId("assistant"),
          role: "assistant",
          content: summaryParts.join(" "),
          createdAt: Date.now(),
          kind: "ai",
          intent: suggestion.intent,
        },
      ]);
    },
    [
      aiConversations,
      aiPanelNodeId,
      appendConversation,
      updateGraph,
      updateSuggestionStatus,
    ]
  );

  const applyAiSuggestionAdd = useCallback(
    (messageId: string) => {
      applyAiSuggestion(messageId, "add");
    },
    [applyAiSuggestion]
  );

  const applyAiSuggestionReplace = useCallback(
    (messageId: string) => {
      applyAiSuggestion(messageId, "replace");
    },
    [applyAiSuggestion]
  );

  const rejectAiSuggestion = useCallback(
    (messageId: string) => {
      if (!aiPanelNodeId) {
        return;
      }

      const conversation = aiConversations[aiPanelNodeId] ?? [];
      const targetMessage = conversation.find(
        (entry) => entry.id === messageId
      );
      const suggestion = targetMessage?.suggestion;

      if (!suggestion || suggestion.status !== "pending") {
        return;
      }

      updateSuggestionStatus(aiPanelNodeId, messageId, "rejected");

      appendConversation(aiPanelNodeId, [
        {
          id: createMessageId("assistant"),
          role: "assistant",
          content: "Suggestion dismissed. No changes were applied.",
          createdAt: Date.now(),
          kind: "ai",
          intent: suggestion.intent,
        },
      ]);
    },
    [aiConversations, aiPanelNodeId, appendConversation, updateSuggestionStatus]
  );

  const handleAiModeChange = useCallback(
    (intent: AIIntent) => {
      setAiPanelMode(intent);
      const targetNodeId = aiPanelNodeId ?? selectedNodeId;
      if (!targetNodeId) {
        return;
      }
      setAiIntentPreference((prev) => {
        if (prev[targetNodeId] === intent) {
          return prev;
        }
        return {
          ...prev,
          [targetNodeId]: intent,
        };
      });
    },
    [aiPanelNodeId, selectedNodeId]
  );

  const runAiInteraction = useCallback(
    async (
      nodeId: string,
      intent: AIIntent,
      options: { manualPrompt?: string; quickActionId?: string } = {},
      autoApplyMode?: "add" | "replace"
    ) => {
      const context = buildContextPayload(nodeId, intent, options);
      if (!context) {
        appendConversation(nodeId, [
          {
            id: createMessageId("assistant"),
            role: "assistant",
            content: "Could not prepare the node context for AI generation.",
            createdAt: Date.now(),
            kind: "ai",
            intent,
          },
        ]);
        setAiPanelPhase("error");
        requestAnimationFrame(() => setAiPanelPhase("idle"));
        return;
      }

      setAiPanelPhase("loading");

      try {
        const response = await generateMindmapSuggestions(context);

        const suggestionId = createMessageId("suggestion");
        const suggestion: MindmapAiSuggestion = {
          id: suggestionId,
          summary: response.summary,
          additions: response.additions,
          updates: response.updates,
          followUp: response.followUp,
          warnings: response.warnings,
          status: "pending",
          createdAt: Date.now(),
          model: import.meta.env.VITE_OPENAI_MODEL?.trim() || "gpt-4o-mini",
          intent,
        };

        const assistantMessageId = createMessageId("assistant");
        const messageSuffix =
          suggestion.additions.length === 0 && !suggestion.updates?.length
            ? `${suggestion.summary} (No direct changes yet.)`
            : suggestion.summary;

        appendConversation(nodeId, [
          {
            id: assistantMessageId,
            role: "assistant",
            content: messageSuffix,
            createdAt: Date.now(),
            kind: "ai",
            suggestion,
            intent,
          },
        ]);

        setAiPanelPhase("idle");

        if (autoApplyMode) {
          applyAiSuggestion(assistantMessageId, autoApplyMode);
        }
      } catch (error) {
        const fallbackMessage =
          error instanceof MindmapAiError
            ? error.message
            : "The AI request failed. Please try again shortly.";

        console.error("[Mindmap AI] generation error", error);

        appendConversation(nodeId, [
          {
            id: createMessageId("assistant"),
            role: "assistant",
            content: fallbackMessage,
            createdAt: Date.now(),
            kind: "ai",
            intent,
          },
        ]);

        setAiPanelPhase("error");
        setTimeout(() => setAiPanelPhase("idle"), 2000);
      }
    },
    [appendConversation, applyAiSuggestion, buildContextPayload]
  );

  const handleQuickActionSelect = useCallback(
    (actionId: string) => {
      if (!aiPanelNodeId) {
        return;
      }

      const action = AI_INTENT_META[aiPanelMode].quickActions.find(
        (item) => item.id === actionId
      );
      if (!action) {
        return;
      }

      const now = Date.now();
      const userMessage: StoredAIMessage = {
        id: createMessageId("user"),
        role: "user",
        content: `Quick action: ${action.label}`,
        createdAt: now,
        kind: "quick",
        intent: aiPanelMode,
      };

      appendConversation(aiPanelNodeId, [userMessage]);

      setAiIntentPreference((prev) => {
        if (prev[aiPanelNodeId] === aiPanelMode) {
          return prev;
        }
        return {
          ...prev,
          [aiPanelNodeId]: aiPanelMode,
        };
      });

      runAiInteraction(aiPanelNodeId, aiPanelMode, { quickActionId: actionId });
    },
    [
      aiPanelMode,
      aiPanelNodeId,
      appendConversation,
      runAiInteraction,
      setAiIntentPreference,
    ]
  );

  const handlePromptSubmit = useCallback(
    (content: string) => {
      if (!aiPanelNodeId) {
        return;
      }

      const trimmed = content.trim();
      if (!trimmed) {
        return;
      }

      const now = Date.now();

      const userMessage: StoredAIMessage = {
        id: createMessageId("user"),
        role: "user",
        content: trimmed,
        createdAt: now,
        kind: "manual",
        intent: aiPanelMode,
      };

      appendConversation(aiPanelNodeId, [userMessage]);

      setAiIntentPreference((prev) => {
        if (prev[aiPanelNodeId] === aiPanelMode) {
          return prev;
        }
        return {
          ...prev,
          [aiPanelNodeId]: aiPanelMode,
        };
      });

      runAiInteraction(aiPanelNodeId, aiPanelMode, { manualPrompt: trimmed });
    },
    [
      aiPanelMode,
      aiPanelNodeId,
      appendConversation,
      runAiInteraction,
      setAiIntentPreference,
    ]
  );

  const triggerAiQuickAction = useCallback(
    (nodeId: string, intent: AIIntent, applyMode: "add" | "replace") => {
      openAiPanel(nodeId, intent);

      const quickActionId = applyMode === "replace" ? "replace" : "children";
      const quickMeta = AI_INTENT_META[intent].quickActions.find(
        (item) => item.id === quickActionId
      );

      const now = Date.now();
      const userMessage: StoredAIMessage = {
        id: createMessageId("user"),
        role: "user",
        content: quickMeta
          ? `Quick action: ${quickMeta.label}`
          : `Quick action: ${intent} (${applyMode})`,
        createdAt: now,
        kind: "quick",
        intent,
      };

      appendConversation(nodeId, [userMessage]);

      runAiInteraction(nodeId, intent, { quickActionId }, applyMode);
    },
    [appendConversation, openAiPanel, runAiInteraction]
  );

  const relayout = useCallback(() => {
    updateGraph(
      (currentNodes, currentEdges) => ({
        nodes: [...currentNodes],
        edges: [...currentEdges],
      }),
      { relayout: true }
    );
  }, [updateGraph]);

  const focusNodes = useCallback(
    (
      _nodeIds: string[],
      _options?: { zoomToFit?: boolean; duration?: number; padding?: number }
    ) => {
      // Intentionally left blank: auto zoom is disabled for a calmer canvas.
    },
    []
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
  }, [restoreSnapshot, syncHistoryMeta]);

  const redo = useCallback(() => {
    if (
      historyIndexRef.current < 0 ||
      historyIndexRef.current >= historyRef.current.length - 1
    ) {
      return;
    }

    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    restoreSnapshot(snapshot);
    syncHistoryMeta();
    setSelectedNodeId(null);
  }, [restoreSnapshot, syncHistoryMeta]);

  useEffect(() => {
    updateGraph(
      (currentNodes, currentEdges) => ({
        nodes: [...currentNodes],
        edges: [...currentEdges],
      }),
      { relayout: !hasSavedFlow }
    );

    const timeout = setTimeout(() => {
      if (hasSavedFlow) {
        if (savedViewport) {
          setViewport(
            {
              x: savedViewport.x,
              y: savedViewport.y,
              zoom: savedViewport.zoom,
            },
            { duration: 0 }
          );
          return;
        }

        const primaryNode =
          nodesRef.current.find((node) => node.data.level === 0) ??
          nodesRef.current[0];

        if (primaryNode) {
          setCenter(primaryNode.position.x, primaryNode.position.y, {
            zoom: DEFAULT_VIEWPORT_ZOOM,
            duration: ZOOM_DURATIONS.initial,
          });
          return;
        }
      }

      setCenter(DEFAULT_VIEWPORT_CENTER.x, DEFAULT_VIEWPORT_CENTER.y, {
        zoom: DEFAULT_VIEWPORT_ZOOM,
        duration: ZOOM_DURATIONS.initial,
      });
    }, 0);

    return () => clearTimeout(timeout);
  }, [hasSavedFlow, savedViewport, setCenter, setViewport, updateGraph]);

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
          type: "mindmap",
          position: { x: 0, y: 0 },
          data: {
            label: "New Topic",
            level: parent.data.level + 1,
            variant: "topic",
            color: COLORS[(parent.data.level + 1) % COLORS.length].value,
            status: "not-started",
            description: "",
          },
        };

        const newEdge: MindmapEdge = {
          id: `${parentId}-${newId}`,
          source: parentId,
          target: newId,
          sourceHandle: `${parentId}-right`,
          targetHandle: `${newId}-left`,
          type: "default",
          style: { stroke: "#cbd5e1", strokeWidth: 2.5 },
        };

        return {
          nodes: [...currentNodes, newNode],
          edges: [...currentEdges, newEdge],
        };
      });
    },
    [updateGraph]
  );

  const addEdgeNote = useCallback(
    (parentId: string) => {
      const newId = `note-${nodeIdCounter++}`;

      updateGraph((currentNodes, currentEdges) => {
        const parent = currentNodes.find((n) => n.id === parentId);
        if (!parent) {
          return null;
        }

        const parentPosition = parent.position ?? { x: 0, y: 0 };
        const level = (parent.data.level ?? 0) + 1;

        const newNode: MindmapNode = {
          id: newId,
          type: "edge-note",
          position: parentPosition,
          data: {
            label: "Content Draft",
            level,
            variant: "edge-note",
            noteContent: "",
            noteCollapsed: false,
            color: "#fef3c7",
          },
        };

        const newEdge: MindmapEdge = {
          id: `${parentId}-${newId}`,
          source: parentId,
          target: newId,
          sourceHandle: `${parentId}-right`,
          targetHandle: `${newId}-left`,
          type: "default",
          style: { stroke: "#cbd5e1", strokeWidth: 2.5 },
        };

        return {
          nodes: [...currentNodes, newNode],
          edges: [...currentEdges, newEdge],
        };
      });
    },
    [updateGraph]
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

        const filteredNodes = currentNodes.filter(
          (n) => !nodesToDelete.has(n.id)
        );
        const filteredEdges = currentEdges.filter(
          (e) => !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target)
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
    [updateGraph, focusNodes]
  );

  // Update node label
  const updateNodeLabel = useCallback(
    (id: string, label: string) => {
      updateGraph(
        (nodesState, edgesState) => ({
          nodes: nodesState.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    label,
                  },
                }
              : n
          ),
          edges: edgesState,
        }),
        { relayout: false }
      );
    },
    [updateGraph]
  );

  // Update node description
  const updateNodeDescription = useCallback(
    (id: string, description: string) => {
      updateGraph(
        (nodesState, edgesState) => ({
          nodes: nodesState.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    description,
                  },
                }
              : n
          ),
          edges: edgesState,
        }),
        { relayout: false }
      );
    },
    [updateGraph]
  );

  // Update node status
  const updateNodeStatus = useCallback(
    (id: string, status: StatusValue) => {
      updateGraph(
        (nodesState, edgesState) => ({
          nodes: nodesState.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    status,
                  },
                }
              : n
          ),
          edges: edgesState,
        }),
        { relayout: false }
      );
    },
    [updateGraph]
  );

  // Change node color
  const changeNodeColor = useCallback(
    (color: string) => {
      if (!selectedNodeId) return;
      updateGraph(
        (nodesState, edgesState) => ({
          nodes: nodesState.map((n) =>
            n.id === selectedNodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    color,
                  },
                }
              : n
          ),
          edges: edgesState,
        }),
        { relayout: false }
      );
    },
    [selectedNodeId, updateGraph]
  );

  // Change node emoji
  const changeNodeEmoji = useCallback(
    (emoji: string) => {
      if (!selectedNodeId) return;
      updateGraph(
        (nodesState, edgesState) => ({
          nodes: nodesState.map((n) =>
            n.id === selectedNodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    emoji,
                  },
                }
              : n
          ),
          edges: edgesState,
        }),
        { relayout: false }
      );
    },
    [selectedNodeId, updateGraph]
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
            : node
        ),
        edges: edgesState,
      }));

      requestAnimationFrame(() => {
        if (collapsed) {
          focusNodes([nodeId], { duration: ZOOM_DURATIONS.collapse });
          return;
        }

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
      });
    },
    [focusNodes, updateGraph]
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
        type: "mindmap",
        position: { x: centerX, y: centerY },
        data: {
          label: "New Root",
          level: 0,
          variant: "topic",
          color: COLORS[0].value,
          status: "not-started",
          description: "",
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
      nodes: nodes.map((n) => ({ id: n.id, data: n.data })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mindmap.json";
    a.click();
  }, [nodes, edges]);

  // Import
  const importData = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          const importedNodes: MindmapNode[] = data.nodes.map((n: any) => ({
            id: n.id,
            type: "mindmap",
            position: { x: 0, y: 0 },
            data: n.data,
          }));
          const importedEdges: MindmapEdge[] = data.edges.map((e: any) => ({
            id: `${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            sourceHandle: "right",
            targetHandle: "left",
            type: "default",
            style: { stroke: "#cbd5e1", strokeWidth: 2.5 },
          }));
          updateGraph(() => ({ nodes: importedNodes, edges: importedEdges }));
        } catch (_err) {
          alert("Invalid file format");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [updateGraph]);

  // Clear all
  const clearAll = useCallback(() => {
    if (confirm("Clear all nodes? This cannot be undone.")) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(FLOW_STORAGE_KEY);
      }

      const resetNodes: MindmapNode[] = [
        {
          id: "root",
          type: "mindmap",
          position: { ...DEFAULT_VIEWPORT_CENTER },
          positionAbsolute: { ...DEFAULT_VIEWPORT_CENTER },
          data: {
            label: "My Mindmap",
            level: 0,
            variant: "topic",
            color: COLORS[0].value,
          },
        },
      ];
      updateGraph(() => ({ nodes: resetNodes, edges: [] }));
      setSelectedNodeId(null);
    }
  }, [updateGraph]);

  // Event listeners
  useEffect(() => {
    const handleAddChild = (e: Event) => {
      const { parentId } = (e as CustomEvent).detail;
      addChild(parentId);
    };
    const handleDeleteNode = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        id?: string;
        nodeId?: string;
      };
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

    const handleFocusNode = (e: Event) => {
      const { nodeId } = (e as CustomEvent).detail ?? {};
      if (!nodeId) {
        return;
      }

      setSelectedNodeId(nodeId);

      setNodes((prev) => {
        let changed = false;
        const next = prev.map((node) => {
          const shouldSelect = node.id === nodeId;
          if (node.selected !== shouldSelect) {
            changed = true;
            return { ...node, selected: shouldSelect };
          }
          return node;
        });
        return changed ? next : prev;
      });
    };

    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only delete if not editing and a node is selected
      const activeElement = document.activeElement;
      const isEditing =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && !isEditing) {
        const key = e.key.toLowerCase();
        if (key === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
        if (key === "y") {
          e.preventDefault();
          redo();
          return;
        }
      }

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isEditing &&
        selectedNodeId
      ) {
        const nodeToDelete = nodesRef.current.find(
          (n) => n.id === selectedNodeId
        );
        // Don't delete root nodes (level 0)
        if (nodeToDelete && nodeToDelete.data.level > 0) {
          e.preventDefault();
          deleteNode(selectedNodeId);
          setSelectedNodeId(null);
        }
      }
    };

    const handleUpdateNoteContent = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId: string; content: string }>)
        .detail;
      if (!detail?.nodeId) {
        return;
      }
      updateNoteContent(detail.nodeId, detail.content ?? "");
    };

    const handleToggleNoteCollapsed = (event: Event) => {
      const detail = (
        event as CustomEvent<{ nodeId: string; collapsed: boolean }>
      ).detail;
      if (!detail?.nodeId) {
        return;
      }
      setNoteCollapsed(detail.nodeId, Boolean(detail.collapsed));
    };

    window.addEventListener("add-child", handleAddChild);
    window.addEventListener("delete-node", handleDeleteNode);
    window.addEventListener("update-node-label", handleUpdateLabel);
    window.addEventListener("update-node-description", handleUpdateDescription);
    window.addEventListener("update-node-status", handleUpdateStatus);
    window.addEventListener("update-note-content", handleUpdateNoteContent);
    window.addEventListener("toggle-note-collapsed", handleToggleNoteCollapsed);
    window.addEventListener("focus-node", handleFocusNode);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("add-child", handleAddChild);
      window.removeEventListener("delete-node", handleDeleteNode);
      window.removeEventListener("update-node-label", handleUpdateLabel);
      window.removeEventListener(
        "update-node-description",
        handleUpdateDescription
      );
      window.removeEventListener("update-node-status", handleUpdateStatus);
      window.removeEventListener(
        "update-note-content",
        handleUpdateNoteContent
      );
      window.removeEventListener(
        "toggle-note-collapsed",
        handleToggleNoteCollapsed
      );
      window.removeEventListener("focus-node", handleFocusNode);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    addChild,
    deleteNode,
    updateNodeLabel,
    updateNodeDescription,
    updateNodeStatus,
    updateNoteContent,
    setNoteCollapsed,
    setNodes,
    redo,
    selectedNodeId,
    undo,
  ]);

  // Track selection and handle root node dragging
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Check if this is a root node being dragged
      const positionChange = changes.find(
        (c) => c.type === "position" && "dragging" in c && c.dragging
      );

      if (
        positionChange &&
        "position" in positionChange &&
        positionChange.position
      ) {
        const draggedNode = nodesRef.current.find(
          (n) => n.id === positionChange.id
        );

        // If dragging a root node (level 0), move only its tree (root + descendants)
        if (draggedNode && draggedNode.data.level === 0) {
          const oldPosition = draggedNode.position;
          const newPosition = positionChange.position;
          const deltaX = newPosition.x - oldPosition.x;
          const deltaY = newPosition.y - oldPosition.y;

          // Build children map to find descendants
          const childrenMap = new Map<string, string[]>();
          edgesRef.current.forEach((edge) => {
            if (!childrenMap.has(edge.source)) {
              childrenMap.set(edge.source, []);
            }
            childrenMap.get(edge.source)!.push(edge.target);
          });

          // Get all descendants of this root node
          const getDescendants = (nodeId: string): Set<string> => {
            const descendants = new Set<string>();
            const children = childrenMap.get(nodeId) || [];
            children.forEach((childId) => {
              descendants.add(childId);
              const childDescendants = getDescendants(childId);
              childDescendants.forEach((desc) => descendants.add(desc));
            });
            return descendants;
          };

          const treeNodeIds = new Set<string>([
            draggedNode.id,
            ...getDescendants(draggedNode.id),
          ]);

          // Apply delta only to nodes in this tree
          const modifiedChanges: NodeChange<MindmapNode>[] = nodesRef.current
            .filter((node) => treeNodeIds.has(node.id))
            .map((node) => ({
              type: "position" as const,
              id: node.id,
              position: {
                x: node.position.x + deltaX,
                y: node.position.y + deltaY,
              },
              dragging: positionChange.id === node.id,
            }));

          onNodesChange(modifiedChanges as any);
          return;
        }
      }

      onNodesChange(changes as any);

      const selectChange = changes.find((c) => c.type === "select");
      if (selectChange && "selected" in selectChange) {
        const nodeId = selectChange.selected ? selectChange.id : null;
        setSelectedNodeId(nodeId);
      }
    },
    [onNodesChange]
  );

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  const aiPanelNode = aiPanelNodeId
    ? nodes.find((n) => n.id === aiPanelNodeId) ?? null
    : null;

  const aiStatusMeta = aiPanelNode
    ? STATUS_OPTIONS.find(
        (option) => option.value === normalizeStatus(aiPanelNode.data.status)
      )
    : null;

  const aiPanelSummary: AIChatPanelNodeSummary | null = aiPanelNode
    ? {
        id: aiPanelNode.id,
        label: aiPanelNode.data.label,
        description:
          typeof aiPanelNode.data.description === "string"
            ? aiPanelNode.data.description
            : undefined,
        level: aiPanelNode.data.level,
        childCount: edges.filter((edge) => edge.source === aiPanelNode.id)
          .length,
        statusLabel: aiStatusMeta?.label,
        statusColor: aiStatusMeta?.color,
        statusIcon: aiStatusMeta?.icon,
      }
    : null;

  const panelMessages = useMemo<AIChatPanelMessage[]>(() => {
    if (!aiPanelNodeId) {
      return [];
    }
    const entries = aiConversations[aiPanelNodeId] ?? [];
    return entries.map((message) => {
      const suggestion = message.suggestion
        ? {
            id: message.suggestion.id,
            summary: message.suggestion.summary,
            additions: message.suggestion.additions,
            updates: message.suggestion.updates?.map((update) => ({
              description: update.description,
            })),
            followUp: message.suggestion.followUp,
            warnings: message.suggestion.warnings,
            status: message.suggestion.status,
            appliedMode: message.suggestion.appliedMode,
            intent: message.suggestion.intent,
          }
        : undefined;

      const payload: AIChatPanelMessage = {
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        suggestion,
      };

      return payload;
    });
  }, [aiConversations, aiPanelNodeId]);

  return (
    <div className="mindmap-shell">
      <div className="mindmap-canvas">
        <ReactFlow
          defaultEdgeOptions={{
            type: "default",
            style: { stroke: "#cbd5e1", strokeWidth: 2.5 },
          }}
          edges={edges}
          maxZoom={2}
          minZoom={0.1}
          nodes={nodes}
          nodeTypes={nodeTypes}
          onEdgesChange={onEdgesChange}
          onNodesChange={handleNodesChange}
          onSelectionChange={handleSelectionChange}
          style={{ width: "100%", height: "100%" }}
        >
          <Background
            color="#bbb"
            gap={16}
            size={1}
            variant={BackgroundVariant.Dots}
          />
          <Controls />
          <MiniMap
            nodeColor={(node: any) => {
              const color = node.data?.color;
              return color || "#4facfe";
            }}
            pannable
            zoomable
          />

          <Toolbar
            canRedo={historyState.canRedo}
            canUndo={historyState.canUndo}
            onAddRoot={addRootNode}
            onAutoLayout={relayout}
            onClear={clearAll}
            onExport={exportData}
            onImport={importData}
            onRedo={redo}
            onUndo={undo}
          />

          <NodeActionToolbar
            isAiActive={
              Boolean(selectedNode?.id) &&
              isAiPanelOpen &&
              aiPanelNodeId === selectedNode?.id
            }
            node={selectedNode}
            onAddChild={addChild}
            onAddEdgeNote={addEdgeNote}
            onColorChange={changeNodeColor}
            onDelete={deleteNode}
            onEmojiChange={changeNodeEmoji}
            onOpenAI={openAiPanel}
            onRunAiQuickAction={triggerAiQuickAction}
            onStatusChange={updateNodeStatus}
            onToggleCollapse={toggleCollapse}
          />
        </ReactFlow>
      </div>
      <AIChatPanel
        intentMeta={AI_INTENT_META}
        isOpen={isAiPanelOpen}
        messages={panelMessages}
        mode={aiPanelMode}
        node={aiPanelSummary}
        onAddSuggestion={applyAiSuggestionAdd}
        onClose={closeAiPanel}
        onModeChange={handleAiModeChange}
        onRejectSuggestion={rejectAiSuggestion}
        onReplaceSuggestion={applyAiSuggestionReplace}
        onSelectQuickAction={handleQuickActionSelect}
        onSubmitMessage={handlePromptSubmit}
        phase={aiPanelPhase}
        quickActions={AI_INTENT_META[aiPanelMode].quickActions}
      />
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
