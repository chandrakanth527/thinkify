import {
  type FC,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { IconMagicWand, IconX } from '@/icons';

type PanelPhase = 'idle' | 'loading' | 'error';

type ChatMessageRole = 'user' | 'assistant';

interface NodeSummary {
  id: string;
  label: string;
  description?: string;
  level: number;
  childCount: number;
  statusLabel?: string;
  statusColor?: string;
  statusIcon?: string;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
}

interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt?: number;
}

interface AIChatPanelProps {
  isOpen: boolean;
  node: NodeSummary | null;
  quickActions: QuickAction[];
  messages: ChatMessage[];
  onClose: () => void;
  onSelectQuickAction: (actionId: string) => void;
  onSubmitMessage: (content: string) => void;
  phase?: PanelPhase;
}

const placeholderMessages = [
  {
    id: 'welcome',
    title: 'AI assistant is ready',
    body: 'Pick a quick action or describe what you need. This conversation stays tied to the selected node.',
  },
  {
    id: 'tip',
    title: 'Tip',
    body: 'You can accept, edit, or discard AI suggestions before they land on the mindmap.',
  },
];

export const AIChatPanel: FC<AIChatPanelProps> = ({
  isOpen,
  node,
  quickActions,
  messages,
  onClose,
  onSelectQuickAction,
  onSubmitMessage,
  phase = 'idle',
}) => {
  const [draft, setDraft] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft('');
  }, [node?.id, isOpen]);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          (a.createdAt ?? Number.MIN_SAFE_INTEGER) -
          (b.createdAt ?? Number.MIN_SAFE_INTEGER),
      ),
    [messages],
  );
  const hasMessages = sortedMessages.length > 0;
  const hasNode = Boolean(node);
  const showQuickActions = hasNode && !hasMessages && quickActions.length > 0;
  const statusBadge = node?.statusLabel
    ? {
        label: node.statusLabel,
        color: node.statusColor ?? '#334155',
        icon: node.statusIcon ?? '○',
      }
    : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasNode) {
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    onSubmitMessage(trimmed);
    setDraft('');
  };

  const handleQuickAction = (actionId: string) => {
    if (!hasNode || phase === 'loading') {
      return;
    }
    onSelectQuickAction(actionId);
  };

  useEffect(() => {
    if (!isOpen || !scrollContainerRef.current) {
      return;
    }

    const element = scrollContainerRef.current;
    // Scroll to the bottom so the latest message is visible
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
  }, [sortedMessages.length, phase, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <aside aria-label="AI assistant panel" className="ai-chat-panel">
      <header className="ai-chat-header">
        <div className="ai-chat-heading">
          <span className="ai-chat-label">AI assistant</span>
          <h2 className="ai-chat-title">
            {hasNode ? node?.label : 'Select a node'}
          </h2>
          {statusBadge && (
            <span
              className="ai-chat-status"
              style={{
                color: statusBadge.color,
                borderColor: statusBadge.color,
              }}
            >
              <span className="ai-chat-status-icon">{statusBadge.icon}</span>
              {statusBadge.label}
            </span>
          )}
        </div>
        <button
          className="ai-chat-close"
          onClick={onClose}
          title="Close AI panel"
          type="button"
        >
          <IconX size={18} />
        </button>
      </header>

      <div className="ai-chat-scroll" ref={scrollContainerRef}>
        <section className="ai-chat-node-summary">
        {hasNode ? (
          <div className="ai-chat-node-card">
            <div className="ai-chat-node-meta">
              <div>
                <p className="ai-chat-node-label">Level {node!.level}</p>
                <p className="ai-chat-node-children">
                  {node!.childCount === 0
                    ? 'No children yet'
                    : `${node!.childCount} child${node!.childCount === 1 ? '' : 'ren'} in this branch`}
                </p>
              </div>
              <span className="ai-chat-node-marker">
                <IconMagicWand size={16} />
              </span>
            </div>
            {node?.description ? (
              <p className="ai-chat-node-description">{node.description}</p>
            ) : (
              <p className="ai-chat-node-placeholder">
                Add a short description to nudge the AI in the right direction.
              </p>
            )}
          </div>
        ) : (
          <div className="ai-chat-node-empty">
            <p>Select a node on the mindmap to start a focused AI conversation.</p>
          </div>
        )}
        </section>

        {showQuickActions ? (
          <section className="ai-chat-quick" aria-live="polite">
            <span className="ai-chat-section-title">Quick start</span>
            <div className="ai-chat-chip-row">
              {quickActions.map((prompt) => (
                <button
                  className="ai-chat-chip"
                  disabled={!hasNode || phase === 'loading'}
                  key={prompt.id}
                  onClick={() => handleQuickAction(prompt.id)}
                  title={prompt.description}
                  type="button"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
            <p className="ai-chat-quick-hint">Pick a bubble to preview how the assistant can help.</p>
          </section>
        ) : null}

        <section className="ai-chat-feed">
          {phase === 'loading' && (
            <div className="ai-chat-message loading">
              <div className="ai-chat-bubble">
                <div className="ai-chat-loading-spinner" />
                <p className="ai-chat-message-body">Preparing suggestions…</p>
              </div>
            </div>
          )}
          {phase === 'error' && (
            <div className="ai-chat-message error">
              <div className="ai-chat-bubble">
                <p className="ai-chat-message-body">
                  Something went wrong while generating ideas. Try again in a moment.
                </p>
              </div>
            </div>
          )}

          {!hasMessages && phase === 'idle' && (
            <div className="ai-chat-message assistant">
              <div className="ai-chat-bubble ai-chat-welcome">
                {placeholderMessages.map((message) => (
                  <div className="ai-chat-placeholder" key={message.id}>
                    <p className="ai-chat-message-title">{message.title}</p>
                    <p className="ai-chat-message-body">{message.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sortedMessages.map((message) => (
            <div className={`ai-chat-message ${message.role}`} key={message.id}>
              <div className="ai-chat-bubble">
                <p className="ai-chat-message-body">{message.content}</p>
              </div>
            </div>
          ))}
        </section>
      </div>

      <footer className="ai-chat-footer">
        <form className="ai-chat-form" onSubmit={handleSubmit}>
          <label className="ai-chat-input-label" htmlFor="ai-chat-draft">
            Describe what you need
          </label>
          <textarea
            id="ai-chat-draft"
            className="ai-chat-textarea"
            placeholder={
              hasNode
                ? `Ask the AI to work on “${node?.label ?? 'this node'}”…`
                : 'Select a node to start chatting'
            }
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!hasNode || phase === 'loading'}
          />
          <div className="ai-chat-actions">
            <span className="ai-chat-input-helper">
              Your prompts stay on this device for now. Database sync is coming later.
            </span>
            <button
              className="ai-chat-run"
              disabled={!hasNode || phase === 'loading' || draft.trim().length === 0}
              title={hasNode ? 'Send a custom prompt' : 'Select a node to enable AI actions'}
              type="submit"
            >
              Send prompt
            </button>
          </div>
        </form>
      </footer>
    </aside>
  );
};

export type {
  NodeSummary as AIChatPanelNodeSummary,
  PanelPhase as AIChatPanelPhase,
  QuickAction as AIChatPanelQuickAction,
  ChatMessage as AIChatPanelMessage,
};
