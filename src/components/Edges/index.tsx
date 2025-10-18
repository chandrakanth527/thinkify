import type { EdgeTypes } from '@xyflow/react';

import { BaseEdge } from './BaseEdge';
import { MindmapEdge } from './MindmapEdge';

export const kEdgeTypes: EdgeTypes = {
  base: BaseEdge,
  mindmap: MindmapEdge,
};
