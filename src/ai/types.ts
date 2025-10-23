export interface MindmapLineageEntry {
  id: string;
  label: string;
  level: number;
  description?: string;
}

export interface MindmapSiblingEntry {
  id: string;
  label: string;
  description?: string;
  status?: string;
  emoji?: string;
}

export interface MindmapChildEntry extends MindmapSiblingEntry {}

export type MindmapIntent = 'spark' | 'deepen';

export interface MindmapContextPayload {
  selectedNodeId: string;
  selectedLabel: string;
  selectedDescription?: string;
  selectedLevel: number;
  lineage: MindmapLineageEntry[];
  siblings: MindmapSiblingEntry[];
  children: MindmapChildEntry[];
  manualPrompt?: string;
  quickActionId?: string;
  conversationSummary?: string;
  intent: MindmapIntent;
}

export interface MindmapNodeDraft {
  label: string;
  description?: string;
  emphasis?: 'primary' | 'secondary' | 'stretch';
  emoji?: string;
}

export interface MindmapDescriptionUpdate {
  target: 'selected-node';
  description: string;
}

export interface MindmapAiSuggestion {
  id: string;
  summary: string;
  additions: MindmapNodeDraft[];
  updates?: MindmapDescriptionUpdate[];
  followUp?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
  model: string;
  warnings?: string[];
  appliedMode?: 'add' | 'replace';
  intent: MindmapIntent;
}

export interface MindmapAiResponsePayload {
  summary: string;
  additions: MindmapNodeDraft[];
  updates?: MindmapDescriptionUpdate[];
  followUp?: string;
  warnings?: string[];
}
