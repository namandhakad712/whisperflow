/**
 * THE LIVING PRINT — GSAP motion layer (v4).
 * The site is a print shop floor: the print develops, re-composes under
 * your scroll, and every block is laid on the sheet with intent.
 * Reduced-motion visitors get the static sheet, fully legible.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import type { PaintedScene } from "@whisperflow/signal-engine";

gsap.registerPlugin(ScrollTrigger);

type HeroLookup = () => PaintedScene | null;

/** Load choreography: the sheet lays itself out. Runs once per page. */
function entrance(): void {
  // headline: each word lifts out of a paper slit (mask reveal)
  document.querySelectorAll<HTMLElement>("[data-lines]").forEach((h) => {
    const words = h.querySelectorAll<HTMLElement>("[data-word]");
    if (!words.length) return;
    gsap.from(words, {
      yPercent: 118,
      duration: 1.1,
      ease: "power4.out",
      stagger: 0.09,
      delay: 0.15,
      scrollTrigger: { trigger: h, start: "top 92%", once: true },
    });
  });

  // eyebrow, lede, CTAs: a staggered lay-on
  const heroSeq = document.querySelectorAll<HTMLElement>("[data-lay]");
  if (heroSeq.length) {
    gsap.from(heroSeq, {
      y: 26,
      autoAlpha: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.12,
      delay: 0.45,
    });
  }

  // everything below the fold: laid on the sheet as it scrolls into view
  ScrollTrigger.batch(
    "[data-reveal], section > div > .proof-card, section > div > .specimen, section > div > .panel",
    {
      interval: 0.12,
      batchMax: 6,
      onEnter: (els) =>
        gsap.from(els, {
          y: 34,
          autoAlpha: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.09,
          overwrite: true,
        }),
      start: "top 88%",
      once: true,
    },
  );
}

/** The hero print listens to the scroll: it re-composes (crop zoom morph),
 *  coarsens its screen, and deepens with scroll velocity (u_drive). */
function livingPrint(hero: HeroLookup): void {
  // scroll through the hero: the crop zooms 1.06 → 1.26 and the screen
  // coarsens — the flower recomposes exactly like the reference states.
  // The hero scene registers itself async; resolve lazily per frame.
  const heroEl = document.getElementById("hero");
  if (heroEl) {
    ScrollTrigger.create({
      trigger: "#hero",
      start: "top top",
      end: "bottom top",
      scrub: 0.6,
      onUpdate: (self) => {
        const scene = hero();
        if (!scene) return;
        const p = self.progress;
        scene.setCrop([0.5, 0.5 - p * 0.06, 1.06 + p * 0.2]);
        scene.setCell(3 + p * 1.5);
      },
    });
  }

  // the canvas itself parallaxes gently under the copy
  const canvas = document.getElementById("hero-scene");
  if (canvas) {
    gsap.to(canvas, {
      yPercent: 12,
      ease: "none",
      scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: 0.5 },
    });
  }

  // scroll velocity → the print deepens (u_drive), decaying after you stop
  let lastY = window.scrollY;
  let vel = 0;
  window.addEventListener(
    "scroll",
    () => {
      vel = Math.min(1, Math.abs(window.scrollY - lastY) / 90);
      lastY = window.scrollY;
    },
    { passive: true },
  );
  setInterval(() => {
    const scene = hero();
    if (scene) scene.setDrive(vel);
    vel *= 0.82;
  }, 50);
}

/** Magnetic buttons: the press leans toward your hand. */
function magnetic(): void {
  if (window.matchMedia("(pointer: coarse)").matches) return;
  document.querySelectorAll<HTMLElement>(".btn-ink, .btn-quiet").forEach((btn) => {
    const xTo = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3" });
    const yTo = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3" });
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.22);
      yTo((e.clientY - r.top - r.height / 2) * 0.34);
    });
    btn.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  });
}

let mounted = false;

/** Mount all motion for a page. hero: lazy lookup of the hero scene (pages
 *  without one pass () => null). Idempotent — safe to call from any layout. */
export function mountMotion(hero: HeroLookup = () => null): void {
  if (mounted) return;
  mounted = true;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Lenis smooth scroll drives ScrollTrigger (one clock, no drift)
  const lenis = new Lenis({ duration: 1.0, wheelMultiplier: 0.9 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  entrance();
  livingPrint(hero);
  magnetic();
}
