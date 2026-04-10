





















# ProfileKit

<p align="center">
  <img src="https://profilekit.vercel.app/api/hero?name=ProfileKit&subtitle=All-in-one+GitHub+profile+cards.+Designer+typography.&bg=wave&width=900&height=240&font=inter" alt="ProfileKit" />
</p>

All-in-one GitHub profile cards. No ratings, no rankings — just clean, customizable cards.
Stats, languages, blog-layout primitives, ten animated mood cards, and five bundled designer fonts. One service replaces 5–6 scattered tools. Deploy once on Vercel, use everywhere.

<p align="center">
  <img src="https://profilekit.vercel.app/api/divider?style=wave&width=900" alt="" />
</p>

## Data Cards

<p>
  <img src="https://profilekit.vercel.app/api/stats?username=heznpc" alt="Stats" />
  <img src="https://profilekit.vercel.app/api/stats?username=heznpc&layout=compact" alt="Stats Compact" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/languages?username=heznpc" alt="Languages" />
  <img src="https://profilekit.vercel.app/api/languages?username=heznpc&layout=donut" alt="Languages Donut" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/reviews?username=heznpc" alt="Reviews" />
  <img src="https://profilekit.vercel.app/api/pin?username=heznpc&repo=ProfileKit" alt="Pin" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/quote?daily=true" alt="Quote" />
  <img src="https://profilekit.vercel.app/api/social?github=heznpc&email=heznpc@gmail.com&layout=compact" alt="Social" />
</p>

<p align="center">
  <img src="https://profilekit.vercel.app/api/divider?style=dots&width=900" alt="" />
</p>

## Blog Layout

Stitch your README together like a blog: hero banner, section headers, dividers, content cards.

<p>
  <img src="https://profilekit.vercel.app/api/hero?name=Hello&subtitle=Building+things+that+ship&bg=gradient&width=900&height=200" alt="Hero gradient" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/section?title=About&subtitle=Engineer+%2F+writer&width=495" alt="Section" />
  <img src="https://profilekit.vercel.app/api/now?coding=ProfileKit&reading=DDIA&listening=Lo-fi&building=Side+projects" alt="Now" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/timeline?items=2024%3BJoined+team%3BWorking+on+AI%7C2023%3BBuilt+ProfileKit%3BOpen+source%7C2022%3BLearned+Rust%3BSide+project" alt="Timeline" />
  <img src="https://profilekit.vercel.app/api/tags?tags=React,TypeScript,Go:00add8,Python:3776ab,Postgres:336791,Rust:dea584,Docker:2496ed" alt="Tags" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/toc?items=About%3Babout%7CStats%3Bstats%7CProjects%3Bprojects%7CContact%3Bcontact" alt="TOC" />
  <img src="https://profilekit.vercel.app/api/posts?source=devto&username=ben&count=4" alt="Posts" />
</p>

<p align="center">
  <img src="https://profilekit.vercel.app/api/divider?style=gradient&width=900" alt="" />
</p>

## Animations

Pure SVG. No JavaScript. Renders inside GitHub's image proxy.

<p>
  <img src="https://profilekit.vercel.app/api/wave?text=ProfileKit&width=900&height=160" alt="Wave" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/terminal?commands=whoami,cat+%2Fetc%2Fmotd,ls+-la,git+status&width=600" alt="Terminal" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/neon?text=NEON&width=445&height=160" alt="Neon" />
  <img src="https://profilekit.vercel.app/api/glitch?text=GLITCH&width=445&height=160" alt="Glitch" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/matrix?text=MATRIX&width=600&height=200" alt="Matrix rain" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/snake?cols=53&rows=7" alt="Snake" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/equalizer?label=Now+Playing&bars=24&width=445" alt="Equalizer" />
  <img src="https://profilekit.vercel.app/api/heartbeat?text=Still+shipping&bpm=72&width=445" alt="Heartbeat" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/constellation?text=ProfileKit&width=600&height=200" alt="Constellation" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/radar?text=SCANNING&width=300&height=300" alt="Radar" />
  <img src="https://profilekit.vercel.app/api/typing?lines=ProfileKit,All-in-one+profile+cards,with+animations&color=58a6ff&align=center&width=560&height=300" alt="Typing" />
</p>

<p align="center">
  <img src="https://profilekit.vercel.app/api/divider?style=double&width=900" alt="" />
</p>

## Endpoints

| Endpoint | Description |
|----------|-------------|
| **Data** | |
| `/api/stats` | GitHub stats — commits, PRs, issues, stars, repos |
| `/api/languages` | Top languages with bars or donut |
| `/api/reviews` | Code review stats |
| `/api/pin` | Repository pin card |
| `/api/leetcode` | LeetCode stats |
| `/api/social` | Social links |
| `/api/quote` | Random or daily dev quote |
| **Blog Layout** | |
| `/api/hero` | Wide hero banner with animated background |
| `/api/section` | Section header with underline animation |
| `/api/divider` | Decorative divider (5 styles) |
| `/api/now` | "Currently" status card |
| `/api/timeline` | Vertical timeline |
| `/api/tags` | Tag cloud / skill pills |
| `/api/toc` | Table of contents |
| `/api/posts` | Latest posts from dev.to / Hashnode / RSS |
| **Animations** | |
| `/api/typing` | Typewriter text |
| `/api/wave` | Layered animated sin waves |
| `/api/terminal` | Terminal window with auto-typing commands |
| `/api/neon` | Neon glow with flicker |
| `/api/glitch` | RGB-split glitch text |
| `/api/matrix` | Matrix code rain |
| `/api/snake` | Standalone snake eating a contribution grid |
| `/api/equalizer` | Audio EQ bars |
| `/api/heartbeat` | EKG heartbeat line |
| `/api/constellation` | Twinkling stars + connections |
| `/api/radar` | Rotating radar sweep with blips |

## Usage

```markdown
![Hero](https://profilekit.vercel.app/api/hero?name=YourName&subtitle=Your+tagline&bg=wave)
![Stats](https://profilekit.vercel.app/api/stats?username=YOU)
![Tags](https://profilekit.vercel.app/api/tags?tags=React,TypeScript,Go,Python)
![Snake](https://profilekit.vercel.app/api/snake)
```

## Themes

Three built-in themes. Pass `?theme=` to any endpoint.

| Theme | Background | Text |
|-------|-----------|------|
| `dark` (default) | `#0d1117` | `#e6edf3` |
| `dark_dimmed` | `#22272e` | `#adbac7` |
| `light` | `#ffffff` | `#1f2328` |

Override individual colors with query params:

```
?bg_color=000000&text_color=ffffff&title_color=58a6ff&icon_color=58a6ff&border_color=30363d
```

## Common Options

These work on most card endpoints (where applicable):

| Param | Description |
|-------|-------------|
| `theme` | `dark` / `dark_dimmed` / `light` |
| `hide_border` | `true` to remove border |
| `hide_title` | `true` to remove title |
| `title` | Custom title text |
| `bg_color` | Background color |
| `text_color` | Text color |
| `title_color` | Title color |
| `icon_color` | Icon color |
| `border_color` | Border color |
| `accent_color` | Accent color — overrides gradient bar + stat/icon colors |
| `hide_bar` | `true` to remove gradient accent bar |
| `border_radius` | Border radius in px (default: 6) |
| `card_width` | Card width in px |
| `font` | Bundled designer font (see below) |

## Fonts

ProfileKit defaults to the system `Segoe UI` stack — fast, zero overhead. Pass `?font=` to embed one of five bundled Variable Fonts (Latin subset). Each adds ~30–65 KB of base64 woff2 to the SVG, but the response is CDN-cached so the cost is paid once.

| Key | Family | Best for | CSS size |
|-----|--------|----------|----------|
| `inter` | Inter | Data cards, neutral UI | ~63 KB |
| `space-grotesk` | Space Grotesk | Headers, geometric look | ~29 KB |
| `jetbrains-mono` | JetBrains Mono | Terminal, code, matrix rain | ~41 KB |
| `ibm-plex-sans` | IBM Plex Sans | Corporate, refined sans | ~52 KB |
| `manrope` | Manrope | Friendly, modern sans | ~32 KB |

Same card, five fonts:

<p>
  <img src="https://profilekit.vercel.app/api/stats?username=heznpc&font=inter&hide=issues,contributed" alt="Inter" />
  <img src="https://profilekit.vercel.app/api/stats?username=heznpc&font=space-grotesk&hide=issues,contributed" alt="Space Grotesk" />
</p>
<p>
  <img src="https://profilekit.vercel.app/api/stats?username=heznpc&font=jetbrains-mono&hide=issues,contributed" alt="JetBrains Mono" />
  <img src="https://profilekit.vercel.app/api/stats?username=heznpc&font=ibm-plex-sans&hide=issues,contributed" alt="IBM Plex Sans" />
</p>
<p>
  <img src="https://profilekit.vercel.app/api/stats?username=heznpc&font=manrope&hide=issues,contributed" alt="Manrope" />
</p>

```
?font=inter             # any card
?font=jetbrains-mono    # terminal, matrix, radar feel right
```

Bundled fonts are downloaded from Google Fonts and ship under the SIL Open Font License 1.1. To refresh or add fonts, edit `scripts/fetch-fonts.js` and run `node scripts/fetch-fonts.js`.

## Design Tokens

Common scale params accept either a friendly token name **or** a raw px number, so you can write `border_radius=lg` instead of memorizing `border_radius=6`. Token names match Tailwind/shadcn conventions.

**Radius** (`border_radius`)

| Token | px |
|-------|-----|
| `none` | 0 |
| `sm` | 2 |
| `md` | 4 |
| `lg` (default) | 6 |
| `xl` | 12 |
| `2xl` | 16 |
| `3xl` | 24 |
| `full` | 9999 |

```
?border_radius=full   # pill-shaped card
?border_radius=none   # sharp corners
?border_radius=20     # any raw px still works
```

The same scale (`xs / sm / md / lg / xl / 2xl / 3xl / 4xl`) is exposed for spacing and the type scale internally — see `src/common/tokens.js`. Designer-friendly param names will roll out across the rest of the catalog as cards adopt them.

## Playground

Live editor at the deployment root: <https://profilekit.vercel.app/>

Pick a card from the sidebar, tweak parameters in the right panel, copy the URL or markdown snippet. Every preview is rendered by the real `/api/*` endpoint, so what you see is exactly what GitHub will fetch.

## Endpoint-Specific Options

### Data

#### `/api/stats`
| Param | Description |
|-------|-------------|
| `username` | GitHub username (required) |
| `hide` | Comma-separated: `commits,prs,issues,stars,repos,contributed` |
| `layout` | `default` / `compact` |

#### `/api/languages`
| Param | Description |
|-------|-------------|
| `username` | GitHub username (required) |
| `langs_count` | Number of languages (default: 6, max: 10) |
| `hide` | Comma-separated language names to exclude |
| `layout` | `default` / `compact` / `donut` |

#### `/api/reviews`
| Param | Description |
|-------|-------------|
| `username` | GitHub username (required) |

#### `/api/pin`
| Param | Description |
|-------|-------------|
| `username` | GitHub username (required) |
| `repo` | Repository name (required) |
| `description` | Override the repo description |

#### `/api/leetcode`
| Param | Description |
|-------|-------------|
| `username` | LeetCode username (required) |

#### `/api/social`
| Param | Description |
|-------|-------------|
| `github` / `linkedin` / `x` / `email` / `website` / `youtube` | Identifiers |
| `layout` | `default` / `compact` |

> Note: clicking icons in the rendered card only works when the SVG is embedded directly (HTML `<object>` / inline SVG). GitHub README embeds via `<img>` show the icons but cannot navigate.

#### `/api/quote`
| Param | Description |
|-------|-------------|
| `daily` | `true` for the same quote all day |
| `width` | Card width (default: 495) |

### Blog Layout

#### `/api/hero`
| Param | Description |
|-------|-------------|
| `name` | Big text (default: `Hello, World`) |
| `subtitle` | Smaller line under the name |
| `bg` | `gradient` (default) / `wave` / `grid` / `particles` |
| `align` | `center` (default) / `left` |
| `color` | Accent color |
| `width` | Default 1200 |
| `height` | Default 280 |

#### `/api/section`
| Param | Description |
|-------|-------------|
| `title` | Section title (required) |
| `subtitle` | Optional subtitle |
| `align` | `left` (default) / `center` |
| `icon` | Single character / emoji shown before title |
| `color` | Override title color |
| `width` | Default 800 |

#### `/api/divider`
| Param | Description |
|-------|-------------|
| `style` | `line` (default) / `wave` *(animated)* / `dots` *(animated)* / `dashed` / `gradient` / `double` |
| `color` | Stroke color |
| `width` | Default 800 |
| `height` | Default 30 |

#### `/api/now`
| Param | Description |
|-------|-------------|
| `coding` / `building` / `learning` / `reading` / `listening` / `watching` / `playing` | Each adds a row |

#### `/api/timeline`
| Param | Description |
|-------|-------------|
| `items` | Pipe-separated entries: `when;title;desc\|when;title;desc` |

#### `/api/tags`
| Param | Description |
|-------|-------------|
| `tags` | Comma-separated. Optional `:hexcolor` per tag, e.g. `Go:00add8` |

#### `/api/toc`
| Param | Description |
|-------|-------------|
| `items` | Pipe-separated entries: `text;anchor\|text;anchor` |

#### `/api/posts`
| Param | Description |
|-------|-------------|
| `source` | `devto` (default) / `hashnode` / `medium` / `rss` |
| `username` | Author username (devto / hashnode / medium) |
| `url` | Feed URL (rss source) |
| `count` | Number of posts (default 5, max 10) |

### Animations

#### `/api/typing`
| Param | Description |
|-------|-------------|
| `lines` | Comma-separated lines of text (required) |
| `font` / `size` / `weight` / `color` / `speed` / `pause` / `cursor` / `align` / `width` / `height` | Standard typing options |
| `frame` | `true` to draw a card frame (background + border + accent bar) so it matches the data cards |
| `bg_color` / `border_color` / `accent_color` / `hide_border` / `hide_bar` / `border_radius` | Frame styling (used when `frame=true` or `bg_color` is set) |

#### `/api/wave`
| Param | Description |
|-------|-------------|
| `text` | Optional overlay text |
| `color` | Wave color |
| `waves` | Layer count (1–5, default 3) |
| `width` / `height` | Default 800 × 160 |

#### `/api/terminal`
| Param | Description |
|-------|-------------|
| `commands` | Comma-separated commands that auto-type in sequence |
| `prompt` | Prompt string (default `$`) |
| `window_title` | Window title (default `bash`) |
| `speed` | Per-char typing speed in ms (default 70) |
| `pause` | Pause between lines in ms (default 600) |
| `color` | Prompt color |
| `width` | Default 600 |

#### `/api/neon`
| Param | Description |
|-------|-------------|
| `text` | Text to render (default `NEON`) |
| `color` | Glow color (default magenta) |
| `size` | Font size (default 64) |
| `width` / `height` | Default 600 × 160 |

#### `/api/glitch`
| Param | Description |
|-------|-------------|
| `text` | Text to render (default `GLITCH`) |
| `color` | Base text color |
| `size` | Font size (default 64) |
| `width` / `height` | Default 600 × 160 |

#### `/api/matrix`
| Param | Description |
|-------|-------------|
| `text` | Optional overlay |
| `color` | Rain color (default green) |
| `density` | Column density multiplier (default 1) |
| `speed` | Animation speed multiplier (default 1) |
| `seed` | Pattern seed for deterministic output |
| `width` / `height` | Default 600 × 200 |

#### `/api/snake`
| Param | Description |
|-------|-------------|
| `color` | Snake / cell color |
| `empty_color` | Empty cell color |
| `cols` / `rows` | Grid size (default 53 × 7) |
| `cell_size` / `cell_gap` | Cell sizing |
| `duration` | Full loop duration in seconds (default 24) |
| `seed` | Pattern seed |

#### `/api/equalizer`
| Param | Description |
|-------|-------------|
| `bars` | Number of bars (4–60, default 24) |
| `label` | Optional label with LIVE indicator |
| `color` | Bar color |
| `width` / `height` | Default 495 × 140 |
| `seed` | Pattern seed |

#### `/api/heartbeat`
| Param | Description |
|-------|-------------|
| `text` | Optional label |
| `bpm` | Beats per minute (default 72) |
| `color` | Line color (default red) |
| `width` / `height` | Default 495 × 140 |

#### `/api/constellation`
| Param | Description |
|-------|-------------|
| `text` | Optional overlay |
| `color` | Star color |
| `density` | Star count multiplier (default 1) |
| `seed` | Pattern seed |
| `width` / `height` | Default 600 × 200 |

#### `/api/radar`
| Param | Description |
|-------|-------------|
| `text` | Optional label below the dish |
| `color` | Radar color |
| `blips` | Number of blips (default 5) |
| `speed` | Sweep duration in seconds (default 4) |
| `seed` | Blip placement seed |
| `width` / `height` | Default 300 × 300 (square) |

## Customization Examples

```
# Red accent, no border
?username=heznpc&accent_color=f85149&hide_border=true

# Minimal — no bar, no border, sharp corners
?username=heznpc&hide_bar=true&hide_border=true&border_radius=0

# Custom palette
?username=heznpc&bg_color=1a1b27&text_color=a9b1d6&title_color=7aa2f7&accent_color=bb9af7&border_color=292e42

# Hero with grid background
/api/hero?name=YourName&subtitle=Tagline&bg=grid&color=a371f7

# Terminal with custom commands
/api/terminal?commands=npm+run+dev,git+commit+-m+"ship+it",git+push&prompt=%E2%9D%AF&color=a371f7
```

## Self-Hosting

1. Fork this repo
2. Deploy to [Vercel](https://vercel.com/new)
3. Add environment variable: `GITHUB_TOKEN` — [create one here](https://github.com/settings/tokens) (no scopes needed for public data)
4. Done. Your endpoints are at `https://your-project.vercel.app/api/*`

## Tech

- Zero runtime dependencies
- Node.js 18+ (native fetch)
- Pure SVG string templates with CSS / SMIL animations
- Vercel serverless functions
- 30-minute CDN cache (12-hour for daily quotes)

## License

MIT
