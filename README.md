# STONKEX Strategy

Single-page site for **Stonk Exchange Strategy** — buy `$STONKEXSTR`, get `$STONKEX`.
1B total supply on Base chain.

Static HTML/CSS/JS. No build step, no dependencies, no framework.

```
index.html            markup
config.js             ← the only file you need to edit
assets/css/styles.css
assets/js/app.js
images/               branding
```

## What's on the page

- **Link bar** — the bull mark, X, chart, and a contract-address button that copies
  the CA to the clipboard and flashes a `COPIED!` confirmation.
- **Hero** — the STONKEX Strategy banner (WebP with a PNG fallback).
- **Dashboard** — six live tiles: total fees collected, total `$STONKEX` distributed
  (tokens plus its USD value), total holders, market cap, liquidity and 24h volume,
  each with a trend sparkline. Values blink a `…` placeholder until the first load
  resolves.
- **Ecosystem** — the [The Stonks Exchange](https://www.thestonks.exchange/) and
  [Stockify](https://www.stockify.finance/) lockups, each one the link itself.

## Setup

Everything configurable lives in `config.js`.

### 1. Set the contract address

```js
contractAddress: '0x…',   // $STONKEXSTR on Base — this is what the CA button copies
rewardTokenAddress: null, // $STONKEX, only used to price "total distributed" in USD
```

The chart button auto-builds a DexScreener link from the contract address. Set
`links.chart` to override it with Dexscreener, DexTools, or anything else.

### 2. Wire up the data

Market cap, liquidity, 24h volume and the `$STONKEX` price come from the public
DexScreener API automatically — no key, nothing to host. Set `useDexScreener: false`
to turn that off.

Fees collected, tokens distributed and the holder count can't be read from a DEX,
so they come from your own endpoint. Point `statsEndpoint` at a URL returning:

```json
{
  "totalFeesCollected": 2845632.78,
  "totalDistributed": 12856324.68,
  "totalDistributedUsd": 3128463.21,
  "holders": 8942,
  "history": { "fees": [12, 15, 14, "…12 points"] }
}
```

Every field is optional — whatever you send overrides the DexScreener value or the
fallback; whatever you leave out falls back. The endpoint must send permissive CORS
headers, since the browser calls it directly. `refreshSeconds` controls how often
the dashboard re-polls (default 60).

### 3. Replace the fallback numbers

The `stats` object holds the values shown before the first fetch resolves and
whenever a source is unreachable.

> ⚠️ **The `history` arrays are sample shapes**, there only so the sparklines render
> like the design out of the box. They are decorative until you serve real series
> from `statsEndpoint.history`. Replace them or the trend lines mean nothing.

## Running it

Any static host works — GitHub Pages, Netlify, Vercel, Cloudflare Pages, S3. Locally:

```bash
python3 -m http.server 8000
```

then open <http://localhost:8000>. (Clipboard copy needs `https://` or `localhost`;
the page falls back to `execCommand` elsewhere.)

## Notes

- Light theme only, by design — the brand artwork is built for a white ground.
- Both ecosystem lockups sit on the same white plate at a matched size. The
  Stonks.Exchange wordmark shipped near-white (built for a dark background), so
  `images/stonkex_button.png` has had that wordmark recoloured dark — the icon and
  the blue `.EXCHANGE` are untouched. Swap in an official light-background lockup
  if Stonks.Exchange publishes one.
- `images/logo.png`, `favicon.png` and `apple-touch-icon.png` are all generated from
  `images/stonx_logo.jpg`. Regenerate them together if the mark changes.
- On mobile the hero runs edge to edge, the dashboard drops to two tiles per row, and
  the ecosystem blocks centre. Tested at 390px wide with no horizontal overflow.
