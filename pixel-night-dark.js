/*
  PIXEL NIGHT - DARK SCENE
  ------------------------------------------------------------------
  The night wallpaper, in the same 640x360 logical space as
  pixel-night.js.

  Scenery that never moves (sky, mountains, forest, lake bed, meadow)
  is painted once into offscreen pixel buffers using small colour
  ramps and ordered dithering. Each frame then only stacks those
  layers and animates the small things between them: twinkling stars,
  drifting cloud and mist, rippling reflections, grass, fireflies.

  Still one visible canvas, no assets, no dependencies.
  ------------------------------------------------------------------
*/

window.PixelNightDark = (() => {
  "use strict";

  const W = 640;
  const H = 360;
  const TAU = Math.PI * 2;

  const MOON_X = 320;
  const MOON_Y = 132;
  const MOON_SET_Y = 278;
  const MOON_R = 33;

  const WATER_Y = 262;
  const LAKE_ROWS = 50;
  const LAKE_PAD = 4;
  const OFF = 999;

  // ---------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smooth(a, b, v) {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function hash3(x, y, seed) {
    // Deterministic integer hash -> [0, 1)
    let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }

  function rnd(i, seed) {
    return hash3(i, 0, seed);
  }

  function valueNoise(x, y, seed, period) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const x0 = period ? ((xi % period) + period) % period : xi;
    const x1 = period ? (x0 + 1) % period : xi + 1;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    return lerp(
      lerp(hash3(x0, yi, seed), hash3(x1, yi, seed), u),
      lerp(hash3(x0, yi + 1, seed), hash3(x1, yi + 1, seed), u),
      v
    );
  }

  function fbm(x, y, seed, octaves = 3, period = 0) {
    // Layered value noise. A non-zero period makes it tile horizontally.
    let amplitude = 0.5;
    let sum = 0;
    let total = 0;

    for (let o = 0; o < octaves; o++) {
      sum += amplitude * valueNoise(x, y, seed + o * 13, period);
      total += amplitude;
      x *= 2;
      y *= 2;
      period *= 2;
      amplitude *= 0.5;
    }

    return sum / total;
  }

  // ---------------------------------------------------------------
  // Pixel buffers, ramps and dithering
  // ---------------------------------------------------------------

  function pack(hex) {
    // "#rrggbb" -> little-endian ABGR for Uint32 pixel writes.
    const n = parseInt(hex.slice(1), 16);
    return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0;
  }

  function ramp(keys, steps) {
    const rgb = keys.map(key => {
      const n = parseInt(key.slice(1), 16);
      return [n >>> 16, (n >> 8) & 255, n & 255];
    });
    const out = new Uint32Array(steps);

    for (let i = 0; i < steps; i++) {
      const p = i / (steps - 1) * (rgb.length - 1);
      const a = Math.min(rgb.length - 2, Math.floor(p));
      const f = p - a;
      const r = Math.round(lerp(rgb[a][0], rgb[a + 1][0], f));
      const g = Math.round(lerp(rgb[a][1], rgb[a + 1][1], f));
      const b = Math.round(lerp(rgb[a][2], rgb[a + 1][2], f));
      out[i] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
    }

    return out;
  }

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  function bayer(x, y) {
    return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  }

  function shade(colors, v, x, y) {
    // Pick a ramp colour for v in [0, 1], dithering between neighbours.
    const p = clamp(v, 0, 1) * (colors.length - 1);
    const i = Math.floor(p);
    return colors[Math.min(colors.length - 1, i + (p - i > bayer(x, y) ? 1 : 0))];
  }

  function luminance(color) {
    return ((color & 255) * 0.3 + ((color >> 8) & 255) * 0.59 + ((color >> 16) & 255) * 0.11) / 255;
  }

  function makeLayer(w = W, h = H) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const layerCtx = canvas.getContext("2d");
    const image = layerCtx.createImageData(w, h);
    const px = new Uint32Array(image.data.buffer);

    return {
      canvas,
      px,
      set(x, y, color) {
        if (x >= 0 && x < w && y >= 0 && y < h) px[y * w + x] = color;
      },
      get(x, y) {
        return x >= 0 && x < w && y >= 0 && y < h ? px[y * w + x] : 0;
      },
      commit() {
        layerCtx.putImageData(image, 0, 0);
      }
    };
  }

  function stamp(layer, rows, x, y, colors) {
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const color = colors[row[c]];
        if (color !== undefined) layer.set(x + c, y + r, color);
      }
    });
  }

  function contour(points, seed, jitter) {
    // Smooth ground line through control points. OFF outside their span.
    const line = new Int16Array(W).fill(OFF);

    for (let x = 0; x < W; x++) {
      if (x < points[0][0] || x > points[points.length - 1][0]) continue;
      let i = 0;
      while (i < points.length - 2 && x > points[i + 1][0]) i++;
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const f = (1 - Math.cos(clamp((x - x0) / (x1 - x0), 0, 1) * Math.PI)) / 2;
      line[x] = Math.round(lerp(y0, y1, f) + (fbm(x * 0.08, seed * 1.7, seed, 2) - 0.5) * jitter * 2);
    }

    return line;
  }

  // ---------------------------------------------------------------
  // Sky: dithered gradient, moon glow, Milky Way, faint stars
  // ---------------------------------------------------------------

  function milkyWay(x, y) {
    // u runs along a band falling from the top-right, w runs across it.
    const u = (W - x - 95) * 0.546 + y * 0.838;
    const w = (W - x - 95) * 0.838 - y * 0.546;
    const width = 22 + fbm(u * 0.02, 0.5, 11, 2) * 22;
    const core = Math.exp(-(w * w) / (width * width));
    const clumps = 0.4 + fbm(u * 0.035, w * 0.07, 12, 3) * 0.95;
    const riftCentre = (fbm(u * 0.025, 3.5, 13, 2) - 0.5) * 26;
    const rift = Math.exp(-((w - riftCentre) ** 2) / 36) * 0.65;
    return clamp(core * clumps * (1 - rift), 0, 1);
  }

  function buildSky() {
    const layer = makeLayer();
    const SKY = ramp([
      "#070818", "#0c0b26", "#131136", "#1a1848", "#1d2558",
      "#1c3564", "#1b4a6b", "#1f6170", "#32807c"
    ], 30);
    const NEBULA = [pack("#2a1d5c"), pack("#43297a"), pack("#6a3f92")];
    const FAINT = [pack("#3a3f72"), pack("#55649a"), pack("#7f9cc0"), pack("#b9d0e0")];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const fall = Math.pow(Math.min(1, y / WATER_Y), 1.15);
        const distance = Math.hypot(x - MOON_X, y - MOON_Y);
        const glow = Math.pow(Math.max(0, 1 - distance / 175), 2.2) * 0.3;
        const band = milkyWay(x, y) * (1 - fall * 0.6);

        let color = shade(SKY, 0.07 + fall * 0.68 + glow + band * 0.13, x, y);
        if (band * 0.5 > bayer(x + 1, y + 2)) {
          color = NEBULA[Math.min(2, Math.floor(band * 3.2))];
        }
        layer.px[y * W + x] = color;
      }
    }

    // Faint fixed stars, crowding into the Milky Way.
    for (let i = 0; i < 1500; i++) {
      const x = Math.floor(rnd(i, 21) * W);
      const y = Math.floor(rnd(i, 22) * 250);
      if (rnd(i, 23) > 0.2 + milkyWay(x, y) * 1.1) continue;
      const roll = rnd(i, 24);
      layer.set(x, y, FAINT[roll < 0.45 ? 0 : roll < 0.78 ? 1 : roll < 0.95 ? 2 : 3]);
    }

    layer.commit();
    return layer;
  }

  // ---------------------------------------------------------------
  // Moon sprite
  // ---------------------------------------------------------------

  function buildMoon() {
    const size = MOON_R * 2 + 3;
    const centre = MOON_R + 1;
    const layer = makeLayer(size, size);
    const MOON = ramp(["#5f8784", "#789d91", "#a9c9a7", "#c4d8b2", "#e8e6bd", "#fff3ca"], 11);
    const craters = [
      [-14, -10, 5], [13, -17, 3.5], [9, 11, 4.5], [-8, 20, 3.5], [-23, 6, 2.5],
      [23, 2, 2.5], [-3, -24, 2.5], [19, 19, 2], [-18, -21, 2], [1, 1, 2]
    ];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - centre;
        const dy = y - centre;
        const distance = Math.hypot(dx, dy);
        if (distance > MOON_R + 0.35) continue;

        let v = 0.82;

        // Maria: broad dark seas, leaning to the upper-left like the real thing.
        const sea = fbm((dx + 60) * 0.05, (dy + 60) * 0.05, 7, 3) + (-dx * 0.5 - dy * 0.6) / MOON_R * 0.09;
        v -= smooth(0.5, 0.6, sea) * 0.3;
        v += (fbm(dx * 0.24 + 9, dy * 0.24 + 3, 5, 2) - 0.5) * 0.16;

        // Limb darkening gives the disc a little roundness.
        v -= Math.pow(distance / MOON_R, 3.2) * 0.2;
        v += (-dx - dy) / MOON_R * 0.045;

        for (const [cx, cy, r] of craters) {
          const q = Math.hypot(dx - cx, dy - cy);
          const towardLight = ((cx - dx) + (cy - dy)) / r;
          if (q < r) v += -0.1 - towardLight * 0.09;
          else if (q < r + 1.1) v += towardLight > 0 ? 0.13 : -0.06;
        }

        // A bright rayed crater low on the disc.
        const rx = dx - 5;
        const ry = dy - 23;
        const rayDistance = Math.hypot(rx, ry);
        if (rayDistance < 2) v += 0.16;
        else if (rayDistance < 20 && Math.abs(Math.sin(Math.atan2(ry, rx) * 4 + 0.6)) > 0.94) {
          v += 0.1 * (1 - rayDistance / 20);
        }

        layer.set(x, y, shade(MOON, v, x, y));
      }
    }

    layer.commit();
    return layer;
  }

  // ---------------------------------------------------------------
  // Mountains
  //
  // Each range is a jagged ridge line. A wandering "spine" drops from
  // every peak and splits it into a moon-facing side and a shadowed
  // side; valleys between peaks wander the same way. Smaller bumps on
  // the ridge cast their own facets, and everything above the snow
  // line is drawn with the snow ramp.
  // ---------------------------------------------------------------

  function ridgeLine(points, seed, jitter) {
    const line = new Int16Array(W);

    for (let x = 0; x < W; x++) {
      let i = 0;
      while (i < points.length - 2 && x > points[i + 1][0]) i++;
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const t = clamp((x - x0) / (x1 - x0), 0, 1);
      // Slopes steepen toward the summit, so peaks read as pointed.
      const eased = y1 < y0 ? Math.pow(t, 1.3) : 1 - Math.pow(1 - t, 1.3);
      line[x] = Math.round(
        lerp(y0, y1, eased) +
        (fbm(x * 0.07, seed * 2.3, seed, 3) - 0.5) * jitter +
        (fbm(x * 0.3, seed * 4.1, seed + 9, 2) - 0.5) * jitter * 0.45
      );
    }

    return line;
  }

  function wander(x0, y0, seed, bias, reach) {
    // A crooked line running straight down the canvas from (x0, y0).
    const xs = new Float32Array(H);
    let x = x0;
    let direction = 0;
    let run = 0;

    for (let y = 0; y < H; y++) {
      if (y > y0) {
        if (run-- <= 0) {
          const roll = rnd(y, seed);
          direction = roll < 0.38 ? -1 : roll < 0.62 ? 0 : 1;
          run = 2 + Math.floor(rnd(y, seed + 1) * 6);
        }
        x = clamp(x + (direction + bias) * (0.3 + rnd(y, seed + 2) * 0.5), x0 - reach, x0 + reach);
      }
      xs[y] = x;
    }

    return xs;
  }

  function snowTeeth(x, seed) {
    // Triangular fingers of snow reaching down the gullies.
    const tx = x / 7;
    const cell = Math.floor(tx);
    const f = tx - cell;
    return (1 - Math.abs(f * 2 - 1)) * rnd(cell, seed) * 16 + (fbm(x * 0.05, 0.5, seed + 1, 2) - 0.5) * 16;
  }

  function paintRange(layer, config) {
    const { points, seed } = config;
    const ridge = ridgeLine(points, seed, config.jitter);
    const peaks = [];
    const valleys = [];

    points.forEach(([px, py, isPeak], i) => {
      if (!isPeak) {
        valleys.push(wander(px, py, seed * 7 + i, 0, 12));
        return;
      }

      // Snap the summit to wherever the jittered ridge actually tops out.
      let topX = px;
      let topY = py;
      if (px >= 0 && px < W) {
        topY = OFF;
        for (let x = Math.max(0, px - 6); x <= Math.min(W - 1, px + 6); x++) {
          if (ridge[x] < topY) {
            topY = ridge[x];
            topX = x;
          }
        }
      }

      const light = topX < MOON_X ? 1 : -1;
      peaks.push({
        x: topX,
        y: topY,
        light,
        spine: wander(topX, topY, seed * 13 + i, -light * 0.3, 22)
      });
    });

    // Minor bumps along the ridge become small light/shadow facets.
    const facets = [];
    for (let x = 4; x < W - 4; x++) {
      let isTop = ridge[x] < ridge[x - 4] && ridge[x] < ridge[x + 4];
      for (let k = -3; k <= 3 && isTop; k++) {
        if (ridge[x + k] < ridge[x]) isTop = false;
      }
      if (!isTop || peaks.some(p => Math.abs(p.x - x) < 7)) continue;
      facets.push({ x, y: ridge[x], length: 12 + rnd(x, seed + 30) * 30 });
      x += 4;
    }

    for (let x = 0; x < W; x++) {
      const nearby = facets.filter(f => Math.abs(f.x - x) < f.length);
      const teeth = snowTeeth(x, seed + 40);

      for (let y = ridge[x]; y <= config.baseY; y++) {
        let k = 0;
        while (k < peaks.length - 1 && x >= valleys[k + 1][y]) k++;
        const peak = peaks[k];
        const side = (x - peak.spine[y]) * peak.light;
        const lit = side >= 0;
        const grain = fbm(x * 0.1, y * 0.1, seed + 5, 3);

        let tone = lit ? 0.7 : 0.3;
        if (lit && side < 2) tone = 0.92;
        if (!lit && side > -1.6) tone = 0.16;

        // Rock strata running down and away from the spine.
        const strata = Math.abs(side) * 0.9 - (y - peak.y) * 0.75;
        if (((strata % 9) + 9) % 9 < 1.3 && grain > 0.48) tone += lit ? -0.22 : 0.14;

        for (const facet of nearby) {
          const fy = y - facet.y;
          if (fy <= 0 || fy >= facet.length) continue;
          const offset = (x - facet.x) * -peak.light - fy * 0.15;
          const reach = Math.min(fy * 0.9, (facet.length - fy) * 0.7) + 1;
          if (offset >= 0 && offset < reach) tone -= lit ? 0.26 : 0.08;
          else if (offset < 0 && offset > -2.2 && fy < facet.length * 0.7) tone += lit ? 0.14 : 0.2;
        }

        tone += (grain - 0.5) * 0.2;
        if (y - ridge[x] <= 1) tone += lit ? 0.14 : 0.08;
        tone = 0.5 + (tone - 0.5) * config.contrast;

        const snowY = config.snowLine + teeth + (grain - 0.5) * 14 - (lit ? 0 : 6);
        let color = shade(y < snowY ? config.snow : config.rock, tone, x, y);

        // Distance haze swallows the foot of the range.
        const haze = smooth(config.hazeFrom, config.hazeTo, y) * config.haze;
        if (haze > bayer(x + 2, y + 1)) color = config.hazeColor;

        layer.set(x, y, color);
      }
    }
  }

  function buildMountains() {
    const layer = makeLayer();

    // Pale distant range, mostly seen through the saddle under the moon.
    paintRange(layer, {
      points: [
        [-20, 216, 0], [28, 207, 1], [70, 215, 0], [128, 202, 1], [196, 212, 0],
        [262, 202, 1], [298, 212, 0], [334, 205, 1], [372, 214, 0], [420, 204, 1],
        [478, 212, 0], [540, 200, 1], [598, 210, 0], [652, 202, 1], [700, 215, 0]
      ],
      seed: 3,
      jitter: 5,
      contrast: 0.6,
      snowLine: 209,
      rock: ramp(["#1a2550", "#1f2d5a", "#253765", "#2b426f", "#324e78"], 8),
      snow: ramp(["#3a4f80", "#4a6590", "#6182a0", "#7fa0b0", "#9dbcc0"], 8),
      hazeFrom: 205,
      hazeTo: 248,
      haze: 0.85,
      hazeColor: pack("#1c4068"),
      baseY: WATER_Y + 2
    });

    // Two low snow-capped massifs either side of the moon.
    paintRange(layer, {
      points: [
        [-30, 236, 0], [38, 212, 1], [72, 221, 0], [118, 194, 1], [150, 204, 0],
        [186, 180, 1], [224, 201, 0], [248, 196, 1], [318, 234, 0], [392, 206, 1],
        [420, 212, 0], [462, 176, 1], [500, 198, 0], [530, 190, 1], [566, 209, 0],
        [606, 197, 1], [670, 220, 0]
      ],
      seed: 8,
      jitter: 7,
      contrast: 1,
      snowLine: 206,
      rock: ramp(["#0f1232", "#151a40", "#1c264f", "#24345e", "#2e466c", "#3d5c7c"], 10),
      snow: ramp(["#3b4a86", "#5668a0", "#8192b8", "#aebfd0", "#d6e2dc", "#f4f2d8"], 10),
      hazeFrom: 214,
      hazeTo: 262,
      haze: 0.72,
      hazeColor: pack("#1e3e64"),
      baseY: WATER_Y + 2
    });

    layer.commit();
    return layer;
  }

  // ---------------------------------------------------------------
  // Conifers and the forested far shore
  // ---------------------------------------------------------------

  function pine(layer, x, baseY, height, colors, light, seed) {
    const trunkHeight = Math.max(1, Math.round(height * 0.12));
    const crown = height - trunkHeight;
    const maxHalf = Math.max(1.6, height * 0.23);
    const tierHeight = crown / Math.max(2, Math.round(crown / (4 + height * 0.035)));
    const trunkWidth = height > 60 ? 3 : height > 28 ? 2 : 1;
    const rim = height > 40 ? 1 : 0;

    for (let i = 0; i <= trunkHeight; i++) {
      for (let w = 0; w < trunkWidth; w++) {
        layer.set(x - (trunkWidth >> 1) + w, baseY - i, colors.trunk);
      }
    }

    for (let r = 0; r < crown; r++) {
      const y = baseY - trunkHeight - crown + 1 + r;
      const inTier = (r / tierHeight) % 1;
      const underside = inTier > 1 - 1.01 / tierHeight;
      const half = Math.max(0, Math.round(
        maxHalf * (0.1 + 0.9 * (r + 1) / crown) * (0.5 + 0.5 * inTier) +
        (rnd(r, seed) - 0.5) * (height > 20 ? 1.4 : 0.5)
      ));

      for (let dx = -half; dx <= half; dx++) {
        const edge = half - Math.abs(dx);
        if (edge === 0 && half > 2 && hash3(dx, r, seed) < 0.3) continue;

        const facing = dx * light;
        let color = colors.mid;
        if (facing < -half * 0.15) color = colors.dark;
        if (underside && facing < half * 0.5) color = colors.dark;
        if (facing > 0 && edge <= rim) color = edge === 0 && inTier > 0.6 && colors.high ? colors.high : colors.lit;
        else if (facing > half * 0.3 && hash3(dx, r, seed + 1) < 0.2) color = colors.lit;

        layer.set(x + dx, y, color);
      }
    }

    layer.set(x, baseY - height, colors.lit);
  }

  function paintForest(layer, top, body, ridgeColors, innerColors, minHeight, extraHeight, seed) {
    for (let x = 0; x < W; x++) {
      if (top[x] >= WATER_Y) continue;
      for (let y = top[x] + 3; y <= WATER_Y; y++) layer.set(x, y, body);
    }

    // Rows of pines, from the ridge down to the waterline.
    for (let row = 0; row < 7; row++) {
      let x = -3 + rnd(row, seed) * 4;

      while (x < W + 3) {
        const xi = Math.round(x);
        const ground = top[clamp(xi, 0, W - 1)];
        const baseY = ground + 4 + row * 5 + Math.floor(rnd(xi, seed + row) * 3);

        if (ground < WATER_Y - 2 && baseY <= WATER_Y + 1) {
          pine(
            layer,
            xi,
            Math.min(baseY, WATER_Y),
            minHeight + Math.floor(rnd(xi, seed + 50 + row) * extraHeight),
            row === 0 ? ridgeColors : innerColors,
            xi < MOON_X ? 1 : -1,
            seed + xi
          );
        }
        x += 3 + rnd(xi, seed + 90 + row) * 4;
      }
    }
  }

  const CABIN_X = 377;
  const CABIN_Y = 253;

  function buildFarShore() {
    const layer = makeLayer();

    paintForest(
      layer,
      contour([
        [0, 238], [60, 244], [130, 240], [200, 247], [270, 253], [320, 255],
        [370, 252], [440, 245], [520, 241], [590, 245], [640, 239]
      ], 41, 3),
      pack("#0e1f3a"),
      { dark: pack("#0b1a33"), mid: pack("#102442"), lit: pack("#1f4660"), trunk: pack("#0b1a33") },
      { dark: pack("#0a1830"), mid: pack("#0e1f3a"), lit: pack("#15304a"), trunk: pack("#0a1830") },
      7, 6, 500
    );

    // Two nearer, darker headlands close the lake in from either side.
    const headland = [
      contour([[0, 236], [60, 241], [120, 245], [180, 250], [225, 256], [252, 262]], 42, 2),
      contour([[366, 262], [396, 256], [450, 249], [520, 243], [590, 238], [640, 235]], 43, 2)
    ];
    headland.forEach((top, i) => paintForest(
      layer,
      top,
      pack("#0a1730"),
      { dark: pack("#08122a"), mid: pack("#0c1b36"), lit: pack("#1b3f58"), trunk: pack("#08122a") },
      { dark: pack("#071127"), mid: pack("#0a1730"), lit: pack("#112a44"), trunk: pack("#071127") },
      9, 8, 700 + i * 100
    ));

    // Pebble beach where the forest meets the water.
    for (let x = 0; x < W; x++) {
      const roll = rnd(x >> 1, 44);
      layer.set(x, WATER_Y - 1, pack(roll > 0.72 ? "#4f7590" : roll > 0.35 ? "#2f4f70" : "#1a3152"));
      layer.set(x, WATER_Y, pack("#0a1730"));
    }

    // A small cabin with one lit window, at the tip of the right headland.
    stamp(layer, [
      "........cc...",
      "...hhhhhcch..",
      "..rrrrrrrrrr.",
      ".rrrrrrrrrrrr",
      ".eeeeeeeeeeee",
      "..wwwwwwwwww.",
      "..wYYwwwwdww.",
      "..wYYwwwwdww.",
      "..wwwwwwwdww."
    ], CABIN_X, CABIN_Y, {
      c: pack("#16303a"),
      h: pack("#5b8f8c"),
      r: pack("#234852"),
      e: pack("#0b1d25"),
      w: pack("#12272f"),
      Y: pack("#ffd27a"),
      d: pack("#0a1920")
    });

    layer.commit();
    return layer;
  }

  // ---------------------------------------------------------------
  // Lake: a squashed, broken mirror of everything above the water
  // ---------------------------------------------------------------

  function buildLake(layers) {
    const layer = makeLayer(W + LAKE_PAD * 2, LAKE_ROWS);
    const LAKE = ramp([
      "#0a1430", "#0e1e40", "#132c4e", "#1a405e",
      "#27586a", "#4f8580", "#8eaf95", "#cfe3c8"
    ], 18);

    const sample = (x, y) => {
      for (const source of layers) {
        const color = source.get(x, y);
        if (color) return color;
      }
      return 0;
    };

    for (let dy = 0; dy < LAKE_ROWS; dy++) {
      // The mirror compresses with distance from the far shore.
      const sourceY = Math.max(0, Math.round(WATER_Y - 2 - dy * 1.9 - dy * dy * 0.035));
      const nudge = Math.round((rnd(dy, 71) - 0.5) * 3);

      for (let lx = 0; lx < W + LAKE_PAD * 2; lx++) {
        const x = clamp(lx - LAKE_PAD, 0, W - 1);
        const mirrored = luminance(sample(clamp(x + nudge, 0, W - 1), sourceY));
        let v = Math.min(0.8, Math.pow(mirrored, 0.62) * 1.25 - 0.14) - dy * 0.003;
        v += (fbm(x * 0.05, dy * 0.9, 80, 2) - 0.5) * 0.12;
        if (dy === 0) v = 0.08;
        layer.set(lx, dy, shade(LAKE, v, lx, dy));
      }
    }

    return layer;
  }

  // ---------------------------------------------------------------
  // Near shore: meadow, framing pines, boulders, pier, wildlife
  // ---------------------------------------------------------------

  const SHORE = contour([
    [0, 263], [45, 259], [95, 266], [140, 282], [185, 294], [235, 301], [290, 305], [330, 306],
    [375, 303], [420, 297], [465, 290], [510, 279], [555, 267], [600, 260], [640, 257]
  ], 3, 1.6);

  const PIER_Y = 284;
  const PIER_X = 434;
  const BOAT_X = 415;

  const MEADOW_HEX = [
    "#6fa373", "#4f8a64", "#3a7459", "#2b6253", "#22544d",
    "#1b4649", "#163a44", "#12303d", "#0e2636", "#0b1e2e"
  ];
  const FLOWER_HEX = ["#f3e7bd", "#d99b91", "#e6c878", "#a9a0d8", "#cfe6e6"];

  function boulder(layer, cx, baseY, width, height, light, seed) {
    const DARK = pack("#0f2731");
    const MID = pack("#1d3d49");
    const LIT = pack("#3b6670");
    const HIGH = pack("#7fa39a");
    const MOSS = pack("#3a7459");
    const half = Math.ceil(width / 2);

    for (let y = 0; y < height; y++) {
      for (let dx = -half; dx <= half; dx++) {
        const nx = dx / (width / 2);
        const ny = (y + 0.5) / height;
        if (nx * nx + ny * ny + (hash3(dx >> 1, y >> 1, seed) - 0.5) * 0.25 > 1) continue;

        const facing = ny * 0.9 + nx * light * 0.45 + (hash3(dx, y, seed + 1) - 0.5) * 0.2;
        let color = facing > 0.95 ? HIGH : facing > 0.6 ? LIT : facing > 0.25 ? MID : DARK;
        if (facing > 0.7 && hash3(dx, y, seed + 2) < 0.18) color = MOSS;
        layer.set(cx + dx, baseY - y, color);
      }
    }
  }

  function buildNearShore(lake) {
    const layer = makeLayer();
    const MEADOW = ramp(MEADOW_HEX, 14);
    const tones = new Float32Array(W * H);

    for (let x = 0; x < W; x++) {
      const top = SHORE[x];

      for (let y = top; y < H; y++) {
        const depth = (y - top) / (H - top);
        let v = 0.14 + Math.pow(depth, 0.8) * 0.78;
        v += (fbm(x * 0.035, y * 0.09, 31, 3) - 0.5) * 0.24;
        // Moonlight pools in the middle of the meadow.
        v -= Math.exp(-(((x - MOON_X) / 190) ** 2)) * 0.1 * (1 - depth);
        if (y - top < 1) v = rnd(x >> 1, 32) > 0.3 ? 0 : 0.1;
        else if (y - top < 3) v = Math.min(v, 0.17);

        tones[y * W + x] = v;
        layer.set(x, y, shade(MEADOW, v, x, y));
      }
    }

    // Fixed grass tufts, a shade lighter or darker than the ground they sit on.
    for (let i = 0; i < 3600; i++) {
      const x = Math.floor(rnd(i, 33) * W);
      const top = SHORE[x] + 3;
      const depth = rnd(i, 34);
      const y = top + Math.floor(depth * (H - top));
      const length = 1 + Math.floor(depth * 3 + rnd(i, 35) * 2);
      const tone = tones[y * W + x] + (rnd(i, 36) > 0.35 ? -0.13 : 0.1);
      const color = MEADOW[clamp(Math.round(tone * (MEADOW.length - 1)), 0, MEADOW.length - 1)];

      for (let k = 0; k < length; k++) layer.set(x, y - k, color);
      layer.set(x + (rnd(i, 37) > 0.5 ? 1 : -1), y - length, color);
    }

    // Drifts of distant wildflowers, too small to sway.
    const FLOWERS = FLOWER_HEX.map(pack);
    for (let i = 0; i < 900; i++) {
      const x = Math.floor(rnd(i, 38) * W);
      const top = SHORE[x] + 4;
      const y = top + Math.floor(Math.pow(rnd(i, 39), 1.4) * (H - top) * 0.75);
      if (fbm(x * 0.022, y * 0.06, 45, 2) < 0.52) continue;
      layer.set(x, y, FLOWERS[Math.floor(fbm(x * 0.012, y * 0.03, 46, 2) * 9 + rnd(i, 40) * 2) % FLOWERS.length]);
    }

    // Boulders along the shore and through the grass.
    [
      [150, 2, 11, 6], [258, 2, 15, 8], [270, 3, 8, 4], [404, 2, 17, 9], [391, 3, 7, 4],
      [96, 46, 19, 10], [522, 48, 23, 12], [472, 58, 10, 5], [208, 44, 9, 5]
    ].forEach(([x, drop, width, height], i) => {
      boulder(layer, x, SHORE[x] + drop, width, height, x < MOON_X ? 1 : -1, 60 + i * 3);
    });
    // Two that sit out in the shallows.
    boulder(layer, 345, SHORE[345] - 5, 9, 4, -1, 90);
    boulder(layer, 302, SHORE[302] - 4, 6, 3, 1, 93);

    // Lily pads gathered in the quiet corners of the cove.
    const PAD = pack("#2f6d58");
    const PAD_LIT = pack("#5a9a70");
    for (let i = 0; i < 34; i++) {
      const x = Math.floor(i < 20 ? 158 + rnd(i, 47) * 78 : 388 + rnd(i, 47) * 62);
      const y = SHORE[x] - 3 - Math.floor(rnd(i, 48) * 9);
      if (y < WATER_Y + 12) continue;
      const width = 2 + Math.floor(rnd(i, 49) * 3);
      for (let k = 0; k < width; k++) layer.set(x + k, y, k === 0 ? PAD_LIT : PAD);
      if (rnd(i, 50) > 0.72) layer.set(x + 1, y - 1, FLOWERS[i % 2]);
    }

    // Wooden pier reaching out from the right bank.
    const WOOD_LIT = pack("#6f8f86");
    const WOOD = pack("#2c4a4c");
    const WOOD_DARK = pack("#10262d");
    for (let x = PIER_X; x < W && SHORE[x] > PIER_Y; x++) {
      layer.set(x, PIER_Y, (x - PIER_X) % 6 === 5 ? WOOD : WOOD_LIT);
      layer.set(x, PIER_Y + 1, WOOD_DARK);

      if ((x - PIER_X) % 11 === 1) {
        const foot = Math.min(SHORE[x], PIER_Y + 8);
        for (let y = PIER_Y - 2; y < foot; y++) layer.set(x, y, y < PIER_Y ? WOOD : WOOD_DARK);
        layer.set(x, PIER_Y - 3, WOOD_LIT);
        // Post reflections, broken by the ripples.
        for (let y = foot; y < foot + 7; y++) {
          if ((y - foot) % 3 !== 2) lake.set(x + LAKE_PAD, y - WATER_Y, pack("#0a1430"));
        }
      }
    }
    // Shadow under the moored boat.
    for (let x = BOAT_X + 1; x < BOAT_X + 14; x++) {
      lake.set(x + LAKE_PAD, PIER_Y + 5 - WATER_Y, pack("#0a1430"));
      if (x % 3) lake.set(x + LAKE_PAD, PIER_Y + 7 - WATER_Y, pack("#0e1e40"));
    }

    // A stag at the water's edge, looking toward the moon.
    stamp(layer, [
      "..............o.o...",
      "..............o.o.o.",
      "...............ooo..",
      "...............#o...",
      "..............##oo..",
      "..............###...",
      ".............##o....",
      "..ooooooooooo##.....",
      ".o############......",
      "..############......",
      "..###.....####......",
      "..#.#......#.#......",
      "..#.#......#.#......",
      "..#.#......#.#......",
      "..#..#.....#..#.....",
      "..#..#.....#..#....."
    ], 204, SHORE[212] - 14, { "#": pack("#08191f"), o: pack("#2c5f5c") });

    // Tall pines on both banks frame the view.
    const NEAR_PINE = {
      dark: pack("#060f20"),
      mid: pack("#0a1a2b"),
      lit: pack("#1c4048"),
      high: pack("#3a7060"),
      trunk: pack("#070f1e")
    };
    [
      [112, 38], [530, 42], [90, 58], [552, 62], [66, 82], [576, 88], [-6, 122], [646, 118],
      [40, 106], [602, 114], [14, 134], [628, 142]
    ].forEach(([x, height], i) => {
      const ground = SHORE[clamp(x, 0, W - 1)];
      pine(layer, x, ground + 5 + Math.floor(height * 0.06), height, NEAR_PINE, x < MOON_X ? 1 : -1, 800 + i * 7);
    });

    lake.commit();
    layer.commit();
    return layer;
  }

  // ---------------------------------------------------------------
  // Tileable cloud and mist strips
  // ---------------------------------------------------------------

  function buildCloudStrip(height, seed, cut, colors) {
    // Thin streaks: the noise is stretched hard along x.
    const layer = makeLayer(W, height);
    const density = new Float32Array(W * height);

    for (let y = 0; y < height; y++) {
      const envelope = Math.sin(Math.PI * (y + 0.5) / height);
      for (let x = 0; x < W; x++) {
        density[y * W + x] = fbm(x * 0.025, y * 0.2, seed, 3, 16) + envelope * 0.2 - cut;
      }
    }

    const at = (x, y) => (y < 0 || y >= height ? -1 : density[y * W + x]);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < W; x++) {
        const d = at(x, y);
        if (d <= 0) continue;

        // Moonlit tops, shadowed bellies.
        let color = colors.body;
        if (at(x, y - 1) <= 0) color = colors.lit;
        else if (at(x, y + 1) <= 0) color = colors.dark;
        layer.set(x, y, color);
      }
    }

    layer.commit();
    return layer;
  }

  function buildMistStrip(height, seed) {
    const layer = makeLayer(W, height);
    const THIN = pack("#4b6f90");
    const THICK = pack("#7498a8");

    for (let y = 0; y < height; y++) {
      const envelope = Math.sin(Math.PI * (y + 0.5) / height);
      for (let x = 0; x < W; x++) {
        const d = fbm(x * 0.01875, y * 0.1, seed, 3, 12) + envelope * 0.3 - 0.7;
        if (d > bayer(x, y) * 0.06) layer.set(x, y, d > 0.09 ? THICK : THIN);
      }
    }

    layer.commit();
    return layer;
  }

  const GLOW_R = 104;

  function buildGlowMask() {
    // Dithered disc used to brighten whatever cloud drifts near the moon.
    const size = GLOW_R * 2 + 1;
    const layer = makeLayer(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const reach = 1 - Math.hypot(x - GLOW_R, y - GLOW_R) / GLOW_R;
        if (reach > 0 && Math.pow(reach, 0.8) * 2.1 > bayer(x, y)) layer.set(x, y, 0xffffffff);
      }
    }

    layer.commit();
    return layer;
  }

  // ---------------------------------------------------------------
  // Build the static layers
  // ---------------------------------------------------------------

  const sky = buildSky();
  const moon = buildMoon();
  const mountains = buildMountains();
  const farShore = buildFarShore();
  const lake = buildLake([farShore, mountains, sky]);
  const nearShore = buildNearShore(lake);
  const glowMask = buildGlowMask();
  const glowScratch = document.createElement("canvas");
  glowScratch.width = glowScratch.height = GLOW_R * 2 + 1;
  const glowCtx = glowScratch.getContext("2d");

  const CLOUD_DIM = { dark: pack("#1a1f4c"), body: pack("#20285a"), lit: pack("#2a3668") };
  const CLOUD_LIT = { dark: pack("#27406c"), body: pack("#34557c"), lit: pack("#5a8494") };
  const cloudBands = [
    { y: 170, height: 26, seed: 110, cut: 0.74, speed: 0.0011 },
    { y: 194, height: 22, seed: 140, cut: 0.75, speed: -0.0007 }
  ].map(band => ({
    ...band,
    dim: buildCloudStrip(band.height, band.seed, band.cut, CLOUD_DIM),
    lit: buildCloudStrip(band.height, band.seed, band.cut, CLOUD_LIT)
  }));

  const mist = [buildMistStrip(26, 170), buildMistStrip(18, 190)];

  // ---------------------------------------------------------------
  // Animated scene data
  // ---------------------------------------------------------------

  const STAR_HEX = ["#e4e8d8", "#f3e7bd", "#a8c8f0", "#c8b8f0"];
  const stars = [];

  for (let i = 0; i < 150; i++) {
    const x = Math.floor(rnd(i, 211) * W);
    const y = Math.floor(rnd(i, 212) * 236);
    if (Math.hypot(x - MOON_X, y - MOON_Y) < MOON_R + 16) continue;
    const roll = rnd(i, 213);
    // Keep bright stars out of the patch of sky where the name is drawn.
    if (roll > 0.78 && x > 20 && x < 275 && y > 30 && y < 125) continue;

    stars.push({
      x,
      y,
      size: roll > 0.95 ? 2 : roll > 0.78 ? 1 : 0,
      color: STAR_HEX[Math.floor(rnd(i, 214) * STAR_HEX.length)],
      alpha: 0.45 + rnd(i, 215) * 0.55,
      phase: rnd(i, 216) * TAU,
      twinkle: 0.5 + rnd(i, 217) * 2
    });
  }

  // The Big Dipper.
  [
    [478, 106], [489, 100], [498, 102], [508, 104], [511, 113], [524, 114], [525, 102]
  ].forEach(([x, y], i) => {
    stars.push({ x, y, size: 1, color: "#e4e8d8", alpha: 0.95, phase: i * 1.7, twinkle: 0.6 + (i % 3) * 0.3 });
  });

  // The name, written as a constellation. Each letter is a handful of stars
  // on a 4x6 grid plus the links between them.
  const GLYPHS = {
    D: { stars: [[0, 0], [2.8, 0.6], [4, 3], [2.8, 5.4], [0, 6]], links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] },
    A: { stars: [[0, 6], [0.85, 3.6], [2, 0], [3.15, 3.6], [4, 6]], links: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 3]] },
    R: { stars: [[0, 6], [0, 3.2], [0, 0], [3.7, 1.5], [4, 6]], links: [[0, 1], [1, 2], [2, 3], [3, 1], [1, 4]] },
    E: { stars: [[4, 0], [0, 0], [0, 3], [0, 6], [4, 6], [3, 3]], links: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]] },
    N: { stars: [[0, 6], [0, 0], [4, 6], [4, 0]], links: [[0, 1], [1, 2], [2, 3]] },
    J: { stars: [[1.6, 0], [4, 0], [4, 4.6], [2.3, 6], [0.3, 4.6]], links: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    H: { stars: [[0, 0], [0, 3], [0, 6], [4, 0], [4, 3], [4, 6]], links: [[0, 1], [1, 2], [3, 4], [4, 5], [1, 4]] }
  };
  const NAME_LINES = ["DARREN", "NADARAJAH"];
  const NAME_UNITS = 9 * 4 + 8 * 2;

  const meteors = [];

  const sparkles = [];
  for (let i = 0; i < 80; i++) {
    sparkles.push({
      x: rnd(i, 221) * W,
      y: WATER_Y + 2 + rnd(i, 222) * 42,
      width: 2 + Math.floor(rnd(i, 223) * 6),
      phase: rnd(i, 224) * TAU,
      speed: 0.0007 + rnd(i, 225) * 0.0013
    });
  }

  const reeds = [];
  [150, 170, 262, 280, 352, 398, 416].forEach((centre, c) => {
    for (let i = 0; i < 7; i++) {
      const x = Math.round(centre + (rnd(i, 231 + c) - 0.5) * 18);
      reeds.push({
        x,
        y: SHORE[x] + 2,
        height: 8 + rnd(i, 241 + c) * 11,
        head: rnd(i, 251 + c) > 0.4,
        phase: rnd(i, 261 + c) * TAU
      });
    }
  });

  const BLADE_HEX = ["#6fa373", "#5a9468", "#477b5c", "#3a7459", "#2b6253", "#22544d"];
  const blades = [];
  for (let i = 0; i < 560; i++) {
    const x = rnd(i, 271) * W;
    const top = SHORE[Math.floor(x)] + 5;
    const depth = Math.pow(rnd(i, 272), 0.8);

    blades.push({
      x,
      baseY: top + depth * (H + 8 - top),
      depth,
      height: 3 + depth * 20 + rnd(i, 273) * (4 + depth * 10),
      width: depth > 0.8 && rnd(i, 274) > 0.6 ? 2 : 1,
      color: BLADE_HEX[clamp(Math.round(depth * 3 + rnd(i, 275) * 2.2), 0, BLADE_HEX.length - 1)],
      phase: rnd(i, 276) * TAU
    });
  }
  blades.sort((a, b) => a.baseY - b.baseY);

  const FLOWER_TYPES = ["daisy", "daisy", "daisy", "tulip", "tulip", "lupine", "bud"];
  const flowers = [];
  for (let i = 0; i < 150; i++) {
    const x = rnd(i, 281) * W;
    const top = SHORE[Math.floor(x)] + 9;
    const depth = Math.pow(rnd(i, 282), 0.9);
    // Flowers grow in loose colour drifts rather than evenly mixed.
    const drift = Math.floor(fbm(x * 0.012, depth * 3, 46, 2) * 9 + rnd(i, 283) * 1.6);
    const type = depth < 0.22 ? "bud" : FLOWER_TYPES[Math.floor(rnd(i, 284) * FLOWER_TYPES.length)];

    flowers.push({
      x,
      y: top + depth * (H - 3 - top),
      depth,
      type,
      height: Math.round(5 + depth * 15 + rnd(i, 285) * 6),
      size: depth > 0.62 ? 2 : 1,
      color: type === "lupine" ? "#a9a0d8" : FLOWER_HEX[drift % FLOWER_HEX.length],
      stem: depth > 0.6 ? "#2b6253" : "#3a7459",
      leaf: rnd(i, 286) > 0.5 ? 1 : -2,
      phase: rnd(i, 287) * TAU
    });
  }
  flowers.sort((a, b) => a.y - b.y);

  const fireflies = [];
  for (let i = 0; i < 46; i++) {
    const x = rnd(i, 291) * W;
    const top = SHORE[Math.floor(x)];

    fireflies.push({
      x,
      y: top - 6 + rnd(i, 292) * (H - top),
      phase: rnd(i, 293) * TAU,
      speed: 0.5 + rnd(i, 294) * 0.9,
      roam: 5 + rnd(i, 295) * 13
    });
  }

  const silhouettes = [];
  for (let i = 0; i < 52; i++) {
    silhouettes.push({
      x: i * 12.6 + rnd(i, 301) * 9 - 4,
      height: 14 + rnd(i, 302) * 26,
      width: rnd(i, 303) > 0.6 ? 3 : 2,
      seedHead: rnd(i, 304) > 0.74,
      color: rnd(i, 305) > 0.5 ? "#081826" : "#0b2030",
      phase: rnd(i, 306) * TAU
    });
  }

  // ---------------------------------------------------------------
  // Per-frame drawing
  // ---------------------------------------------------------------

  let g = null;

  function rect(x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function disc(cx, cy, radius, color) {
    // Stepped circle drawn as rows, so the halo stays blocky.
    for (let dy = -radius; dy <= radius; dy++) {
      const span = Math.floor(Math.sqrt(radius * radius - dy * dy));
      rect(cx - span, cy + dy, span * 2 + 1, 1, color);
    }
  }

  function drawWrapped(source, offset, y) {
    const x = Math.floor(((offset % W) + W) % W);
    g.drawImage(source, x, y);
    g.drawImage(source, x - W, y);
  }

  function drawStars(t) {
    for (const s of stars) {
      const tw = 0.7 + Math.sin(t * 0.001 * s.twinkle + s.phase) * 0.3;
      g.globalAlpha = s.alpha * tw;
      rect(s.x, s.y, 1, 1, s.size === 2 ? "#fffbe0" : s.color);
      if (s.size === 0) continue;

      // Brighter stars carry a small cross that flares as they twinkle.
      const arm = s.size + (tw > 0.93 ? 1 : 0);
      g.globalAlpha = s.alpha * tw * 0.45;
      rect(s.x - arm, s.y, arm, 1, s.color);
      rect(s.x + 1, s.y, arm, 1, s.color);
      rect(s.x, s.y - arm, 1, arm, s.color);
      rect(s.x, s.y + 1, 1, arm, s.color);

      if (s.size === 2) {
        g.globalAlpha = s.alpha * tw * 0.2;
        rect(s.x - 1, s.y - 1, 1, 1, s.color);
        rect(s.x + 1, s.y - 1, 1, 1, s.color);
        rect(s.x - 1, s.y + 1, 1, 1, s.color);
        rect(s.x + 1, s.y + 1, 1, 1, s.color);
      }
    }
    g.globalAlpha = 1;
  }

  function line(x0, y0, x1, y1, color, drawn = 1) {
    // Stepped line that stops short of each end, leaving the stars clear.
    // `drawn` is how far along it has been written so far.
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 2; i <= (steps - 2) * drawn; i++) {
      rect(Math.round(lerp(x0, x1, i / steps)), Math.round(lerp(y0, y1, i / steps)), 1, 1, color);
    }
  }

  const NAME_WRITE_DELAY = 300;
  const NAME_WRITE_STEP = 28;
  const NAME_HIT_RADIUS = 5;
  let nameStart = null;
  // Where the stars of the first letter were last drawn; clicking one replays the writing.
  let nameHotspots = [];

  function isNameHotspot(x, y) {
    return nameHotspots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) <= NAME_HIT_RADIUS);
  }

  function replayName() {
    nameStart = performance.now() - NAME_WRITE_DELAY;
  }

  function drawName(t, visibleWidth, animate) {
    // On first sight the name is written out link by link, in pen order.
    // `written` counts how many links the pen has finished.
    if (nameStart === null) nameStart = t;
    const written = animate ? (t - nameStart - NAME_WRITE_DELAY) / NAME_WRITE_STEP : Infinity;
    let ordinal = 0;

    // Sits in the open sky left of the moon; on narrow screens, where that
    // sky is cropped away, it moves above the moon instead.
    const left = Math.max(16, MOON_X - visibleWidth / 2 + 10);
    const room = 258 - left;
    const beside = room >= 150;
    const unit = Math.min(beside ? 3.6 : 3.2, (beside ? room : visibleWidth - 14) / NAME_UNITS);
    const centreX = beside ? left + room / 2 : MOON_X;
    const topY = beside ? 50 : 26;
    let index = 0;

    NAME_LINES.forEach((text, row) => {
      let cursor = centreX - (text.length * 6 - 2) * unit / 2;

      for (const letter of text) {
        const glyph = GLYPHS[letter];
        const points = glyph.stars.map(([gx, gy], i) => {
          const id = index * 8 + i;
          // Every star bobs gently on its own slow rhythm.
          const bob = Math.sin(t * (0.0007 + rnd(id, 322) * 0.0006) + rnd(id, 323) * TAU) * 1.3;
          return [
            Math.round(cursor + (gx + (rnd(id, 320) - 0.5) * 0.36) * unit),
            Math.round(topY + row * unit * 9.5 + (gy + (rnd(id, 321) - 0.5) * 0.36) * unit + bob),
            id
          ];
        });

        if (index === 0) nameHotspots = points;

        // A star appears the moment the pen first touches it.
        const reveal = glyph.stars.map(() => Infinity);
        glyph.links.forEach(([a, b], k) => {
          reveal[a] = Math.min(reveal[a], ordinal + k);
          reveal[b] = Math.min(reveal[b], ordinal + k + 1);
        });

        glyph.links.forEach(([a, b], k) => {
          const drawn = clamp(written - (ordinal + k), 0, 1);
          if (drawn <= 0) return;
          g.globalAlpha = 0.36 + Math.sin(t * 0.0006 + index) * 0.06;
          line(points[a][0], points[a][1], points[b][0], points[b][1], "#8fa8e0", drawn);

          if (drawn < 1) {
            // The bright pen tip.
            g.globalAlpha = 1;
            rect(
              Math.round(lerp(points[a][0], points[b][0], drawn)),
              Math.round(lerp(points[a][1], points[b][1], drawn)),
              1, 1, "#fffbe0"
            );
          }
        });

        points.forEach(([x, y, id], i) => {
          const age = written - reveal[i];
          if (age <= 0) return;
          const tw = 0.78 + Math.sin(t * (0.001 + rnd(id, 324) * 0.002) + rnd(id, 325) * TAU) * 0.22;
          // Each star flares briefly as it is lit, then settles.
          const flare = clamp(1 - age / 7, 0, 1);
          const arm = flare > 0.45 ? 2 : 1;

          g.globalAlpha = Math.min(1, tw * 0.36 + flare * 0.5);
          rect(x - arm, y, arm * 2 + 1, 1, "#bcd0f4");
          rect(x, y - arm, 1, arm * 2 + 1, "#bcd0f4");
          g.globalAlpha = Math.min(1, tw + flare);
          rect(x, y, 1, 1, "#f4f2d8");
        });

        ordinal += glyph.links.length;
        cursor += unit * 6;
        index++;
      }
    });
    g.globalAlpha = 1;
  }

  let lastFrame = 0;

  function drawMeteors(t) {
    const dt = t - lastFrame;
    lastFrame = t;

    // Only spawn while frames are flowing, so a paused scene never freezes one mid-flight.
    if (dt > 0 && dt < 120 && meteors.length < 2 && Math.random() < dt * 0.00012) {
      meteors.push({
        x: 60 + Math.random() * 520,
        y: 12 + Math.random() * 90,
        born: t,
        length: 18 + Math.random() * 26,
        speed: 0.16 + Math.random() * 0.1,
        direction: Math.random() < 0.5 ? -1 : 1
      });
    }

    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      const age = (t - m.born) / 900;
      if (age < 0 || age > 1) {
        meteors.splice(i, 1);
        continue;
      }

      const travelled = (t - m.born) * m.speed;
      const x = m.x + travelled * m.direction;
      const y = m.y + travelled * 0.42;
      const fade = Math.sin(age * Math.PI);

      for (let k = m.length; k >= 1; k--) {
        g.globalAlpha = fade * (1 - k / m.length) * 0.8;
        rect(x - k * m.direction, y - Math.round(k * 0.42), 1, 1, k < 6 ? "#d0ebc4" : "#72a7a1");
      }
      g.globalAlpha = fade;
      rect(x, y, 2, 1, "#fffbe0");
    }
    g.globalAlpha = 1;
  }

  function drawMoon(t, moonY) {
    const pulse = 1 + Math.sin(t * 0.0011) * 0.025;

    g.globalAlpha = 0.045;
    disc(MOON_X, moonY, Math.round(MOON_R * 2.25 * pulse), "#a9d8bd");
    g.globalAlpha = 0.07;
    disc(MOON_X, moonY, Math.round(MOON_R * 1.7 * pulse), "#a9d8bd");
    g.globalAlpha = 0.1;
    disc(MOON_X, moonY, Math.round(MOON_R * 1.32 * pulse), "#bfe3c4");
    g.globalAlpha = 1;

    g.drawImage(moon.canvas, MOON_X - MOON_R - 1, moonY - MOON_R - 1);
  }

  function drawClouds(t, moonY) {
    for (const band of cloudBands) {
      const offset = t * band.speed;
      const drift = Math.round(Math.sin(t * 0.00016 + band.seed) * 2);
      const y = band.y + drift;

      g.globalAlpha = 0.6;
      drawWrapped(band.dim.canvas, offset, y);

      // Repaint the part of the band near the moon in the moonlit palette.
      const x = Math.floor(((offset % W) + W) % W);
      const left = MOON_X - GLOW_R;
      const top = moonY - GLOW_R;
      glowCtx.globalCompositeOperation = "source-over";
      glowCtx.clearRect(0, 0, glowScratch.width, glowScratch.height);
      glowCtx.drawImage(band.lit.canvas, x - left, y - top);
      glowCtx.drawImage(band.lit.canvas, x - W - left, y - top);
      glowCtx.globalCompositeOperation = "destination-in";
      glowCtx.drawImage(glowMask.canvas, 0, 0);
      g.drawImage(glowScratch, left, top);
      g.globalAlpha = 1;
    }
  }

  function drawCabin(t) {
    const flicker = 0.5 + Math.sin(t * 0.004) * 0.25 + Math.sin(t * 0.011 + 2) * 0.2;
    const wx = CABIN_X + 3;
    const wy = CABIN_Y + 6;

    g.globalAlpha = 0.18 + flicker * 0.3;
    rect(wx, wy, 2, 2, "#fff0b0");
    g.globalAlpha = 0.1 + flicker * 0.08;
    rect(wx - 1, wy, 4, 2, "#e6a85c");
    rect(wx, wy - 1, 2, 4, "#e6a85c");

    // Chimney smoke, carried off on the breeze.
    for (let i = 0; i < 9; i++) {
      const age = (t * 0.00011 + i / 9) % 1;
      g.globalAlpha = (1 - age) * 0.3;
      rect(
        CABIN_X + 8 + Math.sin(age * 5 + i * 1.3) * 2 + age * 11,
        CABIN_Y - 1 - age * 30,
        age > 0.45 ? 2 : 1,
        age > 0.7 ? 2 : 1,
        "#86a9a6"
      );
    }
    g.globalAlpha = 1;
  }

  function drawLake(t, moonGlow) {
    // Every row of the mirror slides sideways on its own slow wave.
    for (let dy = 0; dy < LAKE_ROWS; dy++) {
      const amplitude = 0.5 + dy * 0.045;
      const shift = Math.round(
        Math.sin(t * 0.0013 + dy * 0.75) * amplitude +
        Math.sin(t * 0.0007 + dy * 0.31) * amplitude * 0.6
      );
      g.drawImage(lake.canvas, 0, dy, W + LAKE_PAD * 2, 1, shift - LAKE_PAD, WATER_Y + dy, W + LAKE_PAD * 2, 1);
    }

    // Moon glade: a path of broken light widening toward the near shore.
    for (let dy = 2; dy < 46; dy++) {
      const p = dy / 46;
      const half = 5 + p * 30 + Math.sin(dy * 1.7) * 2;
      let offset = -half;
      let segment = 0;

      while (offset < half) {
        const key = dy * 83 + segment * 17;
        const length = 2 + Math.floor(rnd(key, 311) * (3 + p * 7));
        const gap = 1 + Math.floor(rnd(key, 312) * (2 + p * 5));
        const flick = Math.sin(t * (0.0011 + rnd(key, 313) * 0.0016) + rnd(key, 314) * TAU);
        const centre = 1 - Math.abs(offset + length / 2) / half;
        const alpha = (0.25 + centre * 0.6) * (0.55 + 0.45 * flick) * (1 - p * 0.35) * moonGlow;

        if (alpha > 0.1) {
          g.globalAlpha = Math.min(1, alpha);
          rect(
            MOON_X + offset + Math.round(flick * (1 + p * 2.5)),
            WATER_Y + dy,
            Math.min(length, half - offset),
            1,
            centre > 0.6 && segment % 3 === 0 ? "#fff3ca" : centre > 0.3 ? "#cfe3c8" : "#8eaf8d"
          );
        }
        offset += length + gap;
        segment++;
      }
    }

    // Stray glints across the rest of the water.
    for (const s of sparkles) {
      const wave = Math.sin(t * s.speed + s.phase);
      if (wave < 0.25) continue;
      g.globalAlpha = (wave - 0.25) * 0.5;
      rect(s.x + wave * 2, s.y, s.width, 1, "#8eaf8d");
    }

    // The cabin window, stretched into a warm streak.
    for (let dy = 1; dy < 11; dy++) {
      const wobble = Math.round(Math.sin(t * 0.002 + dy * 1.1) * (0.6 + dy * 0.15));
      g.globalAlpha = (1 - dy / 11) * (0.42 + Math.sin(t * 0.003 + dy) * 0.14);
      rect(CABIN_X + 3 + wobble, WATER_Y + dy, dy % 3 === 0 ? 1 : 2, 1, dy < 4 ? "#ffd27a" : "#e6a85c");
    }
    g.globalAlpha = 1;
  }

  function drawBoat(t) {
    const y = PIER_Y + Math.round(Math.sin(t * 0.0012) * 0.6);
    rect(BOAT_X, y, 1, 1, "#7fa39a");
    rect(BOAT_X + 14, y, 1, 1, "#7fa39a");
    rect(BOAT_X, y + 1, 15, 1, "#7fa39a");
    rect(BOAT_X + 1, y + 2, 13, 1, "#2c4a4c");
    rect(BOAT_X + 2, y + 3, 11, 1, "#10262d");
    rect(BOAT_X + 6, y + 1, 1, 1, "#2c4a4c");
    // Mooring line up to the pier.
    rect(BOAT_X + 15, y, 2, 1, "#4f7f80");
    rect(BOAT_X + 17, y - 1, 2, 1, "#4f7f80");
  }

  function drawReeds(t) {
    for (const r of reeds) {
      const bend = Math.sin(t * 0.0014 + r.phase + r.x * 0.03) * 1.6;
      const height = Math.round(r.height);
      const half = height >> 1;
      const topX = r.x + Math.round(bend);

      rect(r.x, r.y - half, 1, half, "#2b6253");
      rect(r.x + Math.round(bend * 0.5), r.y - height, 1, height - half, "#3a7459");
      if (r.head) rect(topX, r.y - height - 3, 1, 4, "#8a7a58");
      else rect(topX, r.y - height - 1, 1, 1, "#6fa373");
    }
  }

  function drawGrass(t) {
    for (const b of blades) {
      const sway = Math.sin(t * 0.0017 + b.phase + b.x * 0.022) + Math.sin(t * 0.0041 + b.phase * 2.3) * 0.4;
      const bend = sway * (0.6 + b.depth * 2.4);
      const segments = b.height > 14 ? 4 : b.height > 7 ? 3 : 2;
      const step = b.height / segments;

      // Each blade is a few stacked segments that lean further toward the tip.
      for (let s = 0; s < segments; s++) {
        const reach = (s + 1) / segments;
        rect(
          Math.round(b.x) + Math.round(bend * reach * reach),
          b.baseY - step * (s + 1),
          b.width,
          Math.ceil(step),
          b.color
        );
      }
    }
  }

  function drawFlowers(t) {
    for (const f of flowers) {
      const sway = Math.sin(t * 0.0013 + f.phase + f.x * 0.02) * (0.6 + f.depth * 1.6);
      const x = Math.round(f.x);
      const baseY = Math.round(f.y);
      const half = f.height >> 1;
      const hx = x + Math.round(sway);
      const hy = baseY - f.height;

      rect(x, baseY - half, 1, half, f.stem);
      rect(x + Math.round(sway * 0.5), hy, 1, f.height - half, f.stem);
      if (f.height > 8) rect(x + f.leaf, baseY - Math.floor(f.height * 0.4), 2, 1, "#477b5c");

      if (f.type === "daisy") {
        const s = f.size;
        rect(hx - s, hy - (s - 1), s * 2 + 1, s * 2 - 1, f.color);
        rect(hx - (s - 1), hy - s, s * 2 - 1, s * 2 + 1, f.color);
        rect(hx, hy, 1, 1, "#9c7951");
      } else if (f.type === "tulip") {
        rect(hx - 1, hy - 2, 3, 2, f.color);
        rect(hx, hy - 3, 1, 1, f.color);
      } else if (f.type === "lupine") {
        const spike = 4 + f.size * 2;
        rect(hx, hy - spike - 1, 1, 2, "#cdc6ee");
        for (let k = 0; k < spike; k++) {
          rect(hx - 1, hy - spike + 1 + k, 3, 1, k % 2 ? "#a9a0d8" : "#cdc6ee");
        }
      } else {
        rect(hx, hy - 1, f.size, 2, f.color);
      }
    }
  }

  function drawFireflies(t) {
    for (const f of fireflies) {
      const x = Math.round(f.x + Math.sin(t * 0.00031 * f.speed + f.phase) * f.roam + Math.sin(t * 0.0009 + f.phase * 3) * 2);
      const y = Math.round(f.y + Math.cos(t * 0.00043 * f.speed + f.phase * 1.7) * f.roam * 0.5);
      const glow = Math.max(0, Math.sin(t * 0.0019 * f.speed + f.phase * 5));
      if (glow < 0.05) continue;

      g.globalAlpha = glow * 0.28;
      rect(x - 1, y - 1, 3, 3, "#d4d98b");
      g.globalAlpha = glow * 0.5;
      rect(x - 1, y, 3, 1, "#d4d98b");
      rect(x, y - 1, 1, 3, "#d4d98b");
      if (glow > 0.8) {
        g.globalAlpha = (glow - 0.8) * 1.4;
        rect(x - 2, y, 5, 1, "#d4d98b");
        rect(x, y - 2, 1, 5, "#d4d98b");
      }
      g.globalAlpha = glow;
      rect(x, y, 1, 1, "#fff0ad");
    }
    g.globalAlpha = 1;
  }

  function drawSilhouettes(t) {
    // Dark foreground growth, closest to the viewer.
    for (const s of silhouettes) {
      const bend = Math.sin(t * 0.0015 + s.phase + s.x * 0.02) * 4;
      const third = s.height / 3;

      for (let k = 0; k < 3; k++) {
        const reach = (k + 1) / 3;
        rect(
          s.x + Math.round(bend * reach * reach),
          H - third * (k + 1),
          k === 2 ? s.width - 1 : s.width,
          Math.ceil(third),
          s.color
        );
      }

      if (s.seedHead) {
        const hx = s.x + Math.round(bend);
        const hy = H - s.height;
        rect(hx, hy - 9, 1, 9, s.color);
        rect(hx - 1, hy - 8, 3, 5, s.color);
      }
    }
  }

  // ---------------------------------------------------------------
  // Public draw
  // ---------------------------------------------------------------

  function draw(target, t, dayProgress = 0, visibleWidth = W, animate = true) {
    g = target;
    g.imageSmoothingEnabled = false;
    g.globalAlpha = 1;

    // The moon sinks behind the mountains as day comes on.
    const moonY = Math.round(lerp(MOON_Y, MOON_SET_Y, clamp(dayProgress / 0.55, 0, 1)));

    g.drawImage(sky.canvas, 0, 0);
    drawStars(t);
    drawName(t, visibleWidth, animate);
    drawMeteors(t);
    drawMoon(t, moonY);
    drawClouds(t, moonY);

    g.drawImage(mountains.canvas, 0, 0);
    g.globalAlpha = 0.5;
    drawWrapped(mist[0].canvas, t * 0.0011, 226);
    g.globalAlpha = 1;

    g.drawImage(farShore.canvas, 0, 0);
    drawCabin(t);
    drawLake(t, 1 - clamp(dayProgress / 0.4, 0, 1));
    g.globalAlpha = 0.34;
    drawWrapped(mist[1].canvas, -t * 0.0017, WATER_Y - 9);
    g.globalAlpha = 0.24;
    drawWrapped(mist[0].canvas, t * 0.0023 + 300, WATER_Y - 5);
    g.globalAlpha = 1;

    g.drawImage(nearShore.canvas, 0, 0);
    drawBoat(t);
    drawReeds(t);
    drawGrass(t);
    drawFlowers(t);
    drawFireflies(t);
    drawSilhouettes(t);
  }

  return { draw, isNameHotspot, replayName };
})();
