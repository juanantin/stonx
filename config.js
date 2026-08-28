/* ==========================================================================
   STONKEX STRATEGY — site configuration
   --------------------------------------------------------------------------
   This is the only file you need to edit to point the page at the real
   token, the real chart and the real stats API.
   ========================================================================== */

window.STONKEX_CONFIG = {
  /* ---- Token ---------------------------------------------------------- */

  // The $STONKEXSTR contract address on Base — the token people buy, and the
  // one the CA button copies. Replace with the real one.
  contractAddress: '0x8a00000000000000000000000000000000007f3e',

  // The $STONKEX reward token address on Base. Only used to price the
  // "total distributed" figure in USD. Leave null if your stats endpoint
  // already returns `totalDistributedUsd`.
  rewardTokenAddress: null,

  chain: 'base',

  /* ---- Links ---------------------------------------------------------- */

  links: {
    x: 'https://x.com/Stonks_Exchange',

    // Leave null to auto-build a DexScreener link from the contract address.
    chart: null,

    launchedIn: 'https://www.thestonks.exchange/',
    rewardsBy: 'https://www.stockify.finance/',
  },

  /* ---- Live data ------------------------------------------------------ */

  // Market cap, liquidity, 24h volume and the $STONKEX price are pulled live
  // from DexScreener (free, no API key). Set to false to use only the values
  // in `stats` below.
  useDexScreener: true,

  // Optional project endpoint for the numbers DexScreener cannot know:
  // fees collected, $STONKEX distributed and holder count.
  //
  // It should return JSON shaped like:
  //   {
  //     "totalFeesCollected": 2845632.78,   // USD
  //     "totalDistributed":   12856324.68,  // $STONKEX tokens
  //     "totalDistributedUsd": 3128463.21,  // optional; derived from price if absent
  //     "holders":            8942,
  //     "marketCap":          6732518.32,   // optional, overrides DexScreener
  //     "liquidity":          1456892.19,   // optional, overrides DexScreener
  //     "volume24h":          883265.74,    // optional, overrides DexScreener
  //     "history": {                        // optional 12-point sparkline series
  //       "fees": [...], "distributed": [...], "holders": [...],
  //       "marketCap": [...], "liquidity": [...], "volume24h": [...]
  //     }
  //   }
  statsEndpoint: null,

  // How often to refresh the dashboard, in seconds. 0 disables auto-refresh.
  refreshSeconds: 60,

  /* ---- Fallback values ------------------------------------------------ */
  // Shown before the first fetch resolves, and whenever a source is
  // unavailable. Replace with your own launch-day numbers.

  stats: {
    totalFeesCollected: 2845632.78,
    totalDistributed: 12856324.68,
    totalDistributedUsd: 3128463.21,
    holders: 8942,
    marketCap: 6732518.32,
    liquidity: 1456892.19,
    volume24h: 883265.74,
  },

  /* ---- Sparkline history ---------------------------------------------- */
  // 12-point trend series, oldest → newest, one per tile.
  //
  // NOTE: these are SAMPLE shapes so the page renders like the design out of
  // the box. Serve real series from `statsEndpoint.history` to make the
  // sparklines meaningful — until then they are decorative.

  history: {
    fees: [12, 15, 14, 19, 22, 20, 26, 31, 29, 36, 42, 48],
    distributed: [10, 13, 17, 16, 21, 25, 24, 30, 34, 33, 41, 47],
    holders: [8, 11, 10, 15, 18, 17, 23, 26, 30, 29, 38, 44],
    marketCap: [14, 12, 18, 21, 19, 25, 29, 27, 34, 38, 41, 46],
    liquidity: [9, 12, 11, 16, 20, 18, 24, 23, 29, 33, 37, 43],
    volume24h: [16, 13, 20, 18, 24, 28, 26, 32, 30, 37, 40, 45],
  },
};
