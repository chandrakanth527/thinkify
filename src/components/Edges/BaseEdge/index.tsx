import { BaseEdge as _BaseEdge, type EdgeProps } from '@xyflow/react';
import { type ComponentType, memo } from 'react';

import type { ReactflowEdgeWithData } from '@/data/types';
import { isConnectionBackward } from '@/layout/edge/edge';
import { getEdgeStyles, layoutEdge } from '@/layout/edge/style';
import { flowStore } from '@/states/reactflow';

import { EdgeControllers } from '../EdgeController';
import { useRebuildEdge } from './useRebuildEdge';

export const BaseEdge: ComponentType<
  EdgeProps & {
    data: any;
    type: any;
  }
> = memo(
  ({
    id,
    selected,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    label,
    labelStyle,
    labelShowBg,
    labelBgStyle,
    labelBgPadding,
    labelBgBorderRadius,
    style,
    sourcePosition,
    targetPosition,
    markerStart,
    interactionWidth,
  }) => {
    useRebuildEdge(id);

    const isBackward = isConnectionBackward({
      source: {
        id,
        x: sourceX,
        y: sourceY,
        position: sourcePosition,
      },
      target: {
        id,
        x: targetX,
        y: targetY,
        position: targetPosition,
      },
    });

    const { color, edgeType, pathType } = getEdgeStyles({ id, isBackward });

    const edge = flowStore.value.getEdge(id)! as ReactflowEdgeWithData;

    const offset = 20;
    const borderRadius = 12;
    const handlerWidth = 24;
    const handlerThickness = 6;

    edge.data!.layout = layoutEdge({
      layout: edge.data!.layout,
      id,
      offset,
      borderRadius,
      pathType,
      source,
      target,
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });

    const { path, points, labelPosition } = edge.data!.layout;

    return (
      <>
        <_BaseEdge
          interactionWidth={interactionWidth}
          label={label}
          labelBgBorderRadius={labelBgBorderRadius}
          labelBgPadding={labelBgPadding}
          labelBgStyle={labelBgStyle}
          labelShowBg={labelShowBg}
          labelStyle={labelStyle}
          labelX={labelPosition.x}
          labelY={labelPosition.y}
          markerEnd={`url('#${color.replace('#', '')}')`}
          markerStart={markerStart}
          path={path}
          style={{
            ...style,
            stroke: color,
            opacity: selected ? 1 : 0.5,
            strokeWidth: selected ? 2 : 1.5,
            strokeDasharray: edgeType === 'dashed' ? '10,10' : undefined,
          }}
        />
        {selected && (
          <EdgeControllers
            handlerThickness={handlerThickness}
            handlerWidth={handlerWidth}
            id={id}
            offset={offset}
            points={points}
            sourcePosition={sourcePosition}
            targetPosition={targetPosition}
          />
        )}
      </>
    );
  },
);

BaseEdge.displayName = 'BaseEdge';
