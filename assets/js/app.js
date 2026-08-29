/* ==========================================================================
   STONKEX STRATEGY — app
   Contract-address copy, live dashboard, sparklines.
   ========================================================================== */

(function () {
  'use strict';

  var CFG = window.STONKEX_CONFIG || {};
  var LINKS = CFG.links || {};

  /* ---------------------------------------------------------------------
     Formatting
     --------------------------------------------------------------------- */

  var nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

  function usd(n) { return '$' + nf2.format(n); }
  function amount(n) { return nf2.format(n); }
  function count(n) { return nf0.format(Math.round(n)); }

  /* Each tile knows how to render its own number. */
  var FORMATTERS = {
    fees: usd,
    distributed: amount,
    distributedUsd: amount,
    holders: count,
    marketCap: usd,
    liquidity: usd,
    volume24h: usd,
  };

  /* ---------------------------------------------------------------------
     Contract address + links
     --------------------------------------------------------------------- */

  var address = String(CFG.contractAddress || '').trim();

  function shorten(addr) {
    if (!addr) return '—';
    return addr.length <= 12 ? addr : addr.slice(0, 4) + '…' + addr.slice(-4);
  }

  var caShort = document.getElementById('ca-short');
  if (caShort) caShort.textContent = shorten(address);

  var chartLink = document.getElementById('link-chart');
  if (chartLink) {
    chartLink.href = LINKS.chart ||
      ('https://dexscreener.com/' + (CFG.chain || 'base') + '/' + encodeURIComponent(address));
  }

  var xLink = document.getElementById('link-x');
  if (xLink && LINKS.x) xLink.href = LINKS.x;

  /* Copy-to-clipboard, with a fallback for non-secure contexts. */
  var copyBtn = document.getElementById('copy-ca');
  var toast = document.getElementById('copy-toast');
  var toastText = document.getElementById('toast-text');
  var toastTimer = null;

  function flashToast(message, isError) {
    if (!toast) return;
    toastText.textContent = message;
    toast.classList.toggle('is-error', !!isError);
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 1800);
  }

  function legacyCopy(text) {
    var el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(el);
    el.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(el);
    return ok;
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (!address) { flashToast('NO ADDRESS SET', true); return; }

      function fallback() {
        var ok = legacyCopy(address);
        flashToast(ok ? 'COPIED!' : 'COPY FAILED', !ok);
      }

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(address).then(
          function () { flashToast('COPIED!'); },
          fallback
        );
      } else {
        fallback();
      }
    });
  }

  /* ---------------------------------------------------------------------
     Sparklines
     Single series per tile, so no legend: the tile label names the metric.
     2px line, round caps, ~10% area wash, one end-marker with a surface ring.
     --------------------------------------------------------------------- */

  var SPARK_COLORS = {
    blue: '#1f55f0',
    green: '#2eb135',
  };

  /* Cardinal spline through the points, so the trend reads as a curve
     rather than a zig-zag. */
  function splinePath(pts, tension) {
    if (pts.length < 2) return '';
    var t = tension == null ? 0.5 : tension;
    var d = 'M' + pts[0].x.toFixed(2) + ',' + pts[0].y.toFixed(2);

    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;

      var c1x = p1.x + ((p2.x - p0.x) / 6) * t;
      var c1y = p1.y + ((p2.y - p0.y) / 6) * t;
      var c2x = p2.x - ((p3.x - p1.x) / 6) * t;
      var c2y = p2.y - ((p3.y - p1.y) / 6) * t;

      d += 'C' + c1x.toFixed(2) + ',' + c1y.toFixed(2) +
           ' ' + c2x.toFixed(2) + ',' + c2y.toFixed(2) +
           ' ' + p2.x.toFixed(2) + ',' + p2.y.toFixed(2);
    }
    return d;
  }

  var sparkSeq = 0;

  function drawSpark(host, series, colorKey) {
    var cs = getComputedStyle(host);
    var w = host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var h = host.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (!(w > 0) || !(h > 0) || !series || series.length < 2) return;

    var color = SPARK_COLORS[colorKey] || SPARK_COLORS.blue;
    var padY = 10;
    var min = Math.min.apply(null, series);
    var max = Math.max.apply(null, series);
    var span = max - min || 1;

    var pts = series.map(function (v, i) {
      return {
        x: (i / (series.length - 1)) * w,
        y: h - padY - ((v - min) / span) * (h - padY * 2),
      };
    });

    var line = splinePath(pts, 0.5);
    var area = line + 'L' + w.toFixed(2) + ',' + h + 'L0,' + h + 'Z';
    var last = pts[pts.length - 1];
    var gid = 'spark-grad-' + (++sparkSeq);

    host.innerHTML =
      '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true" focusable="false">' +
        '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.16"/>' +
          '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
        '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" ' +
              'stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="' + (last.x - 3).toFixed(2) + '" cy="' + last.y.toFixed(2) + '" r="4" ' +
              'fill="' + color + '" stroke="#fbfcfe" stroke-width="2"/>' +
      '</svg>';
  }

  var sparkHosts = Array.prototype.slice.call(document.querySelectorAll('[data-spark]'));
  var sparkData = Object.assign({}, CFG.history || {});

  function renderSparks() {
    sparkHosts.forEach(function (host) {
      drawSpark(host, sparkData[host.dataset.spark], host.dataset.color);
    });
  }

  if (typeof ResizeObserver === 'function' && sparkHosts.length) {
    var ro = new ResizeObserver(function () { renderSparks(); });
    sparkHosts.forEach(function (host) { ro.observe(host); });
  } else {
    window.addEventListener('resize', renderSparks);
    renderSparks();
  }

  /* ---------------------------------------------------------------------
     Values (with a count-up on change)
     --------------------------------------------------------------------- */

  var valueNodes = {};
  Array.prototype.forEach.call(document.querySelectorAll('[data-value]'), function (node) {
    valueNodes[node.dataset.value] = node;
  });

  var shown = {};
  var timers = {};
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setValue(key, target) {
    var node = valueNodes[key];
    if (!node || typeof target !== 'number' || !isFinite(target)) return;

    var fmt = FORMATTERS[key] || amount;
    var from = typeof shown[key] === 'number' ? shown[key] : 0;
    shown[key] = target;

    if (reduceMotion || from === target) {
      node.textContent = fmt(target);
      return;
    }

    cancelAnimationFrame(timers[key]);
    var start = performance.now();
    var dur = 900;

    (function step(now) {
      var p = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(from + (target - from) * eased);
      if (p < 1) timers[key] = requestAnimationFrame(step);
    })(start);
  }

  var painted = false;

  function paint(stats) {
    painted = true;
    ['fees', 'distributed', 'distributedUsd', 'holders', 'marketCap', 'liquidity', 'volume24h']
      .forEach(function (key) { setValue(key, stats[key]); });
  }

  /* ---------------------------------------------------------------------
     Data
     --------------------------------------------------------------------- */

  var note = document.getElementById('dash-note');

  function baseStats() {
    var s = CFG.stats || {};
    return {
      fees: s.totalFeesCollected,
      distributed: s.totalDistributed,
      distributedUsd: s.totalDistributedUsd,
      holders: s.holders,
      marketCap: s.marketCap,
      liquidity: s.liquidity,
      volume24h: s.volume24h,
    };
  }

  function num(v) {
    var n = typeof v === 'string' ? parseFloat(v) : v;
    return typeof n === 'number' && isFinite(n) ? n : null;
  }

  /* Pick the deepest-liquidity pair for a token on the configured chain. */
  function bestPair(pairs, chain) {
    return (pairs || [])
      .filter(function (p) { return !chain || p.chainId === chain; })
      .sort(function (a, b) {
        return ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0);
      })[0] || null;
  }

  function fetchJson(url) {
    return fetch(url, { headers: { accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function fetchDex(addr) {
    if (!CFG.useDexScreener || !addr) return Promise.resolve(null);
    return fetchJson('https://api.dexscreener.com/latest/dex/tokens/' + encodeURIComponent(addr))
      .then(function (data) { return bestPair(data && data.pairs, CFG.chain); });
  }

  function fetchProject() {
    if (!CFG.statsEndpoint) return Promise.resolve(null);
    return fetchJson(CFG.statsEndpoint);
  }

  function load() {
    var stats = baseStats();

    return Promise.all([
      fetchDex(address).catch(function () { return null; }),
      fetchDex(CFG.rewardTokenAddress).catch(function () { return null; }),
      fetchProject().catch(function () { return null; }),
    ]).then(function (res) {
      var pair = res[0];
      var rewardPair = res[1];
      var api = res[2] || {};
      var live = false;

      if (pair) {
        live = true;
        var mc = num(pair.marketCap) || num(pair.fdv);
        if (mc !== null) stats.marketCap = mc;
        if (pair.liquidity && num(pair.liquidity.usd) !== null) stats.liquidity = num(pair.liquidity.usd);
        if (pair.volume && num(pair.volume.h24) !== null) stats.volume24h = num(pair.volume.h24);
      }

      // Project API wins over DexScreener where it supplies a value.
      var map = {
        totalFeesCollected: 'fees',
        totalDistributed: 'distributed',
        totalDistributedUsd: 'distributedUsd',
        holders: 'holders',
        marketCap: 'marketCap',
        liquidity: 'liquidity',
        volume24h: 'volume24h',
      };
      Object.keys(map).forEach(function (k) {
        var v = num(api[k]);
        if (v !== null) { stats[map[k]] = v; live = true; }
      });

      // Derive the USD value of distributed $STONKEX from its live price
      // when the API did not supply one.
      if (num(api.totalDistributedUsd) === null) {
        var price = rewardPair ? num(rewardPair.priceUsd) : null;
        if (price !== null && typeof stats.distributed === 'number') {
          stats.distributedUsd = stats.distributed * price;
        }
      }

      if (api.history && typeof api.history === 'object') {
        Object.keys(api.history).forEach(function (k) {
          if (Array.isArray(api.history[k]) && api.history[k].length > 1) {
            sparkData[k] = api.history[k];
          }
        });
        renderSparks();
      }

      paint(stats);

      if (note) {
        note.textContent = live
          ? 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Live data unavailable — showing last published figures.';
      }
    });
  }

  // The tiles blink a "…" placeholder until the first load resolves. If the
  // network is slow or dead, fall back to the configured values rather than
  // blinking forever.
  renderSparks();

  var fallbackTimer = setTimeout(function () {
    if (!painted) paint(baseStats());
  }, 4000);

  load()['catch'](function () {})
    .then(function () {
      clearTimeout(fallbackTimer);
      if (!painted) paint(baseStats());
    });

  var every = Number(CFG.refreshSeconds) || 0;
  if (every > 0) setInterval(load, every * 1000);
})();
