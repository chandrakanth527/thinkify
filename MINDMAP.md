# Mindmap Application

This project has been converted from a workflow diagram demo into a fully functional mindmap application using ReactFlow.

## Features

### 1. Visual Mindmap Interface
- **Root Node** (Level 0): Purple gradient, largest size - represents the main topic
- **Main Branch Nodes** (Level 1): Pink/red gradient, medium size - primary topics
- **Sub-branch Nodes** (Level 2+): Blue gradient, smaller size - subtopics and details

### 2. Interactive Node Editing
- **Double-click** any node to edit its label
- Press **Enter** to save changes
- Press **Escape** to cancel editing

### 3. Add Child Nodes
- **Hover** over any node to reveal the **green + button** on the right side
- Click the **+** button to add a child node
- New nodes automatically inherit the correct level and styling
- Layout automatically adjusts to accommodate new nodes

### 4. Delete Nodes
- **Hover** over any non-root node to reveal the **red × button** in the top-left corner
- Click the **×** button to delete the node
- Deleting a node also removes all its descendant nodes
- The root node cannot be deleted

### 5. Auto-Layout
- Nodes are automatically positioned using advanced layout algorithms
- Multiple layout options available in the control panel:
  - **Dagre** - Hierarchical tree layout
  - **ELK** - Eclipse Layout Kernel
  - **D3-hierarchy** - D3-based tree layouts
  - **D3-dag** - Directed acyclic graph layouts

### 6. Smooth Connections
- Edges use smooth step paths with rounded corners
- Hover over edges to highlight them
- Clean, professional mindmap appearance

### 7. Navigation & Controls
- **Pan**: Click and drag the background
- **Zoom**: Use mouse wheel or trackpad pinch
- **Fit View**: Button in the controls panel
- **MiniMap**: Overview of entire mindmap in bottom-right corner

## Getting Started

### Running the Application

```bash
pnpm install
pnpm dev
```

The application will be available at `http://localhost:5173/`

### Customizing Your Mindmap

1. **Edit the default mindmap data**: Modify `src/data/mindmap-data.json`
2. **Change node styling**: Edit `src/components/Nodes/MindmapNode/styles.css`
3. **Adjust layout settings**: Use the control panel in the UI or modify `src/layout/node/index.ts`

## File Structure

### Key Mindmap Components

- `src/MindmapApp.tsx` - Main mindmap application with add/delete logic
- `src/components/Nodes/MindmapNode/` - Mindmap node component with editing capabilities
- `src/components/Edges/MindmapEdge/` - Smooth edge styling for mindmap
- `src/data/mindmap-data.json` - Default mindmap data

### Data Structure

```json
{
  "nodes": [
    {
      "id": "unique-id",
      "type": "mindmap",
      "label": "Node Label",
      "level": 0  // 0 = root, 1 = main branch, 2+ = sub-branches
    }
  ],
  "edges": [
    {
      "id": "edge-id",
      "source": "parent-node-id",
      "target": "child-node-id",
      "sourceHandle": "parent#source#0",
      "targetHandle": "child#target#0"
    }
  ]
}
```

## Architecture

The mindmap implementation builds on the original ReactFlow auto-layout demo:

1. **Node Management**: Custom mindmap nodes with level-based styling
2. **Edge Routing**: Smooth step paths for organic mindmap appearance
3. **State Management**: React hooks for nodes and edges
4. **Layout Engine**: Multiple algorithms for automatic positioning
5. **Event System**: Custom events for add/delete operations

## Advanced Features

### Layout Configuration

Adjust layout parameters in the control panel:
- Direction (horizontal/vertical)
- Node spacing
- Port sorting
- Algorithm selection

### Keyboard Shortcuts

- **Enter**: Save node edit
- **Escape**: Cancel node edit
- **+/- or Mouse Wheel**: Zoom in/out

## Tips for Best Results

1. Start with a clear central topic as your root node
2. Organize related ideas under main branch nodes (level 1)
3. Use sub-branches (level 2+) for detailed breakdown
4. Keep node labels concise for better readability
5. Use the minimap to navigate large mindmaps
6. Experiment with different layout algorithms for optimal visualization

## Technical Details

- **Framework**: React 19 + TypeScript
- **Diagram Library**: ReactFlow v12.8.6
- **Layout Algorithms**: Dagre, ELK, D3-hierarchy, D3-dag
- **Build Tool**: Vite 7
- **Package Manager**: pnpm

## Future Enhancements

Potential features to add:
- Export mindmap as PNG/SVG
- Collaborative editing
- Node colors/icons customization
- Collapsible branches
- Search functionality
- Keyboard navigation
- Undo/redo support

---

Built with ReactFlow and modern web technologies.
