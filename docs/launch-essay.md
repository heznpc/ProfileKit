# Craft your GitHub profile in an AI-default era

> Draft for dev.to / Hacker News / personal blog. Tune headline per platform.

---

The last time I browsed a stack of GitHub profile READMEs, I noticed something: they all looked the same.

Wave backgrounds, gradient banners, the exact same accent blue. Typography choices limited to what some generator picked. Even the copy felt interchangeable — "Full-stack engineer / Coffee enthusiast / Learning AI every day."

That's not a dig at the people who made them. It's what happens when the default path for everything becomes "AI generates it for me." In three years we went from hand-rolled HTML banners to prompting v0 or Midjourney for each hero image. The defaults got faster *and* more uniform at the same time.

## The Sims 3 corner of the internet

If you played The Sims 3 in the early 2010s, you remember CAS — Create-A-Style. It wasn't just a color picker. You could take any garment, any piece of furniture, any wallpaper, and swap its pattern on individual material slots. The same chair, 10,000 looks. Players spent more time in CAS than actually playing the game, and The Exchange (the upload / download community) grew into millions of user-submitted styles.

CAS worked because it hit a particular sweet spot:

- **Too open and you get blank-canvas paralysis.** Figma is 99% empty canvas. Most people can't bring themselves to start.
- **Too closed and there is no self-expression.** A form with 10 fields feels like paperwork, not craft.
- **In between: constrained creativity.** The garment silhouette is fixed. The pattern and color? Infinite. The constraint *is* the feature.

Sims 3 players weren't making better clothes than Maxis's in-house designers. They were making *theirs*. And sharing them is how communities formed.

## Where profile-card tools sit today

There are two camps, and there's a gap between them.

**The AI-default camp.** Point-and-click template sites, or prompt-driven generators. You describe what you want, something comes out, it's fine. Nothing you adjusted. Nothing to show for the ninety seconds.

**The Figma camp.** Hand-draw the whole thing in a design tool, export to PNG, embed in your README. Total freedom, zero structure. Most people never start, and if they do, it's stale in a week.

Between those sits a Sims-3-CAS-shaped hole.

## What I actually built

[ProfileKit](https://github.com/newtria/ProfileKit) is an SVG service with 28 composable card types — stats, languages, contribution snake, hero banners, terminal windows, neon signs, timelines, tag clouds, matrix rain. Everything is pure SVG, no JavaScript, animations via CSS + SMIL. It renders inside GitHub's image proxy, dev.to, Hashnode, Notion covers, slide decks.

Every visual property is a query parameter. Every theme is swappable. You can bring your own palette via a JSON gist. Five bundled variable fonts subset to Latin so you're not waiting on Google.

But the card catalog is the easy part. The real work was the [playground](https://profilekit.vercel.app) — a live editor where you pick a card, tweak every param in a right-hand panel, see the exact SVG GitHub will fetch, copy a URL. As of this week, there's a Templates tab with curated starting looks — and every state of the editor now encodes into a shareable URL.

That's v1. Here's the roadmap:

- **v2 — Shareable URL presets.** ✅ Shipped. Every state of the editor encodes to a URL. Share your look with anyone.
- **v3 — Direct manipulation.** Click on the hero background → color picker opens. Click on text → edit inline. The Figma moment of *"oh this is actually fun."*
- **v4 — Cross-agent.** Same recipe → Claude Code hooks, Cursor rules, Codex CLI config. Profile identity shouldn't be locked to one agent's ecosystem.
- **v5 — The Exchange.** Upload a look, get credit, remix other devs'. Sims 3 CAS + The Exchange, for developer profile walls.

## What about AI?

The thesis isn't anti-AI. That's the wrong fight.

AI makes *"nice"* easy. It does not make *"yours"* easy. The useful integration isn't "type a prompt and get a profile" — that's what everyone else is building, and the output converges on whatever GPT thinks a "nice profile" looks like. The useful integration is this:

- **Claude Vision** extracts a palette from a reference image you upload
- A **suggest-tagline** tool fires only if the hero subtitle field is empty and you ask for help
- The agent you're already talking to — Claude Code, Codex CLI, ChatGPT — can call ProfileKit as an **MCP server** (`@heznpc/profilekit-mcp` on npm) and render cards through conversation

AI handles the blank page. You handle the craft.

## Try it

- **Playground**: [profilekit.vercel.app](https://profilekit.vercel.app) — pick a card, tweak every param, copy the URL, share the preset link
- **Templates tab**: curated starting looks, one click to load into the editor
- **MCP server**: `npm i -g @heznpc/profilekit-mcp`, register in your agent's config, then ask *"give me a tokyo_night stats card for <your username>"*
- **Source**: [github.com/newtria/ProfileKit](https://github.com/newtria/ProfileKit) — MIT, fork-friendly, single router function so it deploys on Vercel Hobby

Two things I care about more than stars:

1. **Show me yours.** If you make a look you like, share the URL — I want to see it.
2. **Tell me where the defaults fail.** Font rendering, theme contrast, unexpected browsers. Issues open, PRs welcome.

In a world where most profiles converge on whatever the generator thinks a "nice profile" looks like, the ones that stand out will be the ones that were *authored*, not generated. ProfileKit is for the people who still want to author.
