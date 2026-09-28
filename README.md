# Pixel Night Portfolio Background — V2

This version is a moonlit pixel-art lakeside scene with a still, softly shimmering reflection.

## What changed

- Removed all navigation links and portfolio UI.
- Replaced normal text with a built-in 5x7 bitmap pixel font.
- Large pixel-art name: `DARREN`.
- Live date/time directly below the name.
- Detailed warm moon with:
  - stepped circular silhouette
  - dark rim
  - several blocky craters
  - highlight patches
  - subtle animated glow
- Fixed, stair-stepped mountain silhouettes with pixel facets and no morphing peaks.
- Quiet lake with a round moon-disc reflection that breaks into small, restrained ripples.
- Abundant pixel flowers in cream, blush, and gold framing the shoreline.
- Animated starfield:
  - 220 deterministic stars
  - twinkling
  - brighter star crosses
  - occasional shooting stars
- Slow drifting pixel clouds.
- Layered grass foreground and shoreline plants.
- Hundreds of animated grass/reed blades responding to wind.
- Fireflies that drift and brighten/dim.
- Subtle pixel texture and vignette.
- Full viewport with `overflow: hidden`.
- Automatically pauses the animation when the browser tab is hidden.
- Automatically respects `prefers-reduced-motion` at the CSS overlay level.
- No external images, libraries, fonts, or APIs.

## Files

- `index.html`
- `pixel-night.css`
- `pixel-night.js`

## Customize the name

In `pixel-night.js`, change:

```js
pixelText(
  "DARREN",
```

to your desired name.

## Put your portfolio on top

Keep the background fixed and add your real site content normally.

Example:

```html
<div class="pixel-night" aria-hidden="true">
  <canvas id="pixelNightCanvas"></canvas>
  <div class="pixel-night__vignette"></div>
  <div class="pixel-night__grain"></div>
</div>

<main class="site-content">
  Your real portfolio
</main>
```

Then:

```css
.site-content {
  position: relative;
  z-index: 10;
}
```

The background itself never creates a scrollbar.

## Performance notes

The scene is rendered at a fixed 640x360 logical resolution and scaled to the viewport with nearest-neighbour rendering. This keeps the pixel style crisp and makes the amount of drawing independent from a very large monitor's native resolution.

The scene uses a single canvas and a single `requestAnimationFrame` loop. No DOM particle elements are created.
