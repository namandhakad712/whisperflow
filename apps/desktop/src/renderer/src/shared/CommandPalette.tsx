/**
 * The command palette — "the patch bay".
 *
 * Ctrl/⌘+K opens a keyboard-first launcher over the settings: every screen
 * reachable by fuzzy match, plus a few live actions (theme flip, onboarding
 * replay). Arrow keys + Enter navigate; Esc closes; typing filters.
 *
 * Signal Standard: paper panel, hairline, mono, phosphor selection rail,
 * section markers. Motion per MOTION.md — 240ms out-expo entrance.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { allScreens, PAGES } from "../settings/nav";

export interface PaletteAction {
  id: string;
  label: string;
  /** Group heading, e.g. "navigate" or "actions". */
  group: string;
  /** Right-aligned mono hint, e.g. a hotkey. */
  hint?: string;
  run: () => void;
}

/** Subsequence fuzzy match: "ovl" matches "overlay". Returns score or -1. */
function fuzzy(needle: string, haystack: string): number {
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  if (!n) return 0;
  let score = 0;
  let hi = 0;
  let streak = 0;
  for (const ch of n) {
    const found = h.indexOf(ch, hi);
    if (found === -1) return -1;
    score += found === hi ? 3 + streak : 1; // reward consecutive runs
    streak = found === hi ? streak + 1 : 0;
    hi = found + 1;
  }
  // prefix bonus
  if (h.startsWith(n)) score += 6;
  return score;
}

/** v0.1.51: the last five ran commands ride the top of an empty query —
 *  the palette learns what you actually use. Persisted locally. */
const RECENTS_KEY = "wf-palette-recents";
const RECENTS_MAX = 5;
function readRecents(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function pushRecent(id: string): void {
  try {
    const next = [id, ...readRecents().filter((x) => x !== id)].slice(0, RECENTS_MAX);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* session-only */
  }
}

export function CommandPalette({
  open,
  onClose,
  extraActions,
}: {
  open: boolean;
  onClose: () => void;
  extraActions: PaletteAction[];
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Navigate actions: one per screen, plus the live extras. The hint shows
  // the channel hotkey when the page has one (v0.1.51).
  const navActions: PaletteAction[] = useMemo(() => {
    const pageIdx = new Map(PAGES.map((p, i) => [p.id, i]));
    return allScreens().map((s) => {
      const ch = pageIdx.get(s.pageId);
      return {
        id: `nav:${s.route}`,
        label: s.label,
        group: `go to · ${s.page}`,
        hint: ch !== undefined ? `alt+${ch + 1} · ${s.route}` : s.route,
        run: () => {
          window.location.hash = `/${s.route}`;
        },
      };
    });
  }, []);

  const items = useMemo<PaletteAction[]>(() => {
    const all = [...extraActions, ...navActions];
    const query = q.trim();
    if (!query) {
      // v0.1.51: recents ride the top, everything else follows
      const byId = new Map(all.map((a) => [a.id, a]));
      const recent = recents
        .map((id) => byId.get(id))
        .filter((a): a is PaletteAction => Boolean(a))
        .map((a) => ({ ...a, group: "recent" }));
      const rest = all.filter((a) => !recents.includes(a.id));
      return [...recent, ...rest].slice(0, 12);
    }
    return all
      .map((a) => ({ a, s: Math.max(fuzzy(query, a.label), fuzzy(query, a.hint ?? "") * 0.6) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 12)
      .map((x) => x.a);
  }, [q, navActions, extraActions, recents]);

  // Reset selection whenever the result list changes shape.
  useEffect(() => setSel(0), [q]);

  // Focus + select the input on open; clear on close.
  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setRecents(readRecents());
      // next tick: the input exists by then
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // Keep the selected row in view.
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open) return null;

  const commit = (a: PaletteAction) => {
    pushRecent(a.id);
    a.run();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 pt-[14vh] backdrop-blur-[2px]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setSel((s) => Math.min(s + 1, items.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSel((s) => Math.max(s - 1, 0));
        } else if (e.key === "Enter" && items[sel]) {
          e.preventDefault();
          commit(items[sel]);
        }
      }}
      data-interactive="true"
    >
      {/* the panel — paper, hairline, one phosphor edge */}
      <div className="wf-palette-panel">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="font-mono text-[11px] tracking-[0.14em] text-phosphor" aria-hidden="true">
            ///
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="jump to a setting or run an action…"
            className="w-full bg-transparent font-mono text-[14px] text-ink outline-none placeholder:text-ink-faint"
            spellCheck={false}
          />
          <kbd className="rounded border border-line bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">
            esc
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-1.5">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center font-mono text-[12.5px] text-ink-faint">
              no match — try "overlay" or "theme"
            </p>
          )}
          {items.map((a, i) => (
            <button
              key={a.id}
              type="button"
              data-idx={i}
              onMouseEnter={() => setSel(i)}
              onClick={() => commit(a)}
              className={`wf-palette-row ${i === sel ? "is-sel" : ""}`}
            >
              <span className="led" data-on={i === sel ? "live" : "off"} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-left font-mono text-[13px] text-ink">
                {a.label}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-ink-faint">{a.group}</span>
              {a.hint && (
                <span className="shrink-0 rounded border border-line-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
                  {a.hint}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line-soft px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          <span>whisperflow console</span>
          <span className="flex items-center gap-3">
            <span>↑↓ select</span>
            <span>↵ open</span>
            <span>alt+1…9 channel</span>
          </span>
        </div>
      </div>
    </div>
  );
}
