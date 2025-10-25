import {
  type FC,
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { IconMagicWand, IconX, IconCollapse, IconExpand } from '@/icons';

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

// State reducer for explicit stage transitions
type PanelStage = 'compose' | 'review' | 'applying';

interface PanelState {
  stage: PanelStage;
  selectedSuggestionIds: Set<string>;
  contextExpanded: boolean;
  conversationExpanded: boolean;
  suggestionsExpanded: boolean;
}

type PanelAction =
  | { type: 'START_REVIEW'; suggestionIds: string[] }
  | { type: 'TOGGLE_SUGGESTION'; id: string }
  | { type: 'APPLY_SUGGESTIONS' }
  | { type: 'RESET_TO_COMPOSE' }
  | { type: 'TOGGLE_SECTION'; section: 'context' | 'conversation' | 'suggestions' };

function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case 'START_REVIEW':
      return {
        ...state,
        stage: 'review',
        selectedSuggestionIds: new Set(action.suggestionIds),
        suggestionsExpanded: true,
      };
    case 'TOGGLE_SUGGESTION':
      const newSelected = new Set(state.selectedSuggestionIds);
      if (newSelected.has(action.id)) {
        newSelected.delete(action.id);
      } else {
        newSelected.add(action.id);
      }
      return { ...state, selectedSuggestionIds: newSelected };
    case 'APPLY_SUGGESTIONS':
      return { ...state, stage: 'applying' };
    case 'RESET_TO_COMPOSE':
      return {
        ...state,
        stage: 'compose',
        selectedSuggestionIds: new Set(),
      };
    case 'TOGGLE_SECTION':
      const key = `${action.section}Expanded` as keyof Pick<
        PanelState,
        'contextExpanded' | 'conversationExpanded' | 'suggestionsExpanded'
      >;
      return { ...state, [key]: !state[key] };
    default:
      return state;
  }
}

const initialState: PanelState = {
  stage: 'compose',
  selectedSuggestionIds: new Set(),
  contextExpanded: true,
  conversationExpanded: true,
  suggestionsExpanded: true,
};

// ==================== CHAT HEADER ====================
interface ChatHeaderProps {
  onClose: () => void;
}

const ChatHeader: FC<ChatHeaderProps> = ({ onClose }) => (
  <header className="ai-chat-v2-header">
    <div className="ai-chat-v2-header-content">
      <IconMagicWand size={18} />
      <span className="ai-chat-v2-header-title">AI Assistant</span>
    </div>
    <button
      className="ai-chat-v2-close"
      onClick={onClose}
      title="Close AI panel"
      type="button"
    >
      <IconX size={18} />
    </button>
  </header>
);

// ==================== INTENT SWITCHER ====================
interface IntentSwitcherProps {
  mode: AIIntent;
  onModeChange: (intent: AIIntent) => void;
  intentMeta: AIChatPanelProps['intentMeta'];
}

const IntentSwitcher: FC<IntentSwitcherProps> = ({
  mode,
  onModeChange,
  intentMeta,
}) => {
  const modeEntries = useMemo(
    () =>
      Object.entries(intentMeta) as Array<
        [AIIntent, (typeof intentMeta)[AIIntent]]
      >,
    [intentMeta],
  );

  return (
    <div className="ai-chat-v2-intent-switcher">
      {modeEntries.map(([intentKey, metadata]) => (
        <button
          className={
            intentKey === mode
              ? 'ai-chat-v2-intent-btn is-active'
              : 'ai-chat-v2-intent-btn'
          }
          key={intentKey}
          onClick={() => onModeChange(intentKey)}
          title={metadata.tagline}
          type="button"
        >
          <span className="ai-chat-v2-intent-icon">
            {intentKey === 'spark' ? '✨' : '🔍'}
          </span>
          <span className="ai-chat-v2-intent-label">{metadata.label}</span>
        </button>
      ))}
    </div>
  );
};

// ==================== COMPACT CONTEXT SECTION ====================
interface ContextSectionProps {
  node: NodeSummary | null;
  mode: AIIntent;
  intentMeta: AIChatPanelProps['intentMeta'];
  expanded: boolean;
  onToggle: () => void;
}

const ContextSection: FC<ContextSectionProps> = ({
  node,
  mode,
  intentMeta,
  expanded,
  onToggle,
}) => {
  const activeIntentMeta = intentMeta[mode];
  const statusBadge = node?.statusLabel
    ? {
        label: node.statusLabel,
        color: node.statusColor ?? '#334155',
        icon: node.statusIcon ?? '○',
      }
    : null;

  return (
    <section className="ai-chat-v2-context-compact">
      <button
        className="ai-chat-v2-context-header"
        onClick={onToggle}
        type="button"
      >
        {node ? (
          <div className="ai-chat-v2-context-inline">
            <span className="ai-chat-v2-context-node">{node.label}</span>
            {statusBadge && (
              <span
                className="ai-chat-v2-context-status"
                style={{ color: statusBadge.color }}
              >
                {statusBadge.icon}
              </span>
            )}
            <span className="ai-chat-v2-context-mode">
              {mode === 'spark' ? '✨' : '🔍'}
            </span>
          </div>
        ) : (
          <span className="ai-chat-v2-context-empty">Select a node</span>
        )}
        <span className="ai-chat-v2-context-toggle">
          {expanded ? <IconCollapse size={14} /> : <IconExpand size={14} />}
        </span>
      </button>
      {expanded && node && (
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
      )}
    </section>
  );
};

// ==================== TRANSCRIPT ====================
interface TranscriptProps {
  messages: ChatMessage[];
  expanded: boolean;
  onToggle: () => void;
}

const Transcript: FC<TranscriptProps> = ({ messages, expanded, onToggle }) => {
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
    <section className="ai-chat-v2-section ai-chat-v2-conversation">
      <button
        className="ai-chat-v2-section-header"
        onClick={onToggle}
        type="button"
      >
        <span className="ai-chat-v2-section-title">
          Conversation {sortedMessages.length > 0 && `(${sortedMessages.length})`}
        </span>
        <span className="ai-chat-v2-section-toggle">
          {expanded ? <IconCollapse size={16} /> : <IconExpand size={16} />}
        </span>
      </button>
      {expanded && (
        <div className="ai-chat-v2-section-body">
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
                    <div className="ai-chat-v2-message-text">{message.content}</div>
                    {message.suggestion && message.suggestion.status !== 'pending' && (
                      <div className="ai-chat-v2-message-status">
                        {message.suggestion.status === 'accepted' ? '✓ Applied' : '✗ Rejected'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

// ==================== COMPOSER ====================
interface ComposerProps {
  node: NodeSummary | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
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
        <textarea
          className="ai-chat-v2-textarea-compact"
          disabled={!hasNode || phase === 'loading'}
          id={textareaId}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={hasNode ? 'What do you need?' : 'Select a node'}
          rows={2}
          value={draft}
        />
        <button
          className="ai-chat-v2-send-btn"
          disabled={!hasNode || phase === 'loading' || draft.trim().length === 0}
          type="submit"
        >
          {phase === 'loading' ? 'Generating...' : 'Generate'}
        </button>
      </form>
    </div>
  );
};

// ==================== SUGGESTION REVIEW ====================
interface SuggestionReviewProps {
  latestSuggestion: { message: ChatMessage; suggestion: ChatSuggestion } | null;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onAdd: () => void;
  onReplace: () => void;
  onReject: () => void;
  phase: PanelPhase;
  expanded: boolean;
  onToggle: () => void;
  intentMeta: AIChatPanelProps['intentMeta'];
}

const SuggestionReview: FC<SuggestionReviewProps> = ({
  latestSuggestion,
  selectedIds,
  onToggleSelection,
  onAdd,
  onReplace,
  onReject,
  phase,
  expanded,
  onToggle,
  intentMeta,
}) => {
  if (!latestSuggestion) return null;

  const { message, suggestion } = latestSuggestion;
  const selectedCount = selectedIds.size;
  const totalCount = suggestion.additions.length;
  const activeIntent = suggestion.intent || 'spark';
  const meta = intentMeta[activeIntent];

  return (
    <section className="ai-chat-v2-section ai-chat-v2-suggestions">
      <button
        className="ai-chat-v2-section-header"
        onClick={onToggle}
        type="button"
      >
        <span className="ai-chat-v2-section-title">
          Apply Suggestions ({selectedCount}/{totalCount})
        </span>
        <span className="ai-chat-v2-section-toggle">
          {expanded ? <IconCollapse size={16} /> : <IconExpand size={16} />}
        </span>
      </button>
      {expanded && (
        <div className="ai-chat-v2-section-body">
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
                    <div className="ai-chat-v2-suggestion-diff">
                      <span className="ai-chat-v2-diff-label">+ Add to map</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="ai-chat-v2-suggestion-actions">
            <button
              className="ai-chat-v2-action-btn ai-chat-v2-action-primary"
              disabled={phase === 'loading' || selectedCount === 0}
              onClick={onAdd}
              type="button"
            >
              {meta.addLabel} ({selectedCount})
            </button>
            <button
              className="ai-chat-v2-action-btn ai-chat-v2-action-secondary"
              disabled={phase === 'loading' || selectedCount === 0}
              onClick={onReplace}
              type="button"
            >
              {meta.replaceLabel}
            </button>
            <button
              className="ai-chat-v2-action-btn ai-chat-v2-action-ghost"
              disabled={phase === 'loading'}
              onClick={onReject}
              type="button"
            >
              Reject
            </button>
          </div>
        </div>
      )}
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
  const latestPendingSuggestion = useMemo(() => {
    for (let i = sortedMessages.length - 1; i >= 0; i--) {
      const msg = sortedMessages[i];
      if (msg.suggestion && msg.suggestion.status === 'pending') {
        return { message: msg, suggestion: msg.suggestion };
      }
    }
    return null;
  }, [sortedMessages]);

  // Auto-transition to review when new suggestion appears
  useEffect(() => {
    if (latestPendingSuggestion) {
      const suggestionIds = latestPendingSuggestion.suggestion.additions.map(
        (_, idx) => `${latestPendingSuggestion.message.id}-${idx}`,
      );
      dispatch({ type: 'START_REVIEW', suggestionIds });
    } else {
      dispatch({ type: 'RESET_TO_COMPOSE' });
    }
  }, [latestPendingSuggestion?.message.id]);

  // Reset on node change
  useEffect(() => {
    setDraft('');
    dispatch({ type: 'RESET_TO_COMPOSE' });
  }, [node?.id, isOpen]);

  // Auto-scroll
  useEffect(() => {
    if (!isOpen || !scrollContainerRef.current) return;
    const element = scrollContainerRef.current;
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

  const handleAddSuggestions = () => {
    if (!latestPendingSuggestion) return;
    dispatch({ type: 'APPLY_SUGGESTIONS' });
    onAddSuggestion?.(latestPendingSuggestion.message.id);
  };

  const handleReplaceSuggestions = () => {
    if (!latestPendingSuggestion) return;
    dispatch({ type: 'APPLY_SUGGESTIONS' });
    onReplaceSuggestion?.(latestPendingSuggestion.message.id);
  };

  const handleRejectSuggestions = () => {
    if (!latestPendingSuggestion) return;
    onRejectSuggestion?.(latestPendingSuggestion.message.id);
    dispatch({ type: 'RESET_TO_COMPOSE' });
  };

  if (!isOpen) return null;

  return (
    <aside aria-label="AI assistant panel" className="ai-chat-panel-v2">
      <ChatHeader onClose={onClose} />

      {/* Super compact sticky context */}
      <ContextSection
        expanded={state.contextExpanded}
        intentMeta={intentMeta}
        mode={mode}
        node={node}
        onToggle={() => dispatch({ type: 'TOGGLE_SECTION', section: 'context' })}
      />

      <div className="ai-chat-v2-scroll" ref={scrollContainerRef}>
        {/* Generated nodes section - middle */}
        {latestPendingSuggestion && (
          <SuggestionReview
            expanded={state.suggestionsExpanded}
            intentMeta={intentMeta}
            latestSuggestion={latestPendingSuggestion}
            onAdd={handleAddSuggestions}
            onReject={handleRejectSuggestions}
            onReplace={handleReplaceSuggestions}
            onToggle={() =>
              dispatch({ type: 'TOGGLE_SECTION', section: 'suggestions' })
            }
            onToggleSelection={(id) =>
              dispatch({ type: 'TOGGLE_SUGGESTION', id })
            }
            phase={phase}
            selectedIds={state.selectedSuggestionIds}
          />
        )}

        {/* Conversation history - bottom */}
        <Transcript
          expanded={state.conversationExpanded}
          messages={sortedMessages}
          onToggle={() =>
            dispatch({ type: 'TOGGLE_SECTION', section: 'conversation' })
          }
        />
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
