import type { Edge, Node } from '@xyflow/react';

export interface MindmapNodeData {
  id: string;
  label: string;
  level: number;
  parentId: string | null;
  order: number;
}

export type MindmapNode = Node<MindmapNodeData, 'mindmap'>;

export type MindmapEdge = Edge<Record<string, unknown>>;

export const EDGE_STYLE = { stroke: '#b1b1b7', strokeWidth: 3 } as const;

export interface LayoutOptions {
  horizontalGap?: number;
  verticalGap?: number;
}
