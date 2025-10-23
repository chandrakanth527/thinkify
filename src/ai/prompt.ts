import type { MindmapContextPayload } from './types';

const INTENT_CONFIG = {
  spark: {
    system: `You are an ideation assistant inside a collaborative mindmap.
Return only JSON matching the provided schema.
Focus on:
- Generating distinct ideas or answers for the selected node
- Keep titles under 8 words and optional descriptions under 35 words
- Avoid duplicates or restating existing siblings
- Suggest up to 5 ideas per response
If the user asks for replacement ideas, ensure they differ significantly from current children.
If nothing meaningful comes to mind, return an empty additions array with a short summary explaining why.`,
    defaultObjective:
      'Provide a concise list of new idea candidates that the user could adopt for this node.',
    defaultTask: 'Suggest impactful ideas for the selected node.',
    quickObjectives: {
      children:
        'Propose 3-5 high-impact idea candidates tailored to the selected node.',
      expand:
        'Offer varied idea angles that broaden the creative direction of this node.',
      replace:
        'Generate a refreshed batch of 3-5 idea candidates that differ from the existing ones.',
    } satisfies Record<string, string>,
  },
  deepen: {
    system: `You are a planning assistant inside a collaborative mindmap.
Return only JSON matching the provided schema.
Focus on:
- Identifying research axes, subtasks, or structural components beneath the selected node
- Keep titles under 8 words and optional descriptions under 45 words
- Provide up to 6 subtopics that help develop the branch comprehensively
- Avoid duplicating existing child nodes; suggest what's missing
If nothing meaningful can be added right now, return an empty additions array with a short summary explaining why.`,
    defaultObjective:
      'Outline the key subtopics, research areas, or tasks needed to develop this branch.',
    defaultTask:
      'Suggest actionable child nodes that deepen the structure of this branch.',
    quickObjectives: {
      children:
        'List 3-6 foundational subtopics that should exist beneath this node.',
      expand:
        'Provide a mix of research, planning, and execution tasks to flesh out this branch.',
      replace:
        'Recommend an improved set of child nodes to replace the current structure.',
    } satisfies Record<string, string>,
  },
} as const;

const sanitize = (value?: string) => value?.trim().replace(/\s+/g, ' ') ?? '';

const formatEntry = (
  label: string,
  description?: string,
  extras?: string[],
) => {
  const details = [sanitize(description), ...(extras ?? [])]
    .filter(Boolean)
    .join(' — ');
  return details ? `${label}: ${details}` : label;
};

const summarizeEntries = (
  title: string,
  entries: Array<{ label: string; description?: string; extras?: string[] }>,
) => {
  if (entries.length === 0) {
    return `${title}: (none)`;
  }

  return `${title}:\n${entries
    .map(
      (entry) =>
        `- ${formatEntry(entry.label, entry.description, entry.extras)}`,
    )
    .join('\n')}`;
};

export const buildMindmapPrompt = (context: MindmapContextPayload) => {
  const lineageSummary = summarizeEntries(
    'Lineage to root',
    context.lineage.map((entry) => ({
      label: `Level ${entry.level} — ${entry.label}`,
      description: entry.description,
    })),
  );

  const siblingsSummary = summarizeEntries(
    'Siblings',
    context.siblings.map((entry) => ({
      label: entry.label,
      description: entry.description,
      extras: [
        entry.status ? `status: ${entry.status}` : undefined,
        entry.emoji ? `emoji: ${entry.emoji}` : undefined,
      ],
    })),
  );

  const childrenSummary = summarizeEntries(
    'Existing children',
    context.children.map((entry) => ({
      label: entry.label,
      description: entry.description,
      extras: entry.status ? [`status: ${entry.status}`] : undefined,
    })),
  );

  const intentConfig = INTENT_CONFIG[context.intent];
  const quickObjective =
    intentConfig.quickObjectives[context.quickActionId ?? ''] ?? null;

  const baseObjective = context.manualPrompt
    ? 'Address the user request while keeping suggestions grounded in the mindmap context.'
    : (quickObjective ?? intentConfig.defaultObjective);

  const userTask = context.manualPrompt
    ? context.manualPrompt
    : (quickObjective ?? intentConfig.defaultTask);

  const conversationTail = context.conversationSummary
    ? `Recent context:
${context.conversationSummary}`
    : null;

  const userPrompt = `Mindmap snapshot:
Primary node: ${context.selectedLabel} (level ${context.selectedLevel})
Description: ${sanitize(context.selectedDescription) || '(empty)'}
${lineageSummary}
${siblingsSummary}
${childrenSummary}

Objective: ${baseObjective}
Task: ${userTask}
${conversationTail ? `\n${conversationTail}\n` : ''}
Respond with actionable updates that keep the mindmap balanced.`;

  const systemPrompt = intentConfig.system;

  return {
    systemPrompt,
    userPrompt,
  };
};
