/*
  PIXEL NIGHT V2
  ------------------------------------------------------------------
  Everything is rendered in a 640x360 logical coordinate system.
  It is then scaled to the viewport with nearest-neighbour rendering.

  The scenery itself lives in pixel-scene.js, which paints one scene
  in night colours and again in day colours. This file owns the
  visible canvas: it picks the scene for the current appearance,
  cross-fades the two while the theme changes, and runs the frame loop.
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

  // The night scene is drawn into this buffer only while cross-fading
  // over the day scene, so it only exists for the length of a theme change.
  const scenes = window.PixelScene;
  let nightBuffer = null;
  let nightCtx = null;

  function updateVisibleLogicalWidth() {
    const canvasBounds = canvas.getBoundingClientRect();
    visibleLogicalWidth = canvasBounds.width > 0
      ? Math.min(W, W * window.innerWidth / canvasBounds.width)
      : W;
  }

  window.addEventListener("resize", updateVisibleLogicalWidth, { passive: true });
  updateVisibleLogicalWidth();

  // ---------------------------------------------------------------
  // Day / night progress
  // ---------------------------------------------------------------

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  let dayProgress = document.documentElement.dataset.appearance === "light" ? 1 : 0;
  let animationsEnabled = !document.body.classList.contains("animations-disabled");
  document.documentElement.style.setProperty("--day-progress", `${dayProgress * 100}%`);
  let transitionFrom = dayProgress;
  let transitionTo = dayProgress;
  let transitionStart = 0;
  let transitionDuration = 0;

  window.addEventListener("portfolio-theme-transition", event => {
    transitionFrom = dayProgress;
    transitionTo = event.detail.appearance === "light" ? 1 : 0;
    transitionStart = performance.now();
    const requestedDuration = Number(event.detail.duration);
    if (!animationsEnabled || requestedDuration <= 0) {
      dayProgress = transitionTo;
      transitionDuration = 0;
      document.documentElement.style.setProperty("--day-progress", `${dayProgress * 100}%`);
      if (running) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(render);
      }
      return;
    }
    transitionDuration = requestedDuration || 1500;
  });

  function updateDayProgress(now) {
    if (!transitionDuration) return;
    const linear = clamp((now - transitionStart) / transitionDuration, 0, 1);
    const eased = linear * linear * (3 - 2 * linear);
    dayProgress = lerp(transitionFrom, transitionTo, eased);
    if (linear >= 1) {
      dayProgress = transitionTo;
      transitionDuration = 0;
    }
    document.documentElement.style.setProperty("--day-progress", `${dayProgress * 100}%`);
  }

  // The scene for whichever appearance is currently settled, if any.
  function settledScene() {
    if (dayProgress <= 0) return scenes.get("night");
    if (dayProgress >= 1) return scenes.get("day");
    return null;
  }

  // ---------------------------------------------------------------
  // Name: clicking the first letter writes it out again
  // ---------------------------------------------------------------

  function isOverName(event) {
    // The wallpaper itself ignores the pointer, so a hit on bare desktop
    // lands on the page root; anything else is real UI on top.
    const scene = settledScene();
    if (!scene || !animationsEnabled) return false;
    if (event.target !== document.body && event.target !== document.documentElement) return false;
    const bounds = canvas.getBoundingClientRect();
    return scene.isNameHotspot(
      (event.clientX - bounds.left) * W / bounds.width,
      (event.clientY - bounds.top) * H / bounds.height
    );
  }

  document.addEventListener("click", event => {
    if (isOverName(event)) settledScene().replayName();
  });

  let overName = false;
  document.addEventListener("pointermove", event => {
    const over = isOverName(event);
    if (over === overName) return;
    overName = over;
    document.body.style.cursor = over ? "var(--cursor-hand, pointer)" : "";
  }, { passive: true });

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------

  let running = true;
  let raf = 0;
  let lastDraw = 0;

  window.addEventListener("portfolio-animations-change", event => {
    animationsEnabled = Boolean(event.detail.enabled);
    cancelAnimationFrame(raf);
    if (!animationsEnabled && transitionDuration) {
      dayProgress = transitionTo;
      transitionDuration = 0;
      document.documentElement.style.setProperty("--day-progress", `${dayProgress * 100}%`);
    }
    if (running) raf = requestAnimationFrame(render);
  });

  function render(now) {
    if (!running) return;

    if (animationsEnabled && document.body.classList.contains("is-window-dragging") && now - lastDraw < 1000 / 30) {
      raf = requestAnimationFrame(render);
      return;
    }
    lastDraw = now;
    updateDayProgress(now);

    // Keep canvas coordinate system stable at 640x360.
    const scene = settledScene();
    if (scene) {
      nightBuffer = nightCtx = null;
      scene.draw(ctx, now, dayProgress, visibleLogicalWidth, animationsEnabled);
    } else {
      // Mid-transition, the night scene fades out over the day scene.
      if (!nightBuffer) {
        nightBuffer = document.createElement("canvas");
        nightBuffer.width = W;
        nightBuffer.height = H;
        nightCtx = nightBuffer.getContext("2d", { alpha: false });
      }
      scenes.get("day").draw(ctx, now, dayProgress, visibleLogicalWidth, animationsEnabled);
      scenes.get("night").draw(nightCtx, now, dayProgress, visibleLogicalWidth, animationsEnabled);
      ctx.globalAlpha = 1 - dayProgress;
      ctx.drawImage(nightBuffer, 0, 0);
      ctx.globalAlpha = 1;
    }

    if (animationsEnabled) raf = requestAnimationFrame(render);
  }

  // Stop animation while the tab is hidden; restart when visible.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else {
      running = true;
      raf = requestAnimationFrame(render);
    }
  });

  // Render forever.
  raf = requestAnimationFrame(render);

  // Paint the other appearance's scene once the page has settled, so the
  // first theme switch does not have to wait for it.
  window.setTimeout(() => {
    scenes.get(dayProgress >= 0.5 ? "night" : "day");
  }, 3000);

  // Keep the background from becoming focusable.
  canvas.setAttribute("aria-hidden", "true");
})();
