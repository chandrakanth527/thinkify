import { buildMindmapPrompt } from './prompt';
import type { MindmapAiResponsePayload, MindmapContextPayload } from './types';

const DEFAULT_MODEL = 'gpt-4o-mini';

export class MindmapAiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MindmapAiError';
  }
}

interface GenerateOptions {
  signal?: AbortSignal;
}

const responseSchema = {
  name: 'mindmap_suggestions',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'additions'],
    properties: {
      summary: {
        type: 'string',
        description: 'One-sentence recap of the assistant response.',
      },
      additions: {
        type: 'array',
        description: 'New node ideas to add as children of the selected node.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['label'],
          properties: {
            label: {
              type: 'string',
              description: 'Short node title (<= 8 words).',
            },
            description: {
              type: 'string',
              description: 'Optional supporting detail (<= 45 words).',
            },
            emphasis: {
              type: 'string',
              enum: ['primary', 'secondary', 'stretch'],
              description:
                'Optional hint for how strongly to prioritise this idea.',
            },
            emoji: {
              type: 'string',
              description: 'Optional single emoji for flair.',
              maxLength: 4,
            },
          },
        },
      },
      updates: {
        type: 'array',
        description:
          'Optional description updates for the selected node. Omit when not requested.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['target', 'description'],
          properties: {
            target: {
              type: 'string',
              const: 'selected-node',
              description: 'Currently only updates to the selected node.',
            },
            description: {
              type: 'string',
              description: 'Replacement description text.',
            },
          },
        },
      },
      follow_up: {
        type: 'string',
        description:
          'Optional suggestion for the next manual follow-up prompt.',
      },
      warnings: {
        type: 'array',
        description: 'Optional cautions about the generated output.',
        items: { type: 'string' },
      },
    },
  },
} as const;

const normalizeString = (value?: string | null) =>
  typeof value === 'string' ? value.trim() : undefined;

export const generateMindmapSuggestions = async (
  context: MindmapContextPayload,
  options: GenerateOptions = {},
): Promise<MindmapAiResponsePayload> => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new MindmapAiError(
      'No OpenAI API key found. Set VITE_OPENAI_API_KEY in your .env file.',
    );
  }

  const { systemPrompt, userPrompt } = buildMindmapPrompt(context);
  const model = import.meta.env.VITE_OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  console.groupCollapsed('[Mindmap AI] Prompt payload');
  console.info('Model:', model);
  console.info('Intent:', context.intent);
  console.info('System prompt:\n', systemPrompt);
  console.info('User prompt:\n', userPrompt);
  console.groupEnd();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: options.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: 900,
        response_format: {
          type: 'json_schema',
          json_schema: responseSchema,
        },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new MindmapAiError(
        `OpenAI request failed with status ${response.status}`,
        errorText,
      );
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new MindmapAiError('Received empty response content from OpenAI.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new MindmapAiError('Failed to parse AI response JSON.', error);
    }

    return {
      summary: normalizeString(parsed.summary) ?? 'No summary provided.',
      additions: Array.isArray(parsed.additions)
        ? parsed.additions
            .map((entry) => ({
              label: entry.label?.trim() ?? '',
              description: normalizeString(entry.description),
              emphasis: entry.emphasis,
              emoji: normalizeString(entry.emoji),
            }))
            .filter((entry) => entry.label.length > 0)
        : [],
      updates: Array.isArray(parsed.updates)
        ? parsed.updates.map((update) => ({
            target: 'selected-node' as const,
            description: normalizeString(update.description) ?? '',
          }))
        : undefined,
      followUp: normalizeString((parsed as any).follow_up ?? parsed.followUp),
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.map((warning) => warning.trim()).filter(Boolean)
        : undefined,
    };
  } catch (error) {
    if (error instanceof MindmapAiError) {
      throw error;
    }
    throw new MindmapAiError(
      'Unexpected error while contacting OpenAI.',
      error,
    );
  }
};
