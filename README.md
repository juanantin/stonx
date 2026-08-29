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
- **Hero** — the animated STONKEX Strategy banner, looping silently. The poster is
  the clip's own first frame, so poster → playback is seamless. Viewers with
  `prefers-reduced-motion: reduce` get the poster as a still and the video never
  downloads.
- **Dashboard** — six live tiles: total fees collected, total `$STONKEX` distributed
  (tokens plus its USD value), total holders, market cap, liquidity and 24h volume,
  each with a trend sparkline. Values blink a `…` placeholder until the first load
  resolves.
- **Ecosystem** — the [The Stonks Exchange](https://www.thestonks.exchange/) and
  [Stockify](https://www.stockify.finance/) lockups, each one the link itself.

## Data sources

Everything configurable lives in `config.js`. Each source fills in the fields it
knows about and they merge in order, so a later source overrides an earlier one.
Whatever no source provides falls back to `stats`, and anything still missing
renders as `—` rather than as a number that isn't real.

| Metric | Source | Status |
|---|---|---|
| Market cap, liquidity, 24h volume | DexScreener | live, no key |
| Holders | Base Blockscout | live, no key |
| Total fees collected | project rewards API | **needs `sources.rewards.url`** |
| Total $STONKEX distributed | project rewards API | **needs `sources.rewards.url`** |

### Market data — DexScreener

`GET https://api.dexscreener.com/latest/dex/tokens/<contract>`. Public, no key,
CORS-enabled. Of the pairs it returns, the deepest-liquidity one on `chain` is
used; `marketCap` is preferred over `fdv`.

### Holders — Blockscout

DexScreener does not report holder counts, so they come from
`https://base.blockscout.com/api/v2/tokens/<contract>` (free, no key). Blockscout
has shipped the field as both `holders` and `holders_count`; both are read.

Set `sources.holders.mode` to `'etherscan'` to use the Etherscan V2 multichain API
instead — note its `tokenholdercount` action requires a paid Etherscan plan, and
you must supply `sources.holders.etherscanApiKey`.

### Rewards — the project's own API

Fees collected and `$STONKEX` distributed are project figures that no explorer
knows. Point `sources.rewards.url` at the JSON endpoint behind
<https://www.thestonks.exchange/token/0x80081d759E5e0154fB15D5ee8De5085D89E3dCcC>:

1. open that page,
2. DevTools ▸ Network ▸ Fetch/XHR,
3. reload, and find the request carrying the reward totals,
4. copy its URL into `sources.rewards.url`.

`sources.rewards.fields` maps our metric names onto that response using dot-paths
(`data.stats.totalFeesUsd`, `rewards.0.amount`). Several common spellings are
listed per metric and the first that resolves to a number wins, so usually you
just add the response's own key to the front of a list.

The endpoint must send permissive CORS headers, since the browser calls it
directly. If it doesn't, proxy it from your own domain.

If it returns tokens but no USD figure for them, set `rewardTokenAddress` to the
`$STONKEX` contract and the USD value is derived from its live DexScreener price.

### Debugging

Append `?debug=1` to the URL. Every source logs its raw response and the merged
result to the console, so you can see exactly which one supplied each number.

`refreshSeconds` controls the poll interval (default 60).

## Sparklines

Trend lines are drawn from real observations only:

1. a `history` object on the rewards response, if it sends one —
   `{ "marketCap": [ … ], "holders": [ … ] }`, oldest to newest; or
2. a rolling series the browser records as the page refreshes, kept in
   `localStorage` (`historyPoints` observations per metric, default 24).

A tile with fewer than three real points draws no line, so a first-time visitor
sees the numbers before the trends. Set `useSample: true` to draw the placeholder
shapes in `sampleHistory` instead — they are decorative, not data, so use that
only for screenshots.

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
  `images/stkstr_icon.png`. Regenerate them together if the mark changes
  (apple-touch-icon is flattened onto white — iOS renders transparency as black).
- `images/stonkex_header.mp4` is the source clip stripped of its audio track and
  re-encoded (2.2MB → 627KB). It is **768×384**, so it is upscaled roughly 2.5× on a
  desktop retina screen and looks soft there — re-export at 1536×768 or larger and
  drop it in if you want it crisp. `images/stonkex_header.png` is kept only as the
  Open Graph share image.
- On mobile the hero runs edge to edge, the dashboard drops to two tiles per row, and
  the ecosystem blocks centre. Tested at 390px wide with no horizontal overflow.
