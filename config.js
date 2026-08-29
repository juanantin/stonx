/* ==========================================================================
   STONKEX STRATEGY — site configuration
   --------------------------------------------------------------------------
   This is the only file you need to edit.
   ========================================================================== */

window.STONKEX_CONFIG = {
  /* ---- Token ---------------------------------------------------------- */

  // $STONKEXSTR on Base — the token people buy, and the one the CA button copies.
  contractAddress: '0x80081d759E5e0154fB15D5ee8De5085D89E3dCcC',

  // $STONKEX, the reward token — confirmed as the `quote` side of this token's
  // pair in the /api/coins listing, where the same address is "The Stonks
  // Exchange" (STONKEX). Used to price "total distributed" in USD when the
  // rewards source doesn't already give a USD figure.
  rewardTokenAddress: '0x5ab000ff9B9FfE0349CE5ffA5fD86f217C3680F5',

  chain: 'base',    // DexScreener chain slug
  chainId: 8453,    // EVM chain id

  /* Related contracts, from thestonks.exchange's own APIs. Recorded here for
     reference — nothing reads them yet.
       pool         the STONKEXSTR/STONKEX pool           (/api/coins)
       feeLocker    where trading fees accrue             (/api/coins)
       rewardsIndex the "rewards" routing target for this
                    token, i.e. the distributor           (/api/fee-routing) */
  contracts: {
    pool: '0x550b95fcb0e309c552FAe9670b1A514D443CA463',
    rewardPool: '0x7692AcC1CDd771D09EbCae3663e1843b2911BEC7',  // STONKEX/WETH
    feeLocker: '0x71D1D363176723f85d98B8B430DF33cde89f0A7f',
    rewardsIndex: '0xf01a4dabfd54d1A6a1812a95F7151e8DA851DE2E',
  },

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

    /* Holder count. DexScreener does not report holders, and no single explorer
       is reliable for a token this new — Blockscout was answering 0 for
       $STONKEXSTR, which just means it hasn't indexed the holders yet.

       So the providers below are tried IN ORDER and the first one to return a
       count above zero wins. A zero is treated as "no answer" and falls through
       to the next provider: a launched token with liquidity cannot have none.
       Run the page with ?debug=1 to see which provider answered.

         blockscout — base.blockscout.com. Free, no key.
         routescan  — indexes Base, Etherscan-compatible API. Free, no key.
         etherscan  — Etherscan V2 multichain. Needs `etherscanApiKey`, and its
                      tokenholdercount action requires a PAID Etherscan plan.
         moralis    — needs `moralisApiKey`; the free tier is enough.

       Providers without a key configured are skipped, so the two key-free ones
       are tried first and the rest only engage once you fill a key in. Set
       `enabled: false` (or mode: 'none') to stop fetching holders entirely. */
    holders: {
      enabled: true,
      providers: ['blockscout', 'routescan', 'etherscan', 'moralis'],

      blockscoutBase: 'https://base.blockscout.com',
      routescanBase: 'https://api.routescan.io/v2/network/mainnet/evm/8453',
      etherscanApiKey: '',
      moralisApiKey: '',
    },

    /* Rewards figures — total fees collected and total $STONKEX distributed.
       These are project numbers, so they come from the project's own API.

       ▸ SET `url` TO THE JSON ENDPOINT that carries the reward totals.
         Pass one URL or an array of them; each is read through `fields` below
         and the first source to yield a number for a metric wins.

       These thestonks.exchange endpoints have been checked and do NOT carry the
       totals — don't bother pointing at them again:
         /api/kols/airdrops?token=<ca>   KOL airdrops; empty for this token
         /api/fee-routing?pairs=<ca>:<feeLocker>
                                         routing config only — it is what told
                                         us fees route to "rewards" via the
                                         index contract recorded above
         /api/coins                      token metadata + supply, no totals

       The token page also issues Alchemy JSON-RPC calls, so the figures it
       renders are likely read straight off the rewards-index contract rather
       than served by an API. If so, they need either an endpoint that exposes
       them or an indexer — a browser cannot sum transfer logs over Base history.

       `fields` maps our metric names onto the response. Values are dot-paths,
       so 'data.stats.totalFeesUsd' and 'rewards.0.amount' both work. Several
       common spellings are listed per metric — the first one that resolves to a
       number wins, so you can usually just add yours to the front of the list.

       The endpoint must send permissive CORS headers, since the browser calls
       it directly. If it doesn't, proxy it from your own domain.              */
    rewards: {
      enabled: true,
      // A string, or an array of them. Defaults to the committed JSON file, so
      // the plumbing works with no infrastructure: edit data/rewards.json, push,
      // done. Add a real endpoint in front of it when you have one —
      //   url: ['https://api.example.com/stonkexstr', 'data/rewards.json'],
      // and the first source with a number for a metric wins.
      url: 'data/rewards.json',

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
