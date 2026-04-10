#!/usr/bin/env node
// Build-time: download Latin subset of selected Google Fonts and write
// src/data/fonts.js as a JS module that the cards can `require`.
//
// Usage:
//   node scripts/fetch-fonts.js
//
// Run this whenever the font catalog needs updating. The output file is
// committed so the serverless functions never make a network request.

const fs = require("fs");
const path = require("path");

// Each entry: key → { family, googleName, weights }
// Variable fonts cover all weights with a single woff2; we still pass the
// weight list so Google's CSS API gives us the right axis range.
const FONTS = {
  inter: {
    family: "Inter",
    googleName: "Inter",
    weights: "wght@400;500;600;700;800",
  },
  "space-grotesk": {
    family: "Space Grotesk",
    googleName: "Space+Grotesk",
    weights: "wght@400;500;600;700",
  },
  "jetbrains-mono": {
    family: "JetBrains Mono",
    googleName: "JetBrains+Mono",
    weights: "wght@400;500;600;700",
  },
  "ibm-plex-sans": {
    family: "IBM Plex Sans",
    googleName: "IBM+Plex+Sans",
    weights: "wght@400;500;600;700",
  },
  manrope: {
    family: "Manrope",
    googleName: "Manrope",
    weights: "wght@400;500;600;700;800",
  },
};

// Modern desktop UA so Google serves woff2 with subset URLs split by
// unicode-range. Older UAs get a single combined TTF.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Pull only the `latin` subset blocks from Google's CSS response. Each block
// looks like:
//   /* latin */
//   @font-face {
//     font-family: 'Inter';
//     ...
//     src: url(https://fonts.gstatic.com/...) format('woff2');
//     unicode-range: U+0000-00FF, ...;
//   }
// VF families return the same URL across weights — we dedupe.
function extractLatinFaces(css) {
  const blocks = css.split(/\/\*\s*([\w-]+)\s*\*\/\s*/);
  const faces = [];
  for (let i = 1; i < blocks.length; i += 2) {
    if (blocks[i] === "latin") {
      faces.push(blocks[i + 1]);
    }
  }
  return faces;
}

function parseFace(face) {
  const urlMatch = face.match(/url\((https:[^)]+)\)/);
  const weightMatch = face.match(/font-weight:\s*([\d\s]+)/);
  const styleMatch = face.match(/font-style:\s*(\w+)/);
  return {
    url: urlMatch ? urlMatch[1] : null,
    weight: weightMatch ? weightMatch[1].trim() : "400",
    style: styleMatch ? styleMatch[1] : "normal",
  };
}

async function fetchFont(key, def) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${def.googleName}:${def.weights}&display=swap`;
  process.stdout.write(`  ${def.family.padEnd(20)} ... `);
  const css = await fetchText(cssUrl);
  const faces = extractLatinFaces(css).map(parseFace).filter((f) => f.url);

  // Dedupe by URL — variable fonts share one woff2 across all weights.
  const byUrl = new Map();
  for (const f of faces) {
    if (!byUrl.has(f.url)) byUrl.set(f.url, []);
    byUrl.get(f.url).push(f);
  }

  let totalBytes = 0;
  const faceCss = [];
  for (const [url, group] of byUrl) {
    const buf = await fetchBuffer(url);
    totalBytes += buf.length;
    const b64 = buf.toString("base64");
    // For a variable font (one URL covering many weights) use the full
    // 100-900 range so any caller weight resolves through the VF axis. For
    // a static font (one URL per weight) emit the exact weight.
    const weight = group.length > 1 ? "100 900" : group[0].weight;
    const style = group[0].style;
    faceCss.push(
      `@font-face{font-family:'${def.family}';font-style:${style};font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2')}`
    );
  }

  const isVF = byUrl.size < faces.length;
  console.log(
    `${(totalBytes / 1024).toFixed(1)} KB raw, ${(faceCss.join("").length / 1024).toFixed(1)} KB css ${isVF ? "(VF)" : `(${byUrl.size} static)`}`
  );

  return { family: def.family, css: faceCss.join("") };
}

(async () => {
  console.log("Fetching Google Fonts (Latin subset):");
  // Parallel fetch — Google Fonts CDN handles concurrent requests fine and
  // this drops the wall clock from 5x sequential to ~1x.
  const entries = await Promise.all(
    Object.entries(FONTS).map(async ([key, def]) => [key, await fetchFont(key, def)])
  );
  const result = Object.fromEntries(entries);

  // Output as JSON instead of a JS module so cold-start parse uses the fast
  // JSON.parse path instead of the JS lexer (~4× faster on a 200 KB literal).
  const outPath = path.join(__dirname, "..", "src", "data", "fonts.json");
  fs.writeFileSync(outPath, JSON.stringify(result));
  const outBytes = fs.statSync(outPath).size;
  console.log(`\nWrote ${outPath} (${(outBytes / 1024).toFixed(1)} KB)`);
  console.log("Note: bundled fonts ship under the SIL Open Font License 1.1 (OFL-1.1).");
})().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
