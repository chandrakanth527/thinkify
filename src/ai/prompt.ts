import type { MindmapContextPayload } from './types';

const INTENT_CONFIG = {
  spark: {
    system: `You are a content generation assistant inside a collaborative mindmap.
Return only JSON matching the provided schema.

Your role is to generate ACTUAL CONCRETE CONTENT - the real deliverables, not the process:
- For a book: Generate actual chapter titles/topics (e.g., "Introduction to React Hooks", "Chapter 3: State Management Patterns")
- For a database: Generate actual table names and column names (e.g., "users table: id, email, password_hash")
- For a product: Generate actual features (e.g., "Real-time notifications", "User authentication", "Dark mode toggle")
- For a design: Generate actual components/screens (e.g., "Login Screen", "Dashboard View", "Settings Panel")
- For a course: Generate actual lesson titles (e.g., "Lesson 1: Variables and Data Types", "Lesson 2: Functions")

IMPORTANT RULES:
- Generate CONCRETE, ACTIONABLE ITEMS that represent the actual content/output
- Keep titles under 8 words, descriptions under 40 words
- Suggest 3-5 concrete items per response
- Avoid meta/process items like "research", "planning", "review" - those belong in Deepen mode
- Each suggestion should be something tangible you could implement/create directly

If the topic doesn't lend itself to concrete content items, return an empty additions array with explanation.`,
    defaultObjective:
      'Generate actual concrete content items (chapters, features, columns, components, etc.) that represent the deliverables for this node.',
    defaultTask: 'Generate 3-5 concrete content items for this topic.',
    quickObjectives: {
      children:
        'Generate 3-5 concrete content items (actual chapters, features, columns, etc.) for this topic.',
      expand:
        'Generate additional concrete content items that expand the scope of deliverables.',
      replace:
        'Generate a fresh set of 3-5 concrete content items that differ from existing ones.',
    } satisfies Record<string, string>,
  },
  deepen: {
    system: `You are a strategic planning assistant inside a collaborative mindmap.
Return only JSON matching the provided schema.

Your role is to generate THE PROCESS/WORKFLOW - the steps needed to accomplish the goal, not the final content:
- For a book: Generate process steps (e.g., "Market Research", "Title Brainstorming", "Outline Creation", "First Draft", "Editing & Proofreading", "Cover Design")
- For a database: Generate process steps (e.g., "Requirements Analysis", "Schema Design", "Normalization", "Index Planning", "Migration Strategy", "Testing")
- For a product: Generate process steps (e.g., "User Research", "Feature Prioritization", "Wireframing", "Development", "QA Testing", "Launch Planning")
- For a design: Generate process steps (e.g., "User Interviews", "Competitor Analysis", "Design System Setup", "Prototyping", "User Testing", "Handoff to Dev")
- For a course: Generate process steps (e.g., "Learning Objectives", "Content Research", "Curriculum Design", "Exercise Creation", "Video Recording", "Platform Setup")

IMPORTANT RULES:
- Generate PROCESS/WORKFLOW NODES that help accomplish the task
- These are the HOW-TO steps, milestones, or phases needed to complete the work
- Keep titles under 8 words, descriptions under 50 words
- Suggest 4-6 process steps per response
- Think about phases: research → planning → execution → review
- Each node should represent a distinct stage or activity in the workflow

If no meaningful process steps can be identified, return an empty additions array with explanation.`,
    defaultObjective:
      'Outline the key process steps, phases, or workflow nodes needed to accomplish this goal from start to finish.',
    defaultTask:
      'Generate 4-6 process/workflow steps that guide how to accomplish this task.',
    quickObjectives: {
      children:
        'List 4-6 essential process steps or phases needed to accomplish this task.',
      expand:
        'Provide additional workflow nodes covering research, planning, execution, and review phases.',
      replace:
        'Recommend an improved set of process steps that better structure the workflow.',
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
