(() => {
  "use strict";

  const root = document.body;
  const dock = document.querySelector(".desktop-dock");
  const windows = [...document.querySelectorAll(".portfolio-window")];
  const accentButtons = [...document.querySelectorAll(".accent-swatch")];
  const animationsSetting = document.getElementById("disable-animations");
  const settingsToggle = document.getElementById("desktop-settings-toggle");
  const settingsPopover = document.getElementById("desktop-settings-popover");
  const accentKey = "portfolio-accent";
  const animationsKey = "portfolio-animations-disabled";
  const mobileBreakpoint = window.matchMedia("(max-width: 767px)");
  const openingAnimations = new WeakMap();
  let focusedWindow = null;
  let animationsDisabled = readSetting(animationsKey) === "true";

  function readSetting(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function writeSetting(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Session-only fallback. */ }
  } 

  function setAccent(value) {
    const selected = accentButtons.find(button => button.dataset.accent === value) || accentButtons[0];
    document.documentElement.style.setProperty("--desktop-accent", selected.dataset.accent);
    paintCursors(selected.dataset.accent);
    writeSetting(accentKey, selected.dataset.accent);
    accentButtons.forEach(button => {
      const isSelected = button === selected;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-checked", String(isSelected));
      button.tabIndex = isSelected ? 0 : -1;
    });
  }

  // Old-school pixel cursors, drawn at 2x and handed to CSS as custom
  // properties. The hand ("select" cursor) is filled with the accent colour.
  const cursorArt = {
    arrow: {
      hotspot: [1, 1],
      rows: [
        "k...........",
        "kk..........",
        "kwk.........",
        "kwwk........",
        "kwwwk.......",
        "kwwwwk......",
        "kwwwwwk.....",
        "kwwwwwwk....",
        "kwwwwwwwk...",
        "kwwwwwwwwk..",
        "kwwwwwkkkkk.",
        "kwwkwwk.....",
        "kwk.kwwk....",
        "kk..kwwk....",
        "k....kwwk...",
        "......kk...."
      ]
    },
    hand: {
      hotspot: [11, 1],
      rows: [
        ".....kk.........",
        "....kwwk........",
        "....kwwk........",
        "....kwwk........",
        "....kwwkkk......",
        "....kwwkwwkkk...",
        "....kwwkwwkwwkk.",
        ".kk.kwwkwwkwwkwk",
        "kwwkkwwwwwwwwkwk",
        "kwwwkwwwwwwwwwwk",
        ".kwwwwwwwwwwwwwk",
        "..kwwwwwwwwwwwwk",
        "..kwwwwwwwwwwwk.",
        "...kwwwwwwwwwwk.",
        "....kwwwwwwwwk..",
        "....kkkkkkkkkk.."
      ]
    },
    // I-beam, shown over text that can be selected.
    text: {
      hotspot: [7, 16],
      rows: [
        "kkk.kkk",
        "kwwkwwk",
        "kkkwkkk",
        "..kwk..",
        "..kwk..",
        "..kwk..",
        "..kwk..",
        "..kwk..",
        "..kwk..",
        "..kwk..",
        "..kwk..",
        "..kwk..",
        "..kwk..",
        "kkkwkkk",
        "kwwkwwk",
        "kkk.kkk"
      ]
    },
    grab: {
      hotspot: [16, 16],
      rows: [
        ".......kk.......",
        "...kk.kwwkkk....",
        "..kwwkkwwkwwk...",
        "..kwwkkwwkwwkk..",
        "..kwwkkwwkwwkwk.",
        "...kwwkwwkwwkwwk",
        "...kwwwwwwwwkwwk",
        ".kk.kwwwwwwwwwwk",
        "kwwkkwwwwwwwwwwk",
        "kwwwkwwwwwwwwwwk",
        ".kwwwwwwwwwwwwk.",
        "..kwwwwwwwwwwwk.",
        "...kwwwwwwwwwwk.",
        "....kwwwwwwwwk..",
        ".....kwwwwwwwk..",
        ".....kkkkkkkkk.."
      ]
    },
    // Page-turn arrow, pointing right; the left one is its mirror image.
    next: {
      hotspot: [28, 12],
      rows: [
        "........k.......",
        "........kk......",
        "........kwk.....",
        "........kwwk....",
        "kkkkkkkkkwwwk...",
        "kwwwwwwwwwwwwk..",
        "kwwwwwwwwwwwwwk.",
        "kwwwwwwwwwwwwk..",
        "kkkkkkkkkwwwk...",
        "........kwwk....",
        "........kwk.....",
        "........kk......",
        "........k......."
      ]
    },
    grabbing: {
      hotspot: [16, 16],
      rows: [
        "................",
        "................",
        "................",
        "................",
        "...kk.kk.kk.....",
        "..kwwkwwkwwkkk..",
        "..kwwkwwkwwkwwk.",
        ".kkwwwwwwwwkwwk.",
        "kwwkwwwwwwwwwwk.",
        "kwwwwwwwwwwwwwk.",
        ".kwwwwwwwwwwwwk.",
        "..kwwwwwwwwwwwk.",
        "...kwwwwwwwwwk..",
        "....kwwwwwwwwk..",
        ".....kwwwwwwk...",
        ".....kkkkkkkk..."
      ]
    }
  };

  function cursorValue(art, fill, fallback) {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = art.rows[0].length * scale;
    canvas.height = art.rows.length * scale;
    const context = canvas.getContext("2d");

    art.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === ".") continue;
        context.fillStyle = row[x] === "k" ? "#141c2e" : fill;
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    });

    return `url("${canvas.toDataURL()}") ${art.hotspot[0]} ${art.hotspot[1]}, ${fallback}`;
  }

  function paintCursors(accent) {
    const style = document.documentElement.style;
    style.setProperty("--cursor-arrow", cursorValue(cursorArt.arrow, "#f1edda", "auto"));
    style.setProperty("--cursor-hand", cursorValue(cursorArt.hand, accent, "pointer"));
    style.setProperty("--cursor-text", cursorValue(cursorArt.text, "#f1edda", "text"));
    style.setProperty("--cursor-grab", cursorValue(cursorArt.grab, "#f1edda", "grab"));
    style.setProperty("--cursor-grabbing", cursorValue(cursorArt.grabbing, "#f1edda", "grabbing"));
    style.setProperty("--cursor-next", cursorValue(cursorArt.next, accent, "e-resize"));
    style.setProperty("--cursor-previous", cursorValue({
      hotspot: [3, 12],
      rows: cursorArt.next.rows.map(row => [...row].reverse().join(""))
    }, accent, "w-resize"));
  }

  const savedAccent = readSetting(accentKey);
  setAccent(accentButtons.some(button => button.dataset.accent === savedAccent) ? savedAccent : "#e6c878");
  accentButtons.forEach(button => {
    button.addEventListener("click", () => setAccent(button.dataset.accent));
  });

  document.querySelector(".accent-swatches").addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = accentButtons.indexOf(document.activeElement);
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const nextIndex = (currentIndex + step + accentButtons.length) % accentButtons.length;
    accentButtons[nextIndex].focus();
    accentButtons[nextIndex].click();
  });

  root.classList.toggle("is-mobile-mode", mobileBreakpoint.matches);
  root.classList.toggle("animations-disabled", animationsDisabled);
  animationsSetting.checked = animationsDisabled;

  function positionSettingsPopover() {
    if (settingsPopover.hidden) return;
    const anchor = settingsToggle.getBoundingClientRect();
    const width = settingsPopover.getBoundingClientRect().width;
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
    settingsPopover.style.left = `${left}px`;
    settingsPopover.style.top = `${anchor.bottom + 6}px`;
  }

  function setSettingsPopoverOpen(open) {
    settingsPopover.hidden = !open;
    settingsToggle.setAttribute("aria-expanded", String(open));
    if (open) {
      positionSettingsPopover();
      settingsPopover.classList.add("is-open");
    } else {
      settingsPopover.classList.remove("is-open");
    }
  }

  settingsToggle.addEventListener("click", () => {
    setSettingsPopoverOpen(settingsPopover.hidden);
  });
  settingsPopover.querySelector(".desktop-settings-popover__close").addEventListener("click", () => {
    setSettingsPopoverOpen(false);
    settingsToggle.focus();
  });
  document.addEventListener("pointerdown", event => {
    if (settingsPopover.hidden || settingsPopover.contains(event.target) || settingsToggle.contains(event.target)) return;
    setSettingsPopoverOpen(false);
  });
  window.addEventListener("resize", positionSettingsPopover, { passive: true });

  function setAnimationsDisabled(disabled) {
    animationsDisabled = disabled;
    root.classList.toggle("animations-disabled", disabled);
    animationsSetting.checked = disabled;
    writeSetting(animationsKey, String(disabled));
    window.dispatchEvent(new CustomEvent("portfolio-animations-change", {
      detail: { enabled: !disabled }
    }));
    if (disabled) {
      window.clearTimeout(appearanceTimer);
      root.classList.remove("is-theme-transitioning");
    }
  }

  animationsSetting.addEventListener("change", () => {
    setAnimationsDisabled(animationsSetting.checked);
  });

  // ---------------------------------------------------------------
  // Pixel lettering
  //
  // Window headings are set in a 5x7 bitmap face rather than a system
  // font. Each word becomes one small SVG, so headings still wrap, and
  // the heading keeps its text as an accessible label.
  // ---------------------------------------------------------------

  const pixelGlyphs = {
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
    ",": ["00000","00000","00000","00000","00110","00110","01100"],
    "'": ["00100","00100","01000","00000","00000","00000","00000"],
    "!": ["00100","00100","00100","00100","00100","00000","00100"],
    "?": ["01110","10001","00001","00010","00100","00000","00100"],
    "&": ["01100","10010","10100","01000","10101","10010","01101"],
    "+": ["00000","00100","00100","11111","00100","00100","00000"]
  };

  function pixelWord(word) {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNamespace, "svg");
    const path = document.createElementNS(svgNamespace, "path");
    let outline = "";
    let width = 0;

    for (const character of word) {
      const glyph = pixelGlyphs[character] || pixelGlyphs["?"];
      // Punctuation is trimmed to its inked columns so it sits tight to the word.
      const columns = [...glyph[0]].map((_, x) => x).filter(x => glyph.some(row => row[x] === "1"));
      const narrow = ".,':!".includes(character);
      const first = narrow ? columns[0] : 0;
      const last = narrow ? columns[columns.length - 1] : glyph[0].length - 1;

      glyph.forEach((row, y) => {
        for (let x = first; x <= last; x++) {
          if (row[x] === "1") outline += `M${width + x - first} ${y}h1v1h-1z`;
        }
      });
      width += last - first + 2;
    }

    width -= 1;
    path.setAttribute("d", outline);
    svg.appendChild(path);
    svg.setAttribute("viewBox", `0 0 ${width} 7`);
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("aria-hidden", "true");
    svg.style.width = `${width / 7}em`;
    return svg;
  }

  document.querySelectorAll(".window-content h1, .book-page__title").forEach(heading => {
    const text = heading.textContent.trim();
    heading.setAttribute("aria-label", text);
    heading.textContent = "";
    heading.classList.add("pixel-heading");
    text.toUpperCase().replace(/\u2019/g, "'").split(/\s+/).forEach(word => heading.appendChild(pixelWord(word)));
  });

  const clock = document.getElementById("system-clock");
  const updateClock = () => {
    const now = new Date();
    clock.dateTime = now.toISOString();
    const compact = window.matchMedia("(max-width: 380px)").matches;
    clock.textContent = new Intl.DateTimeFormat(undefined, {
      ...(compact ? { month: "numeric", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" }),
      hour: "numeric",
      minute: "2-digit"
    }).format(now);
  };
  updateClock();
  window.addEventListener("resize", updateClock, { passive: true });
  window.setInterval(updateClock, 15000);

  const appearanceToggle = document.getElementById("appearance-toggle");
  const appearanceKey = "portfolio-appearance";
  let appearanceTimer = 0;

  function setAppearance(value, animate = true) {
    const appearance = value === "light" ? "light" : "dark";
    const previousAppearance = document.documentElement.dataset.appearance || "dark";
    const motionDisabled = animationsDisabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isLight = appearance === "light";
    appearanceToggle.textContent = isLight ? "Dark mode" : "Light mode";

    if (!animate || appearance === previousAppearance) {
      writeSetting(appearanceKey, appearance);
      document.documentElement.dataset.appearance = appearance;
      return;
    }

    window.clearTimeout(appearanceTimer);
    if (motionDisabled) {
      root.classList.remove("is-theme-transitioning");
      document.documentElement.dataset.appearance = appearance;
      writeSetting(appearanceKey, appearance);
      window.dispatchEvent(new CustomEvent("portfolio-theme-transition", {
        detail: { appearance, duration: 0 }
      }));
      return;
    } else {
      root.classList.add("is-theme-transitioning");
    }
    document.documentElement.dataset.appearance = appearance;
    writeSetting(appearanceKey, appearance);
    window.dispatchEvent(new CustomEvent("portfolio-theme-transition", {
      detail: { appearance, duration: motionDisabled ? 0 : 1500 }
    }));
    if (!motionDisabled) {
      appearanceTimer = window.setTimeout(() => {
        root.classList.remove("is-theme-transitioning");
      }, 1500);
    }
  }

  setAppearance(readSetting(appearanceKey) || "dark", false);
  appearanceToggle.addEventListener("click", () => {
    setSettingsPopoverOpen(false);
    setAppearance(document.documentElement.dataset.appearance === "light" ? "dark" : "light");
  });

  // On a phone (no right-click) fullscreen is entered from the menu bar and
  // left with its own button; the stylesheet hides both on larger screens.
  const fullscreenToggle = document.getElementById("fullscreen-toggle");
  const fullscreenExit = document.getElementById("fullscreen-exit");

  function setFullscreenView(enabled) {
    if (enabled) setSettingsPopoverOpen(false);
    root.classList.toggle("is-fullscreen-view", enabled);
    fullscreenExit.hidden = !enabled;
  }

  fullscreenToggle.addEventListener("click", () => setFullscreenView(true));
  fullscreenExit.addEventListener("click", () => setFullscreenView(false));

  // ---------------------------------------------------------------
  // Right-click menu
  //
  // Replaces the browser's own menu everywhere but on links, which keep
  // theirs (open in new tab, copy link). Items that would do nothing
  // right now are left out rather than greyed. With text selected, the
  // menu offers only Copy.
  // ---------------------------------------------------------------

  const contextMenu = document.getElementById("desktop-context-menu");
  const contextItems = Object.fromEntries(
    [...contextMenu.querySelectorAll("[data-menu-action]")].map(item => [item.dataset.menuAction, item])
  );
  // Held from the moment the menu opens, in case clicking it clears the selection.
  let copyText = "";

  function visibleContextItems() {
    return [...contextMenu.querySelectorAll("[data-menu-action]")].filter(item => !item.hidden);
  }

  function openContextMenu(x, y) {
    const fullscreen = root.classList.contains("is-fullscreen-view");
    const hasOpenWindow = windows.some(item => !item.hidden);
    const mobile = root.classList.contains("is-mobile-mode");
    const selected = window.getSelection()?.toString() || "";
    copyText = selected.trim() ? selected : "";
    const copying = Boolean(copyText);
    contextItems.copy.hidden = !copying;
    contextItems.fullscreen.hidden = copying;
    contextItems.fullscreen.textContent = fullscreen ? "Exit fullscreen" : "Fullscreen";
    contextItems["close-all"].hidden = copying || fullscreen || !hasOpenWindow;
    contextItems.arrange.hidden = copying || fullscreen || mobile || !hasOpenWindow;
    contextItems.chill.hidden = copying || mobile;

    setSettingsPopoverOpen(false);
    contextMenu.hidden = false;
    // Open toward the pointer's lower right, flipping when it would run off screen.
    const { width, height } = contextMenu.getBoundingClientRect();
    const left = x + width > window.innerWidth - 4 ? x - width : x;
    const top = y + height > window.innerHeight - 4 ? y - height : y;
    contextMenu.style.left = `${Math.max(4, left)}px`;
    contextMenu.style.top = `${Math.max(4, top)}px`;
  }

  function closeContextMenu() {
    contextMenu.hidden = true;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard access (an insecure page, or permission refused): copy
      // through a hidden text box instead.
      const box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.cssText = "position: fixed; top: 0; left: 0; opacity: 0;";
      document.body.appendChild(box);
      box.select();
      document.execCommand("copy");
      box.remove();
    }
  }

  document.addEventListener("contextmenu", event => {
    if (event.target.closest("a[href]")) return;
    event.preventDefault();
    openContextMenu(event.clientX, event.clientY);
  });

  contextMenu.addEventListener("click", event => {
    const item = event.target.closest("[data-menu-action]");
    if (!item || item.getAttribute("aria-disabled") === "true") return;
    closeContextMenu();
    const action = item.dataset.menuAction;
    if (action === "copy") copyToClipboard(copyText);
    if (action === "fullscreen") setFullscreenView(!root.classList.contains("is-fullscreen-view"));
    if (action === "close-all") windows.forEach(closeWindow);
    if (action === "arrange") arrangeWindows();
  });

  document.addEventListener("pointerdown", event => {
    if (!contextMenu.hidden && !contextMenu.contains(event.target)) closeContextMenu();
  });
  window.addEventListener("resize", closeContextMenu, { passive: true });
  window.addEventListener("blur", closeContextMenu);

  contextMenu.addEventListener("keydown", event => {
    if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const items = visibleContextItems();
    const index = items.indexOf(document.activeElement);
    const step = event.key === "ArrowUp" ? -1 : 1;
    items[(index + step + items.length) % items.length].focus();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !contextMenu.hidden) {
      closeContextMenu();
      return;
    }
    if (event.key === "Escape" && !settingsPopover.hidden) {
      setSettingsPopoverOpen(false);
      settingsToggle.focus();
    }
    if (event.key === "Escape" && root.classList.contains("is-fullscreen-view")) {
      setFullscreenView(false);
    }
  });

  function syncDock() {
    const openIds = new Set(windows.filter(item => !item.hidden).map(item => item.dataset.window));
    dock.querySelectorAll("[data-target]").forEach(button => {
      const isOpen = openIds.has(button.dataset.target);
      button.classList.toggle("is-open", isOpen);
      button.classList.toggle("is-focused", focusedWindow?.dataset.window === button.dataset.target);
      button.setAttribute("aria-current", focusedWindow?.dataset.window === button.dataset.target ? "page" : "false");
    });
    root.classList.toggle("has-open-window", openIds.size > 0);
  }

  function focusWindow(windowElement) {
    const otherWindows = windows
      .filter(item => item !== windowElement && !item.hidden)
      .sort((first, second) => Number(first.style.zIndex) - Number(second.style.zIndex));
    otherWindows.forEach((item, index) => {
      item.style.zIndex = String(10 + index);
    });
    focusedWindow = windowElement;
    windowElement.style.zIndex = String(10 + otherWindows.length);
    windowElement.focus({ preventScroll: true });
    syncDock();
  }

  // ---------------------------------------------------------------
  // Genie effect
  //
  // macOS does not scale a window out of the dock; it pours it, like a
  // flexible sheet, in two overlapping movements:
  //
  //   1. Rise. The bottom edge stays pinched inside the dock icon while
  //      the top edge climbs to its resting place, so the sheet is drawn
  //      out long and thin between two S-curves that meet at the icon.
  //   2. Release. The bottom edge lets go of the icon and lifts to its
  //      resting place, widening as it goes, and the curves relax into
  //      the window's straight sides.
  //
  // HTML cannot be bent, so for the length of the animation the window
  // is replaced by a stack of thin horizontal slices of itself. Each
  // slice is projected onto the piece of funnel it currently occupies,
  // which makes the stack follow the curves smoothly.
  // ---------------------------------------------------------------

  const genieSlices = 14;
  const genieDuration = 240;

  function adjugate(m) {
    return [
      m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
      m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
      m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]
    ];
  }

  function multiply(a, b) {
    const out = new Array(9);
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        out[row * 3 + column] =
          a[row * 3] * b[column] + a[row * 3 + 1] * b[3 + column] + a[row * 3 + 2] * b[6 + column];
      }
    }
    return out;
  }

  function basisToPoints(p) {
    const m = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1];
    const a = adjugate(m);
    const v = [
      a[0] * p[6] + a[1] * p[7] + a[2],
      a[3] * p[6] + a[4] * p[7] + a[5],
      a[6] * p[6] + a[7] * p[7] + a[8]
    ];
    return multiply(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
  }

  // CSS matrix3d that carries one quad (four x,y corners) onto another.
  function quadToQuad(from, to) {
    const t = multiply(basisToPoints(to), adjugate(basisToPoints(from))).map((value, _, all) => value / all[8]);
    return `matrix3d(${t[0]}, ${t[3]}, 0, ${t[6]}, ${t[1]}, ${t[4]}, 0, ${t[7]}, 0, 0, 1, 0, ${t[2]}, ${t[5]}, 0, 1)`;
  }

  function easeOut(value) {
    const t = Math.max(0, Math.min(1, value));
    return 1 - (1 - t) ** 3;
  }

  function easeInOut(value) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }

  function playGenieOpen(windowElement) {
    openingAnimations.get(windowElement)?.cancel();
    if (animationsDisabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      windowElement.classList.remove("is-opening");
      return;
    }

    const icon = dock.querySelector(`[data-target="${windowElement.dataset.window}"] .dock-icon`);
    const bounds = windowElement.getBoundingClientRect();
    const iconBounds = icon.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
    // Everything below is in the window's own coordinates.
    const spoutY = Math.max(height + 1, iconBounds.top + iconBounds.height / 2 - bounds.top);
    const spoutLeft = iconBounds.left - bounds.left;
    const spoutRight = iconBounds.right - bounds.left;

    // Note where everything in the window sits. Whatever is scrolled out of
    // sight below or to the right (later project reels, later gallery
    // slides), and any hidden overlay (the book's other pages), is left out
    // of the slices altogether.
    const boxes = new Map();
    const unseen = [];
    for (const node of windowElement.querySelectorAll("*")) {
      if (unseen.some(parent => parent.contains(node))) continue;
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (
        box.top >= bounds.bottom || box.left >= bounds.right ||
        (style.visibility === "hidden" && style.position === "absolute")
      ) {
        unseen.push(node);
        continue;
      }
      boxes.set(node, {
        top: box.top - bounds.top,
        bottom: box.bottom - bounds.top,
        width: box.width,
        height: box.height,
        // Only boxes can be swapped for an empty one of the same size.
        solid: node instanceof HTMLElement && !["inline", "contents"].includes(style.display),
        scrollLeft: node.scrollLeft,
        scrollTop: node.scrollTop
      });
    }

    // A copy of the window for one slice. Building, laying out and painting
    // a whole window per slice is what makes the effect stutter, so a slice
    // only gets the parts that cross its strip: anything wholly above or
    // below it becomes an empty box of the same size, which keeps the rest
    // of the layout exactly where it was.
    const scrolled = [];
    const copyFor = (node, top, bottom) => {
      const copy = node.cloneNode(false);
      copy.removeAttribute("id");
      const box = boxes.get(node);
      if (box && box.solid && (box.bottom <= top || box.top >= bottom)) {
        copy.style.cssText += `; box-sizing: border-box; width: ${box.width}px; height: ${box.height}px; min-width: 0; min-height: 0; max-width: none; max-height: none; flex: none;`;
        return copy;
      }
      // Copies do not inherit scroll positions, so note any that are in use.
      if (box && (box.scrollLeft || box.scrollTop)) scrolled.push([copy, box.scrollLeft, box.scrollTop]);
      for (const child of node.childNodes) {
        if (child.nodeType !== Node.ELEMENT_NODE) copy.appendChild(child.cloneNode(false));
        else if (boxes.has(child)) copy.appendChild(copyFor(child, top, bottom));
      }
      return copy;
    };

    // The stand-in: slices of the window, stacked where it sits.
    const stage = document.createElement("div");
    stage.className = "genie-stage";
    stage.setAttribute("aria-hidden", "true");
    stage.style.cssText = `position: fixed; z-index: ${windowElement.style.zIndex || 10}; left: ${bounds.left}px; top: ${bounds.top}px; width: 0; height: 0; pointer-events: none;`;
    const slices = Array.from({ length: genieSlices }, (_, index) => {
      const top = height * index / genieSlices;
      const bottom = height * (index + 1) / genieSlices;
      // Each slice is a window-wide box one strip tall, showing its strip of
      // its copy. It runs two pixels under the next slice to hide the seam.
      const copy = copyFor(windowElement, top - 1, bottom + 3);
      copy.removeAttribute("data-window");
      copy.style.cssText = `position: absolute; inset: ${-top}px auto auto 0; width: ${width}px; height: ${height}px; min-width: 0; min-height: 0; max-width: none; margin: 0; box-shadow: none; transform: none;`;
      const slice = document.createElement("div");
      slice.style.cssText = `position: absolute; inset: 0 auto auto 0; width: ${width}px; height: ${bottom - top + 2}px; overflow: hidden; contain: strict; visibility: hidden; transform-origin: 0 0; will-change: transform;`;
      slice.appendChild(copy);
      stage.appendChild(slice);
      return { element: slice, top, bottom };
    });
    windowElement.parentNode.appendChild(stage);
    scrolled.forEach(([copy, left, top]) => {
      copy.scrollLeft = left;
      copy.scrollTop = top;
    });
    windowElement.classList.add("is-opening");
    // The real window stays invisible until the sheet has landed. Its usual
    // opacity transition is switched off so it cannot flash or fade around that.
    windowElement.style.transition = "none";
    windowElement.style.opacity = "0";

    // Laying out and painting the slices is the expensive part, and it lands
    // on the first frame they are drawn in, while the sheet is still a sliver
    // inside the icon. The clock counts at most 50ms per
    // frame, so a slow one holds the sheet still for a moment instead of
    // making it skip ahead to catch up.
    let frame = 0;
    let elapsed = 0;
    let lastTime = 0;
    const animation = {
      cancel() {
        cancelAnimationFrame(frame);
        stage.remove();
        windowElement.style.opacity = "";
        windowElement.classList.remove("is-opening");
        // Let the browser register the window as visible before its opacity
        // transition is restored, or it would fade in instead of appearing.
        void getComputedStyle(windowElement).opacity;
        windowElement.style.transition = "";
        if (openingAnimations.get(windowElement) === animation) openingAnimations.delete(windowElement);
      }
    };
    openingAnimations.set(windowElement, animation);

    function step(now) {
      if (lastTime) elapsed += Math.max(0, Math.min(50, now - lastTime));
      lastTime = now;
      const progress = elapsed / genieDuration;
      if (progress >= 1) {
        animation.cancel();
        return;
      }

      const rise = easeOut(progress / 0.6);
      const release = easeInOut((progress - 0.25) / 0.75);

      // Where the sheet's top and bottom edges are right now.
      const sheetTop = spoutY * (1 - rise);
      const sheetBottom = spoutY + (height - spoutY) * release;
      const bottomLeft = spoutLeft * (1 - release);
      const bottomRight = width + (spoutRight - width) * (1 - release);

      // Its sides: S-curves from the window's top corners to the bottom edge.
      const edges = y => {
        const pinch = 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, y / sheetBottom)));
        return [bottomLeft * pinch, width + (bottomRight - width) * pinch];
      };

      const stretch = (sheetBottom - sheetTop) / height;
      for (const slice of slices) {
        // Nothing has come out of the icon yet.
        if (stretch * height < 0.5) {
          slice.element.style.visibility = "hidden";
          continue;
        }
        const top = sheetTop + slice.top * stretch;
        const bottom = sheetTop + slice.bottom * stretch;
        const [topLeft, topRight] = edges(top);
        const [lowerLeft, lowerRight] = edges(bottom);
        const depth = slice.bottom - slice.top;
        slice.element.style.visibility = "";
        slice.element.style.transform = quadToQuad(
          [0, 0, width, 0, width, depth, 0, depth],
          [topLeft, top, topRight, top, lowerRight, bottom, lowerLeft, bottom]
        );
      }
      frame = requestAnimationFrame(step);
    }
    step(performance.now());
  }

  function addResizeHandles(windowElement) {
    ["n", "ne", "e", "se", "s", "sw", "w", "nw"].forEach(direction => {
      const handle = document.createElement("span");
      handle.className = `resize-handle resize-handle--${direction}`;
      handle.dataset.resize = direction;
      handle.setAttribute("aria-hidden", "true");
      windowElement.append(handle);
    });
  }

  function beginResize(windowElement, handle, event) {
    const direction = handle.dataset.resize;
    const bounds = windowElement.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = bounds.left;
    const startTop = bounds.top;
    const startWidth = bounds.width;
    const startHeight = bounds.height;
    const fixedRight = startLeft + startWidth;
    const fixedBottom = startTop + startHeight;
    const menuBottom = document.querySelector(".system-menubar").getBoundingClientRect().bottom;
    let pointerX = startX;
    let pointerY = startY;
    let frame = 0;

    windowElement.style.left = `${startLeft}px`;
    windowElement.style.top = `${startTop}px`;
    windowElement.style.width = `${startWidth}px`;
    windowElement.style.height = `${startHeight}px`;
    windowElement.style.transform = "translate3d(0, 0, 0)";
    windowElement.classList.add("is-dragged");
    windowElement.style.willChange = "left, top, width, height";
    root.classList.add("is-window-dragging");
    handle.setPointerCapture(event.pointerId);

    // Some windows need more room than others (the book must fit an entry).
    const style = getComputedStyle(windowElement);
    const minWidth = parseFloat(style.minWidth) || 220;
    const minHeight = parseFloat(style.minHeight) || 160;

    const applyResize = () => {
      const deltaX = pointerX - startX;
      const deltaY = pointerY - startY;
      const widthDelta = direction.includes("e") ? deltaX : direction.includes("w") ? -deltaX : 0;
      const heightDelta = direction.includes("s") ? deltaY : direction.includes("n") ? -deltaY : 0;
      const maxWidth = direction.includes("w") ? fixedRight : window.innerWidth - startLeft;
      const maxHeight = direction.includes("n") ? fixedBottom - menuBottom : window.innerHeight - startTop;
      const width = Math.max(minWidth, Math.min(maxWidth, startWidth + widthDelta));
      const height = Math.max(Math.min(minHeight, maxHeight), Math.min(maxHeight, startHeight + heightDelta));
      const left = direction.includes("w") ? fixedRight - width : startLeft;
      const top = direction.includes("n") ? Math.max(menuBottom, fixedBottom - height) : startTop;

      windowElement.style.left = `${left}px`;
      windowElement.style.top = `${top}px`;
      windowElement.style.width = `${width}px`;
      windowElement.style.height = `${height}px`;
      frame = 0;
    };

    const move = moveEvent => {
      pointerX = moveEvent.clientX;
      pointerY = moveEvent.clientY;
      if (!frame) frame = requestAnimationFrame(applyResize);
    };
    const stop = stopEvent => {
      pointerX = stopEvent.clientX;
      pointerY = stopEvent.clientY;
      if (frame) cancelAnimationFrame(frame);
      applyResize();
      windowElement.style.willChange = "";
      root.classList.remove("is-window-dragging");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function getWindowTitle(windowElement) {
    return windowElement.querySelector(".window-titlebar__title").textContent.trim();
  }

  function fitExpandedProject(windowElement) {
    const menuBottom = document.querySelector(".system-menubar").getBoundingClientRect().bottom;
    const dockTop = dock.getBoundingClientRect().top;
    const maxWidth = Math.max(0, window.innerWidth - 32);
    const availableHeight = Math.max(0, dockTop - menuBottom - 8);
    const height = Math.min(746, availableHeight, maxWidth * 16 / 9);

    windowElement.style.top = `${menuBottom + 8}px`;
    windowElement.style.left = "50%";
    windowElement.style.width = `${height * 9 / 16}px`;
    windowElement.style.height = `${height}px`;
    windowElement.style.transform = "translateX(-50%)";
  }

  function toggleExpanded(windowElement, button) {
    const title = getWindowTitle(windowElement);
    windowElement.getAnimations().forEach(animation => animation.cancel());
    openingAnimations.delete(windowElement);
    windowElement.classList.remove("is-opening");

    if (windowElement.classList.contains("is-expanded")) {
      windowElement.classList.remove("is-expanded");
      windowElement.style.left = windowElement.dataset.restoreLeft || "";
      windowElement.style.top = windowElement.dataset.restoreTop || "";
      windowElement.style.width = windowElement.dataset.restoreWidth || "";
      windowElement.style.height = windowElement.dataset.restoreHeight || "";
      windowElement.style.transform = windowElement.dataset.restoreTransform || "";
      delete windowElement.dataset.restoreLeft;
      delete windowElement.dataset.restoreTop;
      delete windowElement.dataset.restoreWidth;
      delete windowElement.dataset.restoreHeight;
      delete windowElement.dataset.restoreTransform;
      button.setAttribute("aria-label", `Expand ${title} window`);
      button.setAttribute("aria-pressed", "false");
      return;
    }

    windowElement.dataset.restoreLeft = windowElement.style.left;
    windowElement.dataset.restoreTop = windowElement.style.top;
    windowElement.dataset.restoreWidth = windowElement.style.width;
    windowElement.dataset.restoreHeight = windowElement.style.height;
    windowElement.dataset.restoreTransform = windowElement.style.transform;
    windowElement.style.left = "";
    windowElement.style.top = "";
    windowElement.style.width = "";
    windowElement.style.height = "";
    windowElement.style.transform = "";
    windowElement.classList.add("is-expanded");
    if (windowElement.classList.contains("projects-window")) {
      fitExpandedProject(windowElement);
    }
    button.setAttribute("aria-label", `Restore ${title} window size`);
    button.setAttribute("aria-pressed", "true");
  }

  function keepAboveDock(windowElement) {
    // A freshly opened window must sit wholly above the dock (and below the
    // menu bar). If its usual spot would overlap, it is pinned higher up,
    // and shortened only when the screen is too small to hold it otherwise.
    if (root.classList.contains("is-mobile-mode") || windowElement.classList.contains("is-expanded")) return;
    const limit = dock.getBoundingClientRect().top - 12;
    const ceiling = document.querySelector(".system-menubar").getBoundingClientRect().bottom + 8;
    const bounds = windowElement.getBoundingClientRect();
    if (bounds.bottom <= limit) return;

    const top = Math.max(ceiling, bounds.top - (bounds.bottom - limit));
    windowElement.style.left = `${bounds.left}px`;
    windowElement.style.top = `${top}px`;
    windowElement.style.transform = "translate3d(0, 0, 0)";
    windowElement.classList.add("is-dragged");
    if (top + bounds.height > limit) {
      windowElement.style.height = `${limit - top}px`;
      windowElement.dataset.fittedHeight = "true";
    }
  }

  const windowGap = 12;

  function desktopArea() {
    return {
      left: windowGap,
      top: document.querySelector(".system-menubar").getBoundingClientRect().bottom + 8,
      right: window.innerWidth - windowGap,
      bottom: dock.getBoundingClientRect().top - windowGap
    };
  }

  function moveWindow(windowElement, left, top) {
    windowElement.style.left = `${Math.round(left)}px`;
    windowElement.style.top = `${Math.round(top)}px`;
    windowElement.style.transform = "translate3d(0, 0, 0)";
    windowElement.classList.add("is-dragged");
  }

  function placeWindow(windowElement) {
    // A freshly opened window goes in the middle of the desktop if that is
    // free, or else in the free spot nearest to it. If the open windows
    // leave no room at all, it takes the spot that covers the least of them.
    if (root.classList.contains("is-mobile-mode") || windowElement.classList.contains("is-expanded")) return;
    const gap = windowGap;
    const area = desktopArea();
    const bounds = windowElement.getBoundingClientRect();
    const width = bounds.width;
    let height = bounds.height;
    // Shortened only when the screen is too small to hold it otherwise.
    if (height > area.bottom - area.top) {
      height = area.bottom - area.top;
      windowElement.style.height = `${height}px`;
      windowElement.dataset.fittedHeight = "true";
    }

    const others = windows
      .filter(item => item !== windowElement && !item.hidden)
      .map(item => item.getBoundingClientRect());
    const maxLeft = Math.max(area.left, area.right - width);
    const maxTop = Math.max(area.top, area.bottom - height);
    const homeLeft = Math.max(area.left, Math.min(maxLeft, (area.left + area.right - width) / 2));
    const homeTop = Math.max(area.top, Math.min(maxTop, (area.top + area.bottom - height) / 2));
    // Spots worth trying: the middle, the desktop's edges, and flush against or
    // level with each open window.
    const lefts = [homeLeft, area.left, maxLeft];
    const tops = [homeTop, area.top, maxTop];
    others.forEach(other => {
      lefts.push(other.right + gap, other.left - gap - width, other.left, other.right - width);
      tops.push(other.bottom + gap, other.top - gap - height, other.top, other.bottom - height);
    });

    let best = null;
    for (const candidateLeft of lefts) {
      for (const candidateTop of tops) {
        const left = Math.max(area.left, Math.min(maxLeft, candidateLeft));
        const top = Math.max(area.top, Math.min(maxTop, candidateTop));
        let covered = 0;
        for (const other of others) {
          const overlapX = Math.min(left + width, other.right + gap) - Math.max(left, other.left - gap);
          const overlapY = Math.min(top + height, other.bottom + gap) - Math.max(top, other.top - gap);
          if (overlapX > 0.5 && overlapY > 0.5) covered += overlapX * overlapY;
        }
        const distance = Math.hypot(left - homeLeft, top - homeTop);
        if (!best || covered < best.covered - 1 || (covered < best.covered + 1 && distance < best.distance)) {
          best = { left, top, covered, distance };
        }
      }
    }

    moveWindow(windowElement, best.left, best.top);
  }

  function arrangeWindows() {
    // Puts every open window back to its usual size and lays them out side
    // by side: Projects, then Achievements, then About above Contact. When
    // the screen is too narrow (or short) for that, the row is squeezed
    // evenly, so neighbours overlap by as little as possible.
    if (root.classList.contains("is-mobile-mode")) return;
    const open = windows.filter(item => !item.hidden && !item.classList.contains("is-closing"));
    if (!open.length) return;

    open.forEach(item => {
      if (item.classList.contains("is-expanded")) toggleExpanded(item, item.querySelector('[data-action="expand"]'));
      openingAnimations.get(item)?.cancel();
      openingAnimations.delete(item);
      item.classList.remove("is-opening");
      item.style.width = "";
      item.style.height = "";
      delete item.dataset.fittedHeight;
    });

    const area = desktopArea();
    const areaHeight = area.bottom - area.top;
    const sizes = new Map(open.map(item => {
      const bounds = item.getBoundingClientRect();
      // Shortened only when the screen is too small to hold it otherwise.
      if (bounds.height > areaHeight) {
        item.style.height = `${areaHeight}px`;
        item.dataset.fittedHeight = "true";
      }
      return [item, { width: bounds.width, height: Math.min(bounds.height, areaHeight) }];
    }));
    const columns = [["projects"], ["achievements"], ["about", "contact"]]
      .map(ids => ids.map(id => open.find(item => item.dataset.window === id)).filter(Boolean))
      .filter(column => column.length);
    const columnWidths = columns.map(column => Math.max(...column.map(item => sizes.get(item).width)));
    const spread = (lengths, room) => {
      // The step between neighbours: the usual gap, or less (even negative,
      // so they overlap) when that is the only way to fit.
      const total = lengths.reduce((sum, length) => sum + length, 0);
      const step = lengths.length > 1
        ? Math.min(windowGap, (room - total) / (lengths.length - 1))
        : 0;
      return { step, length: total + step * (lengths.length - 1) };
    };

    open.forEach(item => item.classList.add("is-arranging"));
    window.setTimeout(() => open.forEach(item => item.classList.remove("is-arranging")), 360);

    const row = spread(columnWidths, area.right - area.left);
    let left = Math.max(area.left, (area.left + area.right - row.length) / 2);
    columns.forEach((column, index) => {
      const heights = column.map(item => sizes.get(item).height);
      const stack = spread(heights, areaHeight);
      let top = Math.max(area.top, (area.top + area.bottom - stack.length) / 2);
      column.forEach((item, slot) => {
        moveWindow(item, left, top);
        top += heights[slot] + stack.step;
      });
      left += columnWidths[index] + row.step;
    });
  }


  function openWindow(id) {
    const windowElement = windows.find(item => item.dataset.window === id);
    if (!windowElement) return;

    if (root.classList.contains("is-mobile-mode")) {
      windows.forEach(item => {
        if (item !== windowElement) {
          item.hidden = true;
          item.classList.remove("is-opening");
        }
      });
    }

    if (windowElement.hidden) {
      windowElement.hidden = false;
      placeWindow(windowElement);
      // Lay the book out before the window is copied for its opening.
      if (windowElement.contains(book)) paginateBook();
      // Bring it to the front first, so the sheet pours over any open windows.
      focusWindow(windowElement);
      playGenieOpen(windowElement);
      return;
    }
    focusWindow(windowElement);
  }

  function resetWindowAfterClose(windowElement) {
    openingAnimations.get(windowElement)?.cancel();
    openingAnimations.delete(windowElement);
    windowElement.hidden = true;
    windowElement.classList.remove("is-closing", "is-opening", "is-expanded", "is-dragged");
    windowElement.style.left = "";
    windowElement.style.top = "";
    windowElement.style.transform = "";
    windowElement.style.willChange = "";
    if (windowElement.dataset.fittedHeight) {
      windowElement.style.height = "";
      delete windowElement.dataset.fittedHeight;
    }
    const expandButton = windowElement.querySelector('[data-action="expand"]');
    expandButton.setAttribute("aria-label", `Expand ${getWindowTitle(windowElement)} window`);
    expandButton.setAttribute("aria-pressed", "false");
    delete windowElement.dataset.restoreLeft;
    delete windowElement.dataset.restoreTop;
    delete windowElement.dataset.restoreWidth;
    delete windowElement.dataset.restoreHeight;
    delete windowElement.dataset.restoreTransform;
    if (focusedWindow === windowElement) {
      focusedWindow = windows
        .filter(item => item !== windowElement && !item.hidden)
        .sort((first, second) => Number(second.style.zIndex) - Number(first.style.zIndex))[0] || null;
    }
    syncDock();
  }

  function closeWindow(windowElement) {
    if (windowElement.hidden) return;
    resetWindowAfterClose(windowElement);
  }

  dock.addEventListener("click", event => {
    const button = event.target.closest("[data-target]");
    if (!button) return;
    // Launch bounce, as an app icon does when it opens.
    button.classList.remove("is-launching");
    void button.offsetWidth;
    button.classList.add("is-launching");
    openWindow(button.dataset.target);
  });
  dock.addEventListener("animationend", event => {
    event.target.closest(".dock-item")?.classList.remove("is-launching");
  });

  // Pixel-art app icons: a 16x16 glyph stamped onto a rounded colour tile.
  // tile = [upper, lower, bottom edge, top highlight]
  const dockIcons = {
    about: {
      tile: ["#e08a6a", "#c96f55", "#9a4f3f", "#f4b79a"],
      colors: { k: "#141c2e", w: "#f1edda", s: "#a8d8e8", d: "#141c2e", g: "#8a8f8a" },
      rows: [
        "................",
        "................",
        "...kkkkkkkkkk...",
        "...kwwwwwwwwk...",
        "...kwsssssswk...",
        "...kwsdssdswk...",
        "...kwsssssswk...",
        "...kwsdssdswk...",
        "...kwssddsswk...",
        "...kwsssssswk...",
        "...kwwwwwwwwk...",
        "...kwwwwggwwk...",
        "...kkkkkkkkkk...",
        "....kwwwwwwk....",
        "....kkkkkkkk....",
        "................"
      ]
    },
    projects: {
      tile: ["#6a5cb0", "#554795", "#3b2f70", "#9a8fd8"],
      colors: { k: "#141c2e", w: "#f1edda" },
      rows: [
        "................",
        "................",
        "................",
        "..kkkkkkkkkkkk..",
        ".kwwkwwkkwwkwwk.",
        ".kkkkkkkkkkkkkk.",
        ".kkkkkwwkkkkkkk.",
        ".kkkkkwwwkkkkkk.",
        ".kkkkkwwwwkkkkk.",
        ".kkkkkwwwkkkkkk.",
        ".kkkkkwwkkkkkkk.",
        ".kkkkkkkkkkkkkk.",
        ".kwwkwwkkwwkwwk.",
        "..kkkkkkkkkkkk..",
        "................",
        "................"
      ]
    },
    achievements: {
      tile: ["#34508f", "#283f78", "#1b2c58", "#6f8ccf"],
      colors: { k: "#141c2e", b: "#8f4a34", s: "#5a2c1e", p: "#f2e6c9", y: "#f0c552", h: "#fff3b8" },
      rows: [
        "................",
        "................",
        "..kkkkkkkkkkkk..",
        "..ksbbbbbbbbbk..",
        "..ksbbbbbbbbbk..",
        "..ksbbyyyyybbk..",
        "..ksbyyhyyyybk..",
        "..ksbbyyyyybbk..",
        "..ksbbbyyybbbk..",
        "..ksbbbbybbbbk..",
        "..ksbbbyyybbbk..",
        "..ksbbbbbbbbbk..",
        "..kspppppppppk..",
        "..kkkkkkkkkkkk..",
        "................",
        "................"
      ]
    },
    contact: {
      tile: ["#5fb56f", "#469a58", "#2f7440", "#9be0a0"],
      colors: { p: "#f4f0dc", d: "#2f7440" },
      rows: [
        "................",
        "................",
        "...ppp..........",
        "..ppppp.........",
        "..pppppd........",
        "..ppppdd........",
        "...pppd.........",
        "...ppppd........",
        "....ppppd..p....",
        ".....ppppdppp...",
        "......pppppppp..",
        ".......pppppppd.",
        ".........ppppdd.",
        "..........dddd..",
        "................",
        "................"
      ]
    }
  };

  dock.querySelectorAll("canvas[data-icon]").forEach(canvas => {
    const icon = dockIcons[canvas.dataset.icon];
    const context = canvas.getContext("2d");

    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        // Clip the tile's corners so it reads as a rounded app icon.
        const edgeX = Math.min(x, 15 - x);
        const edgeY = Math.min(y, 15 - y);
        if (edgeX + edgeY < 2) continue;

        const glyph = icon.colors[icon.rows[y][x]];
        context.fillStyle = glyph || icon.tile[y === 0 ? 3 : y === 15 ? 2 : y < 8 ? 0 : 1];
        context.fillRect(x, y, 1, 1);
      }
    }
  });

  // Magnification: icons grow the closer the pointer is to them.
  //
  // Sizes are eased toward their targets once per frame and applied purely
  // as transforms, measured against the icons' resting positions, so moving
  // across the dock never triggers layout or feeds back into itself.
  const dockItems = [...dock.querySelectorAll(".dock-item")];
  const dockCanvases = dockItems.map(item => item.querySelector(".dock-icon"));
  const dockScales = dockItems.map(() => 1);
  const dockReach = 130;
  let dockMetrics = null;
  let dockPointerX = null;
  let dockFrame = 0;

  function measureDock() {
    const size = dockItems[0].offsetWidth;
    dockMetrics = {
      left: dock.getBoundingClientRect().left + dockItems[0].offsetLeft,
      size,
      pitch: size + (parseFloat(getComputedStyle(dock).columnGap) || 0)
    };
  }

  function clearDockStyles() {
    dockScales.fill(1);
    dock.style.removeProperty("--dock-grow");
    dockItems.forEach((item, index) => {
      item.style.removeProperty("transform");
      item.style.removeProperty("--dock-lift");
      dockCanvases[index].style.removeProperty("transform");
    });
  }

  function tickDock() {
    dockFrame = 0;
    const { left, size, pitch } = dockMetrics;
    let settling = false;
    let total = 0;

    dockItems.forEach((item, index) => {
      let target = 1;
      if (dockPointerX !== null) {
        const distance = Math.abs(dockPointerX - (left + index * pitch + size / 2));
        const pull = distance < dockReach ? Math.cos(distance / dockReach * Math.PI / 2) : 0;
        target = 1 + pull * pull * 0.6;
      }
      const gap = target - dockScales[index];
      if (Math.abs(gap) < 0.003) dockScales[index] = target;
      else {
        dockScales[index] += gap * 0.28;
        settling = true;
      }
      total += dockScales[index] * size;
    });

    if (!settling && dockPointerX === null) {
      clearDockStyles();
      return;
    }

    // Lay the swollen icons out from the centre and shift each into place.
    const grow = (total - dockItems.length * size) / 2;
    let edge = -grow;
    dockItems.forEach((item, index) => {
      const width = dockScales[index] * size;
      const shift = edge + width / 2 - (index * pitch + size / 2);
      item.style.transform = `translate3d(${shift.toFixed(2)}px, 0, 0)`;
      item.style.setProperty("--dock-lift", `${(width - size).toFixed(1)}px`);
      dockCanvases[index].style.transform = `scale(${dockScales[index].toFixed(3)})`;
      edge += width + pitch - size;
    });
    dock.style.setProperty("--dock-grow", `${grow.toFixed(2)}px`);

    if (settling) dockFrame = requestAnimationFrame(tickDock);
  }

  function relaxDock() {
    dockPointerX = null;
    if (dockMetrics && !dockFrame) dockFrame = requestAnimationFrame(tickDock);
  }

  dock.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse" || animationsDisabled || root.classList.contains("is-mobile-mode")) {
      dockPointerX = null;
      cancelAnimationFrame(dockFrame);
      dockFrame = 0;
      clearDockStyles();
      return;
    }
    if (!dockMetrics) measureDock();
    dockPointerX = event.clientX;
    if (!dockFrame) dockFrame = requestAnimationFrame(tickDock);
  }, { passive: true });
  dock.addEventListener("pointerleave", relaxDock);
  window.addEventListener("resize", () => {
    dockMetrics = null;
  }, { passive: true });

  // ---------------------------------------------------------------
  // Achievements book: two pages to a spread, click a page to turn it.
  // On a phone only one page of the spread shows, and turning moves a
  // single page at a time.
  //
  // The pages never scroll. Instead the chapters are laid out afresh
  // whenever the book changes size: each chapter starts a new page, and
  // entries that do not fit run on to the next one.
  // ---------------------------------------------------------------

  const book = document.querySelector("[data-book]");
  const bookLeaves = book.querySelector(".book-leaves");
  const bookTurns = [...book.querySelectorAll("[data-book-turn]")];
  // The chapters as written in the page, before being split into pages.
  const bookChapters = [...book.querySelectorAll(".book-spread .book-page")].map(page => ({
    label: page.getAttribute("aria-label"),
    eyebrow: page.querySelector(".eyebrow").textContent.trim(),
    title: page.querySelector(".book-page__title"),
    entries: [...page.querySelectorAll(".book-entries > li")]
  }));
  let bookSpreads = [...book.querySelectorAll(".book-spread")];
  let bookPageCount = bookSpreads.length * 2;
  let bookIndex = 0;
  // Which page of the current spread a phone is showing: 0 left, 1 right.
  let bookSide = 0;
  let bookTurning = false;
  let bookLaidOutSize = "";
  const BOOK_TURN_TIME = 560;
  const BOOK_STRIPS = 10;

  function bookPage(chapter, continued) {
    const page = document.createElement("article");
    page.className = "book-page";
    page.setAttribute("aria-label", continued ? `${chapter.label} (continued)` : chapter.label);
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = continued ? `${chapter.eyebrow} \u00b7 ${chapter.label.toUpperCase()} CONT.` : chapter.eyebrow;
    const entries = document.createElement("ul");
    entries.className = "book-entries";
    const number = document.createElement("span");
    number.className = "book-page__number";
    number.setAttribute("aria-hidden", "true");
    // Numbered once all the pages are known; held open meanwhile, for measuring.
    number.textContent = "00";
    page.append(eyebrow);
    if (!continued) page.append(chapter.title.cloneNode(true));
    page.append(entries, number);
    return page;
  }

  function paginateBook() {
    if (bookTurning) return;
    const bounds = bookLeaves.getBoundingClientRect();
    const size = `${Math.round(bounds.width)}x${Math.round(bounds.height)}:${mobileBreakpoint.matches}`;
    if (!bounds.width || !bounds.height || size === bookLaidOutSize) return;
    bookLaidOutSize = size;

    // Keep the reader on the same entry after the pages are redrawn.
    const shownPage = bookSpreads[bookIndex]?.querySelectorAll(".book-page")[bookSide];
    const shownEntry = shownPage?.querySelector(".book-entries > li");

    // Pages are filled inside an invisible spread of the real size, each on
    // the side it will be shown (a phone shows every page on the left).
    const measure = document.createElement("div");
    measure.className = "book-spread is-current book-measure";
    measure.setAttribute("aria-hidden", "true");
    bookLeaves.appendChild(measure);
    const side = book.dataset.side;
    book.dataset.side = "left";

    const pages = [];
    const mount = page => {
      const right = !mobileBreakpoint.matches && pages.length % 2 === 1;
      page.classList.add(right ? "book-page--right" : "book-page--left");
      measure.replaceChildren(...(right ? [document.createElement("div"), page] : [page]));
    };
    bookChapters.forEach(chapter => {
      let page = bookPage(chapter, false);
      mount(page);
      chapter.entries.forEach(entry => {
        const list = page.querySelector(".book-entries");
        list.appendChild(entry);
        // An entry that does not fit moves to a fresh page (unless it is the
        // page's only one: there is nowhere better for it).
        if (page.scrollHeight > page.clientHeight + 1 && list.children.length > 1) {
          pages.push({ chapter, page });
          page = bookPage(chapter, true);
          mount(page);
          page.querySelector(".book-entries").appendChild(entry);
        }
      });
      pages.push({ chapter, page });
    });
    measure.remove();
    book.dataset.side = side;

    bookSpreads.forEach(spread => spread.remove());
    bookSpreads = [];
    for (let index = 0; index < pages.length; index += 2) {
      const spread = document.createElement("div");
      spread.className = "book-spread";
      const right = pages[index + 1]?.page || document.createElement("article");
      if (!pages[index + 1]) right.setAttribute("aria-hidden", "true");
      right.className = "book-page book-page--right";
      pages[index].page.className = "book-page book-page--left";
      spread.append(pages[index].page, right);
      bookLeaves.insertBefore(spread, bookTurns[0]);
      bookSpreads.push(spread);
    }
    pages.forEach(({ page }, index) => {
      page.querySelector(".book-page__number").textContent = index + 1;
    });
    bookPageCount = pages.length;

    const page = Math.max(0, pages.findIndex(item => item.page.contains(shownEntry)));
    bookIndex = Math.floor(page / 2);
    bookSide = mobileBreakpoint.matches ? page % 2 : 0;
    syncBook();
  }

  // The page edges either side of the spread: thicker the more sheets
  // have been read (left) or are still to come (right).
  function setBookStack(side, sheets) {
    book.style.setProperty(`--stack-${side}`, `${Math.min(4, Math.max(0, sheets)) * 2}px`);
  }

  function syncBook() {
    const single = mobileBreakpoint.matches;
    const page = bookIndex * 2 + bookSide;
    bookSpreads.forEach((spread, index) => spread.classList.toggle("is-current", index === bookIndex));
    book.dataset.side = bookSide ? "right" : "left";
    setBookStack("left", bookIndex);
    setBookStack("right", bookSpreads.length - 1 - bookIndex);
    bookTurns.forEach(button => {
      const step = Number(button.dataset.bookTurn);
      button.disabled = single
        ? page + step < 0 || page + step >= bookPageCount
        : bookIndex + step < 0 || bookIndex + step >= bookSpreads.length;
    });
  }

  function turnBook(step) {
    if (mobileBreakpoint.matches) {
      const page = bookIndex * 2 + bookSide + step;
      if (page < 0 || page >= bookPageCount) return;
      bookIndex = Math.floor(page / 2);
      bookSide = page % 2;
      syncBook();
      return;
    }

    const target = bookIndex + step;
    if (bookTurning || target < 0 || target >= bookSpreads.length) return;
    const from = bookSpreads[bookIndex];
    const to = bookSpreads[target];
    bookIndex = target;

    // A phone picking the book up later starts on the spread's first page.
    bookSide = 0;

    if (animationsDisabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      syncBook();
      return;
    }

    // One sheet of paper turns over the gutter. Its front is the right-hand
    // page of the earlier spread and its back the left-hand page of the later
    // one; turning forward lays it down to the left, turning back lifts it.
    const earlier = step > 0 ? from : to;
    const later = step > 0 ? to : from;
    const frontPage = earlier.querySelector(".book-page--right");
    const backPage = later.querySelector(".book-page--left");
    const width = frontPage.offsetWidth;
    const height = frontPage.offsetHeight;

    // The sheet bends, so it is cut into upright strips hinged edge to edge,
    // each showing its slice of both pages. The outer edge is the one being
    // pulled, so it leads and the strips nearer the spine follow it over.
    const stripWidth = width / BOOK_STRIPS;
    const leaf = document.createElement("div");
    leaf.className = "book-leaf";
    leaf.setAttribute("aria-hidden", "true");
    const face = (page, offset, side) => {
      const element = document.createElement("div");
      element.className = `book-leaf__face book-leaf__face--${side}`;
      const copy = page.cloneNode(true);
      copy.style.cssText = `width: ${width}px; height: ${height}px; left: ${-offset}px;`;
      const shade = document.createElement("div");
      shade.className = "book-leaf__shade";
      element.append(copy, shade);
      return { element, shade };
    };
    const strips = Array.from({ length: BOOK_STRIPS }, (_, index) => {
      const element = document.createElement("div");
      element.className = "book-leaf__strip";
      // A pixel of overlap keeps hairline gaps from opening between strips.
      element.style.width = `${stripWidth + 1}px`;
      const front = face(frontPage, index * stripWidth, "front");
      const back = face(backPage, width - (index + 1) * stripWidth, "back");
      element.append(front.element, back.element);
      leaf.appendChild(element);
      return { element, front: front.shade, back: back.shade };
    });
    // Shadows the sheet casts on the pages beneath it, either side of the spine.
    const shadows = ["right", "left"].map(side => {
      const element = document.createElement("div");
      element.className = `book-turn-shadow book-turn-shadow--${side}`;
      return element;
    });

    bookTurning = true;
    book.classList.add("is-turning");
    earlier.classList.add("is-under-left");
    later.classList.add("is-under-right");
    bookLeaves.append(...shadows, leaf);

    // The sheet leaves the pile on one side as it lifts, and joins the pile
    // on the other side as it lands; the edges change at those moments, so
    // the book never shifts while nothing is touching it.
    const liftSide = step > 0 ? "right" : "left";
    const landSide = step > 0 ? "left" : "right";
    const landSheets = step > 0 ? bookIndex : bookSpreads.length - 1 - bookIndex;
    let lifted = false;
    let landed = false;

    const lag = 0.3;
    const ease = t => t * t * (3 - 2 * t);
    // Painting the page copies makes the first frame slow. The clock counts
    // at most 33ms per frame, so a slow one holds the sheet nearly still for
    // a moment instead of making it jump ahead.
    let elapsed = 0;
    let lastTime = 0;
    const frame = now => {
      if (lastTime) elapsed += Math.max(0, Math.min(33, now - lastTime));
      lastTime = now;
      const time = Math.min(1, elapsed / BOOK_TURN_TIME);
      let x = 0;
      let z = 0;
      strips.forEach((strip, index) => {
        const lead = (BOOK_STRIPS - 1 - index) / (BOOK_STRIPS - 1) * lag;
        const progress = ease(Math.max(0, Math.min(1, (time - lead) / (1 - lag))));
        const angle = Math.PI * (step > 0 ? progress : 1 - progress);
        strip.element.style.transform =
          `translate3d(${x.toFixed(2)}px, 0, ${(z + 0.5).toFixed(2)}px) rotateY(${(-angle * 180 / Math.PI).toFixed(2)}deg)`;
        // Light falls from in front, so each strip darkens as it tips away.
        strip.front.style.opacity = (0.32 * (1 - Math.cos(angle))).toFixed(3);
        strip.back.style.opacity = (0.32 * (1 + Math.cos(angle))).toFixed(3);
        x += stripWidth * Math.cos(angle);
        z += stripWidth * Math.sin(angle);
      });
      // `x` is now where the sheet's outer edge is, across the spine.
      const reach = Math.max(-1, Math.min(1, x / width));
      const travelled = step > 0 ? 1 - reach : 1 + reach;
      if (!lifted && travelled > 0.04) {
        lifted = true;
        setBookStack(liftSide, step > 0 ? bookSpreads.length - 1 - bookIndex : bookIndex);
      }
      if (!landed && travelled > 1.96) {
        landed = true;
        setBookStack(landSide, landSheets);
      }
      shadows[0].style.transform = `scaleX(${Math.max(0, reach).toFixed(4)})`;
      shadows[0].style.opacity = reach > 0 ? (0.55 * (1 - reach)).toFixed(3) : "0";
      shadows[1].style.transform = `scaleX(${Math.max(0, -reach).toFixed(4)})`;
      shadows[1].style.opacity = reach < 0 ? (0.55 * (1 + reach)).toFixed(3) : "0";
      if (time < 1) {
        requestAnimationFrame(frame);
        return;
      }
      leaf.remove();
      shadows.forEach(shadow => shadow.remove());
      book.classList.remove("is-turning");
      earlier.classList.remove("is-under-left");
      later.classList.remove("is-under-right");
      bookTurning = false;
      syncBook();
      // The book may have changed size while the page was turning.
      paginateBook();
    };
    frame(performance.now());
  }

  book.addEventListener("click", event => {
    const button = event.target.closest("[data-book-turn]");
    if (button) turnBook(Number(button.dataset.bookTurn));
  });
  book.closest(".portfolio-window").addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") turnBook(-1);
    if (event.key === "ArrowRight") turnBook(1);
  });
  mobileBreakpoint.addEventListener("change", syncBook);
  new ResizeObserver(paginateBook).observe(bookLeaves);
  // Laying the book out takes a moment, so it is done ahead of time while
  // the page is idle (in an invisible, unplaced window of the usual size),
  // instead of when the window opens and its opening animation needs the time.
  const bookWindow = book.closest(".portfolio-window");
  (window.requestIdleCallback || window.setTimeout)(() => {
    if (!bookWindow.hidden) return;
    bookWindow.style.visibility = "hidden";
    bookWindow.hidden = false;
    paginateBook();
    bookWindow.hidden = true;
    bookWindow.style.visibility = "";
  });
  syncBook();

  // ---------------------------------------------------------------
  // Projects: a feed of reels, each a carousel post as on Instagram.
  // ---------------------------------------------------------------

  // Line icons, drawn on a 24-unit grid; brand marks are solid shapes.
  const reelIcons = {
    github: { solid: true, d: "M12 .5A11.5 11.5 0 0 0 8.4 22.9c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" },
    devpost: { solid: true, d: "M6.2 1.5h11.6L23.6 12l-5.8 10.5H6.2L.4 12zM8 6.5v11h3.6c3.3 0 5.4-2.1 5.4-5.5s-2.1-5.5-5.4-5.5zm2.4 2.2h1.1c1.9 0 3.1 1.2 3.1 3.3s-1.2 3.3-3.1 3.3h-1.1z" },
    youtube: { solid: true, d: "M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1z" },
    base44: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM10 7l-3.5 6H11M9.5 10v7M16.5 7 13 13h4.5M16 10v7",
    menu: "M4 6h16M4 12h12M4 18h8",
    "chevron-left": "M15 5l-7 7 7 7",
    "chevron-right": "M9 5l7 7-7 7"
  };

  document.querySelectorAll(".reel-icon[data-icon]").forEach(slot => {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNamespace, "svg");
    const path = document.createElementNS(svgNamespace, "path");
    const icon = reelIcons[slot.dataset.icon];
    path.setAttribute("d", icon.d || icon);
    path.setAttribute("fill-rule", "evenodd");
    svg.appendChild(path);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", icon.solid ? "reel-icon reel-icon--solid" : "reel-icon");
    svg.setAttribute("aria-hidden", "true");
    slot.replaceWith(svg);
  });

  const projectsWindow = document.querySelector(".projects-window");
  projectsWindow.addEventListener("click", event => {
    const scrollBehavior = animationsDisabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const step = event.target.closest("[data-gallery-step]");
    if (step) {
      const gallery = step.closest(".reel-stage").querySelector(".project-gallery");
      gallery.scrollBy({ left: Number(step.dataset.galleryStep) * gallery.clientWidth, behavior: scrollBehavior });
      return;
    }
    // A dot jumps straight to its slide.
    const dot = event.target.closest("[data-slide]");
    if (dot) {
      const gallery = dot.closest(".reel-stage").querySelector(".project-gallery");
      gallery.scrollTo({ left: Number(dot.dataset.slide) * gallery.clientWidth, behavior: scrollBehavior });
      return;
    }
    // The corner button opens the description; a click anywhere else in the
    // reel (but the sheet itself) closes it.
    const sheetButton = event.target.closest("[data-reel-sheet]");
    if (sheetButton) {
      setReelSheet(sheetButton, sheetButton.getAttribute("aria-expanded") !== "true");
      return;
    }
    // The handle on its own (a click, or Enter) switches between half and full.
    const sizeButton = event.target.closest("[data-reel-sheet-size]");
    if (sizeButton) {
      const sheet = sizeButton.closest(".reel-sheet");
      setReelSheetFull(sheet, !sheet.classList.contains("is-full"));
      return;
    }
    if (!event.target.closest(".reel-sheet")) closeReelSheets();
  });

  function setReelSheet(button, open) {
    const sheet = document.getElementById(button.getAttribute("aria-controls"));
    sheet.classList.toggle("is-open", open);
    sheet.inert = !open;
    // It always opens at half height.
    if (!open) setReelSheetFull(sheet, false);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Hide description" : "Show description");
  }

  function setReelSheetFull(sheet, full) {
    sheet.classList.toggle("is-full", full);
    sheet.querySelector("[data-reel-sheet-size]").setAttribute("aria-label", full ? "Shrink description" : "Expand description");
  }

  // Dragging the top of the sheet resizes it with the pointer. On release it
  // settles at whichever is nearest: the whole reel, half of it, or put away.
  projectsWindow.addEventListener("pointerdown", event => {
    const grip = event.target.closest(".reel-sheet__grip");
    if (!grip || event.button !== 0) return;
    // Keep a drag from selecting the text it passes over.
    event.preventDefault();
    const sheet = grip.closest(".reel-sheet");
    const reelHeight = sheet.closest(".project-reel").clientHeight;
    const startY = event.clientY;
    const startHeight = sheet.getBoundingClientRect().height;
    let dragging = false;

    const move = moveEvent => {
      const travel = startY - moveEvent.clientY;
      if (!dragging && Math.abs(travel) < 4) return;
      dragging = true;
      sheet.classList.add("is-dragging");
      sheet.style.height = `${Math.max(0, Math.min(reelHeight, startHeight + travel))}px`;
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      if (!dragging) return;
      // The click that ends a drag is not a click on whatever is under it.
      const swallow = clickEvent => clickEvent.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }));
      const share = sheet.getBoundingClientRect().height / reelHeight;
      // Let the sheet animate from where it was dropped to where it settles.
      sheet.classList.remove("is-dragging");
      void sheet.offsetHeight;
      sheet.style.height = "";
      if (share < 0.3) setReelSheet(sheet.closest(".project-reel").querySelector("[data-reel-sheet]"), false);
      else setReelSheetFull(sheet, share > 0.75);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  });

  function closeReelSheets() {
    projectsWindow.querySelectorAll('[data-reel-sheet][aria-expanded="true"]').forEach(button => setReelSheet(button, false));
  }

  projectsWindow.addEventListener("keydown", event => {
    if (event.key === "Escape") closeReelSheets();
  });
  // Moving on to another reel puts the description away.
  projectsWindow.querySelector(".project-feed").addEventListener("scroll", closeReelSheets, { passive: true });

  // Each reel's counter, dots and arrows follow its slides.
  projectsWindow.querySelectorAll(".project-reel").forEach(reel => {
    const gallery = reel.querySelector(".project-gallery");
    const slideCount = gallery.children.length;
    const counter = reel.querySelector(".reel-counter");
    const dots = [...reel.querySelectorAll(".reel-dots [data-slide]")];
    const [previous, next] = reel.querySelectorAll("[data-gallery-step]");
    let shown = -1;
    const syncSlides = () => {
      const index = Math.round(gallery.scrollLeft / Math.max(1, gallery.clientWidth));
      if (index === shown) return;
      shown = index;
      counter.textContent = `${index + 1}/${slideCount}`;
      dots.forEach((dot, dotIndex) => dot.setAttribute("aria-current", String(dotIndex === index)));
      previous.hidden = index === 0;
      next.hidden = index === slideCount - 1;
    };
    gallery.addEventListener("scroll", syncSlides, { passive: true });
    syncSlides();
  });

  windows.forEach(windowElement => {
    windowElement.tabIndex = -1;
    addResizeHandles(windowElement);
    windowElement.addEventListener("click", event => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "close") closeWindow(windowElement);
      if (action === "expand") {
        toggleExpanded(windowElement, event.target.closest("[data-action]"));
      }
    });

    // Double-clicking the title bar puts a resized window back to the size it
    // opens at (set per window in the stylesheet).
    windowElement.addEventListener("dblclick", event => {
      // The top edge of the title bar is covered by the thin resize strips,
      // so a double-click there counts as well.
      const onTop = event.target.closest(".window-titlebar") || (event.target.dataset.resize || "").includes("n");
      if (!onTop || event.target.closest("button") || root.classList.contains("is-mobile-mode")) return;
      // An expanded window is put back first, then sized.
      if (windowElement.classList.contains("is-expanded")) {
        windowElement.querySelector('[data-action="expand"]').click();
      }
      window.getSelection()?.removeAllRanges();
      windowElement.style.width = "";
      windowElement.style.height = "";
      delete windowElement.dataset.fittedHeight;
      keepAboveDock(windowElement);
    });

    windowElement.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      focusWindow(windowElement);
      const resizeHandle = event.target.closest("[data-resize]");
      if (resizeHandle && !root.classList.contains("is-mobile-mode") && !windowElement.classList.contains("is-expanded")) {
        beginResize(windowElement, resizeHandle, event);
        return;
      }
      if (root.classList.contains("is-mobile-mode") || windowElement.classList.contains("is-expanded")) return;
      const titlebar = event.target.closest(".window-titlebar");
      if (!titlebar || event.target.closest("button")) return;
      const bounds = windowElement.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = bounds.left;
      const startTop = bounds.top;
      const windowWidth = bounds.width;
      const windowHeight = bounds.height;
      const menuBottom = document.querySelector(".system-menubar").getBoundingClientRect().bottom;
      windowElement.style.left = `${startLeft}px`;
      windowElement.style.top = `${startTop}px`;
      windowElement.style.transform = "translate3d(0, 0, 0)";
      windowElement.classList.add("is-dragged");
      windowElement.style.willChange = "transform";
      root.classList.add("is-window-dragging", "is-window-moving");
      titlebar.setPointerCapture(event.pointerId);

      let latestX = startX;
      let latestY = startY;
      let frame = 0;
      let finalLeft = startLeft;
      let finalTop = startTop;

      const applyDrag = () => {
        const maxLeft = Math.max(0, window.innerWidth - windowWidth);
        const maxTop = Math.max(menuBottom, window.innerHeight - windowHeight);
        finalLeft = Math.max(0, Math.min(maxLeft, startLeft + latestX - startX));
        finalTop = Math.max(menuBottom, Math.min(maxTop, startTop + latestY - startY));
        windowElement.style.transform = `translate3d(${finalLeft - startLeft}px, ${finalTop - startTop}px, 0)`;
        frame = 0;
      };

      const move = moveEvent => {
        latestX = moveEvent.clientX;
        latestY = moveEvent.clientY;
        if (!frame) frame = requestAnimationFrame(applyDrag);
      };
      const stop = stopEvent => {
        latestX = stopEvent.clientX;
        latestY = stopEvent.clientY;
        if (frame) cancelAnimationFrame(frame);
        applyDrag();
        windowElement.style.left = `${finalLeft}px`;
        windowElement.style.top = `${finalTop}px`;
        windowElement.style.transform = "translate3d(0, 0, 0)";
        windowElement.style.willChange = "";
        root.classList.remove("is-window-dragging", "is-window-moving");
        titlebar.removeEventListener("pointermove", move);
        titlebar.removeEventListener("pointerup", stop);
        titlebar.removeEventListener("pointercancel", stop);
      };
      titlebar.addEventListener("pointermove", move);
      titlebar.addEventListener("pointerup", stop);
      titlebar.addEventListener("pointercancel", stop);
    });

  });

  window.addEventListener("resize", () => {
    windows.forEach(windowElement => {
      if (windowElement.classList.contains("projects-window") && windowElement.classList.contains("is-expanded")) {
        fitExpandedProject(windowElement);
      }
    });
  }, { passive: true });

  function applyMobileMode(enabled) {
    root.classList.toggle("is-mobile-mode", enabled);

    if (enabled) {
      if (!focusedWindow) {
        focusedWindow = windows
          .filter(item => !item.hidden)
          .sort((first, second) => Number(second.style.zIndex) - Number(first.style.zIndex))[0] || null;
      }
      windows.forEach(item => {
        if (item === focusedWindow) {
          return;
        }
        item.hidden = true;
      });
    }

    windows.forEach(item => {
      item.classList.remove("is-opening");
      item.style.left = "";
      item.style.top = "";
      item.style.width = "";
      item.style.height = "";
      item.style.transform = "";
      item.style.willChange = "";
      item.classList.remove("is-dragged", "is-expanded");
      const expandButton = item.querySelector('[data-action="expand"]');
      expandButton.setAttribute("aria-label", `Expand ${getWindowTitle(item)} window`);
      expandButton.setAttribute("aria-pressed", "false");
      delete item.dataset.restoreLeft;
      delete item.dataset.restoreTop;
      delete item.dataset.restoreTransform;
    });
    syncDock();
  }

  mobileBreakpoint.addEventListener("change", event => {
    applyMobileMode(event.matches);
  });

  syncDock();
})();