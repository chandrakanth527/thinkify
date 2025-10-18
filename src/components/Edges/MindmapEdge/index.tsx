import { BaseEdge, type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { memo } from 'react';

import './styles.css';

export const MindmapEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
  }: EdgeProps) => {
    const [edgePath] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 20,
    });

    return (
      <>
        <BaseEdge
          markerEnd={markerEnd}
          path={edgePath}
          style={{
            ...style,
            stroke: '#b1b1b7',
            strokeWidth: 2,
          }}
        />
      </>
    );
  },
);

MindmapEdge.displayName = 'MindmapEdge';
