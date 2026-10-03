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
  let openCount = 0;
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
    writeSetting(accentKey, selected.dataset.accent);
    accentButtons.forEach(button => {
      const isSelected = button === selected;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-checked", String(isSelected));
      button.tabIndex = isSelected ? 0 : -1;
    });
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
    appearanceToggle.classList.toggle("is-light", isLight);
    appearanceToggle.setAttribute("aria-checked", String(isLight));
    appearanceToggle.setAttribute("aria-label", `${isLight ? "Light" : "Dark"} appearance`);

    if (!animate || appearance === previousAppearance) {
      writeSetting(appearanceKey, appearance);
      document.documentElement.dataset.appearance = appearance;
      return;
    }

    window.clearTimeout(appearanceTimer);
    if (motionDisabled) {
      appearanceToggle.classList.remove("is-animating");
      root.classList.remove("is-theme-transitioning");
      document.documentElement.dataset.appearance = appearance;
      writeSetting(appearanceKey, appearance);
      window.dispatchEvent(new CustomEvent("portfolio-theme-transition", {
        detail: { appearance, duration: 0 }
      }));
      return;
    } else {
      appearanceToggle.classList.remove("is-animating");
      void appearanceToggle.offsetWidth;
      appearanceToggle.classList.add("is-animating");
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
    setAppearance(appearanceToggle.classList.contains("is-light") ? "dark" : "light");
  });

  const fullscreenToggle = document.getElementById("fullscreen-toggle");
  const fullscreenExit = document.getElementById("fullscreen-exit");

  function setFullscreenView(enabled) {
    if (enabled) setSettingsPopoverOpen(false);
    root.classList.toggle("is-fullscreen-view", enabled);
    fullscreenExit.hidden = !enabled;
    fullscreenToggle.setAttribute("aria-pressed", String(enabled));
    fullscreenToggle.setAttribute("aria-label", enabled ? "Exit full screen" : "Enter full screen");
  }

  fullscreenToggle.addEventListener("click", () => {
    setFullscreenView(!root.classList.contains("is-fullscreen-view"));
  });
  fullscreenExit.addEventListener("click", () => setFullscreenView(false));
  document.addEventListener("keydown", event => {
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

  function setGenieOrigin(windowElement) {
    const button = dock.querySelector(`[data-target="${windowElement.dataset.window}"]`);
    const icon = button.querySelector(".dock-icon");
    const windowBounds = windowElement.getBoundingClientRect();
    const iconBounds = icon.getBoundingClientRect();
    const iconX = iconBounds.left + iconBounds.width / 2 - windowBounds.left;
    const iconY = iconBounds.top + iconBounds.height / 2 - windowBounds.top;
    windowElement.style.setProperty("--genie-origin-x", `${iconX}px`);
    windowElement.style.setProperty("--genie-origin-y", `${iconY}px`);
    windowElement.style.setProperty(
      "--window-rest-transform",
      root.classList.contains("is-mobile-mode") || windowElement.classList.contains("is-expanded")
        ? "translate3d(0, 0, 0)"
        : windowElement.classList.contains("is-dragged")
        ? "translate3d(0, 0, 0)"
        : "translate(-50%, -50%)"
    );

    return {
      x: iconX,
      y: iconY,
      xPercent: iconX / windowBounds.width * 100,
      yPercent: iconY / windowBounds.height * 100
    };
  }

  function makePolygon(points) {
    return `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(", ")})`;
  }

  function playGenieOpen(windowElement, origin) {
    if (animationsDisabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      windowElement.classList.remove("is-opening");
      return;
    }

    openingAnimations.get(windowElement)?.cancel();
    windowElement.classList.add("is-opening");
    const x = origin.xPercent;
    const y = origin.yPercent;
    const clamp = value => Math.max(0, Math.min(100, value));
    const collapsed = makePolygon(Array.from({ length: 8 }, () => [x, y]));
    const funnel = makePolygon([
      [0, 0], [100, 0], [100, 52], [clamp(x + 34), 76],
      [clamp(x + 7), 100], [clamp(x - 7), 100], [clamp(x - 34), 76], [0, 52]
    ]);
    const widening = makePolygon([
      [0, 0], [100, 0], [100, 76], [clamp(x + 72), 90],
      [clamp(x + 36), 100], [clamp(x - 36), 100], [clamp(x - 72), 90], [0, 76]
    ]);
    const full = makePolygon([
      [0, 0], [50, 0], [100, 0], [100, 50],
      [100, 100], [50, 100], [0, 100], [0, 50]
    ]);
    const restTransform = windowElement.style.getPropertyValue("--window-rest-transform");
    const animation = windowElement.animate([
      {
        opacity: 0.8,
        clipPath: collapsed,
        transformOrigin: `${origin.x}px ${origin.y}px`,
        transform: `${restTransform} scale(0.015, 0.02)`
      },
      {
        offset: 0.32,
        opacity: 1,
        clipPath: funnel,
        transform: `${restTransform} scale(0.12, 0.82)`
      },
      {
        offset: 0.76,
        clipPath: widening,
        transform: `${restTransform} scale(1.025, 1.015)`
      },
      {
        opacity: 1,
        clipPath: full,
        transform: `${restTransform} scale(1, 1)`
      }
    ], {
      duration: 420,
      easing: "cubic-bezier(0.18, 0.86, 0.24, 1)",
      fill: "both"
    });

    openingAnimations.set(windowElement, animation);
    animation.addEventListener("finish", () => {
      if (openingAnimations.get(windowElement) === animation) {
        openingAnimations.delete(windowElement);
        windowElement.classList.remove("is-opening");
        animation.cancel();
      }
    }, { once: true });
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

    const applyResize = () => {
      const deltaX = pointerX - startX;
      const deltaY = pointerY - startY;
      const widthDelta = direction.includes("e") ? deltaX : direction.includes("w") ? -deltaX : 0;
      const heightDelta = direction.includes("s") ? deltaY : direction.includes("n") ? -deltaY : 0;
      const maxWidth = direction.includes("w") ? fixedRight : window.innerWidth - startLeft;
      const maxHeight = direction.includes("n") ? fixedBottom - menuBottom : window.innerHeight - startTop;
      const width = Math.max(320, Math.min(maxWidth, startWidth + widthDelta));
      const height = Math.max(Math.min(260, maxHeight), Math.min(maxHeight, startHeight + heightDelta));
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
      windowElement.style.setProperty("--window-offset", `${(openCount % 5) * 22}px`);
      openCount++;
      windowElement.style.visibility = "hidden";
      const origin = setGenieOrigin(windowElement);
      windowElement.style.visibility = "";
      playGenieOpen(windowElement, origin);
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
    if (button) openWindow(button.dataset.target);
  });

  const projectsWindow = document.querySelector(".projects-window");
  projectsWindow.addEventListener("click", event => {
    const button = event.target.closest("[data-gallery-step]");
    if (!button) return;
    const gallery = button.closest(".reel-carousel-shell").querySelector(".project-gallery");
    gallery.scrollBy({
      left: Number(button.dataset.galleryStep) * gallery.clientWidth,
      behavior: animationsDisabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  });

  projectsWindow.querySelectorAll(".project-gallery").forEach(gallery => {
    let scrollFrame = 0;
    gallery.addEventListener("scroll", () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        const currentSlide = Math.round(gallery.scrollLeft / gallery.clientWidth) + 1;
        const totalSlides = gallery.children.length;
        const counter = gallery.closest(".project-reel").querySelector(".gallery-page");
        counter.textContent = `${String(currentSlide).padStart(2, "0")} / ${String(totalSlides).padStart(2, "0")}`;
        scrollFrame = 0;
      });
    }, { passive: true });
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
      root.classList.add("is-window-dragging");
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
        root.classList.remove("is-window-dragging");
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