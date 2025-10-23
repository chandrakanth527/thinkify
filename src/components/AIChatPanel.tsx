import {
  type FC,
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { IconMagicWand, IconX } from '@/icons';

type PanelPhase = 'idle' | 'loading' | 'error';

type ChatMessageRole = 'user' | 'assistant';

export type AIIntent = 'spark' | 'deepen';

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

type SuggestionStatus = 'pending' | 'accepted' | 'rejected';

interface ChatSuggestion {
  id: string;
  summary: string;
  additions: Array<{
    label: string;
    description?: string;
    emphasis?: 'primary' | 'secondary' | 'stretch';
    emoji?: string;
  }>;
  updates?: Array<{ description: string }>;
  followUp?: string;
  warnings?: string[];
  status: SuggestionStatus;
  appliedMode?: 'add' | 'replace';
  intent?: AIIntent;
}

interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt?: number;
  suggestion?: ChatSuggestion;
}

interface AIChatPanelProps {
  isOpen: boolean;
  node: NodeSummary | null;
  quickActions: QuickAction[];
  messages: ChatMessage[];
  onClose: () => void;
  onSelectQuickAction: (actionId: string) => void;
  onSubmitMessage: (content: string) => void;
  onAddSuggestion?: (messageId: string) => void;
  onReplaceSuggestion?: (messageId: string) => void;
  onRejectSuggestion?: (messageId: string) => void;
  mode: AIIntent;
  onModeChange: (intent: AIIntent) => void;
  intentMeta: Record<
    AIIntent,
    {
      label: string;
      tagline: string;
      addLabel: string;
      replaceLabel: string;
      placeholder: (nodeLabel?: string) => string;
      quickHint?: string;
    }
  >;
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
  onAddSuggestion,
  onReplaceSuggestion,
  onRejectSuggestion,
  mode,
  onModeChange,
  intentMeta,
  phase = 'idle',
}) => {
  const [draft, setDraft] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaId = useId();
  const modeEntries = useMemo(
    () =>
      Object.entries(intentMeta) as Array<
        [AIIntent, (typeof intentMeta)[AIIntent]]
      >,
    [intentMeta],
  );
  const activeIntentMeta = intentMeta[mode];

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

  const submitDraft = () => {
    if (!hasNode || phase === 'loading') {
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    onSubmitMessage(trimmed);
    setDraft('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitDraft();
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
        <div className="ai-chat-modes">
          <div className="ai-chat-mode-switch">
            {modeEntries.map(([intentKey, metadata]) => (
              <button
                className={
                  intentKey === mode
                    ? 'ai-chat-mode-btn is-active'
                    : 'ai-chat-mode-btn'
                }
                key={intentKey}
                onClick={() => onModeChange(intentKey)}
                type="button"
              >
                {metadata.label}
              </button>
            ))}
          </div>
          <p className="ai-chat-mode-tagline">{activeIntentMeta.tagline}</p>
        </div>

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
                  Add a short description to nudge the AI in the right
                  direction.
                </p>
              )}
            </div>
          ) : (
            <div className="ai-chat-node-empty">
              <p>
                Select a node on the mindmap to start a focused AI conversation.
              </p>
            </div>
          )}
        </section>

        {showQuickActions ? (
          <section aria-live="polite" className="ai-chat-quick">
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
            <p className="ai-chat-quick-hint">
              {activeIntentMeta.quickHint ??
                'Pick a bubble to preview how the assistant can help.'}
            </p>
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
                  Something went wrong while generating ideas. Try again in a
                  moment.
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

          {sortedMessages.map((message) => {
            const suggestion = message.suggestion;
            return (
              <div
                className={`ai-chat-message ${message.role}`}
                key={message.id}
              >
                <div className="ai-chat-bubble">
                  <p className="ai-chat-message-body">{message.content}</p>
                  {suggestion ? (
                    <div
                      className={`ai-chat-suggestion ai-chat-suggestion-${suggestion.status}`}
                    >
                      <div className="ai-chat-suggestion-header">
                        <span className="ai-chat-suggestion-title">
                          {suggestion.intent
                            ? intentMeta[suggestion.intent].label
                            : 'Proposed nodes'}
                        </span>
                        <span className="ai-chat-suggestion-status">
                          {suggestion.status === 'pending'
                            ? 'Awaiting review'
                            : suggestion.status === 'accepted'
                              ? suggestion.appliedMode === 'replace'
                                ? 'Applied (replaced)'
                                : 'Applied (added)'
                              : 'Dismissed'}
                        </span>
                      </div>
                      <ul className="ai-chat-suggestion-list">
                        {suggestion.additions.map((addition, index) => (
                          <li
                            className="ai-chat-suggestion-item"
                            key={`${suggestion.id}-addition-${index}`}
                          >
                            <div className="ai-chat-suggestion-item-title">
                              {addition.emoji ? (
                                <span className="ai-chat-suggestion-emoji">
                                  {addition.emoji}
                                </span>
                              ) : null}
                              <strong>{addition.label}</strong>
                              {addition.emphasis ? (
                                <span className="ai-chat-suggestion-emphasis">
                                  {addition.emphasis}
                                </span>
                              ) : null}
                            </div>
                            {addition.description ? (
                              <p className="ai-chat-suggestion-description">
                                {addition.description}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      {suggestion.updates?.length ? (
                        <div className="ai-chat-suggestion-updates">
                          <span className="ai-chat-suggestion-subtitle">
                            Description update
                          </span>
                          {suggestion.updates.map((update, index) => (
                            <p
                              className="ai-chat-suggestion-description"
                              key={`${suggestion.id}-update-${index}`}
                            >
                              {update.description}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {suggestion.warnings?.length ? (
                        <ul className="ai-chat-suggestion-warnings">
                          {suggestion.warnings.map((warning, index) => (
                            <li key={`${suggestion.id}-warning-${index}`}>
                              {warning}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {suggestion.followUp ? (
                        <p className="ai-chat-suggestion-followup">
                          Next idea: {suggestion.followUp}
                        </p>
                      ) : null}

                      {suggestion.status === 'pending' ? (
                        <div className="ai-chat-suggestion-actions">
                          <button
                            className="ai-chat-chip"
                            disabled={
                              phase === 'loading' ||
                              suggestion.additions.length === 0
                            }
                            onClick={() => onAddSuggestion?.(message.id)}
                            type="button"
                          >
                            {intentMeta[suggestion.intent ?? mode].addLabel}
                          </button>
                          <button
                            className="ai-chat-chip warning"
                            disabled={
                              phase === 'loading' ||
                              suggestion.additions.length === 0
                            }
                            onClick={() => onReplaceSuggestion?.(message.id)}
                            type="button"
                          >
                            {intentMeta[suggestion.intent ?? mode].replaceLabel}
                          </button>
                          <button
                            className="ai-chat-chip danger"
                            disabled={phase === 'loading'}
                            onClick={() => onRejectSuggestion?.(message.id)}
                            type="button"
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <footer className="ai-chat-footer">
        <form className="ai-chat-form" onSubmit={handleSubmit}>
          <label className="ai-chat-input-label" htmlFor={textareaId}>
            Describe what you need
          </label>
          <textarea
            className="ai-chat-textarea"
            disabled={!hasNode || phase === 'loading'}
            id={textareaId}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey
              ) {
                event.preventDefault();
                submitDraft();
              }
            }}
            placeholder={
              hasNode
                ? activeIntentMeta.placeholder(node?.label)
                : 'Select a node to start chatting'
            }
            value={draft}
          />
          <div className="ai-chat-actions">
            <span className="ai-chat-input-helper">
              Your prompts stay on this device for now. Database sync is coming
              later.
            </span>
            <button
              className="ai-chat-run"
              disabled={
                !hasNode || phase === 'loading' || draft.trim().length === 0
              }
              title={
                hasNode
                  ? 'Send a custom prompt'
                  : 'Select a node to enable AI actions'
              }
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
  ChatSuggestion as AIChatPanelSuggestion,
  AIIntent,
};
