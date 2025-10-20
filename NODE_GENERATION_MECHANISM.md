# Node Generation Mechanism - Detailed Specification

## Overview

A user-friendly, iterative system for generating child nodes with AI assistance, while preserving user control and existing work.

---

## User Journey Flow

### Starting State: Parent Node Selected

```
┌─────────────────────────────────────┐
│ 📚 Research Phase                   │  ← User clicks this node
│ Status: ⚪ Not Started              │
├─────────────────────────────────────┤
│ Description:                        │
│ Gather information for the book     │
│                                     │
│ No children yet                     │
└─────────────────────────────────────┘
```

**Floating Toolbar Appears:**
```
┌──────────────────────────┐
│ 🪄 Generate Children     │  ← Main action
│ ➕ Add Child Manually    │
│ 📋 Paste from Template   │
│ ⚙️  Configure            │
└──────────────────────────┘
```

---

## Step 1: Generation Options Modal

When user clicks "🪄 Generate Children", show modal:

```
┌─────────────────────────────────────────────────────┐
│             Generate Children for:                  │
│             "Research Phase"                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ⚙️  Generation Settings                             │
│                                                     │
│ Strategy:                                           │
│ ● Workflow Breakdown   (Phases: A → B → C)         │
│ ○ Task Breakdown      (Parallel subtasks)          │
│ ○ Detailed Steps      (Step-by-step checklist)     │
│                                                     │
│ Number of children:                                 │
│ ○ Let AI decide (recommended)                      │
│ ● Specify: [5] children                            │
│                                                     │
│ Context to include:                                 │
│ ☑ Project goal                                     │
│ ☑ Parent node description                         │
│ ☑ Sibling nodes (if any)                          │
│ ☐ Custom instructions                              │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ Custom instructions (optional):              │   │
│ │ ________________________________________     │   │
│ │ e.g., "Focus on academic sources only"      │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│        [Cancel]  [🪄 Generate Suggestions]         │
└─────────────────────────────────────────────────────┘
```

**Key Features:**
- **Pre-selected defaults** that make sense for node type
- **Optional customization** for power users
- **Preview before generating** - no surprises

---

## Step 2: Suggestions Preview

After generation, show preview modal:

```
┌─────────────────────────────────────────────────────────────┐
│  Suggested Children for "Research Phase"          [x]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  AI Generated 5 suggestions:                                │
│                                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │ ☑ 1. Literature Review                         │  ✏️  🗑️│
│  │   Research academic papers and books           │        │
│  │   Estimated: 3-4 hours                         │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │ ☑ 2. Expert Interviews                         │  ✏️  🗑️│
│  │   Contact and interview domain experts         │        │
│  │   Estimated: 5-6 hours                         │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │ ☑ 3. Case Studies Collection                   │  ✏️  🗑️│
│  │   Gather real-world examples                   │        │
│  │   Estimated: 2-3 hours                         │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │ ☑ 4. Data Analysis                             │  ✏️  🗑️│
│  │   Analyze collected research data              │        │
│  │   Estimated: 4-5 hours                         │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │ ☑ 5. Synthesis Report                          │  ✏️  🗑️│
│  │   Summarize findings and insights              │        │
│  │   Estimated: 2-3 hours                         │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  ────────────────────────────────────────────────          │
│                                                             │
│  💡 Actions:                                                │
│  • Check/uncheck to select which ones to add               │
│  • Click ✏️ to edit a suggestion                           │
│  • Click 🗑️ to remove a suggestion                         │
│                                                             │
│  [➕ Add Custom Child]  [🔄 Regenerate All]                │
│                                                             │
│  [Cancel]  [✅ Add Selected (5 items)]                     │
└─────────────────────────────────────────────────────────────┘
```

**User Options:**

1. **Accept All** - Click "Add Selected" with all checked
2. **Cherry-pick** - Uncheck unwanted suggestions
3. **Edit** - Click ✏️ to modify title/description
4. **Delete** - Click 🗑️ to remove from list
5. **Add More** - Click "Add Custom Child" to manually add
6. **Regenerate** - Don't like any? Click "Regenerate All"
7. **Cancel** - Exit without adding anything

---

## Step 3: Editing a Suggestion

When user clicks ✏️ on a suggestion:

```
┌─────────────────────────────────────────────┐
│  Edit Suggestion                     [x]    │
├─────────────────────────────────────────────┤
│                                             │
│  Title:                                     │
│  [Literature Review____________]            │
│                                             │
│  Description:                               │
│  ┌─────────────────────────────────────┐   │
│  │ Research academic papers and books  │   │
│  │ Focus on: AI ethics, bias, privacy │   │
│  │ Time period: 2020-2024             │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Estimated Time:                            │
│  [3-4 hours_]                              │
│                                             │
│  Expected Output:                           │
│  ● Text (report/notes)                     │
│  ○ Code                                     │
│  ○ File/Asset                              │
│  ○ Link/URL                                │
│                                             │
│  [Cancel]  [💾 Save Changes]               │
└─────────────────────────────────────────────┘
```

---

## Scenario 1: No Existing Children

**Simplest case** - Parent node has no children yet.

**Flow:**
1. User clicks "Generate Children"
2. AI generates suggestions
3. User reviews/edits/selects
4. Clicks "Add Selected"
5. Nodes are created as children

**Result:**
```
Research Phase
├─ Literature Review      (added)
├─ Expert Interviews      (added)
├─ Case Studies           (added)
└─ Data Analysis          (added)
```

---

## Scenario 2: Some Children Already Exist

**User has manually added some children, now wants AI to suggest more.**

### Before:
```
Research Phase
├─ Literature Review      (manually added by user)
└─ Market Survey          (manually added by user)
```

### User Action: Clicks "Generate Children"

### Modal Shows:
```
┌─────────────────────────────────────────────────────────────┐
│  Generate Children for "Research Phase"                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠️  This node already has 2 children:                      │
│  • Literature Review                                        │
│  • Market Survey                                            │
│                                                             │
│  What would you like to do?                                 │
│                                                             │
│  ● Generate additional suggestions                         │
│    (AI will suggest more children to complement existing)  │
│                                                             │
│  ○ Replace all existing children                           │
│    (Current children will be removed)                      │
│                                                             │
│  ○ Regenerate suggestions for existing only                │
│    (AI will suggest alternatives for current children)     │
│                                                             │
│  [Cancel]  [Continue]                                      │
└─────────────────────────────────────────────────────────────┘
```

### Option A: "Generate Additional Suggestions"

AI is prompted with context about existing children:

```
Prompt to AI:
"Parent task: Research Phase
Existing children already created by user:
1. Literature Review
2. Market Survey

Generate 3-5 ADDITIONAL complementary tasks that would
complete the research phase. Do NOT duplicate the existing
tasks."

Result: AI suggests:
- Expert Interviews
- Competitor Analysis
- User Surveys
```

Suggestions modal:
```
┌─────────────────────────────────────────────────────────────┐
│  Additional Suggestions for "Research Phase"               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📌 Existing children (will be preserved):                  │
│  • Literature Review                                        │
│  • Market Survey                                            │
│                                                             │
│  ────────────────────────────────────────────────          │
│                                                             │
│  ✨ New suggestions:                                        │
│                                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │ ☑ 1. Expert Interviews                         │  ✏️  🗑️│
│  │   Contact domain experts for insights          │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │ ☑ 2. Competitor Analysis                       │  ✏️  🗑️│
│  │   Study what competitors are doing             │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │ ☑ 3. User Surveys                              │  ✏️  🗑️│
│  │   Survey target audience for feedback          │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  [➕ Add Custom]  [🔄 Regenerate Suggestions]              │
│                                                             │
│  [Cancel]  [✅ Add Selected (3 items)]                     │
└─────────────────────────────────────────────────────────────┘
```

**After adding:**
```
Research Phase
├─ Literature Review      (existing)
├─ Market Survey          (existing)
├─ Expert Interviews      (new)
├─ Competitor Analysis    (new)
└─ User Surveys           (new)
```

### Option B: "Replace All Existing Children"

Shows warning:
```
┌─────────────────────────────────────────────┐
│  ⚠️  Replace Existing Children?             │
├─────────────────────────────────────────────┤
│                                             │
│  This will DELETE:                          │
│  • Literature Review                        │
│  • Market Survey                            │
│                                             │
│  And generate completely new suggestions.   │
│                                             │
│  Are you sure?                              │
│                                             │
│  [Cancel]  [⚠️ Yes, Replace All]            │
└─────────────────────────────────────────────┘
```

---

## Scenario 3: User Previously Generated, Now Wants to Refine

**User generated nodes before, but wants different suggestions.**

### Before:
```
Research Phase
├─ Literature Review      (AI generated, not started)
├─ Expert Interviews      (AI generated, not started)
├─ Case Studies           (AI generated, not started)
└─ Data Analysis          (AI generated, in progress!)
```

### User Action: Clicks "Generate Children" again

### System Behavior:

Check if any children have been worked on:
- ✅ Data Analysis is "in progress" - **protect it**
- Others are "not started" - **can be replaced**

```
┌─────────────────────────────────────────────────────────────┐
│  Regenerate Children for "Research Phase"                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠️  Notice: Some children have been started                │
│                                                             │
│  🔒 Protected (will be preserved):                          │
│  • Data Analysis (in progress)                             │
│                                                             │
│  🔄 Can be replaced:                                        │
│  • Literature Review (not started)                         │
│  • Expert Interviews (not started)                         │
│  • Case Studies (not started)                              │
│                                                             │
│  What would you like to do?                                 │
│                                                             │
│  ● Regenerate "not started" items only                     │
│    (Keep "Data Analysis", replace the others)              │
│                                                             │
│  ○ Generate additional suggestions                         │
│    (Keep all existing, add more)                           │
│                                                             │
│  ○ Keep everything, let me edit manually                   │
│                                                             │
│  [Cancel]  [Continue]                                      │
└─────────────────────────────────────────────────────────────┘
```

**Protection Rules:**
- ✅ Nodes with status "in-progress" or "completed" are **always protected**
- ✅ Nodes with external links are **always protected**
- ✅ Nodes with user notes are **protected** (shows warning)
- ⚠️ Nodes that are "not started" with no content can be replaced

---

## Scenario 4: Mixed (User + AI Generated)

**User has manually added some, AI generated others.**

### Before:
```
Research Phase
├─ Literature Review      (AI generated, completed)
├─ Talk to John Smith     (manually added, not started)
├─ Expert Interviews      (AI generated, not started)
└─ My Custom Research     (manually added, in progress)
```

### User clicks "Generate Children"

```
┌─────────────────────────────────────────────────────────────┐
│  Manage Children for "Research Phase"                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔒 Protected items (will not be modified):                 │
│  • Literature Review (completed)                           │
│  • My Custom Research (in progress)                        │
│                                                             │
│  🔄 Can be replaced:                                        │
│  • Talk to John Smith (not started, no content)            │
│  • Expert Interviews (not started, no content)             │
│                                                             │
│  Options:                                                   │
│  ● Replace "not started" items with new suggestions        │
│  ○ Keep all and add more suggestions                       │
│  ○ Manual edit mode (don't generate anything)              │
│                                                             │
│  [Cancel]  [Continue]                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## UI Component Breakdown

### 1. Floating Toolbar on Node Selection

```typescript
interface FloatingToolbarProps {
  node: MindmapNode;
  hasChildren: boolean;
}

const FloatingToolbar = ({ node, hasChildren }: FloatingToolbarProps) => {
  return (
    <div className="floating-toolbar">
      <button onClick={handleGenerateChildren}>
        🪄 {hasChildren ? 'Refine Children' : 'Generate Children'}
      </button>
      <button onClick={handleAddManual}>
        ➕ Add Child Manually
      </button>
      {/* ... other actions ... */}
    </div>
  );
};
```

### 2. Generation Settings Modal

```typescript
interface GenerationSettings {
  strategy: 'workflow' | 'tasks' | 'steps';
  count: number | 'auto';
  includeContext: {
    projectGoal: boolean;
    parentDescription: boolean;
    siblings: boolean;
  };
  customInstructions?: string;
}

const GenerationModal = ({ node, onGenerate }: Props) => {
  const [settings, setSettings] = useState<GenerationSettings>(defaultSettings);

  return (
    <Modal>
      <StrategySelector value={settings.strategy} onChange={...} />
      <CountInput value={settings.count} onChange={...} />
      <ContextCheckboxes value={settings.includeContext} onChange={...} />
      <CustomInstructions value={settings.customInstructions} onChange={...} />
      <button onClick={() => onGenerate(settings)}>Generate</button>
    </Modal>
  );
};
```

### 3. Suggestions Preview Modal

```typescript
interface SuggestionNode {
  id: string; // temporary ID
  title: string;
  description: string;
  estimatedTime?: string;
  expectedOutput: 'text' | 'code' | 'file' | 'url';
  selected: boolean; // for checkbox
}

const SuggestionsPreviewModal = ({ suggestions, onAccept }: Props) => {
  const [items, setItems] = useState<SuggestionNode[]>(suggestions);

  const handleToggle = (id: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const handleEdit = (id: string) => {
    // Open edit modal for this suggestion
  };

  const handleRemove = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleAccept = () => {
    const selected = items.filter(item => item.selected);
    onAccept(selected);
  };

  return (
    <Modal>
      <h2>Suggested Children</h2>
      {items.map(item => (
        <SuggestionCard
          key={item.id}
          suggestion={item}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onRemove={handleRemove}
        />
      ))}
      <button onClick={handleAddCustom}>Add Custom Child</button>
      <button onClick={handleRegenerate}>Regenerate All</button>
      <button onClick={handleAccept}>
        Add Selected ({items.filter(i => i.selected).length} items)
      </button>
    </Modal>
  );
};
```

### 4. Conflict Resolution Modal

```typescript
interface ConflictResolution {
  existingChildren: MindmapNode[];
  protectedChildren: MindmapNode[];
  replaceableChildren: MindmapNode[];
}

const ConflictModal = ({ resolution, onResolve }: Props) => {
  const [action, setAction] = useState<'add' | 'replace' | 'regenerate'>('add');

  return (
    <Modal>
      <h2>Existing Children Found</h2>

      {resolution.protectedChildren.length > 0 && (
        <section>
          <h3>🔒 Protected (will be preserved)</h3>
          {resolution.protectedChildren.map(child => (
            <div key={child.id}>
              {child.label} ({child.status})
            </div>
          ))}
        </section>
      )}

      {resolution.replaceableChildren.length > 0 && (
        <section>
          <h3>🔄 Can be modified</h3>
          {resolution.replaceableChildren.map(child => (
            <div key={child.id}>
              {child.label} (not started)
            </div>
          ))}
        </section>
      )}

      <RadioGroup value={action} onChange={setAction}>
        <Radio value="add">Generate additional suggestions</Radio>
        <Radio value="regenerate">Regenerate "not started" items</Radio>
        <Radio value="replace">Replace all (delete protected items)</Radio>
      </RadioGroup>

      <button onClick={() => onResolve(action)}>Continue</button>
    </Modal>
  );
};
```

---

## Protection Logic

```typescript
const determineNodeProtection = (node: MindmapNode): boolean => {
  // Always protect if:
  if (node.status === 'in-progress') return true;
  if (node.status === 'completed') return true;
  if (node.externalLinks && node.externalLinks.length > 0) return true;
  if (node.notes && node.notes.trim().length > 0) return true;

  // Can be replaced if:
  // - Status is "not-started"
  // - No external links
  // - No notes
  return false;
};

const categorizeChildren = (children: MindmapNode[]) => {
  const protected: MindmapNode[] = [];
  const replaceable: MindmapNode[] = [];

  children.forEach(child => {
    if (determineNodeProtection(child)) {
      protected.push(child);
    } else {
      replaceable.push(child);
    }
  });

  return { protected, replaceable };
};
```

---

## Edge Cases Handled

### ✅ Case 1: User adds manual child while AI is generating
**Solution:** Show warning "Suggestions ready, but you added children. Merge or discard?"

### ✅ Case 2: User accidentally clicks "Replace All"
**Solution:** Confirmation modal with clear warning. Allow undo (keep in history).

### ✅ Case 3: AI generates duplicate of existing node
**Solution:** Detect duplicates by similarity check, mark as "(similar to existing: X)"

### ✅ Case 4: User wants to regenerate just one child
**Solution:** Right-click individual node → "Regenerate This Node"

### ✅ Case 5: AI fails to generate (API error, timeout)
**Solution:** Show error, allow retry or manual creation

### ✅ Case 6: User generates, doesn't like any, regenerates multiple times
**Solution:** Show history of previous generations, allow "Use previous suggestion #2"

---

## Keyboard Shortcuts

```
While in Suggestions Preview Modal:
- Space: Toggle current suggestion checkbox
- ↑/↓: Navigate between suggestions
- E: Edit current suggestion
- Delete: Remove current suggestion
- A: Select/deselect all
- Enter: Accept selected
- Esc: Cancel
```

---

## Visual Feedback

### Loading State:
```
┌─────────────────────────────────────┐
│  Generating suggestions...          │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░               │
│  Analyzing project context...       │
└─────────────────────────────────────┘
```

### Success State:
```
✅ Generated 5 suggestions successfully!
```

### Error State:
```
❌ Failed to generate suggestions
   [Retry] [Add Manually]
```

---

## Summary: Key Design Principles

1. **Preview Before Commit** - Never auto-add without user seeing first
2. **Protect User Work** - Never delete nodes with progress/content
3. **Clear Communication** - Always explain what will happen
4. **Easy Refinement** - Edit, remove, regenerate at any time
5. **Escape Hatches** - Cancel, undo, manual override always available
6. **Progressive Disclosure** - Simple by default, advanced when needed
7. **Non-destructive** - Preserve work whenever possible

---

## Next Steps for Implementation

1. Build basic "Generate Children" button
2. Implement simple suggestions modal (no conflict handling)
3. Add edit/remove functionality
4. Add conflict detection
5. Add protection logic
6. Add refinement options
7. Polish UX with animations/feedback

This creates a **safe, flexible, and user-friendly** generation experience! 🎯
