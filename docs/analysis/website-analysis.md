# Wispr Flow — Public Website Analysis (for OpenWispr IA planning)

Researched 2026-10-25 from https://wisprflow.ai, docs.wisprflow.ai, and third-party reviews.
All marketing copy is paraphrased; structure and functional descriptions only. We will not clone their site.

## 1. Sitemap (467 URLs in sitemap.xml)

### Core funnel pages
| Page | Purpose |
|---|---|
| `/` (home) | Main conversion page → download |
| `/features` | Product capability tour (organized into 5 pillars: Speak / Refine / Personalize / Collaborate / Build) |
| `/pricing` | 4 tiers + comparison table + FAQ |
| `/downloads`, `/get-started` | Installer routing (platform detection) |
| `/demo` | Web-based demo of dictation |
| `/why-flow` | Differentiation / positioning page |
| `/whats-new` | Changelog with email subscription |
| `/blog` + `/post/*` (~140 posts) | Content marketing |
| `/use-cases` + `/use-cases/{app}` (~50 pages) | Per-app landing (chrome, cursor, slack, notion, figma, chatgpt, claude, vs-code, whatsapp, gmail, linear, jira, discord, obsidian, substack, x, linkedin, etc.) |
| `/workflows` + `/workflows/{slug}` | Recipe-style mini case studies |
| `/case-studies` + `/case-study/{slug}` | Customer stories incl. named VCs/founders (Reid Hoffman, Steven Bartlett) |
| `/microphones` | Mic buying guide (support content as SEO) |
| `/ai-prompting-guide` | Prompting guide (tie-in to vibe coding) |

### Segment / persona pages
- `/developers`, `/leaders`, `/marketers`, `/content-creators`, `/lawyers`, `/customer-support`, `/sales`, `/students`, `/accessibility`
- `/dictation/{persona}` — ~60 pages, one per occupation (PMs, recruiters, clinicians, paralegals, coaches, …)
- `/vibe-coding` + `/vibe-coding/{cursor,windsurf,warp,replit}` — AI-coding segment
- `/business`, `/enterprise-privacy`, `/talk-to-sales` — enterprise motion
- `/notetaker` + ~140 `/notetaker/*` SEO pages (alternatives-to-X, how-tos, glossary) — full second product line
- `/comparison/{competitor}-alternative` — 7 pages (superwhisper, macwhisper, dragon, apple dictation, google voice typing, betterdictation, murmurtype)
- `/partner/*`, `/deals/*` — influencer/VC partner landing pages with codes
- `/for-non-profits`, `/india`, `/students` — regional/vertical offers
- Company: `/about`, `/careers`, `/media-kit`, `/rebrand`, `/lab`, `/new-funding`, `/yapify` (acquisition)
- Legal: `/privacy`, `/privacy-policy`, `/data-controls`, `/terms-of-service`, `/legal/dpa`, `/legal/msa`, `/cookie-policy`, `/ccpa-notice`

### Off-domain properties
- `docs.wisprflow.ai` — help center (Pylon) with collections: Getting Started (40), Using Wispr Flow (31), Accuracy & Voice Quality (6), Billing & Plans (14), Troubleshooting (32), Privacy/Security/Data (11), Known Issues (12), Notetaker (25)
- Status page linked from docs ("All systems operational")

## 2. Per-page structure

### Home page (section by section)
1. **Hero** — short imperative headline about speaking instead of typing; subline: AI voice-to-text that produces clean prose in any app; primary CTA "download free" → `/get-started`; secondary CTA tries Notetaker; platform badges (Mac/Windows/iPhone/Android); embedded **before/after demo**: raw rambling dictation rendered live, transforming into polished text.
2. **Speed claim** — metric comparison: typing ~45 wpm vs. dictation ~220 wpm (a "4x faster" theme).
3. **How-it-works trio** — (a) handles natural/rambling speech, (b) edits in real time (filler removal, punctuation, formatting), (c) works system-wide without per-app plugins.
4. **Personalization block** — tone selection, 100+ languages w/ auto-detect, custom dictionary (auto-learned + manual), text-expansion snippets, per-app writing styles.
5. **Social proof** — company logo strip; case-study stat teasers (faster message output, hours saved/day, more calls handled, $ cost savings/yr).
6. **Announcement strip** — funding round ($81M) and Notetaker launch.
7. **Testimonials** — named founders/executives (podcast host, newsletter founder, CMO, eyewear co-founder) + press quotes.
8. **Privacy/trust band** — data never sold; SOC 2 Type II, HIPAA, ISO 27001 badges; link to privacy page.
9. **Pricing teaser** — free tier with weekly word allowance, no card required; paid tier for unlimited; teams/enterprise mention (SSO, admin).
10. **FAQ accordion** (~11 items): app compatibility, vs. built-in OS dictation, language count, accents, fast/quiet speech, mic hardware, privacy, free plan limits, team plans, Notetaker availability, shared plans.
11. **Footer** — columns: Products (Dictation, Notetaker), Get started (Pricing, Privacy, Demo, Why Flow, Mic guide), Professionals (persona links), Resources (case studies, blog, workflows, comparisons, bug bounty, support, help center), Company (about, careers, trust center, affiliates, media kit) + legal.

### Features page
Hero + subhead; then content organized into **five pillars**, each with feature cards linking to docs:
- **Speak**: auto-edits as you talk; handles rambling/self-corrections; works in any app; auto language detection.
- **Refine**: smart rewrites; punctuation/formatting (bullets, headings, code blocks); undo & edit; whisper mode.
- **Personalize**: tones; personal dictionary (auto-learn on correction + manual add); snippets (voice-triggered templates, shared for teams); multi-language.
- **Collaborate**: shared dictionaries & snippets across a team.
- **Build (developer angle)**: syntax, file names, code formatting accuracy; AI-tool positioning.
Each card: title, 1–2 sentence functional description, "read more" → docs article.

### Pricing page
- Monthly/annual toggle (annual framed as ~20% off).
- **Free** — $0, all platforms, weekly word allowance (desktop 2,000 words/week soft limit, 5,000 hard; iOS 550/750; Android 1,000/1,500; pooled mobile bucket; resets Sunday; throttles at allowance, blocks at max).
- **Pro** — $15/user/mo or $144/user/yr (~$12/mo annual): unlimited dictation, all personalization features, priority support, team seats/central billing.
- **Growth (dictation-only)** — $23/user/mo or $216/yr: adds SAML SSO, usage reporting, org-wide privacy/HIPAA controls; no Notetaker.
- **Growth w/ Notetaker** — $33/user/mo or $312/yr: + Notetaker, meeting Q&A, MCP access to notes.
- **Enterprise** — custom: SCIM, MDM deployment, training always off, DPA/MSA, SLAs, dedicated CSM, free IT-admin seats, invoice billing.
- Cross-plan notes: HIPAA BAA needs paid Growth/Enterprise; 24 regional-currency price lists; 14-day trial (30 referral, 90 student).
- Student offer: free + 3 months Pro for finals, then ~50% off renewals. Non-profit: free Pro.
- Full feature-comparison table (checks/dashes; many cells rendered as images).

### Downloads page
- Platform tabs/cards (Mac, Windows, iPhone, Android); per-platform "what you can do" checklist; download links route through onboarding (`/get-started`) and a mobile attribution link (AppsFlyer OneLink).
- Marketing claims on page: availability across devices, fast dictation speeds, private/secure processing (SOC 2 / GDPR / HIPAA mentions), no-training default.

### What's New (changelog)
- Subscribe-by-email header; version-tagged entries (e.g., Android v1.27.x, Windows v1.5.x, Mac v2.x); entries cover features (improved dictionary, two-word snippets, universal voice commands, reminder agent, Clips sharing, Notetaker/MCP, "Tux" agent, WhatsApp share) and fixes (crash fixes, latency, ARM64 CPU, audio pipeline).

### Docs / Help center
- Pylon-hosted; collections listed above; articles incl. Command Mode, keyboard/mouse shortcut customization, iOS Shortcuts setup, account management, login troubleshooting.

## 3. UX patterns worth noting
- Single primary conversion goal (download) repeated top and bottom; nav kept minimal on marketing pages.
- Live before/after demo in hero — showing the transformation is the whole pitch.
- Heavy FAQ accordion on home and pricing (objection handling inline).
- Monthly/annual toggle on pricing; per-seat framing for team tiers.
- Programmatic SEO at scale: persona pages × 60, app pages × 50, notetaker SEO × 140, comparison pages, glossary/how-to pages — each with the same template.
- Trust band pattern: compliance badges (SOC 2, ISO 27001, HIPAA) + "data never sold" statement near the bottom before pricing.
- Changelog as public trust/retention surface with email capture.
- Status page + bug bounty + trust center for enterprise evaluation.

## 4. Positioning themes (paraphrased)
1. **Speed vs. typing** — dictation measured at multiples of typing speed.
2. **"Everywhere"** — one tool for any text field on any device, no integrations/plugins needed.
3. **AI polish, not raw transcription** — cleanup of natural speech as the core differentiator vs. OS dictation.
4. **Personalization** — learns your vocabulary, adapts tone and formatting per app/context.
5. **Developer/AI-tool niche** — dedicated "vibe coding" positioning for dictating prompts and code.
6. **Trust/privacy** — compliance certifications, no data selling, training opt-out (enterprise: always off).
7. **Team/enterprise motion** — SSO/SCIM/MDM, admin controls, shared assets, HIPAA.

## 5. CTA structure
- Primary everywhere: **Download for free** → `/get-started` (platform auto-detect).
- Secondary: web demo, Notetaker trial, pricing link.
- Enterprise: "Talk to sales" → `/talk-to-sales`.
- Email capture: changelog subscription; blog subscription.
- Footer CTAs: help center, support.

## 6. Download / installer URLs (links only, for reference)
- Onboarding router: https://wisprflow.ai/get-started
- Downloads page: https://wisprflow.ai/downloads
- Windows installer (direct, observed in page source): https://wispr-packages.s3.us-west-2.amazonaws.com/wispr-flow/win32/x64/Wispr+Flow+Setup.exe
- Mobile attribution link: https://wisprflow.onelink.me/PguH/lw5h199m (AppsFlyer OneLink → app stores)
- macOS/iOS/Android installers not exposed as direct URLs in HTML; routed via `/get-started` and OneLink.

## 7. Tech hints (site, not product)
- **Site builder**: Webflow (generator meta, `data-wf-page`, `w-mod` classes; assets on `cdn.prod.website-files.com`).
- **Animation**: Rive (unpkg `@rive-app/webgl2@2.25.6`).
- **Analytics**: PostHog (many references) + Google gtag; AppsFlyer OneLink for mobile attribution.
- **Support**: Intercom widget (`intercom-iris`); docs on Pylon (`assets.usepylon.com`); status page.
- **Hosting of binaries**: AWS S3 (`wispr-packages.s3.us-west-2.amazonaws.com`).
- **Desktop app**: Electron-based per third-party reviews (RAM/CPU complaints); macOS, Windows, plus iOS/Android native apps.
- FAQ accordion appears to be JS-templated (template placeholders visible in static HTML).

## 8. Outside perspective (reviews/competitors)
- Reviewers confirm accuracy and speed praise; main criticisms: **Electron resource usage** (idle RAM/CPU), **cloud-only processing** (privacy), subscription fatigue.
- vs. Superwhisper: Superwhisper is local/offline w/ model choice and a lifetime price; Wispr Flow wins on polish/speed; cloud vs. local is the key axis. (Sources: reddit r/superwhisper comparison, superwhisper.com/vs/wispr-flow, lumevoice.com, spokenly.app comparisons)
- Review sources: efficient.app, eesel.ai, zackproser.com (184 wpm measured), medium cancel-story (RAM), letterly.app (privacy/idle CPU), spokenly.app (pricing).

### Implications for OpenWispr site IA
- Minimum viable site: Home (hero + demo + features + trust + pricing teaser + FAQ) / Features / Pricing / Download / Docs / Changelog — mirrors their funnel.
- Their moat pages (personas, notetaker SEO) are programmatic growth, not product; defer.
- Differentiation wedge for us: local-first/offline processing + open source — directly attacks their most-cited weaknesses (privacy, resource usage, subscription).
