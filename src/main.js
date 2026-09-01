import "./style.css";

const SWF_VARIANTS = {
  official: "flOw official.swf",
  classic: "flOw classic.swf",
  widescreen: "flOw widescreen.swf",
};

const APP_BASE = import.meta.env.BASE_URL;
const GAME_BASE_PATH = `${APP_BASE}game/`;
const RUFFLE_BASE_PATH = `${APP_BASE}ruffle/`;
const DEFAULT_VARIANT = "official";
const RUFFLE_VERSION = "0.5.0";

const params = new URLSearchParams(window.location.search);
const debugMode = params.has("debug");
const variantKey = params.get("variant") ?? DEFAULT_VARIANT;
const swfFileName = SWF_VARIANTS[variantKey] ?? SWF_VARIANTS[DEFAULT_VARIANT];
const swfUrl = `${GAME_BASE_PATH}${swfFileName.split("/").map(encodeURIComponent).join("/")}`;
const gameBaseUrl = new URL(GAME_BASE_PATH, window.location.href).href;

/** @type {{ url: string, status: number | string, ok: boolean, type: string }[]} */
const networkLog = [];

function isGameAssetUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    const gamePath = new URL(GAME_BASE_PATH, window.location.href).pathname;
    return parsed.pathname.startsWith(gamePath);
  } catch {
    return false;
  }
}

function recordNetwork(url, status, ok, type) {
  if (!isGameAssetUrl(url)) {
    return;
  }

  networkLog.push({ url, status, ok, type });
  if (networkLog.length > 200) {
    networkLog.shift();
  }

  if (debugMode) {
    renderDebugPanel();
  }
}

function installNetworkInstrumentation() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const requestUrl = typeof args[0] === "string" ? args[0] : args[0].url;
    try {
      const response = await originalFetch(...args);
      recordNetwork(requestUrl, response.status, response.ok, "fetch");
      return response;
    } catch (error) {
      recordNetwork(requestUrl, "error", false, "fetch");
      throw error;
    }
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
    this.addEventListener("loadend", () => {
      recordNetwork(String(url), this.status, this.status >= 200 && this.status < 400, "xhr");
    });
    return originalOpen.call(this, method, url, ...rest);
  };
}

function renderDebugPanel() {
  const panel = document.getElementById("debug-panel");
  if (!panel) {
    return;
  }

  panel.hidden = false;

  const mp3Requests = networkLog.filter((entry) => entry.url.toLowerCase().includes(".mp3"));
  const failed = networkLog.filter((entry) => !entry.ok);
  const mp3Failures = failed.filter((entry) => entry.url.toLowerCase().includes(".mp3"));

  panel.innerHTML = `
    <h2>flOw debug</h2>
    <dl>
      <dt>Ruffle version</dt><dd>${RUFFLE_VERSION}</dd>
      <dt>SWF URL</dt><dd>${swfUrl}</dd>
      <dt>Configured base URL</dt><dd>${gameBaseUrl}</dd>
      <dt>Variant</dt><dd>${variantKey} (${swfFileName})</dd>
      <dt>User agent</dt><dd>${navigator.userAgent}</dd>
      <dt>MP3 requests observed</dt><dd class="${mp3Requests.length ? "ok" : ""}">${mp3Requests.length}</dd>
      <dt>Failed game requests</dt><dd class="${failed.length ? "error" : "ok"}">${failed.length}</dd>
      <dt>Failed MP3 requests</dt><dd class="${mp3Failures.length ? "error" : "ok"}">${mp3Failures.length}</dd>
    </dl>
    ${
      failed.length
        ? `<div class="error"><strong>Failed requests</strong><ul>${failed
            .slice(-20)
            .map((entry) => `<li>[${entry.type}] ${entry.status} ${entry.url}</li>`)
            .join("")}</ul></div>`
        : ""
    }
    ${
      mp3Requests.length
        ? `<div><strong>Recent MP3 requests</strong><ul>${mp3Requests
            .slice(-20)
            .map((entry) => `<li class="${entry.ok ? "ok" : "error"}">[${entry.status}] ${entry.url}</li>`)
            .join("")}</ul></div>`
        : ""
    }
  `;
}

function preventPageGestures() {
  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.target.closest("#debug-panel, #about-dialog, #about-trigger")) {
        return;
      }
      event.preventDefault();
    },
    { passive: false },
  );

  document.addEventListener("gesturestart", (event) => {
    event.preventDefault();
  });
}

function installAboutPanel() {
  const app = document.getElementById("app");
  const trigger = document.getElementById("about-trigger");
  const dialog = document.getElementById("about-dialog");
  const closeButton = document.getElementById("about-close");

  if (!app || !trigger || !dialog || !closeButton) {
    return;
  }

  const revealTrigger = () => {
    trigger.hidden = false;
    requestAnimationFrame(() => {
      trigger.classList.add("visible");
    });
  };

  app.addEventListener("pointerdown", revealTrigger, { once: true, passive: true });

  trigger.addEventListener("click", () => {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    }
  });

  closeButton.addEventListener("click", () => {
    dialog.close();
  });

  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const inDialog =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!inDialog) {
      dialog.close();
    }
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dialog.close();
  });
}

function installPointerIntegration(container, playerElement) {
  const resumeAudio = () => {
    const ruffle = playerElement.ruffle?.();
    if (ruffle && typeof ruffle.focus === "function") {
      ruffle.focus();
    }
  };

  container.addEventListener("pointerdown", resumeAudio, { passive: true });
  container.addEventListener("pointerup", resumeAudio, { passive: true });

  // Suppress the browser context menu on touch; Ruffle uses rightClickOnly for its menu.
  container.addEventListener("contextmenu", (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      event.preventDefault();
    }
  });
}

async function loadRuffleScript() {
  if (window.RufflePlayer?.newest) {
    return;
  }

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-ruffle="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(undefined), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Ruffle")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `${APP_BASE}ruffle/ruffle.js`;
    script.dataset.ruffle = "true";
    script.onload = () => resolve(undefined);
    script.onerror = () => reject(new Error("Failed to load Ruffle"));
    document.head.appendChild(script);
  });
}

async function waitForRuffle() {
  await loadRuffleScript();

  if (window.RufflePlayer?.newest) {
    return window.RufflePlayer.newest();
  }

  await new Promise((resolve) => {
    window.RufflePlayer = window.RufflePlayer || {};
    window.RufflePlayer.config = {
      ...(window.RufflePlayer.config || {}),
      publicPath: new URL(RUFFLE_BASE_PATH, window.location.href).href,
    };

    const check = () => {
      if (window.RufflePlayer?.newest) {
        resolve(undefined);
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });

  return window.RufflePlayer.newest();
}

async function boot() {
  installNetworkInstrumentation();
  preventPageGestures();
  installAboutPanel();

  const container = document.getElementById("player-container");
  if (!container) {
    throw new Error("Missing #player-container");
  }

  const ruffle = await waitForRuffle();
  const player = ruffle.createPlayer();
  player.id = "flow-player";
  player.style.width = "100%";
  player.style.height = "100%";
  player.style.touchAction = "none";
  container.appendChild(player);

  installPointerIntegration(container, player);

  const loadOptions = {
    url: swfUrl,
    base: gameBaseUrl,
    publicPath: new URL(RUFFLE_BASE_PATH, window.location.href).href,
    allowNetworking: "all",
    autoplay: "on",
    backgroundColor: "#000000",
    letterbox: "fullscreen",
    unmuteOverlay: "visible",
    splashScreen: false,
    preloader: false,
    polyfills: false,
    favorFlash: false,
    contextMenu: "rightClickOnly",
    warnOnUnsupportedContent: false,
    logLevel: debugMode ? "warn" : "error",
    wmode: "opaque",
    forceScale: false,
    menu: true,
    playerVersion: 8,
  };

  player.ruffle().load(loadOptions);

  if (debugMode) {
    renderDebugPanel();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(`${APP_BASE}sw.js`).catch(() => {
      // Optional offline support; ignore registration failures in dev.
    });
  }
}

boot().catch((error) => {
  console.error("Failed to start flOw:", error);
  if (debugMode) {
    const panel = document.getElementById("debug-panel");
    if (panel) {
      panel.hidden = false;
      panel.innerHTML = `<h2>flOw debug</h2><p class="error">${String(error)}</p>`;
    }
  }
});
