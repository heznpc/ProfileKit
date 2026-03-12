# ProfileKit

All-in-one GitHub profile cards. No ratings, no rankings — just clean, customizable cards.

One service replaces 5–6 scattered tools. Deploy once on Vercel, use everywhere.

## Examples

<p>
  <img src="https://profilekit.vercel.app/api/stats?username=heznpc" alt="Stats" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/languages?username=heznpc" alt="Languages" />
  <img src="https://profilekit.vercel.app/api/languages?username=heznpc&compact=true" alt="Languages Compact" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/reviews?username=heznpc" alt="Reviews" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/typing?lines=ProfileKit,All-in-one+GitHub+profile+cards&color=58a6ff&align=center&width=500&height=40" alt="Typing" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/quote?daily=true" alt="Quote" />
</p>

<p>
  <img src="https://profilekit.vercel.app/api/social?github=heznpc&email=heznpc@gmail.com&layout=compact" alt="Social" />
</p>

## Endpoints

| Endpoint | Description | Example |
|----------|-------------|---------|
| `/api/stats` | GitHub stats — commits, PRs, issues, stars, repos | `?username=heznpc` |
| `/api/languages` | Top languages with percentage bars | `?username=heznpc` |
| `/api/reviews` | Code review stats — approval rate, review count | `?username=heznpc` |
| `/api/typing` | Typing animation | `?lines=Hello,World&color=58a6ff` |
| `/api/quote` | Random or daily dev quotes | `?daily=true` |
| `/api/social` | Social links card | `?github=heznpc&linkedin=heznpc` |
| `/api/leetcode` | LeetCode stats with difficulty breakdown | `?username=heznpc` |

## Usage

```markdown
![Stats](https://profilekit.vercel.app/api/stats?username=heznpc)
![Languages](https://profilekit.vercel.app/api/languages?username=heznpc)
![Reviews](https://profilekit.vercel.app/api/reviews?username=heznpc)
![Typing](https://profilekit.vercel.app/api/typing?lines=Hello,World)
![Quote](https://profilekit.vercel.app/api/quote)
![Social](https://profilekit.vercel.app/api/social?github=heznpc&x=heznpc)
![LeetCode](https://profilekit.vercel.app/api/leetcode?username=heznpc)
```

## Themes

Three built-in themes. Pass `?theme=` to any endpoint.

| Theme | Background | Accent |
|-------|-----------|--------|
| `dark` (default) | `#0d1117` | `#58a6ff` |
| `dark_dimmed` | `#22272e` | `#539bf5` |
| `light` | `#ffffff` | `#0969da` |

Override individual colors with query params:

```
?bg_color=000000&text_color=ffffff&title_color=58a6ff&icon_color=58a6ff&border_color=30363d
```

## Common Options

These work on all endpoints (where applicable):

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

## Endpoint-Specific Options

### /api/stats
| Param | Description |
|-------|-------------|
| `hide` | Comma-separated: `commits,prs,issues,stars,repos,contributed` |

### /api/languages
| Param | Description |
|-------|-------------|
| `langs_count` | Number of languages (default: 6, max: 10) |
| `hide` | Comma-separated language names to exclude |
| `compact` | `true` for stacked bar layout |

### /api/reviews
| Param | Description |
|-------|-------------|
| `username` | GitHub username (required) |

### /api/typing
| Param | Description |
|-------|-------------|
| `lines` | Comma-separated lines of text (required) |
| `font` | Font family (default: `monospace`) |
| `size` | Font size (default: 20) |
| `weight` | Font weight (default: 400) |
| `color` | Text color |
| `speed` | Typing speed in ms per character (default: 100) |
| `pause` | Pause after typing in ms (default: 1500) |
| `cursor` | `true` / `false` (default: true) |
| `align` | `left` / `center` / `right` |
| `width` | SVG width (default: 500) |
| `height` | SVG height (default: 50) |

### /api/quote
| Param | Description |
|-------|-------------|
| `daily` | `true` for same quote all day, otherwise random |
| `width` | Card width (default: 495) |

### /api/social
| Param | Description |
|-------|-------------|
| `github` | GitHub username |
| `linkedin` | LinkedIn username |
| `x` | X (Twitter) username |
| `email` | Email address |
| `website` | Website URL |
| `youtube` | YouTube channel |
| `layout` | `default` (vertical) / `compact` (horizontal icons) |

### /api/leetcode
| Param | Description |
|-------|-------------|
| `username` | LeetCode username (required) |

## Design

Every card features:
- Gradient accent bar at the top
- Smooth fade-in animations
- Icon backgrounds with subtle opacity
- Accent-colored values for visual hierarchy
- Gradient progress bars (languages)
- Consistent 495px width across cards

## Self-Hosting

1. Fork this repo
2. Deploy to [Vercel](https://vercel.com/new)
3. Add environment variable: `GITHUB_TOKEN` — [create one here](https://github.com/settings/tokens) (no scopes needed for public data)
4. Done. Your endpoints are at `https://your-project.vercel.app/api/*`

## Tech

- Zero runtime dependencies
- Node.js 18+ (native fetch)
- Pure SVG string templates
- Vercel serverless functions
- 30-minute CDN cache

## License

MIT
