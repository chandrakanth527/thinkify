import {
  EDGE_STYLE,
  type LayoutOptions,
  type MindmapEdge,
  type MindmapNode,
} from './types';

export const DEFAULT_HORIZONTAL_GAP = 280;
export const DEFAULT_VERTICAL_GAP = 120;

export const cloneNodes = (nodes: MindmapNode[]): MindmapNode[] =>
  nodes.map((node) => ({
    ...node,
    data: { ...node.data },
  }));

export const cloneEdges = (edges: MindmapEdge[]): MindmapEdge[] =>
  edges.map((edge) => ({ ...edge }));

export const createEdge = (source: string, target: string): MindmapEdge => ({
  id: `${source}-${target}`,
  source,
  target,
  sourceHandle: 'right',
  targetHandle: 'left',
  type: 'simplebezier',
  style: EDGE_STYLE,
});

export const buildChildrenMap = (
  edges: MindmapEdge[],
): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  edges.forEach((edge) => {
    const list = map.get(edge.source) ?? [];
    list.push(edge.target);
    map.set(edge.source, list);
  });
  return map;
};

export const collectBranch = (
  nodeId: string,
  edges: MindmapEdge[],
): Set<string> => {
  const childrenMap = buildChildrenMap(edges);
  const toRemove = new Set<string>([nodeId]);
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childrenMap.get(current) ?? [];
    children.forEach((childId) => {
      if (!toRemove.has(childId)) {
        toRemove.add(childId);
        queue.push(childId);
      }
    });
  }

  return toRemove;
};

export const getNextChildOrder = (
  parentId: string,
  nodes: MindmapNode[],
  edges: MindmapEdge[],
): number => {
  const childIds = edges
    .filter((edge) => edge.source === parentId)
    .map((edge) => edge.target);
  const orders = childIds
    .map(
      (childId) => nodes.find((node) => node.id === childId)?.data.order ?? 0,
    )
    .filter((value) => Number.isFinite(value));
  if (orders.length === 0) {
    return 0;
  }
  return Math.max(...orders) + 1;
};

export const layoutMindmap = (
  nodes: MindmapNode[],
  edges: MindmapEdge[],
  options: LayoutOptions = {},
): MindmapNode[] => {
  if (nodes.length === 0) {
    return nodes;
  }

  const horizontalGap = options.horizontalGap ?? DEFAULT_HORIZONTAL_GAP;
  const verticalGap = options.verticalGap ?? DEFAULT_VERTICAL_GAP;

  const nodeMap = new Map<string, MindmapNode>(
    nodes.map((node) => [node.id, { ...node, data: { ...node.data } }]),
  );
  const childrenMap = buildChildrenMap(edges);
  const parentMap = new Map<string, string>();

  edges.forEach((edge) => {
    parentMap.set(edge.target, edge.source);
  });

  childrenMap.forEach((childIds, parentId) => {
    childIds.sort((a, b) => {
      const dataA = nodeMap.get(a)?.data;
      const dataB = nodeMap.get(b)?.data;
      return (dataA?.order ?? 0) - (dataB?.order ?? 0);
    });
  });

  const roots = nodes.filter((node) => !parentMap.has(node.id));
  roots.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));

  let cursorY = 0;

  const assign = (nodeId: string, depth: number): number => {
    const node = nodeMap.get(nodeId);
    if (!node) {
      return cursorY;
    }

    const children = childrenMap.get(nodeId) ?? [];

    if (children.length === 0) {
      const y = cursorY;
      cursorY += verticalGap;
      node.position = { x: depth * horizontalGap, y };
      node.positionAbsolute = node.position;
      node.data = { ...node.data, level: depth };
      return y;
    }

    const childYs = children.map((childId) => assign(childId, depth + 1));
    const y = childYs.reduce((sum, value) => sum + value, 0) / childYs.length;

    node.position = { x: depth * horizontalGap, y };
    node.positionAbsolute = node.position;
    node.data = { ...node.data, level: depth };

    return y;
  };

  roots.forEach((root) => {
    assign(root.id, 0);
  });

  return Array.from(nodeMap.values());
};
