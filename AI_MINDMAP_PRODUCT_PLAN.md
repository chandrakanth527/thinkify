# AI-Powered Mindmap Tool - Product Plan

## Executive Summary

A mindmap tool that transforms problem-solving by breaking down complex tasks into structured, AI-generated hierarchies. Users start with a goal, the AI suggests a workflow structure, and each node can be expanded iteratively with context-aware content generation.

---

## Core Concept

### The Problem

- Open-ended AI instructions lead to overwhelming, broad results
- Too-narrow instructions miss critical context
- Need for **structured, incremental problem-solving** with AI assistance

### The Solution

A mindmap where:

1. **User defines the goal** (write a book, build an app, create a video)
2. **AI generates workflow nodes** (research → outline → draft → review)
3. **Each node can expand** with detailed, context-aware sub-nodes
4. **Content flows forward** - each node uses parent + sibling context

---

## User Journey

### 1. Starting a Project

```
User Action: Creates root node "Write a Book about AI Ethics"
AI Response: Suggests workflow structure
  → Research Phase
  → Content Planning
  → Writing
  → Review & Polish
```

### 2. Expanding a Node

```
User Action: Clicks "expand" on "Research Phase"
AI Response: Generates research sub-tasks
  → Literature Review
  → Expert Interviews
  → Case Studies
  → Ethical Frameworks Analysis

Each child node contains:
- Title: "Literature Review"
- Instructions: "Search academic papers on AI ethics from 2020-2024"
- Status: "pending" | "in-progress" | "completed"
- Output: (populated when AI executes)
```

### 3. Executing a Node

````
User Action: Clicks "execute" on "Literature Review" node
AI Behavior:
  1. Reads parent context ("Research Phase for AI Ethics book")
  2. Reads sibling context (other research tasks)
  3. Reads global context (root goal)
  4. Executes the task
  5. Stores output in node.output
  6. Updates status to "completed"
```maybe

### 4. Iterative Refinement
````

User Action: Sees output, clicks "refine" or "expand further"
AI Response: Adds more specific sub-nodes or regenerates content

````

---

## Data Structure

### Node Schema
```typescript
interface AINode {
  id: string;
  label: string;
  level: number;

  // AI-specific fields
  nodeType: 'goal' | 'phase' | 'task' | 'subtask';

  // Instructions for this node
  prompt: string;  // What should AI do for this node

  // Execution state
  status: 'pending' | 'in-progress' | 'completed' | 'error';

  // Results
  output?: {
    content: string;      // Main output
    artifacts?: string[]; // Files, code, etc.
    metadata?: {
      model: string;
      timestamp: string;
      tokensUsed: number;
    };
  };

  // Context configuration
  contextStrategy: 'inherit-all' | 'siblings-only' | 'parent-only' | 'isolated';

  // User customization
  aiModel?: 'gpt-4' | 'claude' | 'custom';
  temperature?: number;
  maxTokens?: number;

  // Visual
  color?: string;
  emoji?: string;
  collapsed?: boolean;
}
````

---

## Core Features

### 1. **Smart Node Generation** (Auto-Expand)

#### User Experience:

- Right-click node → "Generate Children" or click "🪄 Expand" button
- AI analyzes the node and suggests logical sub-nodes
- User can accept all, cherry-pick, or regenerate

#### Implementation:

```typescript
interface NodeExpansionRequest {
  nodeId: string;
  expansionType: "workflow" | "breakdown" | "detailed-steps";
  count?: number; // How many children (default: auto)
  customPrompt?: string; // Override default expansion logic
}

// Example prompt to AI:
`
Context: User is working on "${rootNode.label}"
Current phase: "${currentNode.label}"
Instructions: "${currentNode.prompt}"

Task: Generate ${count || "3-7"} logical sub-nodes that break down this phase.
For each sub-node provide:
1. Title (concise, action-oriented)
2. Prompt (clear instructions for what this node should accomplish)
3. Expected output type (text, code, list, etc.)

Format as JSON array.
`;
```

#### Expansion Strategies:

**A. Workflow Expansion** (for high-level phases)

```
Input: "Research Phase"
Output:
  → Gather Information
  → Analyze Findings
  → Synthesize Insights
  → Document Results
```

**B. Breakdown Expansion** (for concrete tasks)

```
Input: "Write Chapter 1"
Output:
  → Introduction Hook
  → Main Argument
  → Supporting Evidence
  → Conclusion
```

**C. Detailed Steps** (for execution)

```
Input: "Build User Authentication"
Output:
  → Design Database Schema
  → Implement JWT Token System
  → Create Login API Endpoint
  → Add Password Hashing
  → Write Tests
```

---

### 2. **Context-Aware Execution**

#### Context Flow:

```
Root Goal: "Build a SaaS App"
  ↓
Phase: "Backend Development"
  ↓  (inherits: root goal context)
Task: "Design Database"
  ↓  (inherits: root + phase context)
Subtask: "Create User Table Schema"
  ← (also reads: sibling context from "Create Posts Table")
```

#### Context Building Algorithm:

```typescript
function buildContext(node: AINode): string {
  const contexts: string[] = [];

  // 1. Root goal (always included)
  const root = findRootNode(node);
  contexts.push(`Project Goal: ${root.label}\n${root.prompt}`);

  // 2. Ancestor chain (parent → grandparent → ...)
  const ancestors = getAncestors(node);
  ancestors.reverse().forEach((ancestor) => {
    contexts.push(`Phase: ${ancestor.label}\nInstructions: ${ancestor.prompt}`);
    if (ancestor.output) {
      contexts.push(
        `Previous Output:\n${ancestor.output.content.substring(0, 500)}...`
      );
    }
  });

  // 3. Sibling context (for parallel tasks)
  const siblings = getSiblings(node);
  siblings.forEach((sibling) => {
    if (sibling.status === "completed" && sibling.output) {
      contexts.push(
        `Related Work (${sibling.label}):\n${sibling.output.content.substring(
          0,
          300
        )}...`
      );
    }
  });

  // 4. Current node
  contexts.push(`Current Task: ${node.label}\nInstructions: ${node.prompt}`);

  return contexts.join("\n\n---\n\n");
}
```

---

### 3. **Execution Modes**

#### Mode A: **Single Node Execution**

- User clicks "▶ Execute" on one node
- AI processes just that node with full context
- Output appears in node card

#### Mode B: **Sequential Execution**

- User clicks "▶▶ Execute Children" on parent
- AI executes children left-to-right (or top-to-bottom)
- Each child uses previous sibling outputs
- Progress bar shows execution status

#### Mode C: **Batch Execution**

- User selects multiple nodes → "Execute Selected"
- AI processes in dependency order
- Useful for regenerating a section

#### Mode D: **Watch Mode** (Advanced)

- User clicks "👁 Watch" on a node
- As parent/sibling nodes complete, this node auto-executes
- Enables true "flow" execution

---

### 4. **Node Templates** (for Common Workflows)

#### Template System:

User selects from pre-built templates when creating a node:

**Book Writing Template:**

```yaml
name: "Write a Book"
structure:
  - Research Phase:
      children:
        - Literature Review
        - Expert Interviews
        - Case Studies
  - Content Planning:
      children:
        - Target Audience Analysis
        - Chapter Outline
        - Key Messages
  - Writing:
      children:
        - Chapter 1
        - Chapter 2
        - ...
  - Review:
      children:
        - Self-Edit
        - Peer Review
        - Professional Edit
```

**Software Development Template:**

```yaml
name: "Build a Feature"
structure:
  - Research & Planning:
      children:
        - Requirements Gathering
        - Technical Design
        - Database Schema
  - Implementation:
      children:
        - Backend API
        - Frontend UI
        - Integration
  - Quality Assurance:
      children:
        - Unit Tests
        - Integration Tests
        - Manual QA
  - Deployment:
      children:
        - CI/CD Setup
        - Production Deploy
        - Monitoring
```

**Video Production Template:**

```yaml
name: "Create a Video"
structure:
  - Pre-Production:
      children:
        - Script Writing
        - Storyboarding
        - Asset Gathering
  - Production:
      children:
        - Record A-Roll
        - Record B-Roll
        - Voice Over
  - Post-Production:
      children:
        - Video Editing
        - Color Grading
        - Sound Mixing
  - Distribution:
      children:
        - Export & Upload
        - Thumbnail Creation
        - Description & Tags
```

---

## UI/UX Design

### Node Visual States

#### Pending Node:

```
┌─────────────────────────────┐
│ 📝 Literature Review        │
│ Status: ⚪ Pending          │
│                             │
│ [🪄 Expand] [▶ Execute]    │
└─────────────────────────────┘
```

#### In-Progress Node:

```
┌─────────────────────────────┐
│ 📝 Literature Review        │
│ Status: 🔵 In Progress...   │
│                             │
│ [⏸ Pause] [⏹ Stop]         │
└─────────────────────────────┘
```

#### Completed Node:

```
┌─────────────────────────────┐
│ ✅ Literature Review         │
│ Status: 🟢 Completed        │
│                             │
│ [📄 View Output] [🔄 Redo]  │
│ [🪄 Expand Further]          │
└─────────────────────────────┘
```

#### Expanded Node with Output:

```
┌─────────────────────────────────────────┐
│ ✅ Literature Review                     │
│ Status: 🟢 Completed | 2.3k tokens      │
├─────────────────────────────────────────┤
│ Output Preview:                         │
│ "Found 47 relevant papers on AI ethics  │
│ from 2020-2024. Key themes: bias in ML, │
│ privacy concerns, autonomous decision... │
│                                         │
│ [📖 Read Full Output]                   │
│                                         │
│ Actions:                                │
│ [🪄 Expand] [🔄 Regenerate] [✏️ Edit]   │
│ [💾 Export] [🔗 Share]                  │
└─────────────────────────────────────────┘
```

---

### Floating Action Menu (on node selection)

```
┌──────────────────────────┐
│ 🪄 Generate Children     │  ← Smart expand
│ ▶  Execute This Node     │  ← Run AI on this node
│ 👥 Execute All Children  │  ← Sequential execution
│ 📝 Edit Instructions     │  ← Modify prompt
│ ⚙️  Configure AI         │  ← Model, temp, etc.
│ 📋 Duplicate             │
│ 🗑️  Delete               │
└──────────────────────────┘
```

---

### Main Toolbar (Global Actions)

```
┌─────────────────────────────────────────────────────┐
│ [📄 New Project ▼] [💾 Save] [📤 Export]           │
│                                                      │
│ Templates: [📚 Book] [💻 Code] [🎬 Video] [➕ Custom]│
│                                                      │
│ AI: [🤖 GPT-4 ▼] [🔥 Temp: 0.7] [💬 Max: 4000]    │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Core Structure (Week 1-2)

- [ ] Extend node data model with AI fields
- [ ] Add node type badges (goal/phase/task/subtask)
- [ ] Implement prompt/instructions field in node
- [ ] Add status indicator to nodes
- [ ] Create output storage system

### Phase 2: Single Node Generation (Week 3-4)

- [ ] "Generate Children" button on nodes
- [ ] AI integration for node expansion
- [ ] Preview generated nodes before adding
- [ ] Accept/Reject/Regenerate UI
- [ ] Template system (3-5 common templates)

### Phase 3: Execution System (Week 5-6)

- [ ] "Execute Node" functionality
- [ ] Context builder algorithm
- [ ] Output display in node card
- [ ] Status management (pending → in-progress → completed)
- [ ] Error handling & retry

### Phase 4: Advanced Features (Week 7-8)

- [ ] Sequential execution mode
- [ ] Batch execution
- [ ] Output preview/full view modal
- [ ] Export outputs (PDF, Markdown, JSON)
- [ ] Node cloning & templates

### Phase 5: Polish & UX (Week 9-10)

- [ ] Animated transitions for execution
- [ ] Progress indicators
- [ ] Keyboard shortcuts
- [ ] Onboarding tutorial
- [ ] Example projects gallery

---

## Technical Architecture

### AI Integration Layer

```typescript
// ai-service.ts
interface AIService {
  // Generate child nodes for a parent
  generateChildren(
    node: AINode,
    context: ProjectContext,
    options: GenerationOptions
  ): Promise<AINode[]>;

  // Execute a single node
  executeNode(node: AINode, context: ProjectContext): Promise<NodeOutput>;

  // Validate/improve a prompt
  optimizePrompt(prompt: string, nodeType: NodeType): Promise<string>;
}

// Example implementation
class OpenAIService implements AIService {
  async generateChildren(node, context, options) {
    const prompt = buildGenerationPrompt(node, context, options);
    const response = await openai.chat.completions.create({
      model: options.model || "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    return parseGeneratedNodes(response.choices[0].message.content);
  }

  async executeNode(node, context) {
    const fullContext = buildContext(node);
    const response = await openai.chat.completions.create({
      model: node.aiModel || "gpt-4",
      messages: [{ role: "user", content: fullContext }],
      temperature: node.temperature || 0.7,
      max_tokens: node.maxTokens || 4000,
    });

    return {
      content: response.choices[0].message.content,
      metadata: {
        model: response.model,
        timestamp: new Date().toISOString(),
        tokensUsed: response.usage.total_tokens,
      },
    };
  }
}
```

---

## User Scenarios

### Scenario 1: Writing a Technical Blog Post

```
1. User creates root: "Write blog post about React Server Components"

2. AI suggests structure:
   - Research
   - Outline
   - Draft
   - Code Examples
   - Conclusion

3. User expands "Research":
   - AI generates:
     * Review React docs
     * Study existing articles
     * Test RSC in demo app
     * Gather performance data

4. User clicks "Execute All Children" under Research:
   - AI executes each sequentially
   - Each task builds on previous
   - Outputs stored in nodes

5. User moves to "Draft":
   - AI uses research outputs
   - Generates blog post sections

6. User expands "Code Examples":
   - AI creates:
     * Basic RSC example
     * Data fetching example
     * Streaming example
   - Each uses blog context

7. Final result: Complete blog post with code examples
```

### Scenario 2: Building a Feature

```
1. Root: "Add user notification system"

2. AI structure:
   - Database Design
   - Backend API
   - Frontend UI
   - Testing

3. User expands "Database Design":
   - Create notifications table
   - Create user_preferences table
   - Set up indexes

4. Execute "Create notifications table":
   - AI generates SQL schema
   - User reviews, tweaks
   - Marks complete

5. Backend API automatically uses DB schema:
   - Create notification endpoint
   - Update notification endpoint
   - Get notifications endpoint
   - Mark as read endpoint

6. Frontend reads API structure:
   - Notification component
   - Notification list
   - Notification settings
```

---

## Key Differentiators

### vs Traditional Mindmaps:

- ✅ **AI-powered generation** (not manual)
- ✅ **Executable nodes** (not just planning)
- ✅ **Context-aware** (each node knows project state)
- ✅ **Iterative refinement** (regenerate, expand, modify)

### vs Chat Interfaces:

- ✅ **Structured** (not linear conversation)
- ✅ **Visual hierarchy** (see entire project)
- ✅ **Parallel workstreams** (multiple branches)
- ✅ **Reusable** (save, template, replay)

### vs Project Management Tools:

- ✅ **AI-assisted** (not manual task creation)
- ✅ **Content generation** (not just tracking)
- ✅ **Adaptive** (structure evolves with project)

---

## Success Metrics

### User Engagement:

- Average nodes per project
- Time from creation to first execution
- Expansion depth (how deep trees go)
- Regeneration rate (user satisfaction indicator)

### AI Performance:

- Execution success rate
- Average output quality (user ratings)
- Context relevance score
- Token efficiency

### Business:

- Projects completed
- Template usage rate
- Export frequency (sharing indicator)
- Return user rate

---

## Future Enhancements

### Phase 2+ Features:

1. **Collaborative Mode**

   - Multi-user editing
   - Assign nodes to team members
   - Comment threads on nodes

2. **Smart Dependencies**

   - Mark node B as "blocked by" node A
   - Auto-execute when dependencies complete
   - Visualize dependency graph

3. **Version Control**

   - Track node output history
   - Revert to previous versions
   - Branch & merge projects

4. **Plugin System**

   - Custom AI models
   - External tool integrations (GitHub, Figma, etc.)
   - Custom node types

5. **Learning Mode**
   - AI learns from user corrections
   - Personalized templates
   - Project pattern recognition

---

## Risk & Mitigation

### Risk 1: AI Hallucination

**Mitigation:**

- Show confidence scores
- Allow user review before accepting
- Provide "regenerate" option
- Keep human in the loop

### Risk 2: Context Overload

**Mitigation:**

- Smart context summarization
- Token limit warnings
- Configurable context depth
- Cache common contexts

### Risk 3: Complexity Overwhelm

**Mitigation:**

- Start with simple templates
- Progressive disclosure (hide advanced features)
- Interactive tutorial
- Example gallery

### Risk 4: Cost (AI API usage)

**Mitigation:**

- Local model support
- Token budgets per project
- Caching & deduplication
- Batch operations

---

## Conclusion

This AI-powered mindmap tool bridges the gap between open-ended AI chat and rigid project management. It provides:

- **Structure** without rigidity
- **AI assistance** without loss of control
- **Scalability** from simple tasks to complex projects
- **Simplicity** in UX despite powerful features

The key innovation is **context-aware hierarchical execution** - each node knows its place in the project and uses that knowledge to generate better results.

### Next Steps:

1. Review & refine this plan
2. Create UI mockups
3. Build Phase 1 prototype
4. Test with real use cases
5. Iterate based on feedback

---

**Questions for Discussion:**

1. Should templates be user-editable or fixed?
2. How to handle very large projects (100+ nodes)?
3. Should we support multiple AI providers from day 1?
4. What's the right balance of automation vs. manual control?
5. How to monetize (per-token, subscription, freemium)?
