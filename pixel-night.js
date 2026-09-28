/*
  PIXEL NIGHT V2
  ------------------------------------------------------------------
  Everything is rendered in a 640x360 logical coordinate system.
  It is then scaled to the viewport with nearest-neighbour rendering.

  The result is a detailed pixel-art scene that remains lightweight:
  one canvas, no assets, no DOM animation loops, no dependencies.
  ------------------------------------------------------------------
*/

(() => {
  "use strict";

  const canvas = document.getElementById("pixelNightCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  const W = 640;
  const H = 360;
  let visibleLogicalWidth = W;

  canvas.width = W;
  canvas.height = H;

  ctx.imageSmoothingEnabled = false;

  function updateVisibleLogicalWidth() {
    const canvasBounds = canvas.getBoundingClientRect();
    visibleLogicalWidth = canvasBounds.width > 0
      ? Math.min(W, W * window.innerWidth / canvasBounds.width)
      : W;
  }

  window.addEventListener("resize", updateVisibleLogicalWidth, { passive: true });
  updateVisibleLogicalWidth();

  // ---------------------------------------------------------------
  // Palette
  // ---------------------------------------------------------------

  const C = {
    sky0: "#061521",
    sky1: "#092432",
    sky2: "#103644",
    sky3: "#194c55",

    starDim: "#426b7b",
    starMid: "#72a7a1",
    starBright: "#d0ebc4",

    moonGlow: "#a9d8bd",
    moonLight: "#e8e6bd",
    moonLight2: "#fff3ca",
    moonShade: "#c4d8b2",
    moonCrater: "#a9c9a7",
    moonCraterDark: "#789d91",

    farMountain: "#203b50",
    farMountain2: "#29475a",
    midMountain: "#385566",
    midMountainDark: "#2d465a",

    ridge: "#45635f",
    ridgeLight: "#839078",
    ridgeDark: "#263d4a",
    mountainPine: "#203b42",
    mountainPineLight: "#526c58",

    lake0: "#123b46",
    lake1: "#194b51",
    lake2: "#28615d",
    lakeShimmer: "#8eaf8d",
    field0: "#12353b",
    field1: "#19464a",
    field2: "#286054",
    field3: "#477b5c",

    grassShadow: "#102d34",
    grassDark: "#24544c",
    grassMid: "#477354",
    grassLight: "#7d9860",

    firefly: "#d4d98b",
    firefly2: "#fff0ad",

    cloud: "#163747",
    cloud2: "#204a54",
    haze: "#55807c",

    flowerCream: "#f3e7bd",
    flowerBlush: "#d99b91",
    flowerGold: "#e6c878",
    flowerCenter: "#9c7951",

    text: "#e5edcf",
    textShadow: "#071923"
  };

  // ---------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------

  const TAU = Math.PI * 2;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function hash(n) {
    // Deterministic pseudo-random number [0, 1)
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function poly(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(Math.round(points[0][0]), Math.round(points[0][1]));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(Math.round(points[i][0]), Math.round(points[i][1]));
    }
    ctx.closePath();
    ctx.fill();
  }

  // ---------------------------------------------------------------
  // Bitmap pixel font
  //
  // Every glyph is a 5x7 matrix. This means the name/date really
  // is pixel lettering, not a normal font with a CSS filter.
  // ---------------------------------------------------------------

  const FONT = {
    "A": ["01110","10001","10001","11111","10001","10001","10001"],
    "B": ["11110","10001","10001","11110","10001","10001","11110"],
    "C": ["01111","10000","10000","10000","10000","10000","01111"],
    "D": ["11110","10001","10001","10001","10001","10001","11110"],
    "E": ["11111","10000","10000","11110","10000","10000","11111"],
    "F": ["11111","10000","10000","11110","10000","10000","10000"],
    "G": ["01111","10000","10000","10111","10001","10001","01111"],
    "H": ["10001","10001","10001","11111","10001","10001","10001"],
    "I": ["11111","00100","00100","00100","00100","00100","11111"],
    "J": ["00111","00010","00010","00010","10010","10010","01100"],
    "K": ["10001","10010","10100","11000","10100","10010","10001"],
    "L": ["10000","10000","10000","10000","10000","10000","11111"],
    "M": ["10001","11011","10101","10101","10001","10001","10001"],
    "N": ["10001","11001","10101","10101","10011","10001","10001"],
    "O": ["01110","10001","10001","10001","10001","10001","01110"],
    "P": ["11110","10001","10001","11110","10000","10000","10000"],
    "Q": ["01110","10001","10001","10001","10101","10010","01101"],
    "R": ["11110","10001","10001","11110","10100","10010","10001"],
    "S": ["01111","10000","10000","01110","00001","00001","11110"],
    "T": ["11111","00100","00100","00100","00100","00100","00100"],
    "U": ["10001","10001","10001","10001","10001","10001","01110"],
    "V": ["10001","10001","10001","10001","10001","01010","00100"],
    "W": ["10001","10001","10001","10101","10101","11011","10001"],
    "X": ["10001","10001","01010","00100","01010","10001","10001"],
    "Y": ["10001","10001","01010","00100","00100","00100","00100"],
    "Z": ["11111","00001","00010","00100","01000","10000","11111"],

    "0": ["01110","10001","10011","10101","11001","10001","01110"],
    "1": ["00100","01100","00100","00100","00100","00100","01110"],
    "2": ["01110","10001","00001","00010","00100","01000","11111"],
    "3": ["11110","00001","00001","01110","00001","00001","11110"],
    "4": ["00010","00110","01010","10010","11111","00010","00010"],
    "5": ["11111","10000","10000","11110","00001","00001","11110"],
    "6": ["01110","10000","10000","11110","10001","10001","01110"],
    "7": ["11111","00001","00010","00100","01000","01000","01000"],
    "8": ["01110","10001","10001","01110","10001","10001","01110"],
    "9": ["01110","10001","10001","01111","00001","00001","01110"],

    ".": ["00000","00000","00000","00000","00000","00110","00110"],
    ":": ["00000","00110","00110","00000","00110","00110","00000"],
    "-": ["00000","00000","00000","11111","00000","00000","00000"],
    "/": ["00001","00010","00010","00100","01000","01000","10000"],
    " ": ["00000","00000","00000","00000","00000","00000","00000"]
  };

  function measurePixelText(text, scale, gap = scale) {
    const chars = text.toUpperCase().split("");
    let width = 0;

    chars.forEach((ch, i) => {
      width += ((FONT[ch] || FONT[" "])[0].length * scale);
      if (i !== chars.length - 1) width += gap;
    });

    return width;
  }

  function fitPixelTextScale(text, maxScale, maxWidth, gapForScale) {
    for (let candidateScale = maxScale; candidateScale > 1; candidateScale--) {
      if (measurePixelText(text, candidateScale, gapForScale(candidateScale)) <= maxWidth) {
        return candidateScale;
      }
    }
    return 1;
  }

  function pixelText(text, x, y, scale, color, options = {}) {
    const gap = options.gap ?? scale;
    const shadow = options.shadow ?? 0;
    const align = options.align ?? "left";
    const glow = options.glow ?? false;

    const totalW = measurePixelText(text, scale, gap);
    let startX = x;

    if (align === "center") startX = x - totalW / 2;
    if (align === "right") startX = x - totalW;

    const drawGlyphs = (ox, oy, col) => {
      let cursor = ox;

      for (const ch of text.toUpperCase()) {
        const glyph = FONT[ch] || FONT[" "];

        for (let row = 0; row < glyph.length; row++) {
          for (let colIndex = 0; colIndex < glyph[row].length; colIndex++) {
            if (glyph[row][colIndex] === "1") {
              rect(
                cursor + colIndex * scale,
                oy + row * scale,
                scale,
                scale,
                col
              );
            }
          }
        }

        cursor += glyph[0].length * scale + gap;
      }
    };

    if (shadow) drawGlyphs(startX + shadow, y + shadow, C.textShadow);

    if (glow) {
      ctx.globalAlpha = 0.14;
      drawGlyphs(startX + 1, y, color);
      ctx.globalAlpha = 0.14;
      drawGlyphs(startX - 1, y, color);
      ctx.globalAlpha = 1;
    }

    drawGlyphs(startX, y, color);

    return totalW;
  }

  function moonCircle(cx, cy, radius, color) {
    /*
      A stepped circle. Drawing as horizontal rows makes the silhouette
      feel like deliberate pixel art instead of a smooth vector circle.
    */
    const r = Math.round(radius);

    for (let dy = -r; dy <= r; dy++) {
      const span = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      const y = Math.round(cy + dy);
      rect(cx - span, y, span * 2 + 1, 1, color);
    }
  }

  function moonSpot(cx, cy, radius, color) {
    for (let dy = -radius; dy <= radius; dy++) {
      const halfWidth = Math.floor(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
      rect(cx - halfWidth, cy + dy, halfWidth * 2 + 1, 1, color);
    }
  }

  function moonCrater(cx, cy, radius) {
    moonSpot(cx, cy, radius, C.moonCraterDark);
    moonSpot(cx, cy, radius - 1, C.moonCrater);
    moonSpot(cx + 1, cy + 1, Math.max(1, radius - 2), C.moonCraterDark);
    rect(cx - radius + 1, cy - 1, 1, 1, C.moonLight2);
    rect(cx - 1, cy - radius + 1, 1, 1, C.moonLight2);
  }

  // ---------------------------------------------------------------
  // Scene data
  // ---------------------------------------------------------------

  const stars = [];
  const shootingStars = [];
  const clouds = [];
  const fireflies = [];
  const grass = [];
  const flowers = [];

  for (let i = 0; i < 220; i++) {
    stars.push({
      x: Math.floor(hash(i * 4.17) * W),
      y: Math.floor(hash(i * 7.91) * 205),
      s: hash(i * 2.31) > 0.88 ? 2 : 1,
      a: 0.35 + hash(i * 6.11) * 0.65,
      phase: hash(i * 9.73) * TAU,
      twinkle: 0.5 + hash(i * 3.91) * 2.0
    });
  }

  for (let i = 0; i < 7; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    clouds.push({
      x: side < 0 ? hash(i + 60) * 125 - 40 : W - 85 + hash(i + 60) * 125,
      y: 174 + hash(i + 71) * 12,
      speed: 0.8 + hash(i + 72) * 1.4,
      scale: 0.55 + hash(i + 73) * 0.8,
      alpha: 0.16 + hash(i + 74) * 0.14,
      side
    });
  }

  for (let i = 0; i < 32; i++) {
    fireflies.push({
      x: hash(i * 1.71) * W,
      y: 326 + hash(i * 4.43) * 31,
      phase: hash(i * 8.41) * TAU,
      speed: 0.3 + hash(i * 3.17) * 0.8,
      drift: 0.5 + hash(i * 9.11) * 1.2
    });
  }

  for (let i = 0; i < 280; i++) {
    grass.push({
      x: hash(i * 2.12) * W,
      baseY: 324 + hash(i * 9.17) * 42,
      h: 7 + hash(i * 5.73) * 28,
      w: 1 + (hash(i * 1.33) > 0.94 ? 1 : 0),
      phase: hash(i * 7.21) * TAU,
      depth: hash(i * 6.91)
    });
  }

  for (let i = 0; i < 72; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const edge = hash(i * 3.27) * 108;
    flowers.push({
      x: side > 0 ? 18 + edge : W - 18 - edge,
      y: 324 + hash(i * 7.13) * 31,
      height: 10 + hash(i * 4.61) * 15,
      size: hash(i * 8.19) > 0.55 ? 2 : 1,
      color: [C.flowerCream, C.flowerBlush, C.flowerGold][i % 3],
      phase: hash(i * 6.47) * TAU
    });
  }

  for (let i = 0; i < 30; i++) {
    flowers.push({
      x: 202 + hash(i * 2.83 + 17) * 236,
      y: 332 + hash(i * 6.17 + 4) * 22,
      height: 8 + hash(i * 3.91 + 11) * 13,
      size: hash(i * 8.19 + 5) > 0.5 ? 2 : 1,
      color: [C.flowerCream, C.flowerBlush, C.flowerGold][(i + 1) % 3],
      phase: hash(i * 6.47 + 9) * TAU
    });
  }

  // ---------------------------------------------------------------
  // Layered mountain generator
  // ---------------------------------------------------------------

  function mountain(points, baseY, color, seed, facetColor) {
    const tops = [];
    const step = W / (points - 1);

    for (let i = 0; i < points; i++) {
      const x = i * step;
      const n = hash(i * 19.73 + seed);
      const wave = Math.sin(i * 1.37 + seed) * 9;
      const y = baseY - 10 - n * 70 - wave;

      tops.push([x, Math.round(y)]);
    }

    const polyPoints = [[0, H], [0, Math.floor(tops[0][1] / 3) * 3]];
    let segment = 0;
    for (let x = 4; x < W; x += 4) {
      while (segment < tops.length - 2 && x > tops[segment + 1][0]) segment++;
      const left = tops[segment];
      const right = tops[segment + 1];
      const amount = (x - left[0]) / (right[0] - left[0]);
      const surfaceY = lerp(left[1], right[1], amount);
      polyPoints.push([x, Math.floor(surfaceY / 3) * 3]);
    }
    polyPoints.push([W, Math.floor(tops[tops.length - 1][1] / 3) * 3], [W, H]);

    poly(polyPoints, color);

    ctx.globalAlpha = 0.34;
    for (let x = 8; x < W; x += 12) {
      let index = 0;
      while (index < tops.length - 2 && x > tops[index + 1][0]) index++;
      const left = tops[index];
      const right = tops[index + 1];
      const amount = (x - left[0]) / (right[0] - left[0]);
      const surfaceY = lerp(left[1], right[1], amount);
      const patchY = Math.ceil(surfaceY / 3) * 3 + 6 + Math.floor(hash(x * 1.7 + seed) * 15);

      if (patchY < baseY - 5) {
        rect(x, patchY, 3 + Math.floor(hash(x * 2.3 + seed) * 5), 1 + Math.floor(hash(x + seed) * 2), facetColor);
        if (hash(x * 3.1 + seed) > 0.48) {
          rect(x + 2, patchY + 3, 2, 1, facetColor);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------
  // Background drawing
  // ---------------------------------------------------------------

  function drawSky(t) {
    // Horizontal stepped gradient: 40 bands, not one giant smooth fill.
    const bands = 40;
    for (let i = 0; i < bands; i++) {
      const p = i / (bands - 1);

      let color;

      if (p < 0.65) {
        const q = p / 0.65;
        color = interpolateHex(C.sky0, C.sky2, clamp(q, 0, 1));
      } else {
        const q = (p - 0.65) / 0.35;
        color = interpolateHex(C.sky2, C.sky3, clamp(q, 0, 1));
      }

      rect(0, Math.floor(i * H / bands), W, Math.ceil(H / bands) + 1, color);
    }

    // Tiny horizontal pixel haze near the horizon.
    for (let i = 0; i < 18; i++) {
      const y = 210 + i * 2;
      const a = 0.008 + i * 0.0015;
      ctx.fillStyle = `rgba(73, 159, 170, ${a})`;
      ctx.fillRect(0, y, W, 1);
    }
  }

  function interpolateHex(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return rgbToHex(
      Math.round(lerp(ca.r, cb.r, t)),
      Math.round(lerp(ca.g, cb.g, t)),
      Math.round(lerp(ca.b, cb.b, t))
    );
  }

  function hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    };
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b]
      .map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("");
  }

  function drawStars(t) {
    for (const s of stars) {
      const tw = 0.72 + Math.sin(t * 0.001 * s.twinkle + s.phase) * 0.28;
      const alpha = s.a * tw;

      ctx.globalAlpha = alpha;

      if (s.s === 2) {
        rect(s.x, s.y, 2, 2, C.starBright);
      } else {
        rect(
          s.x,
          s.y,
          1,
          1,
          hash(Math.floor(s.x * 0.37 + s.y * 1.91)) > 0.35
            ? C.starDim
            : C.starMid
        );
      }

      // occasional little 3-pixel star cross
      if (s.s === 2 && tw > 0.93) {
        rect(s.x - 1, s.y, 4, 1, C.starBright);
        rect(s.x, s.y - 1, 1, 3, C.starBright);
      }
    }

    ctx.globalAlpha = 1;

    // Animated shooting stars.
    if (Math.random() < 0.006 && shootingStars.length < 2) {
      shootingStars.push({
        x: 40 + Math.random() * 480,
        y: 25 + Math.random() * 85,
        age: 0,
        length: 16 + Math.random() * 22,
        speed: 140 + Math.random() * 100
      });
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const s = shootingStars[i];
      s.age += 0.016;
      const p = s.age;

      if (p > 1.2) {
        shootingStars.splice(i, 1);
        continue;
      }

      const x = s.x + p * s.speed;
      const y = s.y + p * s.speed * 0.35;

      ctx.globalAlpha = Math.max(0, 1 - p);
      rect(x, y, 2, 2, C.starBright);

      const tail = Math.max(4, Math.floor(s.length * (1 - p)));
      for (let k = 1; k < tail; k += 2) {
        rect(x - k * 2, y - Math.floor(k * 0.7), 2, 1, C.starMid);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawClouds(t) {
    for (const c of clouds) {
      c.x += c.speed * 0.018 * c.side;
      if (c.side < 0 && c.x < -120) c.x = 150;
      if (c.side > 0 && c.x > W + 90) c.x = W - 130;

      ctx.globalAlpha = c.alpha;
      const s = c.scale;
      const x = Math.floor(c.x);
      const y = Math.floor(c.y + Math.sin(t * 0.00018 + c.x) * 3);

      // Pixel cloud made of stair-stepped blocks.
      rect(x, y + 5 * s, 34 * s, 5 * s, C.cloud);
      rect(x + 7 * s, y + 2 * s, 22 * s, 8 * s, C.cloud);
      rect(x + 13 * s, y, 12 * s, 8 * s, C.cloud2);
      rect(x + 28 * s, y + 6 * s, 10 * s, 4 * s, C.cloud);
    }
    ctx.globalAlpha = 1;
  }

  function drawMoon(t) {
    const cx = 320;
    const cy = 132;
    const r = 33;
    const pulse = 1 + Math.sin(t * 0.0011) * 0.025;

    // Stepped halo, intentionally blocky.
    ctx.globalAlpha = 0.08;
    moonCircle(cx, cy, Math.round(r * 1.65 * pulse), C.moonGlow);
    ctx.globalAlpha = 0.10;
    moonCircle(cx, cy, Math.round(r * 1.38 * pulse), C.moonGlow);
    ctx.globalAlpha = 1;

    // Dark rim / shadow edge.
    moonCircle(cx, cy + 1, r + 2, C.moonCraterDark);

    // Main moon.
    moonCircle(cx, cy, r, C.moonLight);

    // Small round craters retain lunar texture without chunky rectangular marks.
    moonCrater(cx - 14, cy - 10, 4);
    moonCrater(cx + 13, cy - 16, 3);
    moonCrater(cx + 8, cy + 12, 4);
    moonCrater(cx - 8, cy + 20, 3);
    moonCrater(cx - 22, cy + 6, 2);
    moonCrater(cx + 23, cy + 1, 2);

    // Fine, deterministic flecks add surface detail at the canvas pixel scale.
    for (let i = 0; i < 58; i++) {
      const angle = hash(i * 3.71) * TAU;
      const distance = 5 + Math.sqrt(hash(i * 5.13)) * 24;
      const x = Math.round(cx + Math.cos(angle) * distance);
      const y = Math.round(cy + Math.sin(angle) * distance);
      if ((x - cx) ** 2 + (y - cy) ** 2 < (r - 3) ** 2) {
        ctx.globalAlpha = 0.28 + hash(i * 9.17) * 0.38;
        rect(x, y, 1, 1, i % 4 === 0 ? C.moonLight2 : C.moonCrater);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawMountains() {
    // Fixed, stepped silhouettes keep the horizon still while the lake moves gently.
    mountain(20, 263, C.farMountain, 12.2, C.ridge);
    mountain(16, 271, C.farMountain2, 29.7, C.ridgeLight);

    mountain(18, 280, C.midMountainDark, 8.7, C.ridge);
    mountain(15, 286, C.midMountain, 44.1, C.ridgeLight);

    const ridgeY = 240;
    poly([
      [0, ridgeY + 7],
      [60, ridgeY - 8],
      [111, ridgeY + 5],
      [168, ridgeY - 11],
      [224, ridgeY + 3],
      [282, ridgeY - 14],
      [341, ridgeY + 2],
      [398, ridgeY - 13],
      [455, ridgeY + 3],
      [511, ridgeY - 12],
      [567, ridgeY + 2],
      [640, ridgeY - 11],
      [640, 254],
      [0, 254]
    ], C.ridge);

    // Snowless light-facing ridge pieces.
    poly([
      [0, 240], [60, 225], [95, 234], [111, 232], [168, 221],
      [224, 235], [282, 218], [341, 234], [398, 221], [455, 234],
      [511, 221], [567, 232], [640, 221], [640, 230], [567, 243],
      [511, 232], [455, 245], [398, 232], [341, 245], [282, 229],
      [224, 246], [168, 232], [111, 244], [60, 234], [0, 248]
    ], C.ridgeLight);

    // Low dark ridge gives the mountains readable separation.
    poly([
      [0, 250], [80, 237], [155, 250], [228, 239],
      [309, 254], [387, 238], [464, 254], [540, 237],
      [640, 252], [640, 268], [0, 268]
    ], C.ridgeDark);

    // Tiny conifers break up the skyline and anchor the mountain scale.
    for (let i = 0; i < 43; i++) {
      const x = 5 + i * 15 + Math.floor(hash(i * 5.37) * 7);
      const baseY = 248 + Math.floor(hash(i * 2.91) * 6);
      const height = 6 + Math.floor(hash(i * 7.71) * 7);
      const shade = hash(i * 3.13) > 0.55 ? C.mountainPineLight : C.mountainPine;

      rect(x, baseY - height, 1, height, shade);
      rect(x - 1, baseY - height + 2, 3, 2, shade);
      rect(x - 2, baseY - height + 4, 5, 2, shade);
      rect(x - 3, baseY - height + 6, 7, 2, shade);
      rect(x, baseY - 2, 1, 2, C.ridgeDark);
    }
  }

  function drawLake(t) {
    rect(0, 254, W, 66, C.lake0);
    rect(0, 254, W, 2, C.ridgeDark);
    for (let x = 0; x < W; x += 16) {
      if (hash(x * 0.73) > 0.3) {
        rect(x, 256, 5 + Math.floor(hash(x * 1.31) * 8), 1, C.ridgeLight);
      }
    }
    rect(0, 258, W, 1, C.lake1);

    // Quiet horizontal water bands; only the reflected light breathes.
    for (let y = 264; y < 320; y += 8) {
      ctx.globalAlpha = 0.18;
      rect(0, y, W, 1, y % 16 === 0 ? C.lake2 : C.lake1);
    }

    // A broken, flattened disc gives the reflection the moon's round silhouette.
    const reflectionX = 320;
    const reflectionY = 270;
    for (let dy = -15; dy <= 15; dy++) {
      const normalizedY = dy / 15;
      const halfWidth = Math.floor(30 * Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY)));
      const rowAlpha = 0.18 + (1 - Math.abs(normalizedY)) * 0.3;
      let offsetX = -halfWidth;
      let segment = 0;

      while (offsetX <= halfWidth) {
        const key = dy * 83 + segment * 17;
        const length = 2 + Math.floor(hash(key + 4.1) * 7);
        const gap = Math.floor(hash(key + 9.7) * 3);
        const phase = hash(key + 13.3) * TAU;
        const speed = 0.001 + hash(key + 19.1) * 0.0014;
        const amplitude = 1 + hash(key + 23.7) * 2.5;
        const offset = Math.round(
          Math.sin(t * speed + phase) * amplitude +
          Math.sin(t * speed * 0.53 + phase * 1.7) * 0.8
        );
        const drawX = reflectionX + offsetX + offset;
        const drawWidth = Math.min(length, halfWidth - offsetX + 1);

        ctx.globalAlpha = rowAlpha * (0.75 + hash(key + 29.4) * 0.25);
        rect(drawX, reflectionY + dy, drawWidth, 1, segment % 4 === 0 ? C.moonLight2 : C.lakeShimmer);
        offsetX += length + gap;
        segment++;
      }
    }

    // The round echo breaks into short, still-glistening strokes below the surface.
    for (let row = 0; row < 10; row++) {
      const y = Math.round(reflectionY + 17 + row * 3.5);
      const width = 8 + row * 2;
      const phase = hash(row * 13.7 + 6.2) * TAU;
      const x = Math.round(reflectionX + Math.sin(t * (0.001 + hash(row * 3.1) * 0.0012) + phase) * (2 + row * 0.25));
      ctx.globalAlpha = 0.5 - row * 0.035;
      rect(x - width / 2, y, width, row % 3 === 0 ? 2 : 1, C.lakeShimmer);
      if (row < 6) {
        rect(x - width - 7, y + 1, 4, 1, C.moonLight2);
        rect(x + width + 4, y - 1, 5, 1, C.lake2);
      }
    }

    // Scattered distant ripples keep the surface legible without a river-like flow.
    for (let i = 0; i < 42; i++) {
      const x = hash(i * 4.73) * W;
      const y = 263 + hash(i * 8.31) * 47;
      const nearReflection = Math.abs(x - 320) < 26 + (y - 263) * 0.55;
      if (!nearReflection && hash(i * 2.19) > 0.3) {
        ctx.globalAlpha = 0.18 + hash(i * 5.11) * 0.14;
        rect(x, y, 2 + Math.floor(hash(i * 9.7) * 7), 1, C.lakeShimmer);
      }
    }

    ctx.globalAlpha = 1;
  }

  function drawField(t) {
    rect(0, 318, W, 42, C.field0);
    rect(0, 326, W, 34, C.field1);

    // Horizontal pixel bands create depth.
    for (let y = 328; y < 360; y += 7) {
      ctx.globalAlpha = 0.16;
      rect(0, y, W, 2, y % 14 === 0 ? C.field3 : C.field2);
    }
    ctx.globalAlpha = 1;

    // Fireflies.
    for (const f of fireflies) {
      f.x += Math.sin(t * 0.0006 * f.speed + f.phase) * 0.012;
      const yy = f.y + Math.sin(t * 0.0012 + f.phase) * 7;
      const alpha = 0.25 + (Math.sin(t * 0.0022 + f.phase) + 1) * 0.32;

      ctx.globalAlpha = alpha;
      rect(Math.round(f.x), Math.round(yy), 2, 2, C.firefly);

      if (alpha > 0.72) {
        rect(Math.round(f.x - 2), Math.round(yy), 1, 1, C.firefly2);
        rect(Math.round(f.x + 2), Math.round(yy), 1, 1, C.firefly2);
        rect(Math.round(f.x), Math.round(yy - 2), 1, 1, C.firefly2);
        rect(Math.round(f.x), Math.round(yy + 2), 1, 1, C.firefly2);
      }
    }
    ctx.globalAlpha = 1;

    // Foreground blades.
    for (const g of grass) {
      const wind = Math.sin(t * 0.0019 + g.phase + g.x * 0.025);
      const bend = Math.round(wind * (2 + g.depth * 2));

      const x = Math.round(g.x);
      const baseY = Math.round(g.baseY);
      const topY = Math.round(baseY - g.h);

      const col =
        g.depth < 0.28 ? C.grassLight :
        g.depth < 0.62 ? C.grassMid :
        C.grassDark;

      // trunk
      rect(x, topY, g.w, g.h, col);

      // wind-bent upper pixels
      rect(x + bend, topY - 2, g.w, 5, col);
      if (g.h > 20) {
        rect(x + Math.round(bend * 0.55), topY + 5, g.w, 7, col);
      }
    }

    // Stronger foreground silhouette.
    for (let i = 0; i < 34; i++) {
      const x = i * 20 + ((i % 3) * 5);
      const h = 18 + Math.floor(hash(i * 11.2) * 25);
      const wind = Math.round(Math.sin(t * 0.0016 + i) * 4);

      rect(x + wind, 360 - h, 3, h, C.grassShadow);
      rect(x + wind + 2, 360 - h - 5, 2, 10, C.grassShadow);
    }
  }

  function drawFlowers(t) {
    for (const flower of flowers) {
      const sway = Math.round(Math.sin(t * 0.001 + flower.phase) * 1.5);
      const x = Math.round(flower.x + sway);
      const baseY = Math.round(flower.y);
      const topY = baseY - Math.round(flower.height);

      rect(x, topY, 1, flower.height, C.grassMid);
      rect(x - 3, topY + Math.floor(flower.height * 0.62), 3, 1, C.grassLight);
      rect(x + 1, topY + Math.floor(flower.height * 0.76), 3, 1, C.grassMid);

      const petal = flower.size;
      rect(x - petal, topY - petal, petal, petal, flower.color);
      rect(x + 1, topY - petal, petal, petal, flower.color);
      rect(x - petal, topY + 1, petal, petal, flower.color);
      rect(x + 1, topY + 1, petal, petal, flower.color);
      rect(x, topY, 1, 1, C.flowerCenter);
    }
  }

  function drawText(t) {
    // Name: deliberately large, chunky and pixel-perfect.
    const compactLayout = visibleLogicalWidth < W;
    const name = "DARREN NADARAJAH";
    const nameLines = compactLayout && visibleLogicalWidth < 103
      ? name.split(" ")
      : [name];
    const longestNameLine = nameLines.reduce((longest, line) =>
      line.length > longest.length ? line : longest
    );
    let nameScale = fitPixelTextScale(
      longestNameLine,
      5,
      Math.max(5, visibleLogicalWidth - 8),
      candidateScale => candidateScale
    );

    const nameY = nameLines.length > 1 ? 32 : 38;
    const safeBottom = 92;
    const nameBlockHeight = () =>
      nameLines.length * 7 * nameScale + (nameLines.length - 1) * 4;

    while (nameY + nameBlockHeight() + 8 > safeBottom && nameScale > 1) {
      nameScale--;
    }

    nameLines.forEach((line, lineIndex) => {
      pixelText(
        line,
        W / 2,
        nameY + lineIndex * (7 * nameScale + 4),
        nameScale,
        C.text,
        {
          align: "center",
          gap: nameScale,
          shadow: 3,
          glow: true
        }
      );
    });

    // Tiny decorative pixel dash.
    const pulse = Math.sin(t * 0.003) > 0 ? C.starBright : C.starMid;
    rect(318, nameY + nameBlockHeight() + 6, 4, 1, pulse);
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------

  let running = true;
  let raf = 0;
  let last = performance.now();
  let lastDraw = 0;
  let fpsTime = 0;

  function render(now) {
    if (!running) return;

    const dt = Math.min(50, now - last);
    last = now;
    fpsTime += dt;

    if (document.body.classList.contains("is-window-dragging") && now - lastDraw < 1000 / 30) {
      raf = requestAnimationFrame(render);
      return;
    }
    lastDraw = now;

    // Keep canvas coordinate system stable at 640x360.
    drawSky(now);
    drawStars(now);
    drawClouds(now);
    drawMoon(now);
    drawMountains();
    drawLake(now);
    drawField(now);
    drawFlowers(now);
    drawText(now);

    raf = requestAnimationFrame(render);
  }

  // Stop animation while the tab is hidden; restart when visible.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(render);
    }
  });

  // Render forever.
  raf = requestAnimationFrame(render);

  // Keep the background from becoming focusable.
  canvas.setAttribute("aria-hidden", "true");
})();
