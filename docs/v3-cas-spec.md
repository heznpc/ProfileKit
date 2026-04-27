# v3 — CAS-style README composer (MVP scope C)

## Context

ProfileKit's stated ethos: *"no ratings, no rankings, just clean customizable cards."* An earlier rebrand attempt framed composition as a community-marketplace thesis ("human craft layer"); that has been reverted (#13). v3 picks the idea back up at the right level: an in-playground composer for assembling and customizing your own README, drawing on Sims 3 Create-A-Style as a **UX reference** — not as brand metaphor.

## User mental model

Cards are **items**: customizable + swappable components. A README is built by:

1. Picking cards from an inventory ("아이템")
2. Arranging them into a sequence
3. Customizing each card via slots ("교체 가능한 부품")

Two layers, both swappable:

- **Layer 1 (intra-card)** — each card declares slots (bg / name / theme / font / …); the user fills them.
- **Layer 2 (inter-card)** — the README is a list of blocks (card or markdown); the user reorders, adds, removes.

## Data model

### Card slot declaration

```ts
hero: {
  slots: {
    bg:       { type: 'enum',   options: ['gradient','wave','grid','particles'], param: 'bg' },
    name:     { type: 'text',                                                     param: 'name' },
    subtitle: { type: 'text',                                                     param: 'subtitle' },
    theme:    { type: 'enum',   options: THEMES,                                  param: 'theme' },
    font:     { type: 'enum',   options: FONTS,                                   param: 'font' },
    width:    { type: 'number', range: [400, 1600],                               param: 'width' },
    height:   { type: 'number', range: [120, 400],                                param: 'height' },
  }
}
```

Slot types: `enum` | `text` | `color` | `number`. Each slot maps to one `?param=` on the card endpoint.

### README composition

```ts
README = {
  blocks: [
    { type: 'card',     card_type: 'hero', slots: { bg: 'wave', name: 'heznpc', ... } },
    { type: 'markdown', content: '## Foundation' },
    { type: 'card',     card_type: 'pin',  slots: { username: 'heznpc', repo: 'AirMCP', ... } },
    ...
  ]
}
```

Serializes to README markdown with `<picture>` tags wrapping each card (dark + light pair for OS-theme awareness).

## UI — three-pane editor

```
┌────────────┬──────────────────────────┬──────────────┐
│ INVENTORY  │  COMPOSITION             │ SLOT         │
│            │                          │ INSPECTOR    │
│ Data       │  [hero card]      ▒▒▒    │              │
│  · stats   │  ## Foundation     ⌃⌄    │ bg: ▼ wave   │
│  · pin     │  [pin card]        ⌃⌄    │ name: ___    │
│  · ...     │  [pin card]        ⌃⌄    │ theme: ▼ ... │
│ Animations │  + Add block             │ font: ▼ ...  │
│  · matrix  │                          │ width: 900   │
│  · snake   │  [Copy README markdown]  │ height: 220  │
└────────────┴──────────────────────────┴──────────────┘
```

- **Left** — card inventory, grouped by category (Data / Blog Layout / Animations / Composition / Utility). Click to add to composition (drag-and-drop in v3.3).
- **Center** — README block list. Click = select; drag handle = reorder; ⊘ = remove.
- **Right** — slot inspector for the currently selected block.

Existing Cards / Templates tabs are preserved as-is. The composer is added as a new top-level tab (likely "Compose").

## MVP scope (C)

Vertical slice with intentionally narrow surface so we can validate the model end-to-end:

- Card types supported: **hero only**
- Slots exposed for hero: `bg`, `name`, `subtitle`, `theme`
- Block types: `card` (hero), `markdown` (raw text input)
- Reorder: yes (drag handle on each block)
- Add: click an inventory item
- Remove: per-block ⊘ button
- Live preview rendering: existing `/api/hero?…` endpoint, fetched on every slot change (debounced)
- Storage: `localStorage` key `profilekit.composition.draft`
- Output: a "Copy README markdown" button generates the full snippet

### Out of scope for MVP-C (deferred)

- Other 27 card types — will follow once hero proves the pattern (v3.2)
- Inline direct-manipulation on the preview itself (click on hero text → edit) — slot inspector is the editor for v3 MVP (v3.4)
- URL-encoded share links for full compositions (v3.1)
- Drag-from-inventory (currently click-to-add) (v3.3)
- Backend / gallery (v4)

## Architectural decisions

- Slot declarations live in the **playground** (`public/slots.js`), not in ProfileKit endpoint code. Endpoints stay pure SVG renderers; the playground owns editor metadata.
- Composition state is JSON in `localStorage`. No server.
- Preview renders via the real `/api/*` endpoints (same as today). No divergent rendering pipeline.
- The composer is additive — existing Cards and Templates tabs are untouched.

## Roadmap after MVP-C

| Phase | Scope |
|---|---|
| **v3.1** | URL-share for full compositions (`/c/<base64>` route) |
| **v3.2** | Slot definitions for stats, languages, pin, snake, hero (top-5 cards by usage) |
| **v3.3** | Drag-from-inventory (currently click-to-add) |
| **v3.4** | Inline direct-manipulation on preview (click hero bg → opens picker over the card) |
| **v4** | Gallery — single-card preset registry |

## Explicit non-goals (永)

- Ratings, rankings, leaderboards
- Remix lineage, attribution graph
- Marketplace, paid templates
- Cross-agent compile (Cursor / Codex) — separate feature, parallel track
- Brand thesis copy ("human craft layer", "Sims 3 CAS for devs") — UX reference only, not brand
