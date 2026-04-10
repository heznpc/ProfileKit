# ProfileKit Examples — Beyond GitHub README

ProfileKit cards are SVG. The same endpoint that powers your GitHub README can render banners for almost any developer-facing surface that accepts external SVG via `<img>` (see [Where it works](../README.md#where-it-works) in the main README).

This file is a gallery of dimension presets for the contexts that work today. Every example is a single URL — copy, edit the parameters, paste.

---

## Hashnode post header / banner

Hashnode's recommended cover image is 1600 × 400 (16:4). The hero card scales naturally to this aspect:

```
https://profilekit.vercel.app/api/hero
  ?name=From+Zero+to+Production
  &subtitle=Notes+on+shipping+small+services
  &bg=wave
  &font=space-grotesk
  &width=1600
  &height=400
  &theme=tokyo_night
```

![Hashnode banner example](https://profilekit.vercel.app/api/hero?name=From+Zero+to+Production&subtitle=Notes+on+shipping+small+services&bg=wave&font=space-grotesk&width=1600&height=400&theme=tokyo_night)

---

## dev.to bio cover image

dev.to profile cover is 1000 × 420. Use a quieter background so the navigation chrome doesn't fight it:

```
https://profilekit.vercel.app/api/hero
  ?name=Your+Name
  &subtitle=Backend+%2F+Distributed+systems
  &bg=gradient
  &font=inter
  &width=1000
  &height=420
  &theme=dracula
```

![dev.to bio cover example](https://profilekit.vercel.app/api/hero?name=Your+Name&subtitle=Backend+%2F+Distributed+systems&bg=gradient&font=inter&width=1000&height=420&theme=dracula)

---

## Notion page cover

Notion's full-width cover is roughly 1500 × 600. The `particles` background works well at this size because the random points distribute over the larger canvas:

```
https://profilekit.vercel.app/api/hero
  ?name=Engineering+Notes
  &subtitle=A+working+log
  &bg=particles
  &font=ibm-plex-sans
  &width=1500
  &height=600
  &theme=catppuccin_mocha
```

![Notion cover example](https://profilekit.vercel.app/api/hero?name=Engineering+Notes&subtitle=A+working+log&bg=particles&font=ibm-plex-sans&width=1500&height=600&theme=catppuccin_mocha)

---

## Conference slide cover (16:9)

For talk slide covers at 1280 × 720. The default text sizes are calibrated for banners, so on full HD slides the title will read as a tasteful subtitle rather than a billboard — pair it with the actual talk title in your slide tool:

```
https://profilekit.vercel.app/api/hero
  ?name=Building+the+Personal+Brand+Stack
  &subtitle=One+SVG+service%2C+every+context
  &bg=grid
  &font=space-grotesk
  &width=1280
  &height=720
  &theme=rose_pine
```

![Slide cover example](https://profilekit.vercel.app/api/hero?name=Building+the+Personal+Brand+Stack&subtitle=One+SVG+service%2C+every+context&bg=grid&font=space-grotesk&width=1280&height=720&theme=rose_pine)

---

## Personal site hero strip

The default hero dimensions (1200 × 280–400) drop straight into a personal site as the top-of-page hero. Pair with a `?theme=` matching your site palette:

```
https://profilekit.vercel.app/api/hero
  ?name=Hi%2C+I%27m+Ren
  &subtitle=I+build+small+sharp+tools
  &bg=gradient
  &font=manrope
  &width=1200
  &height=400
  &theme=kanagawa
```

![Personal site hero example](https://profilekit.vercel.app/api/hero?name=Hi%2C+I%27m+Ren&subtitle=I+build+small+sharp+tools&bg=gradient&font=manrope&width=1200&height=400&theme=kanagawa)

---

## What doesn't fit (yet)

- **Big-text slide titles**: the hero card's font sizes are calibrated for banners, not for billboard slide titles. For an 80–120pt slide title, render the cover separately and overlay the title in your slide tool — or wait for `?title_size=` to land.
- **Social cards** (X, LinkedIn, Slack unfurls): these surfaces require raster `og:image`. Export the SVG to PNG with any of the standard SVG-to-PNG converters before posting.
- **Multi-card layouts**: combining several cards into one image is the job of `/api/stack` (in development).

If you build something with ProfileKit in a context that isn't covered here, open a PR adding it to this file — verified examples are the most useful documentation.
