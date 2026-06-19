---
name: app-flow-documenter
description: >
  Generates an interactive single-page HTML app that visually documents workflows between
  packages and components in a codebase. Use this skill whenever a user wants to document,
  visualise, or explore how data and control flow between parts of their app — e.g. "document
  my app flows", "show how packages communicate", "create a flow explorer for my codebase",
  "map out the invite user flow", or "highlight what happens when X is triggered". Also trigger
  when the user asks to produce a JSON-driven flow diagram, an interactive component map, or
  an annotated architecture walkthrough. The output is always a self-contained HTML file driven
  by a companion flows.json data file.
---

# App Flow Documenter

Produces a **self-contained, interactive single-page HTML file** (+ a companion `flows.json`)
that lets engineers click through named workflows and watch how data passes between packages
and components in their app.

---

## What you are building

| Artifact | Purpose |
|---|---|
| `flows.json` | Source-of-truth data: all packages, all flows, all annotations |
| `flow-explorer.html` | Single-page app that reads `flows.json` and renders the interactive explorer |

The HTML file reads the JSON at load time (`fetch('./flows.json')` or inline `<script>` tag).
By default, embed the JSON inline so the file opens with a simple double-click (no server needed).

---

## Step 1 — Discover the codebase

Before writing a single line of JSON, understand the repo structure.

```bash
# Get top-level layout
ls -1

# Identify packages / workspaces
cat package.json | grep -E '"workspaces"|"name"'
ls packages/ apps/ libs/ services/ 2>/dev/null

# Spot key entry points
find . -name "index.ts" -o -name "index.js" | grep -v node_modules | head -30
find . -name "*.routes.ts" -o -name "router.ts" | grep -v node_modules | head -20
```

Ask the user:
1. Which packages / directories are "first-class" nodes in the diagram?
2. Which user-facing or developer-facing **actions / flows** matter most? (e.g. "Invite user", "Checkout", "Build desktop app")
3. Are there any existing architecture docs, README files, or diagrams to reference?

> **Tip from the originator of this prompt:** End your clarifying message with *"Does that make sense? Any questions?"* — this invites the user to correct your understanding before you generate anything.

---

## Step 2 — Build `flows.json`

### Schema

```jsonc
{
  "packages": [
    {
      "id": "string",          // unique slug, e.g. "auth-service"
      "label": "string",       // display name, e.g. "Auth Service"
      "description": "string", // one-liner about what this package does
      "color": "#hex"          // optional; auto-assigned if omitted
    }
  ],
  "flows": [
    {
      "id": "string",          // unique slug, e.g. "invite-user"
      "label": "string",       // button label shown in the UI
      "description": "string", // one paragraph explaining the end-to-end flow
      "steps": [
        {
          "from": "package-id",
          "to": "package-id",
          "label": "string",   // what is passed / what happens, e.g. "POST /invites {email}"
          "detail": "string"   // longer annotation shown on hover / in sidebar
        }
      ]
    }
  ]
}
```

### Guidelines for good JSON

- **Packages** should map 1-to-1 to importable units (npm workspaces, microservices, major
  directories). Avoid granularity below "component file" level unless the user asks.
- **Flow steps** should capture *what is passed* (function call, HTTP request, event, queue
  message) not just "A calls B". The `label` is short (≤10 words); `detail` can be a full
  sentence or two.
- Keep flows to **3–10 steps** each. Very long flows are better split into sub-flows.
- Derive data from the actual source code where possible — check `import` statements,
  API route files, event emitters, message queue consumers.

---

## Step 3 — Build `flow-explorer.html`

### Visual layout

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER: app name + subtitle                                 │
├──────────────┬──────────────────────────────────────────────┤
│ FLOW BUTTONS │  CANVAS (package nodes + animated edges)     │
│ (left panel) │                                              │
│ • Invite user│  [AuthService]──────▶[EmailService]          │
│ • Checkout   │       │                                      │
│ • Build app  │       ▼                                      │
│              │  [UserService]──────▶[Database]              │
│              ├──────────────────────────────────────────────┤
│              │  DETAIL PANEL: selected step annotation       │
└──────────────┴──────────────────────────────────────────────┘
```

### Interaction behaviour

| User action | Effect |
|---|---|
| Click a flow button | All package nodes appear; edges for that flow animate in sequence; non-participating nodes dim |
| Click an edge / step | Detail panel shows `step.detail` text |
| Hover a node | Tooltip shows `package.description` |
| Click "Reset" | All nodes return to neutral state |

### Technical requirements

- **Pure HTML + CSS + JS** — no build step. Load Google Sans from Google Fonts:
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  ```
  Use `font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif` everywhere.
- Embed `flows.json` content inline as a JS variable to allow opening the file locally:
  ```html
  <script>
  const FLOWS_DATA = /* paste JSON here */;
  </script>
  ```
- Use **SVG** for the canvas; position package nodes in a fixed or grid layout.
- Animate edges using SVG `stroke-dashoffset` + CSS transitions to show directionality.
- Make the page **responsive** — it should work at 1280px wide and degrade gracefully.

### Theme and colours

Default to a **super dark grey** theme — not pure black, a dark grey with slight cool tone:

```css
:root {
  --bg:        #111114;   /* page/canvas background */
  --surface:   #17171c;   /* header, sidebar, detail panel */
  --surface2:  #1e1e27;   /* hover states, interactive surfaces */
  --border:    #2a2a38;   /* dividers and borders */
  --node-fill: #1c1c25;   /* SVG node fill */
  --text:      #e0e4f0;
  --muted:     #7a82a0;
  --accent:    #6366f1;
}
```

### Node styling

Nodes must use **simple flat styling** — a single rounded rectangle with a coloured stroke.
No gradient fills, no colour bars, no shadow rects. One `<rect>` + one `<text>` per node:

```js
// One rect — dark flat fill, coloured border
svgEl('rect', { fill: '#1c1c25', stroke: pkg.color, 'stroke-width': '1.5', rx: 9 });

// Centred label — Google Sans, medium weight
svgEl('text', {
  'font-family': "'Google Sans', -apple-system, sans-serif",
  'font-size': '12.5', 'font-weight': '500', fill: '#e0e4f0',
  'text-anchor': 'middle',
});
// If label has > 2 words, split into 2 <tspan> lines (dy='0' then dy='16')
```

### Edge separation for parallel arrows

When multiple steps share the same `from → to` pair within a flow, use a **lateral offset**
so their paths are truly separated — not just different control-point curves.

**Algorithm (implement exactly as shown):**

```js
const LATERAL_SPACING = 22; // px between parallel edges on the same pair

// Pre-count pair occurrences
const pairCount = {}, pairSeen = {};
for (const step of flow.steps) {
  const k = `${step.from}|${step.to}`;
  pairCount[k] = (pairCount[k] || 0) + 1;
}

// Per step, compute a centered bias
for (let i = 0; i < flow.steps.length; i++) {
  const k = `${flow.steps[i].from}|${flow.steps[i].to}`;
  pairSeen[k] = pairSeen[k] ?? 0;
  const bias = pairSeen[k] - (pairCount[k] - 1) / 2; // e.g. count=3 → -1, 0, +1
  pairSeen[k]++;
  const lateral = bias * LATERAL_SPACING;
  // draw edge with this lateral offset
}
```

**Border-point function** (shifts start/end along the node edge perpendicular to the direction):

```js
function borderPoint(fromId, toId, lateralPx) {
  const f = POS[fromId], t = POS[toId];
  const dx = t.cx - f.cx, dy = t.cy - f.cy;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  const ux = dx/len, uy = dy/len;   // unit toward target
  const lx = -uy,   ly =  ux;      // perpendicular (left of direction)

  const hw = NODE_W/2, hh = NODE_H/2;
  const tHit = Math.min(hw/(Math.abs(ux)||1e-9), hh/(Math.abs(uy)||1e-9));

  return { x: f.cx + ux*tHit + lx*lateralPx,
           y: f.cy + uy*tHit + ly*lateralPx };
}

function edgePath(fromId, toId, lateralPx) {
  const s = borderPoint(fromId, toId,  lateralPx);
  const e = borderPoint(toId, fromId, -lateralPx); // reversed node, opposite sign
  const dx = e.x-s.x, dy = e.y-s.y, len = Math.sqrt(dx*dx+dy*dy)||1;
  const CURVE = 24; // constant 24px perpendicular curve on all edges
  const nx = (-dy/len)*CURVE, ny = (dx/len)*CURVE;
  const mx = (s.x+e.x)/2, my = (s.y+e.y)/2;
  return `M ${s.x} ${s.y} Q ${mx+nx} ${my+ny} ${e.x} ${e.y}`;
}
```

The **key rule**: both the source exit point AND the target entry point are shifted by
`lateralPx` (source: `+lateral`, target: `-lateral` because the target uses the reversed
direction), creating truly parallel paths rather than paths that share endpoints.

### Node layout algorithm (simple grid fallback)

If you cannot infer a meaningful spatial layout from the codebase, use a simple grid:

```js
function layoutNodes(packages) {
  const cols = Math.ceil(Math.sqrt(packages.length));
  return packages.map((pkg, i) => ({
    ...pkg,
    cx: (i % cols) * 220 + 115,
    cy: Math.floor(i / cols) * 200 + 100,
  }));
}
```

---

## Step 4 — Deliver the files

1. Write `flows.json` to `/mnt/user-data/outputs/flows.json`
2. Write `flow-explorer.html` to `/mnt/user-data/outputs/flow-explorer.html`
   (with the JSON embedded inline as described above)
3. Call `present_files` with both paths.
4. Tell the user:
   - Open `flow-explorer.html` in a browser (double-click works because the JSON is inline).
   - Edit `flows.json` to add or change flows, then re-run the skill (or paste the updated
     JSON back into the `<script>` block in the HTML).

---

## Iteration loop

After the user reviews the output:

- **"Add a flow"** → append to `flows[].steps` in `flows.json`, re-embed, re-deliver HTML.
- **"Wrong packages"** → update `packages[]` array, re-run layout, re-deliver.
- **"I want a different layout / colour scheme"** → patch the CSS/layout section of the HTML.

Always re-deliver both files together so they stay in sync.

---

## Quality checklist before delivering

- [ ] Every `from` / `to` in every flow step references a valid package `id`
- [ ] No two packages share the same `id`
- [ ] Edges animate in the correct sequence when a flow is selected
- [ ] Clicking "Reset" returns the diagram to a neutral state
- [ ] The HTML opens without a local server (JSON is inline)
- [ ] The page title reflects the actual app name (not a placeholder)
- [ ] Detail panel is visible and readable at 1280px width