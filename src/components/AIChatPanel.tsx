import {
  type FC,
  type FormEvent,
  useEffect,
  useId,
  useMemo,
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
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());
  const [refinementPrompt, setRefinementPrompt] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const generateTextareaId = useId();
  const refinementTextareaId = useId();

  const modeEntries = useMemo(
    () =>
      Object.entries(intentMeta) as Array<
        [AIIntent, (typeof intentMeta)[AIIntent]]
      >,
    [intentMeta],
  );
  const activeIntentMeta = intentMeta[mode];

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          (a.createdAt ?? Number.MIN_SAFE_INTEGER) -
          (b.createdAt ?? Number.MIN_SAFE_INTEGER),
      ),
    [messages],
  );

  // Find the latest pending suggestion
  const latestPendingSuggestion = useMemo(() => {
    for (let i = sortedMessages.length - 1; i >= 0; i--) {
      const msg = sortedMessages[i];
      if (msg.suggestion && msg.suggestion.status === 'pending') {
        return { message: msg, suggestion: msg.suggestion };
      }
    }
    return null;
  }, [sortedMessages]);

  // Auto-select all suggestions when new pending suggestion appears
  useEffect(() => {
    if (latestPendingSuggestion) {
      const newIds = new Set(
        latestPendingSuggestion.suggestion.additions.map((_, idx) =>
          `${latestPendingSuggestion.message.id}-${idx}`
        )
      );
      setSelectedSuggestionIds(newIds);
      setRefinementPrompt('');
    }
  }, [latestPendingSuggestion?.message.id]);

  // Reset on node change
  useEffect(() => {
    setDraft('');
    setRefinementPrompt('');
  }, [node?.id, isOpen]);

  const hasMessages = sortedMessages.length > 0;
  const hasNode = Boolean(node);
  const isReviewMode = Boolean(latestPendingSuggestion);
  const showQuickActions = hasNode && !hasMessages && quickActions.length > 0;

  const statusBadge = node?.statusLabel
    ? {
        label: node.statusLabel,
        color: node.statusColor ?? '#334155',
        icon: node.statusIcon ?? '○',
      }
    : null;

  const selectedCount = selectedSuggestionIds.size;
  const totalCount = latestPendingSuggestion?.suggestion.additions.length ?? 0;

  const submitGenerate = () => {
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

  const submitRefinement = () => {
    if (!hasNode || phase === 'loading') {
      return;
    }
    const trimmed = refinementPrompt.trim();
    if (!trimmed) {
      return;
    }

    // Build context: include current suggestions + refinement request
    const currentSuggestions = latestPendingSuggestion?.suggestion.additions
      .map((item, idx) => `${idx + 1}. ${item.label}${item.description ? `: ${item.description}` : ''}`)
      .join('\n') ?? '';

    const contextPrompt = `Current suggestions:\n${currentSuggestions}\n\nRefinement request: ${trimmed}`;

    onSubmitMessage(contextPrompt);
    setRefinementPrompt('');
  };

  const handleGenerateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitGenerate();
  };

  const handleRefinementSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitRefinement();
  };

  const handleQuickAction = (actionId: string) => {
    if (!hasNode || phase === 'loading') {
      return;
    }
    onSelectQuickAction(actionId);
  };

  const toggleSuggestionSelection = (suggestionId: string) => {
    setSelectedSuggestionIds(prev => {
      const next = new Set(prev);
      if (next.has(suggestionId)) {
        next.delete(suggestionId);
      } else {
        next.add(suggestionId);
      }
      return next;
    });
  };

  const handleAddSelected = () => {
    if (!latestPendingSuggestion || selectedCount === 0) {
      return;
    }
    onAddSuggestion?.(latestPendingSuggestion.message.id);
  };

  const handleStartOver = () => {
    setSelectedSuggestionIds(new Set());
    setRefinementPrompt('');
    setDraft('');
    if (latestPendingSuggestion) {
      onRejectSuggestion?.(latestPendingSuggestion.message.id);
    }
  };

  useEffect(() => {
    if (!isOpen || !scrollContainerRef.current) {
      return;
    }

    const element = scrollContainerRef.current;
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
        {/* Compact Controls - Always Visible */}
        {hasNode && (
          <section className="ai-chat-controls">
            <div className="ai-chat-mode-chips">
              {modeEntries.map(([intentKey, metadata]) => (
                <button
                  className={
                    intentKey === mode
                      ? 'ai-chat-mode-chip is-active'
                      : 'ai-chat-mode-chip'
                  }
                  key={intentKey}
                  onClick={() => onModeChange(intentKey)}
                  title={metadata.tagline}
                  type="button"
                >
                  {intentKey === 'spark' ? '✨' : '🔍'}
                  {metadata.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Conversation History - Compact */}
        {hasMessages && (
          <section className="ai-chat-history">
            <div className="ai-chat-history-list">
              {sortedMessages.map((message) => (
                <div
                  className={`ai-chat-history-item ${message.role}`}
                  key={message.id}
                >
                  <div className="ai-chat-history-bubble">
                    <p className="ai-chat-history-text">{message.content}</p>
                    {message.suggestion && message.suggestion.status !== 'pending' && (
                      <span className="ai-chat-history-badge">
                        {message.suggestion.status === 'accepted' ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Generate Panel - Compact */}
        {!isReviewMode && (
          <section className="ai-chat-generate-panel">
            {showQuickActions && (
              <div className="ai-chat-chip-row">
                {quickActions.map((prompt) => (
                  <button
                    className="ai-chat-chip-compact"
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
            )}

            <form className="ai-chat-generate-form" onSubmit={handleGenerateSubmit}>
              <textarea
                className="ai-chat-textarea"
                disabled={!hasNode || phase === 'loading'}
                id={generateTextareaId}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  hasNode
                    ? 'Describe what you need...'
                    : 'Select a node to start'
                }
                rows={2}
                value={draft}
              />
              <button
                className="ai-chat-btn-primary"
                disabled={!hasNode || phase === 'loading' || draft.trim().length === 0}
                type="submit"
              >
                {phase === 'loading' ? 'Generating...' : 'Generate'}
              </button>
            </form>

            {phase === 'loading' && (
              <div className="ai-chat-loading-compact">
                <div className="ai-chat-loading-spinner" />
                <span>Generating...</span>
              </div>
            )}

            {phase === 'error' && (
              <div className="ai-chat-error-compact">
                <span>⚠ Error. Try again.</span>
              </div>
            )}
          </section>
        )}

        {/* Review Panel - Compact */}
        {isReviewMode && (
          <section className="ai-chat-review-panel">
            <div className="ai-chat-review-count">
              {selectedCount} of {totalCount} selected
            </div>

            <div className="ai-chat-selection-list">
              {latestPendingSuggestion.suggestion.additions.map((item, idx) => {
                const itemId = `${latestPendingSuggestion.message.id}-${idx}`;
                const isSelected = selectedSuggestionIds.has(itemId);

                return (
                  <label
                    className={
                      isSelected
                        ? 'ai-chat-selection-item is-selected'
                        : 'ai-chat-selection-item'
                    }
                    key={itemId}
                  >
                    <input
                      checked={isSelected}
                      className="ai-chat-selection-checkbox"
                      onChange={() => toggleSuggestionSelection(itemId)}
                      type="checkbox"
                    />
                    <div className="ai-chat-selection-content">
                      {item.emoji && (
                        <span className="ai-chat-selection-emoji">{item.emoji}</span>
                      )}
                      <strong>{item.label}</strong>
                      {item.description && (
                        <p className="ai-chat-selection-desc">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <form className="ai-chat-refinement-form" onSubmit={handleRefinementSubmit}>
              <textarea
                className="ai-chat-textarea"
                disabled={phase === 'loading'}
                id={refinementTextareaId}
                onChange={(event) => setRefinementPrompt(event.target.value)}
                placeholder='Refine: "remove last two", "more technical"...'
                rows={2}
                value={refinementPrompt}
              />
              <div className="ai-chat-review-actions">
                <button
                  className="ai-chat-btn-secondary"
                  disabled={phase === 'loading' || refinementPrompt.trim().length === 0}
                  type="submit"
                >
                  {phase === 'loading' ? 'Refining...' : 'Refine'}
                </button>
                <button
                  className="ai-chat-btn-primary"
                  disabled={phase === 'loading' || selectedCount === 0}
                  onClick={handleAddSelected}
                  type="button"
                >
                  Add ({selectedCount})
                </button>
                <button
                  className="ai-chat-btn-ghost-compact"
                  disabled={phase === 'loading'}
                  onClick={handleStartOver}
                  type="button"
                >
                  ×
                </button>
              </div>
            </form>

            {phase === 'loading' && (
              <div className="ai-chat-loading-compact">
                <div className="ai-chat-loading-spinner" />
                <span>Refining...</span>
              </div>
            )}
          </section>
        )}
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
