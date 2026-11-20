/**
 * Screenshot harness for the Settings console — loads the REAL built bundle
 * (out/renderer), stubs the Electron bridge, and drives the UI so a headless
 * browser can photograph it. Used by scripts/console-qa.cjs for visual QA.
 *
 * Load as: file://.../out/renderer/settings.html?qa=1  (this script only
 * activates with ?qa=1 so it never runs in production.)
 */
declare global {
  interface Window {
    __wfQaHarness?: boolean;
  }
}

(() => {
  if (!window.location.search.includes("qa=1")) return;
  window.__wfQaHarness = true;

  // Wait for React to mount the shell, then poke it.
  const ready = setInterval(() => {
    const rail = document.querySelector('aside[aria-label="Sections"]');
    if (!rail) return;
    clearInterval(ready);

    // Neutralize route staging for deterministic screenshots? No — the point
    // is to SEE the staging. Wait one beat for the cascade to finish instead.
    setTimeout(() => {
      document.documentElement.dataset.qaReady = "1";
    }, 600);
  }, 50);

  // Auto-open helpers, driven by the hash: #/dictation/general?palette=1
  const params = new URLSearchParams(window.location.search);
  if (params.get("palette") === "1") {
    const open = setInterval(() => {
      const btn = document.querySelector('button[aria-label="Open command palette"]');
      if (btn) {
        clearInterval(open);
        (btn as HTMLElement).click();
      }
    }, 50);
  }
  if (params.get("onboarding") === "1") {
    try {
      localStorage.removeItem("wf-onboarded");
    } catch {
      /* fresh profile anyway */
    }
    window.location.hash = "/onboarding";
  }
})();

export {};
