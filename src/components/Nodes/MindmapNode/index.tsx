import './styles.css';

import { Handle, type NodeProps, Position } from '@xyflow/react';
import {
  type ComponentType,
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useState,
} from 'react';

import type { MindmapNode } from '@/mindmap/types';

export const MindmapNodeComponent: ComponentType<NodeProps<MindmapNode>> = memo(
  ({ data, id }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [label, setLabel] = useState(data.label ?? data.id);
    const level = data.level ?? 0;

    useEffect(() => {
      if (!isEditing) {
        setLabel(data.label ?? data.id);
      }
    }, [data.id, data.label, isEditing]);

    const handleDoubleClick = useCallback(() => {
      setIsEditing(true);
    }, []);

    const commitRename = useCallback(() => {
      const trimmed = label.trim();
      const nextLabel = trimmed === '' ? (data.label ?? data.id) : trimmed;

      if (trimmed !== '' && nextLabel !== data.label) {
        window.dispatchEvent(
          new CustomEvent('rename-node', {
            detail: { nodeId: id, label: nextLabel },
          }),
        );
      }

      setLabel(nextLabel);
      setIsEditing(false);
    }, [data.id, data.label, id, label]);

    const handleBlur = useCallback(() => {
      commitRename();
    }, [commitRename]);

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          commitRename();
        }
        if (event.key === 'Escape') {
          setLabel(data.label ?? data.id);
          setIsEditing(false);
        }
      },
      [commitRename, data.id, data.label],
    );

    // Determine node styling based on level
    const getNodeClass = () => {
      if (level === 0) return 'mindmap-node-root';
      if (level === 1) return 'mindmap-node-main';
      return 'mindmap-node-sub';
    };

    return (
      <div className={`mindmap-node ${getNodeClass()}`}>
        {/* Single target handle on the left */}
        {/* biome-ignore lint/correctness/useUniqueElementIds: ReactFlow handle ids are scoped per node */}
        <Handle
          className="mindmap-handle"
          id="left"
          position={Position.Left}
          type="target"
        />

        {isEditing ? (
          <input
            autoFocus
            className="mindmap-input"
            onBlur={handleBlur}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            type="text"
            value={label}
          />
        ) : (
          <div className="mindmap-label" onDoubleClick={handleDoubleClick}>
            {label}
          </div>
        )}

        {/* Single source handle on the right - all children connect here */}
        {/* biome-ignore lint/correctness/useUniqueElementIds: ReactFlow handle ids are scoped per node */}
        <Handle
          className="mindmap-handle"
          id="right"
          position={Position.Right}
          type="source"
        />

        {/* Add node button - visible on hover */}
        <button
          className="mindmap-add-btn"
          onClick={(event) => {
            event.stopPropagation();
            window.dispatchEvent(
              new CustomEvent('add-child-node', { detail: { parentId: id } }),
            );
          }}
          title="Add child node"
          type="button"
        >
          +
        </button>

        {/* Delete node button - visible on hover, not shown for root */}
        {level > 0 && (
          <button
            className="mindmap-delete-btn"
            onClick={(event) => {
              event.stopPropagation();
              window.dispatchEvent(
                new CustomEvent('delete-node', { detail: { nodeId: id } }),
              );
            }}
            title="Delete node"
            type="button"
          >
            ×
          </button>
        )}
      </div>
    );
  },
);

MindmapNodeComponent.displayName = 'MindmapNode';
