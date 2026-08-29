/* ==========================================================================
   STONKEX STRATEGY — site configuration
   --------------------------------------------------------------------------
   This is the only file you need to edit.
   ========================================================================== */

window.STONKEX_CONFIG = {
  /* ---- Token ---------------------------------------------------------- */

  // $STONKEXSTR on Base — the token people buy, and the one the CA button copies.
  contractAddress: '0x80081d759E5e0154fB15D5ee8De5085D89E3dCcC',

  // $STONKEX, the reward token. Only used to price "total distributed" in USD
  // when the rewards source doesn't already give a USD figure.
  rewardTokenAddress: null,

  chain: 'base',    // DexScreener chain slug
  chainId: 8453,    // EVM chain id

  /* ---- Links ---------------------------------------------------------- */

  links: {
    x: 'https://x.com/Stonks_Exchange',

    // Leave null to auto-build a DexScreener link from the contract address.
    chart: null,

    launchedIn: 'https://www.thestonks.exchange/',
    rewardsBy: 'https://www.stockify.finance/',
  },

  /* ======================================================================
     DATA SOURCES
     Each source fills in the fields it knows about. Later sources win, so
     `rewards` can override anything. Whatever no source provides falls back
     to `stats` below, and anything still missing renders as "—".
     ====================================================================== */

  sources: {

    /* Market cap, liquidity, 24h volume, and the token price.
       Public API, no key, CORS-enabled. */
    dexscreener: {
      enabled: true,
    },

    /* Holder count. DexScreener does not report holders, so it comes from a
       Base block explorer.

       mode:
         'blockscout' — https://base.blockscout.com, free, no key  (default)
         'etherscan'  — Etherscan V2 multichain API. The tokenholdercount
                        action requires a paid Etherscan API plan.
         'none'       — don't fetch holders                                  */
    holders: {
      enabled: true,
      mode: 'blockscout',
      blockscoutBase: 'https://base.blockscout.com',
      etherscanApiKey: '',
    },

    /* Rewards figures — total fees collected and total $STONKEX distributed.
       These are project numbers, so they come from the project's own API.

       ▸ SET `url` TO THE JSON ENDPOINT that backs
         https://www.thestonks.exchange/token/<contract>
         (open that page, DevTools ▸ Network ▸ Fetch/XHR, and copy the request
         that carries the reward totals).

       `fields` maps our metric names onto that response. Values are dot-paths,
       so 'data.stats.totalFeesUsd' and 'rewards.0.amount' both work. Several
       common spellings are listed per metric — the first one that resolves to a
       number wins, so you can usually just add yours to the front of the list.

       The endpoint must send permissive CORS headers, since the browser calls
       it directly. If it doesn't, proxy it from your own domain.              */
    rewards: {
      enabled: true,
      url: null,

      fields: {
        totalFeesCollected: [
          'totalFeesCollected', 'totalFeesUsd', 'feesCollectedUsd', 'fees.totalUsd',
          'data.totalFeesCollected', 'stats.totalFeesCollected',
        ],
        totalDistributed: [
          'totalDistributed', 'totalRewardsDistributed', 'rewardsDistributed',
          'data.totalDistributed', 'stats.totalDistributed',
        ],
        totalDistributedUsd: [
          'totalDistributedUsd', 'totalRewardsDistributedUsd', 'rewardsDistributedUsd',
          'data.totalDistributedUsd', 'stats.totalDistributedUsd',
        ],
        holders: [
          'holders', 'holderCount', 'totalHolders', 'data.holders', 'stats.holders',
        ],
        marketCap: ['marketCap', 'marketCapUsd', 'data.marketCap'],
        liquidity: ['liquidity', 'liquidityUsd', 'data.liquidity'],
        volume24h: ['volume24h', 'volume24hUsd', 'volumeUsd24h', 'data.volume24h'],
      },
    },
  },

  // How often to refresh, in seconds. 0 disables auto-refresh.
  refreshSeconds: 60,

  /* ---- Fallbacks ------------------------------------------------------ */
  // Used only where no source supplies a value. Leave a field null and the
  // tile shows "—" rather than a number that isn't real.

  stats: {
    totalFeesCollected: null,
    totalDistributed: null,
    totalDistributedUsd: null,
    holders: null,
    marketCap: null,
    liquidity: null,
    volume24h: null,
  },

  /* ---- Sparklines ----------------------------------------------------- */
  /* Trend lines are drawn from real observations only:

       1. a `history` object on the rewards response, if it sends one —
          { "marketCap": [ ... ], "holders": [ ... ] } — oldest to newest; or
       2. a rolling series this browser records as the page refreshes, kept in
          localStorage.

     A tile with fewer than 3 real points draws no line. Turn `useSample` on to
     draw the placeholder shapes below instead — they are decorative, not data,
     so only use it for screenshots.                                          */

  historyPoints: 24,   // how many observations to keep per metric
  useSample: false,

  sampleHistory: {
    fees: [12, 15, 14, 19, 22, 20, 26, 31, 29, 36, 42, 48],
    distributed: [10, 13, 17, 16, 21, 25, 24, 30, 34, 33, 41, 47],
    holders: [8, 11, 10, 15, 18, 17, 23, 26, 30, 29, 38, 44],
    marketCap: [14, 12, 18, 21, 19, 25, 29, 27, 34, 38, 41, 46],
    liquidity: [9, 12, 11, 16, 20, 18, 24, 23, 29, 33, 37, 43],
    volume24h: [16, 13, 20, 18, 24, 28, 26, 32, 30, 37, 40, 45],
  },
};
