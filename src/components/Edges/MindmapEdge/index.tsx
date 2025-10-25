import {
  BaseEdge,
  type EdgeProps,
  getSmoothStepPath,
  getStraightPath,
} from '@xyflow/react';
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
    const isHorizontal = Math.abs(sourceY - targetY) < 0.5;
    const [edgePath] = isHorizontal
      ? getStraightPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
        })
      : getSmoothStepPath({
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
