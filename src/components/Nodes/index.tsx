import type { NodeTypes } from '@xyflow/react';

import { BaseNode } from './BaseNode';
import { MindmapNodeComponent } from './MindmapNode';

export const kNodeTypes: NodeTypes = {
  base: BaseNode,
  mindmap: MindmapNodeComponent,
};
