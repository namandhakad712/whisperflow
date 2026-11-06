# WhisperFlow — personas & positioning: from personal tool to corporate standard

**Purpose:** the product's reference for *who* we build for next and *why*. Every feature decision
should be traceable to a persona here. Re-verify competitor facts before quoting them publicly.

---

## 1. The ladder

Voice dictation products get bought by one person, then adopted by a team, then standardized by an
IT department. WhisperFlow's local-first architecture is a **structural** advantage at every rung,
but the rungs need different features.

| Rung | Who | Their purchase trigger | What local-first means to them |
| --- | --- | --- | --- |
| 1. Personal | Student, writer, developer, accessibility user | "I want to type faster / my hands hurt / I think faster than I type" | Free, no subscription, no account, works offline |
| 2. Knowledge worker | Consultant, PM, researcher, lawyer, doctor | "I write all day; the polish saves me an hour" | Dictation never leaves the machine; BYOK keeps the bill visible |
| 3. Team lead | Engineering/ops/legal lead | "Half my team would use this if it were safe" | No data gravity: nothing of ours is stored server-side |
| 4. Enterprise | IT/security buyer | "Legal cleared it because there's nothing to clear" | Air-gap-able, auditable, no vendor data pipeline at all |

The ladder is also the **roadmap**: personal is shipped, knowledge-worker is shipped, team is the
next 12 months, enterprise is the convergence of what teams need plus packaging.

---

## 2. Personas (synthesized from how dictation is actually used)

### P1 — Maya, 22, student (personal, free)
Writes essays and notes all day in a dorm/shared flat. Has tried dictation, stopped because she
felt *loud* and the transcripts looked dumb when pasted.
- **Pain:** filler words and mis-capitalized text make her look sloppy; "fixing the transcript
  took longer than typing."
- **Wants:** looks polished with zero effort, off by default for everyone but her, free forever.
- **WhisperFlow answer:** one-key toggle + `cleanup: light` polish + the dictionary that learns
  her course vocabulary.
- **Adoption friction:** self-consciousness about talking aloud. *Nothing the software does fixes
  this* — but the resting pill, zero accounts, and instant offline reliability beat "wait for the
  cloud" and make her keep trying.

### P2 — Ravi, 38, software engineer (personal→knowledge worker)
Dictates design docs and Slack messages; types code. Hands starting to hurt after 15 years.
- **Pain:** every dictation tool formats his prose fine and his *code* comments terribly.
- **Wants:** per-app behavior. Raw text in the IDE, polished prose in Gmail, casual in Slack.
- **WhisperFlow answer:** Modes (with per-app corrections) — the feature that makes him stay
  (`docs/EXTENDING.md` §6, the developer recipe). BYOK Groq because he already has a key and
  resents a second subscription.
- **Retention hook:** muscle memory. Hold-to-talk becomes as automatic as Ctrl-S; the chimes
  confirm a successful turn the way a sent email sounds like a whoosh.

### P3 — Dr. Okafor, 45, radiologist (knowledge worker, regulated)
Dictates reports between patients. Employer forbids cloud STT for patient content — full stop.
- **Pain:** the hospital's old ASR misheard every drug name; her *personal* dictation app is
  banned at work.
- **Wants:** offline, a medical vocabulary she controls, and a guarantee that nothing is uploaded.
- **WhisperFlow answer:** `privacy.localOnly` (hard network block), local whisper + polish, a
  dictionary she owns (the medical vocabulary pack is a gap — see §5). The **failure contract** is
  the line her IT department needs to hear: *if the cloud polish fails, the local transcript is
  what gets pasted — never nothing.*
- **Trust mechanic:** an explicit, honest Privacy tab (what's blocked, what's stored, where) — not
  a marketing paragraph.

### P4 — Lena, 41, ops team lead (team)
20 engineers; async-by-default; hours of meetings a week. Wants voice for standups and incident
notes without legal review.
- **Pain:** her team's meeting transcripts sit in a vendor's cloud; the vendor's retention policy
  is a spreadsheet of maybe.
- **Wants:** meeting capture that stays on the machine, a *team* dictionary (service names,
  acronyms), shared Modes profiles.
- **WhisperFlow answer today:** meeting mode + per-user config + backup/restore for the config.
- **WhisperFlow gap:** no team dictionary sync, no shared Modes pack, no multi-device config
  travel beyond manual export/import.

### P5 — Marcus, 50, IT buyer (enterprise)
Needs: no vendor data pipeline, auditable binaries, MSI/SCCM-style deployment, SSO is *not* the
issue (the app is accountless), offline activation, and a support contact.
- **Pain:** every "AI writing" tool wants to route confidential text through its servers.
- **Wants:** the air-gap test to pass; the installer to be small; updates he controls.
- **WhisperFlow answer:** local-first by default (nothing to route), the installer dropped from
  262 MB to 134 MB in 0.1.28 with an explicit diet policy (PR template now blocks new deps
  without a size justification), and self-hostable STT/polish endpoints for air-gapped networks.

---

## 3. The psychology of use — what actually drives adoption

Pulled from our own design history and from what the dictation category gets wrong:

1. **Self-consciousness is the #1 churn driver, not quality.** Voice is public; typing is private.
   Product-side answers: hold mode (press once, talk, release — no "is it listening?" state),
   instant-cancel (Esc, with a chime so the user knows it *stopped*), and a pill that never
   lingers after a cancel. We fixed the stuck-overlay bug class in 0.1.21–0.1.24 because a pill
   that won't dismiss reads as "the app recorded everything and won't let me go."
2. **Muscle memory beats features.** A rebindable hotkey with per-action shortcuts
   (paste-last, copy-last, lens) is what turns a trial into a habit. Defaults that copy the
   incumbent's bindings (`Shift+Alt+Z`, `Shift+Alt+X`) reduce switching cost; document them.
3. **Trust accumulates in small explicit disclosures.** The Privacy tab's failure contract, the
   "partial audio is never billed" note on live partials, the `freeNote` + `verified:` dates on
   every cloud preset — these are not marketing, they're the *reason* a regulated user can sign
   off. Every future endpoint should carry a period-checked freeNote with a verification date.
4. **Habit is visible progress.** Insights (words spoken, streaks, time saved) work because they
   narrate the compounding effect. Onboarding should show the *streak* potential on day 1, not a
   feature tour.
5. **Fear of "AI rewriting my words"** is why polish defaults to light cleanup, tone `neutral`,
   and why there's a `raw` format and a per-Mode `none` cleanup: the user must always be able to
   get their exact words. This is not a limitation to market around — it's the product.
6. **Adoption happens alone, retention happens in a community.** Recipes people share
   (docs/EXTENDING.md §6) are the feature — a vocabulary pack or a Modes pack is a *gift* someone
   gives a colleague. The gap list in §7 of EXTENDING.md is prioritized accordingly.

---

## 4. Local-first: where we genuinely win, where we lose

**Wins (defensible, structural):**
- **Privacy by absence.** There is no server with your audio. No retention policy to audit, no
  breach surface, no data-subject requests. For regulated work this is the whole product.
- **No subscription, no account.** Free forever is a cost structure, not a promotion: our compute
  is the user's machine or their own BYOK budget.
- **Offline and instant.** No "connecting…" pill. Cloud competitors' latency floor is our ceiling.
- **The failure contract.** When the cloud fails, the local transcript is what gets pasted. Their
  product philosophy is best-effort-everything; ours is local-first-with-escape-hatch.

**Losses (real, must not be hand-waved):**
- **Multi-device config.** A competitor with a server syncs your dictionary across laptops. We
  require manual backup/restore (documented; better sync is a team-tier feature).
- **First-run model download.** Cloud STT works the second you install; local needs a model. We
  pick a small default (the smallest competent one) and make BYOK a first-class alternative.
- **Team features.** Shared dictionaries, Modes packs, admin controls — the competition sells
  these as their team plan. See §5.
- **Mobile.** No phone companion. Voice on phone is a different product; do not over-promise.

---

## 5. The 12-month ladder (P0 = now, P2 = next year)

| Priority | Feature | Serves | Local-first defensible? |
| --- | --- | --- | --- |
| P0 | **Vocabulary packs** — dictionary import/export + shareable packs (medical, legal, EN-as-second-language) | P3, P4, P1 | Yes — packs are files, no server needed |
| P0 | **Post-dictation hooks** — pipe the transcript to a script/webhook/scratchpad | P2, P4 | Yes — runs locally, makes us a *pipeline* tool |
| P1 | **Shared Modes/dictionary packs** (team lead curates, team imports) | P4 | Yes — pack files via any channel; no account |
| P1 | **macOS/Linux packaging** | P1–P2 | Yes — the engine and renderer are portable |
| P1 | **Per-mode STT model + language** (Modes grow a `stt` block) | P2, P3 | Yes |
| P1 | **Config profiles** (work/home) | P2 | Yes |
| P2 | **Multi-device config sync via the user's own cloud** (OneDrive/Dropbox folder as the sync agent) | P2–P4 | Yes — we sync through *their* storage, never ours |
| P2 | **MSI/SCCM-style deployment + auto-update channel control** | P5 | Yes — `updates.channel` exists (`stable`/`beta`); needs a managed-channel doc |
| P2 | **Audit log** (what was sent where, locally) | P5 | Yes — this is the enterprise checkbox |
| P2 | **Mobile companion (read/scratchpad only)** | P1 | No — needs a server; do not pretend otherwise |

**Tier mapping (feature gates, not invented prices):**
- **Personal — free, everything local.** No account. This is the product today.
- **Pro — BYOK unlocked niceties**: nothing essential is paywalled; Pro funds model catalog
  curation and pack maintenance. Market anchor: Wispr Flow sells a Pro tier around per-user
  monthly pricing (verify on their pricing page before quoting).
- **Team — the pack/hook features** (shared dictionaries, hooks, audit log, deployment tooling).
  Priced per seat.

---

## 6. Voice & copy rules (what we sound like)

- We say **local-first**, never "100% secure" or "unhackable." Absence of a data pipeline is a
  fact; security theater is a lie.
- Every claim about a third-party endpoint carries a **verified date** (`freeNote` + `verified`) —
  internets change; we show our work.
- We never use the words "AI-powered" to sell. The feature is named what it does:
  "dictation," "polish," "the lens."
- Failure states get copy, not silence ("offline cleanup ran" / "the local transcript was
  pasted").

---

*Sources: competitor positions verified against their public sites on the dates noted in
`docs/research/` and in `CLOUD_*_PRESETS.verified`. Persona details are synthesized from
accessibility/RSI, non-native-speaker, and regulated-industry dictation usage patterns —
representative composites, not real individuals. Re-verify pricing before public use.*
