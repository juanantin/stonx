/* ==========================================================================
   What the indexer watches.
   --------------------------------------------------------------------------
   ⚠ The addresses below come from thestonks.exchange's own APIs, but which
   flow represents "fees collected" versus "distributed" has NOT been confirmed
   against the contracts. Check /debug after the first sync and adjust before
   trusting the numbers — see worker/README.md.
   ========================================================================== */

export const CHAIN_ID = 8453;                    // Base

export const TOKENS = {
  // $STONKEXSTR — the token people buy
  STR: '0x80081d759E5e0154fB15D5ee8De5085D89E3dCcC',
  // $STONKEX — the reward token, 18 decimals
  KEX: '0x5ab000ff9B9FfE0349CE5ffA5fD86f217C3680F5',
};

export const CONTRACTS = {
  pool: '0x550b95fcb0e309c552FAe9670b1A514D443CA463',
  feeLocker: '0x71D1D363176723f85d98B8B430DF33cde89f0A7f',
  // /api/fee-routing reports this token routes to "rewards" via this contract
  rewardsIndex: '0xf01a4dabfd54d1A6a1812a95F7151e8DA851DE2E',
};

// The block $STONKEXSTR launched at, per /api/coins. Nothing relevant happened
// before it, so the scan starts here rather than at genesis.
export const START_BLOCK = 50530608;

/* Each stream sums ERC-20 Transfers matching token + from/to.

   `distributed` — $STONKEX leaving the rewards contract. If that contract
   serves other tokens too, this over-counts; narrowing it needs either a
   per-token distributor or an event from the contract's own ABI.

   `feesIn` — $STONKEX arriving at the fee locker. The locker address is shared
   across every coin on the platform, so this almost certainly over-counts as
   written and is the first thing to verify.

   `holders` — every $STONKEXSTR transfer, folded into a running balance per
   address. Counting addresses left with a positive balance gives the holder
   count exactly, with no explorer involved. This one needs no address
   guesswork, so unlike the two above it is correct as written. */
export const STREAMS = [
  { id: 'distributed', kind: 'sum', token: TOKENS.KEX, from: CONTRACTS.rewardsIndex, decimals: 18 },
  { id: 'feesIn', kind: 'sum', token: TOKENS.KEX, to: CONTRACTS.feeLocker, decimals: 18 },
  { id: 'holders', kind: 'balances', token: TOKENS.STR, decimals: 18 },
];

/* Addresses that hold supply but are not holders in the sense the tile means:
   the pool itself, the fee locker, the rewards contract. */
export const EXCLUDE_FROM_HOLDERS = [
  CONTRACTS.pool,
  CONTRACTS.feeLocker,
  CONTRACTS.rewardsIndex,
].map((a) => a.toLowerCase());

/* Scan pacing. A Worker run is short, so it takes bites and resumes. Raise
   MAX_CHUNKS_PER_RUN to backfill faster; lower CHUNK_SIZE if the RPC complains
   (it halves automatically anyway). */
export const CHUNK_SIZE = 2000;
export const MAX_CHUNKS_PER_RUN = 60;
export const CONFIRMATIONS = 5;

// Price the token totals in USD. Public, no key.
export const DEXSCREENER_PAIR =
  'https://api.dexscreener.com/latest/dex/pairs/base/' + CONTRACTS.pool;
export const DEXSCREENER_KEX_TOKEN =
  'https://api.dexscreener.com/latest/dex/tokens/' + TOKENS.KEX;
