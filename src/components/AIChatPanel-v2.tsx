import {
  type FC,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { IconCollapse, IconExpand, IconSend, IconX } from '@/icons';

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
  onAddSuggestion?: (messageId: string, selectedIndexes: number[]) => void;
  onReplaceSuggestion?: (messageId: string, selectedIndexes: number[]) => void;
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

// State reducer for explicit stage transitions
type PanelStage = 'compose' | 'review' | 'applying';

interface PanelState {
  stage: PanelStage;
  selectedSuggestionIds: Set<string>;
  contextExpanded: boolean;
}

type PanelAction =
  | { type: 'START_REVIEW'; suggestionIds: string[] }
  | { type: 'TOGGLE_SUGGESTION'; id: string }
  | { type: 'APPLY_SUGGESTIONS' }
  | { type: 'RESET_TO_COMPOSE' }
  | { type: 'TOGGLE_CONTEXT' };

function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case 'START_REVIEW':
      return {
        ...state,
        stage: 'review',
        selectedSuggestionIds: new Set(action.suggestionIds),
      };
    case 'TOGGLE_SUGGESTION': {
      const newSelected = new Set(state.selectedSuggestionIds);
      if (newSelected.has(action.id)) {
        newSelected.delete(action.id);
      } else {
        newSelected.add(action.id);
      }
      return { ...state, selectedSuggestionIds: newSelected };
    }
    case 'APPLY_SUGGESTIONS':
      return { ...state, stage: 'applying' };
    case 'RESET_TO_COMPOSE':
      return {
        ...state,
        stage: 'compose',
        selectedSuggestionIds: new Set(),
      };
    case 'TOGGLE_CONTEXT':
      return { ...state, contextExpanded: !state.contextExpanded };
    default:
      return state;
  }
}

const initialState: PanelState = {
  stage: 'compose',
  selectedSuggestionIds: new Set(),
  contextExpanded: false,
};

// ==================== COMPACT CONTEXT SECTION ====================
interface ContextSectionProps {
  node: NodeSummary | null;
  mode: AIIntent;
  intentMeta: AIChatPanelProps['intentMeta'];
  expanded: boolean;
  onToggle: () => void;
  onClose?: () => void;
}

const ContextSection: FC<ContextSectionProps> = ({
  node,
  mode,
  intentMeta,
  expanded,
  onToggle,
  onClose,
}) => {
  const activeIntentMeta = intentMeta[mode];
  const statusBadge = node?.statusLabel
    ? {
        label: node.statusLabel,
        color: node.statusColor ?? '#334155',
      }
    : null;

  return (
    <section className="ai-chat-v2-pane ai-chat-v2-pane-context">
      <div className="ai-chat-v2-context-header">
        <div
          className="ai-chat-v2-context-summary"
          title={node?.label ?? undefined}
        >
          {node ? (
            <>
              <span className="ai-chat-v2-context-node">{node.label}</span>
              {statusBadge && (
                <span
                  aria-label={statusBadge.label}
                  className="ai-chat-v2-context-status"
                  title={statusBadge.label}
                >
                  <span
                    className="ai-chat-v2-status-dot"
                    style={{ background: statusBadge.color }}
                  />
                </span>
              )}
              <span className="ai-chat-v2-context-mode">
                {mode === 'spark' ? '✨' : '🔍'} {activeIntentMeta.label}
              </span>
            </>
          ) : (
            <span className="ai-chat-v2-context-empty">Select a node</span>
          )}
        </div>
        <div className="ai-chat-v2-pane-actions">
          <button
            aria-label={expanded ? 'Collapse context' : 'Expand context'}
            className="ai-chat-v2-pane-toggle"
            onClick={onToggle}
            type="button"
          >
            {expanded ? <IconCollapse size={14} /> : <IconExpand size={14} />}
          </button>
          {onClose && (
            <button
              aria-label="Close AI assistant"
              className="ai-chat-v2-close"
              onClick={onClose}
              type="button"
            >
              <IconX size={14} />
            </button>
          )}
        </div>
      </div>
      <div
        className={
          expanded
            ? 'ai-chat-v2-pane-body is-open'
            : 'ai-chat-v2-pane-body is-collapsed'
        }
      >
        {node ? (
          <div className="ai-chat-v2-context-details">
            {node.description && (
              <p className="ai-chat-v2-context-desc">{node.description}</p>
            )}
            <div className="ai-chat-v2-context-meta">
              <span>L{node.level}</span>
              <span>{node.childCount} children</span>
              {statusBadge && <span>{statusBadge.label}</span>}
              <span>{activeIntentMeta.label}</span>
            </div>
          </div>
        ) : (
          <div className="ai-chat-v2-empty">
            Pick a node to view its context.
          </div>
        )}
      </div>
    </section>
  );
};

// ==================== TRANSCRIPT ====================
interface TranscriptProps {
  messages: ChatMessage[];
  bodyRef?: RefObject<HTMLDivElement>;
}

const Transcript: FC<TranscriptProps> = ({ messages, bodyRef }) => {
  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          (a.createdAt ?? Number.MIN_SAFE_INTEGER) -
          (b.createdAt ?? Number.MIN_SAFE_INTEGER),
      ),
    [messages],
  );

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <section className="ai-chat-v2-pane ai-chat-v2-pane-conversation">
      <div className="ai-chat-v2-pane-body">
        <div className="ai-chat-v2-pane-meta">
          {sortedMessages.length > 0 ? (
            <span className="ai-chat-v2-pane-hint">
              {sortedMessages.length} message
              {sortedMessages.length === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="ai-chat-v2-pane-hint">No messages yet</span>
          )}
        </div>
        <div className="ai-chat-v2-pane-scroll" ref={bodyRef}>
          {sortedMessages.length === 0 ? (
            <p className="ai-chat-v2-empty">No messages yet</p>
          ) : (
            <div className="ai-chat-v2-transcript">
              {sortedMessages.map((message) => (
                <div
                  className={`ai-chat-v2-message ${message.role}`}
                  key={message.id}
                >
                  <div className="ai-chat-v2-message-avatar">
                    {message.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="ai-chat-v2-message-content">
                    <div className="ai-chat-v2-message-header">
                      <span className="ai-chat-v2-message-role">
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </span>
                      <span className="ai-chat-v2-message-time">
                        {formatTimestamp(message.createdAt)}
                      </span>
                    </div>
                    <div className="ai-chat-v2-message-text">
                      {message.content}
                    </div>
                    {message.suggestion &&
                      message.suggestion.status !== 'pending' && (
                        <div className="ai-chat-v2-message-status">
                          {message.suggestion.status === 'accepted'
                            ? '✓ Applied'
                            : '✗ Rejected'}
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

// ==================== COMPOSER ====================
interface ComposerProps {
  node: NodeSummary | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onSubmitByKey: () => void;
  phase: PanelPhase;
  mode: AIIntent;
  onModeChange: (intent: AIIntent) => void;
  intentMeta: AIChatPanelProps['intentMeta'];
  quickActions: QuickAction[];
  onSelectQuickAction: (actionId: string) => void;
}

const Composer: FC<ComposerProps> = ({
  node,
  draft,
  onDraftChange,
  onSubmit,
  onSubmitByKey,
  phase,
  mode,
  onModeChange,
  intentMeta,
  quickActions,
  onSelectQuickAction,
}) => {
  const textareaId = useId();
  const hasNode = Boolean(node);

  const modeEntries = useMemo(
    () =>
      Object.entries(intentMeta) as Array<
        [AIIntent, (typeof intentMeta)[AIIntent]]
      >,
    [intentMeta],
  );

  const guidedPrompts = useMemo(() => {
    return quickActions.slice(0, 2);
  }, [quickActions]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      onSubmitByKey();
    }
  };

  return (
    <div className="ai-chat-v2-composer-compact">
      {guidedPrompts.length > 0 && hasNode && (
        <div className="ai-chat-v2-quick-chips">
          {guidedPrompts.map((prompt) => (
            <button
              className="ai-chat-v2-quick-chip"
              disabled={phase === 'loading'}
              key={prompt.id}
              onClick={() => onSelectQuickAction(prompt.id)}
              title={prompt.description}
              type="button"
            >
              {prompt.label}
            </button>
          ))}
        </div>
      )}

      <form className="ai-chat-v2-composer-form" onSubmit={handleSubmit}>
        <div className="ai-chat-v2-composer-header">
          <div className="ai-chat-v2-mode-toggle">
            {modeEntries.map(([intentKey, metadata]) => (
              <button
                className={
                  intentKey === mode
                    ? 'ai-chat-v2-mode-btn is-active'
                    : 'ai-chat-v2-mode-btn'
                }
                key={intentKey}
                onClick={() => onModeChange(intentKey)}
                title={metadata.tagline}
                type="button"
              >
                {intentKey === 'spark' ? '✨' : '🔍'} {metadata.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ai-chat-v2-input-row">
          <textarea
            className="ai-chat-v2-textarea-wide"
            disabled={!hasNode || phase === 'loading'}
            id={textareaId}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasNode ? 'Ask for new ideas…' : 'Select a node'}
            rows={3}
            value={draft}
          />
          <button
            aria-label={phase === 'loading' ? 'Sending…' : 'Send prompt'}
            className="ai-chat-v2-send-btn"
            disabled={
              !hasNode || phase === 'loading' || draft.trim().length === 0
            }
            type="submit"
          >
            {phase === 'loading' ? (
              <span className="ai-chat-v2-send-dots">…</span>
            ) : (
              <IconSend size={16} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// ==================== SUGGESTION REVIEW ====================
interface SuggestionReviewProps {
  latestSuggestion: { message: ChatMessage; suggestion: ChatSuggestion } | null;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onAdd: (selectedIds: string[]) => void;
  onReplace: (selectedIds: string[]) => void;
  onReject: () => void;
  phase: PanelPhase;
}

const SuggestionReview: FC<SuggestionReviewProps> = ({
  latestSuggestion,
  selectedIds,
  onToggleSelection,
  onAdd,
  onReplace,
  onReject,
  phase,
}) => {
  const suggestion = latestSuggestion?.suggestion;
  const message = latestSuggestion?.message;
  const totalCount = suggestion?.additions.length ?? 0;
  const selectedCount = useMemo(() => {
    if (!message) return 0;
    const prefix = `${message.id}-`;
    let count = 0;
    selectedIds.forEach((id) => {
      if (id.startsWith(prefix)) {
        count += 1;
      }
    });
    return count;
  }, [message?.id, selectedIds]);
  const isPending = suggestion?.status === 'pending';

  return (
    <section className="ai-chat-v2-pane ai-chat-v2-pane-suggestions">
      <div className="ai-chat-v2-pane-body">
        <div className="ai-chat-v2-pane-meta">
          {totalCount > 0 ? (
            <span className="ai-chat-v2-pane-count">
              {selectedCount}/{totalCount}
            </span>
          ) : (
            <span className="ai-chat-v2-pane-hint">No suggestions yet</span>
          )}
          {suggestion ? (
            suggestion.status !== 'pending' ? (
              <span className="ai-chat-v2-pane-status">
                {suggestion.status === 'accepted' ? 'Applied' : 'Dismissed'}
                {suggestion.appliedMode && suggestion.status === 'accepted' && (
                  <span className="ai-chat-v2-pane-status-mode">
                    {suggestion.appliedMode === 'add'
                      ? 'additions'
                      : 'replaced'}
                  </span>
                )}
              </span>
            ) : totalCount > 0 ? (
              <span className="ai-chat-v2-pane-hint">
                Select ideas to apply
              </span>
            ) : null
          ) : null}
        </div>
        <div className="ai-chat-v2-pane-scroll">
          {suggestion && message ? (
            <>
              <div className="ai-chat-v2-suggestion-cards">
                {suggestion.additions.map((item, idx) => {
                  const itemId = `${message.id}-${idx}`;
                  const isSelected = selectedIds.has(itemId);

                  return (
                    <label
                      className={
                        isSelected
                          ? 'ai-chat-v2-suggestion-card is-selected'
                          : 'ai-chat-v2-suggestion-card'
                      }
                      key={itemId}
                    >
                      <input
                        checked={isSelected}
                        className="ai-chat-v2-suggestion-checkbox"
                        onChange={() => onToggleSelection(itemId)}
                        type="checkbox"
                      />
                      <div className="ai-chat-v2-suggestion-card-content">
                        <div className="ai-chat-v2-suggestion-card-header">
                          {item.emoji && (
                            <span className="ai-chat-v2-suggestion-emoji">
                              {item.emoji}
                            </span>
                          )}
                          <strong className="ai-chat-v2-suggestion-title">
                            {item.label}
                          </strong>
                        </div>
                        {item.description && (
                          <p className="ai-chat-v2-suggestion-description">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {suggestion.followUp && (
                <div className="ai-chat-v2-suggestion-followup">
                  {suggestion.followUp}
                </div>
              )}
            </>
          ) : (
            <div className="ai-chat-v2-empty">
              Run a prompt to see suggestions.
            </div>
          )}
        </div>
      </div>
      <div className="ai-chat-v2-pane-footer ai-chat-v2-suggestion-footer">
        <button
          className="ai-chat-v2-action-btn ai-chat-v2-action-primary"
          disabled={
            phase === 'loading' ||
            (!suggestion?.updates?.length && selectedCount === 0)
          }
          onClick={() =>
            onAdd(
              message
                ? Array.from(selectedIds).filter((id) =>
                    id.startsWith(`${message.id}-`),
                  )
                : [],
            )
          }
          type="button"
        >
          Add
        </button>
        <button
          className="ai-chat-v2-action-btn ai-chat-v2-action-secondary"
          disabled={
            phase === 'loading' ||
            (!suggestion?.updates?.length && selectedCount === 0)
          }
          onClick={() =>
            onReplace(
              message
                ? Array.from(selectedIds).filter((id) =>
                    id.startsWith(`${message.id}-`),
                  )
                : [],
            )
          }
          type="button"
        >
          Replace
        </button>
        <button
          className="ai-chat-v2-action-btn ai-chat-v2-action-ghost"
          disabled={phase === 'loading' || !isPending}
          onClick={onReject}
          type="button"
        >
          Dismiss
        </button>
      </div>
    </section>
  );
};

// ==================== MAIN PANEL ====================
export const AIChatPanelV2: FC<AIChatPanelProps> = ({
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
  const [state, dispatch] = useReducer(panelReducer, initialState);
  const [draft, setDraft] = useState('');
  const conversationBodyRef = useRef<HTMLDivElement | null>(null);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          (a.createdAt ?? Number.MIN_SAFE_INTEGER) -
          (b.createdAt ?? Number.MIN_SAFE_INTEGER),
      ),
    [messages],
  );

  // Find latest pending suggestion
  const latestSuggestion = useMemo(() => {
    for (let i = sortedMessages.length - 1; i >= 0; i--) {
      const msg = sortedMessages[i];
      if (msg.suggestion) {
        return { message: msg, suggestion: msg.suggestion };
      }
    }
    return null;
  }, [sortedMessages]);

  const latestPendingSuggestion =
    latestSuggestion && latestSuggestion.suggestion.status === 'pending'
      ? latestSuggestion
      : null;

  // Auto-transition to review when new suggestion appears
  useEffect(() => {
    if (latestPendingSuggestion) {
      const suggestionIds = latestPendingSuggestion.suggestion.additions.map(
        (_, idx) => `${latestPendingSuggestion.message.id}-${idx}`,
      );
      dispatch({ type: 'START_REVIEW', suggestionIds });
      return;
    }

    if (!latestSuggestion) {
      dispatch({ type: 'RESET_TO_COMPOSE' });
    }
  }, [latestPendingSuggestion?.message.id, latestSuggestion?.message.id]);

  // Reset on node change
  useEffect(() => {
    setDraft('');
    dispatch({ type: 'RESET_TO_COMPOSE' });
  }, [node?.id, isOpen]);

  // Auto-scroll
  useEffect(() => {
    if (!isOpen) return;
    const element = conversationBodyRef.current;
    if (!element) return;
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
  }, [sortedMessages.length, phase, isOpen]);

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed || !node || phase === 'loading') return;
    onSubmitMessage(trimmed);
    setDraft('');
  };

  const mapSelectedIdsToIndexes = useCallback(
    (messageId: string, incomingIds: string[]) => {
      const prefix = `${messageId}-`;
      const source =
        incomingIds.length > 0
          ? incomingIds
          : Array.from(state.selectedSuggestionIds).filter((id) =>
              id.startsWith(prefix),
            );
      return source
        .filter((id) => id.startsWith(prefix))
        .map((id) => Number.parseInt(id.slice(prefix.length), 10))
        .filter((idx) => Number.isFinite(idx));
    },
    [state.selectedSuggestionIds],
  );

  const handleAddSuggestions = (
    target: { message: ChatMessage },
    selectedIds: string[],
  ) => {
    const selection = mapSelectedIdsToIndexes(target.message.id, selectedIds);
    dispatch({ type: 'APPLY_SUGGESTIONS' });
    onAddSuggestion?.(target.message.id, selection);
  };

  const handleReplaceSuggestions = (
    target: { message: ChatMessage },
    selectedIds: string[],
  ) => {
    const selection = mapSelectedIdsToIndexes(target.message.id, selectedIds);
    dispatch({ type: 'APPLY_SUGGESTIONS' });
    onReplaceSuggestion?.(target.message.id, selection);
  };

  const handleRejectSuggestions = () => {
    if (!latestSuggestion) return;
    if (latestSuggestion.suggestion.status !== 'pending') return;
    onRejectSuggestion?.(latestSuggestion.message.id);
    dispatch({ type: 'RESET_TO_COMPOSE' });
  };

  if (!isOpen) return null;

  return (
    <aside aria-label="AI assistant panel" className="ai-chat-panel-v2">
      <div className="ai-chat-v2-main">
        <ContextSection
          expanded={state.contextExpanded}
          intentMeta={intentMeta}
          mode={mode}
          node={node}
          onClose={onClose}
          onToggle={() => dispatch({ type: 'TOGGLE_CONTEXT' })}
        />

        <SuggestionReview
          latestSuggestion={latestSuggestion}
          onAdd={(ids) =>
            latestSuggestion && handleAddSuggestions(latestSuggestion, ids)
          }
          onReject={handleRejectSuggestions}
          onReplace={(ids) =>
            latestSuggestion && handleReplaceSuggestions(latestSuggestion, ids)
          }
          onToggleSelection={(id) =>
            dispatch({ type: 'TOGGLE_SUGGESTION', id })
          }
          phase={phase}
          selectedIds={state.selectedSuggestionIds}
        />

        <Transcript bodyRef={conversationBodyRef} messages={sortedMessages} />
      </div>

      <div className="ai-chat-v2-footer">
        {phase === 'error' && (
          <div className="ai-chat-v2-toaster">
            <span className="ai-chat-v2-toaster-icon">⚠</span>
            <span className="ai-chat-v2-toaster-text">
              Something went wrong. Please try again.
            </span>
            <button
              className="ai-chat-v2-toaster-retry"
              onClick={handleSubmit}
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        <Composer
          draft={draft}
          intentMeta={intentMeta}
          mode={mode}
          node={node}
          onDraftChange={setDraft}
          onModeChange={onModeChange}
          onSelectQuickAction={onSelectQuickAction}
          onSubmit={handleSubmit}
          onSubmitByKey={handleSubmit}
          phase={phase}
          quickActions={quickActions}
        />
      </div>
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
