# THE PRESS ROOM — Console v2 design spec (v0.1.48)

Take the free-world grammar (reactbits / canvasui / 21st.dev), speak it in
our print language. Nothing installed; every component authored in-house.

## What the critique said (and we fix all of it)
1. Dead sidebar space → 3-pane layout with a LIVE right rail
2. Half-empty content column → content max-w up, right rail fills it
3. Weak CTA hierarchy → PrintButton ink-fill is unmistakably primary
4. 28px tabs → 40px PillNav tabs with sliding indicator
5. No motion layer → stage cascade + decrypt text + staggered rows everywhere
6. Accent underemployed → spotlight border, focus edge, LED live states
7. Checklist rows not interactive → full-row hover + revisit affordance

## The new components (shared/presskit.tsx + styles)
| Component | Lineage (grammar only) | Our print translation |
|---|---|---|
| PrintButton | reactbits SpecularButton/ShinyText | ink floods the label L→R on hover (a roller pass), specular sweep on focus, press = stamp (scale .97 + ink-bleed shadow) |
| SpotlightCard | reactbits SpotlightCard | cursor-tracking radial ink wash inside hairline frame; corner brackets stay |
| PillNav | canvasui/reactbits PillNav+GooeyNav | 40px pill tabs, sliding accent indicator (layout-measured), sticky under page head |
| FieldFX | canvasui Asciify/DecryptReveal | input placeholder decrypts on focus; value text gets a one-shot glyph settle |
| AnimatedRows | reactbits AnimatedList | staggered 40ms slide+settle on route stage; exit = fold up |
| CountUp | reactbits CountUp | odometer digits for stats (Insights/About), mono, settles with ink-bleed |
| DecryptText | reactbits DecryptedText | page H1 + rail channel numbers scramble→settle per route change (already have Scramble; generalize) |
| AuroraField | reactbits Aurora/SoftAurora | settings main bg: TWO-ink aurora — slow accent-tinted wash behind the content, 4% opacity, dithered |
| DotGrid | reactbits DotGrid | right-rail bg: dot grid whose dots GROW near the cursor (radar feel) |
| Magnetic | reactbits Magnetic | rail items + primary CTAs lean 2px toward cursor |
| Meter | ours | live mic level, halftone bars (ties to Engine G) |

## Layout — "the press room" (3 panes)
```
┌──────────────────────────────────────────────────────────────┐
│ topbar: nameplate · decrypt search (⌘K) · theme press cycle  │
├────────┬──────────────────────────────────┬───────────────────┤
│ rail   │ content (max-w-3xl)              │ LIVE rail (260px) │
│ 216px  │  PillNav sticky                  │  ┌ mic meter ┐    │
│ +mag   │  PageHeader (H1 decrypt)         │  ├ engine ──┤    │
│ +channel#s                                    │  ├ model ───┤    │
│         │  cards: SpotlightCard cascade    │  ├ hotkey ──┤    │
│         │  rows: AnimatedRows              │  └ today ───┘    │
│ footer │                                  │  + quick actions │
└────────┴──────────────────────────────────┴───────────────────┘
```
- Right rail is HIDDEN < 1100px (responsive), content breathes instead
- Rail: magnetic hover, channel numbers, footer with version + theme dot
- Content: sticky PillNav, cards cascade in, H1 decrypts per route

## Motion (MOTION.md dialect)
- stage cascade: 40ms stagger, translateY 8px→0, opacity, 320ms expo-out
- decrypt: 600ms, charset "·:∑#@" stays print
- ink flood: 260ms L→R on hover via background-size
- spotlight: 500ms ease-out radial follow (rAF, no re-render)
- reduced-motion: all FX off, static settle

## Discipline (unchanged)
- 6 themes all still work (tokens drive everything)
- accent ≤10% of area; luminance hierarchy; zero borrowed values
- origin-check must pass (no #1a1a1a/#30302f/#10b981)
