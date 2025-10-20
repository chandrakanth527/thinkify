# AI Mindmap Tool - Planning & Orchestration Layer

## Core Philosophy Shift

**OLD CONCEPT:** Mindmap generates and stores content
**NEW CONCEPT:** Mindmap is the **strategic planner** that hands off to specialized tools

Think of it as:

- **Mindmap** = Project Manager / Architect
- **External Tools** = Engineers / Executors (Claude, ChatGPT, Cursor, VS Code, etc.)

---

## The New Mental Model

```
┌─────────────────────────────────────────────────────┐
│                   MINDMAP TOOL                      │
│                                                     │
│  Role: Planning, Structure, Context Management     │
│  Output: Instructions, Prompts, Context Packages   │
└─────────────────────────────────────────────────────┘
                        │
                        │ Generates prompts/instructions
                        ▼
┌─────────────────────────────────────────────────────┐
│              EXECUTION LAYER (External)             │
│                                                     │
│  • Claude Desktop (conversations)                   │
│  • ChatGPT Web                                      │
│  • Cursor AI (code)                                 │
│  • VS Code Copilot                                  │
│  • Notion AI (docs)                                 │
│  • User's preferred tool                            │
└─────────────────────────────────────────────────────┘
                        │
                        │ Results come back
                        ▼
┌─────────────────────────────────────────────────────┐
│                  USER VALIDATES                     │
│                                                     │
│  • Reviews output                                   │
│  • Marks node as complete                          │
│  • Adds notes/links                                 │
└─────────────────────────────────────────────────────┘
```

---

## What the Mindmap DOES

### 1. **Generate Smart Prompts**

Instead of executing, it creates **copy-paste ready prompts** for your AI tool of choice.

Example:

```
User creates node: "Write Chapter 1: Introduction"

Mindmap generates:
┌─────────────────────────────────────────┐
│ 📋 PROMPT FOR YOUR AI TOOL              │
├─────────────────────────────────────────┤
│ Context:                                │
│ - Book: "AI Ethics in 2024"            │
│ - Target audience: Tech professionals  │
│ - Previous research: [links to nodes]  │
│                                         │
│ Task:                                   │
│ Write Chapter 1 Introduction (500-700  │
│ words). Should hook readers with a     │
│ real-world AI ethics dilemma, then     │
│ outline the book's structure.          │
│                                         │
│ Reference material:                     │
│ - Research findings from node #3       │
│ - Outline from node #5                 │
│                                         │
│ [📋 Copy Prompt] [🚀 Open in Claude]  │
└─────────────────────────────────────────┘
```

### 2. **Maintain Context Graph**

The mindmap keeps track of:

- What's been done
- What needs to be done
- Dependencies between tasks
- Links to external outputs

### 3. **Smart Workflow Suggestions**

Based on project type, suggest logical next steps:

```
User: "Build a SaaS app"

Mindmap suggests:
├─ 📋 Requirements
│   ├─ User stories
│   ├─ Feature list
│   └─ Tech stack decisions
├─ 🎨 Design
│   ├─ Wireframes|
│   ├─ User flow
│   └─ Component design
├─ 💻 Development
│   ├─ Database schema
│   ├─ Backend API
│   └─ Frontend
└─ 🧪 Testing & Launch
    ├─ Test suite
    ├─ Deployment
    └─ Monitoring

Each node has a "Generate Prompt" button
```

### 4. **Progress Tracking**

Simple status management:

- ⚪ Not started
- 🔵 In progress (prompt copied to AI tool)
- 🟢 Completed (user confirms)
- 🔴 Blocked/Issues

---

## Updated Node Structure

```typescript
interface PlanningNode {
  id: string;
  label: string;
  level: number;

  // PLANNING DATA (what mindmap manages)
  nodeType: "goal" | "phase" | "task" | "subtask";
  description: string;
  status: "not-started" | "in-progress" | "completed" | "blocked";

  // PROMPT GENERATION
  promptTemplate: string; // Template for AI tool
  contextIncludes: string[]; // Which parent/sibling nodes to include
  expectedOutput: "text" | "code" | "design" | "data" | "file";

  // EXTERNAL REFERENCES (user fills these)
  externalLinks?: {
    type: "claude-chat" | "cursor-file" | "notion-doc" | "github-pr" | "url";
    url: string;
    label: string;
  }[];

  // USER NOTES
  notes?: string; // User's thoughts, learnings, issues
  estimatedTime?: string; // "2 hours", "1 day"
  actualTime?: string;

  // METADATA
  createdAt: string;
  completedAt?: string;
  color?: string;
  emoji?: string;
}
```

---

## User Workflows

### Workflow 1: **Book Writing**

```
1. Create root: "Write book: AI Ethics"

2. Mindmap generates structure (user accepts):
   ├─ Research
   ├─ Outline
   ├─ Writing
   └─ Editing

3. User expands "Research":
   ├─ Literature review
   ├─ Expert interviews
   └─ Case studies

4. User clicks "Literature review" node:

   Mindmap shows:
   ┌──────────────────────────────────────┐
   │ 💡 SUGGESTED PROMPT                  │
   ├──────────────────────────────────────┤
   │ "I'm writing a book about AI Ethics. │
   │ Help me conduct a literature review  │
   │ of academic papers from 2020-2024.   │
   │ Focus on: bias, privacy, autonomy.   │
   │                                      │
   │ Provide:                             │
   │ 1. List of 15-20 key papers          │
   │ 2. Summary of main findings          │
   │ 3. Common themes                     │
   │ 4. Research gaps"                    │
   │                                      │
   │ [📋 Copy] [🔗 Open Claude Desktop]   │
   └──────────────────────────────────────┘

5. User copies prompt, pastes in Claude Desktop

6. Claude provides research output

7. User returns to mindmap:
   - Marks "Literature review" as ✅ Completed
   - Adds link to Claude conversation
   - Adds note: "Found 23 papers, focus on bias"

8. Next node "Expert interviews" already has context:

   ┌──────────────────────────────────────┐
   │ 💡 SUGGESTED PROMPT                  │
   ├──────────────────────────────────────┤
   │ Context from previous work:          │
   │ - Completed literature review        │
   │ - Key themes: bias, privacy, autonomy│
   │                                      │
   │ Task:                                │
   │ "Based on the research gaps from the │
   │ literature review, help me prepare   │
   │ interview questions for 5 AI ethics  │
   │ experts. Focus on..."                │
   │                                      │
   │ [📋 Copy] [🔗 View Research Node]    │
   └──────────────────────────────────────┘

9. Process continues...
```

### Workflow 2: **Software Development**

```
1. Root: "Build user authentication system"

2. Structure:
   ├─ 📋 Design
   │   ├─ Database schema
   │   └─ API endpoints
   ├─ 💻 Implementation
   │   ├─ Backend code
   │   └─ Frontend UI
   └─ 🧪 Testing

3. User clicks "Database schema":

   Prompt generated:
   "Design a PostgreSQL database schema for user
   authentication supporting:
   - Email/password login
   - OAuth (Google, GitHub)
   - JWT tokens
   - Password reset

   Provide SQL CREATE TABLE statements and explain
   the relationships."

4. User copies to Cursor AI or Claude

5. Gets SQL schema back

6. User marks complete, adds link to Cursor file:
   /database/schema.sql

7. "Backend code" node auto-references the schema:

   "Using the database schema at /database/schema.sql,
   implement the authentication API with Node.js and
   Express. Include:
   - POST /auth/register
   - POST /auth/login
   - POST /auth/refresh
   - POST /auth/logout

   Use bcrypt for passwords and jsonwebtoken for JWTs."

8. User implements in Cursor with AI assistance

9. Marks complete, links to implementation files

10. Testing node references both schema and code
```

---

## Key Features

### 1. **Smart Prompt Builder**

```typescript
interface PromptBuilder {
  // Automatically builds prompts based on context
  generatePrompt(node: PlanningNode): string {
    const parts = [];

    // Add project context
    const root = getRootNode(node);
    parts.push(`Project: ${root.label}`);
    if (root.description) {
      parts.push(`Goal: ${root.description}`);
    }

    // Add parent context
    const parent = getParent(node);
    if (parent) {
      parts.push(`Phase: ${parent.label}`);
      if (parent.notes) {
        parts.push(`Context: ${parent.notes}`);
      }
    }

    // Add sibling context (completed ones)
    const siblings = getSiblings(node).filter(s => s.status === 'completed');
    if (siblings.length > 0) {
      parts.push(`Previous work completed:`);
      siblings.forEach(sib => {
        parts.push(`- ${sib.label}`);
        if (sib.notes) {
          parts.push(`  Note: ${sib.notes}`);
        }
      });
    }

    // Add current task
    parts.push(`\nCurrent Task: ${node.label}`);
    if (node.description) {
      parts.push(node.description);
    }

    // Add expected output format
    parts.push(`\nPlease provide: ${this.getOutputFormat(node.expectedOutput)}`);

    return parts.join('\n');
  }
}
```

### 2. **Template Library**

Pre-built structures that users can customize:

```
Templates:
├─ 📚 Content Creation
│   ├─ Blog Post
│   ├─ Book
│   ├─ Video Script
│   └─ Social Media Campaign
├─ 💻 Software Development
│   ├─ Feature Development
│   ├─ Bug Fix
│   ├─ Refactoring
│   └─ API Design
├─ 🎨 Design Projects
│   ├─ Website Design
│   ├─ App UI/UX
│   └─ Brand Identity
├─ 📊 Business
│   ├─ Market Research
│   ├─ Business Plan
│   └─ Product Launch
└─ 🎓 Learning
    ├─ Course Outline
    ├─ Tutorial Series
    └─ Workshop Plan
```

Each template is just a JSON structure:

```json
{
  "name": "Blog Post",
  "description": "Write a comprehensive blog post",
  "structure": {
    "Research": {
      "children": ["Topic research", "Competitor analysis", "Keyword research"]
    },
    "Outline": {
      "children": ["Hook", "Main points", "Conclusion", "Call-to-action"]
    },
    "Draft": {
      "children": ["Introduction", "Body", "Conclusion"],
      "promptTemplate": "Write {{section}} based on outline: {{outline}}"
    },
    "Polish": {
      "children": ["Edit for clarity", "SEO optimization", "Add images"]
    }
  }
}
```

### 3. **Context Reference System**

Visual links between nodes showing dependencies:

```
Research Node ──────────┐
                        │
Expert Interviews ──────┼─→ Chapter 1 Draft
                        │
Outline ────────────────┘

When you click "Chapter 1 Draft":
- Shows all referenced nodes
- Click to view their notes/links
- Auto-includes in prompt
```

### 4. **External Tool Integration**

One-click handoffs to common tools:

```
Node Action Menu:
├─ 📋 Copy Prompt
├─ 🚀 Quick Actions:
│   ├─ Open in Claude Desktop
│   ├─ Open in ChatGPT Web
│   ├─ Open in Cursor (for code nodes)
│   ├─ Create Notion page
│   └─ Custom URL...
└─ 🔗 Add External Link
    (after completing in other tool)
```

**Implementation:**

```typescript
const quickActions = {
  claudeDesktop: (prompt: string) => {
    // macOS: Uses URL scheme or AppleScript
    // Windows/Linux: Clipboard + notification
    navigator.clipboard.writeText(prompt);
    if (isMac) {
      window.open(`claude://new-chat?prompt=${encodeURIComponent(prompt)}`);
    } else {
      showNotification("Prompt copied! Open Claude Desktop and paste.");
    }
  },

  chatgpt: (prompt: string) => {
    const url = `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`;
    window.open(url, "_blank");
  },

  cursor: (prompt: string, projectPath?: string) => {
    // Creates a temporary file with prompt as comment
    // Opens in Cursor
    // User can use Cursor's AI features
  },
};
```

### 5. **Progress Dashboard**

See project status at a glance:

```
┌─────────────────────────────────────────────┐
│ Project: AI Ethics Book                     │
├─────────────────────────────────────────────┤
│ Progress: ████████░░░░░░░░░░ 40%           │
│                                             │
│ ✅ Completed: 12 tasks                      │
│ 🔵 In Progress: 3 tasks                     │
│ ⚪ Not Started: 15 tasks                    │
│ 🔴 Blocked: 1 task                          │
│                                             │
│ Phases:                                     │
│ ✅ Research (100%)                          │
│ 🔵 Writing (45%)                            │
│ ⚪ Editing (0%)                             │
└─────────────────────────────────────────────┘
```

---

## Updated UI Design

### Node Card (Not Started)

```
┌─────────────────────────────────────────┐
│ 📝 Literature Review                    │
│ Status: ⚪ Not Started                  │
│ Est. time: 2 hours                      │
├─────────────────────────────────────────┤
│ Description:                            │
│ Research academic papers on AI ethics   │
│ from 2020-2024                          │
│                                         │
│ [💡 Generate Prompt] [✏️ Edit]          │
└─────────────────────────────────────────┘
```

### Node Card (Prompt Generated)

```
┌─────────────────────────────────────────┐
│ 📝 Literature Review                    │
│ Status: 🔵 Ready to execute             │
├─────────────────────────────────────────┤
│ 💡 AI Prompt Ready:                     │
│ "I'm writing a book about AI Ethics...  │
│ Help me conduct a literature review..." │
│                                         │
│ [📋 Copy Prompt]                        │
│ [🚀 Open in:]                           │
│   • Claude Desktop                      │
│   • ChatGPT Web                         │
│   • Custom...                           │
│                                         │
│ After completing in your AI tool:       │
│ [✅ Mark Complete] [➕ Add Link]        │
└─────────────────────────────────────────┘
```

### Node Card (Completed)

```
┌─────────────────────────────────────────┐
│ ✅ Literature Review                     │
│ Status: 🟢 Completed                    │
│ Actual time: 2.5 hours                  │
├─────────────────────────────────────────┤
│ 📎 External Links:                      │
│ • Claude chat: [View conversation]      │
│ • Notion doc: [Research notes]          │
│                                         │
│ 📝 Notes:                               │
│ "Found 23 papers. Main themes: bias    │
│ in hiring AI, privacy in healthcare,   │
│ autonomous vehicles ethics."            │
│                                         │
│ Referenced by:                          │
│ → Chapter 1 Draft                       │
│ → Expert Interview Questions            │
│                                         │
│ [✏️ Edit Notes] [🔄 Regenerate Prompt]  │
└─────────────────────────────────────────┘
```

---

## Advantages of This Approach

### ✅ **Tool Agnostic**

Users can use:

- Claude Desktop (best for research/writing)
- Cursor (best for code)
- ChatGPT (general purpose)
- Notion AI (documentation)
- ANY tool they prefer

### ✅ **No Lock-in**

- Not dependent on specific AI provider
- No API costs from the mindmap tool
- Users use their existing subscriptions

### ✅ **Better Separation of Concerns**

- Mindmap: Planning, structure, context
- AI Tools: Generation, specialized tasks
- User: Quality control, decision making

### ✅ **Flexible**

- Some users prefer Claude for writing
- Others prefer Cursor for code
- Mix and match per task

### ✅ **Scalable**

- No backend AI infrastructure needed
- No rate limits
- No token costs for the tool

### ✅ **Realistic**

- Users already have workflows with their tools
- This enhances rather than replaces
- Lower barrier to adoption

---

## Technical Implementation

### Simple Tech Stack

```typescript
// No backend needed for AI!
// Just frontend + local storage

interface MindmapApp {
  // State management
  nodes: PlanningNode[];
  edges: Edge[];

  // Prompt generation (client-side)
  promptBuilder: PromptBuilder;

  // Template system (JSON files)
  templates: Template[];

  // Local storage
  storage: LocalStorage | IndexedDB;

  // Optional: Cloud sync
  sync?: FirebaseSync | SupabaseSync;
}

// Core functions
class MindmapLogic {
  // Generate prompt from node + context
  generatePrompt(nodeId: string): string;

  // Suggest next nodes based on current state
  suggestNextSteps(nodeId: string): PlanningNode[];

  // Track dependencies
  getDependencies(nodeId: string): PlanningNode[];

  // Progress calculation
  calculateProgress(): ProgressStats;

  // Export project
  exportProject(format: "json" | "markdown" | "pdf"): void;
}
```

### No Backend Needed!

Because we're not executing AI:

- ✅ No API keys to manage
- ✅ No server costs
- ✅ No rate limiting
- ✅ No security concerns
- ✅ Works offline (except quick actions)
- ✅ Privacy-friendly (data stays local)

### Optional Cloud Sync

For users who want to sync across devices:

```typescript
interface CloudSync {
  // Simple project sync
  saveProject(project: Project): Promise<void>;
  loadProject(projectId: string): Promise<Project>;
  listProjects(): Promise<ProjectMeta[]>;

  // No AI content to sync
  // Just the planning structure
}
```

---

## Monetization Strategy

Since we're not providing AI execution:

### Free Tier:

- 3 active projects
- Basic templates
- Local storage only

### Pro ($10/month):

- Unlimited projects
- Cloud sync across devices
- Custom templates
- Export to PDF/Markdown
- Team sharing
- Priority support

### Team ($25/user/month):

- Everything in Pro
- Team collaboration
- Project templates library
- Admin controls
- SSO

---

## User Journey Comparison

### Before (Complex):

```
User -> Mindmap executes AI -> Review -> Continue
        ↑ (requires API keys, costs, rate limits)
```

### After (Simple):

```
User -> Mindmap generates prompt -> Copy to preferred tool
     -> Use tool -> Mark complete -> Continue
        ↑ (no API needed, use existing tools)
```

---

## Example: Complete Book Writing Flow

```
Day 1: Setup
- Create "Write AI Ethics Book" project
- Accept suggested structure template
- Customize chapters

Day 2-4: Research Phase
- Click "Literature Review"
- Copy prompt to Claude Desktop
- Claude provides research
- Add Claude chat link to node
- Add key findings to notes
- Mark complete

- Next: "Expert Interviews"
- Prompt auto-includes research findings
- Copy to Claude
- Get interview questions
- Mark complete

Day 5-15: Writing Phase
- Chapter 1: Copy prompt (includes all research context)
- Paste in Claude Desktop
- Get draft
- Review, edit in Google Docs
- Add Google Docs link to node
- Mark complete

- Chapter 2: Same process
- Prompt automatically references Chapter 1
- Maintains consistency

Day 16-18: Editing
- Each chapter marked with edit status
- Copy all chapters context to Claude
- Get editing suggestions
- Apply in Google Docs

Project Complete!
- Export mindmap as PDF (project documentation)
- Share with others
- Use as template for next book
```

---

## Success Metrics (Revised)

### Usage Metrics:

- Projects created
- Average nodes per project
- Template usage rate
- Prompt generation frequency
- External links added (shows actual use)

### Quality Indicators:

- Completion rate (% of started projects finished)
- Time to first prompt (onboarding effectiveness)
- Nodes per session (engagement)
- Repeat users (stickiness)

---

## Future Enhancements

### V2.0 Features:

1. **Smart Templates**

   - Learn from user's completed projects
   - Suggest custom templates
   - Community template marketplace

2. **Browser Extension**

   - Capture Claude/ChatGPT outputs directly
   - Auto-link conversations to nodes
   - Right-click context menu

3. **Integration Plugins**

   - Notion: Auto-create pages
   - Google Docs: Link documents
   - GitHub: Link PRs/issues
   - Linear/Jira: Sync tasks

4. **Collaboration**

   - Share projects with team
   - Assign nodes to people
   - Comment threads
   - Activity feed

5. **Analytics**
   - Time tracking per node
   - Velocity metrics
   - Bottleneck detection
   - Productivity insights

---

## Conclusion

This orchestration approach is:

✅ **Simpler to build** (no AI backend)
✅ **Cheaper to run** (no API costs)
✅ **More flexible** (use any AI tool)
✅ **More realistic** (fits existing workflows)
✅ **More privacy-friendly** (data stays local)
✅ **More scalable** (no rate limits)

The mindmap becomes a **thinking tool** and **project orchestrator**, not an AI execution engine. It helps users think structurally and maintain context, while letting them use their preferred AI tools for actual generation.

**Next Steps:**

1. Build basic prompt generation system
2. Create 3-5 templates
3. Test with real projects
4. Add external link tracking
5. Iterate based on usage

This is much more achievable and valuable! 🎯
