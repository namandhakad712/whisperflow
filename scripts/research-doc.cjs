/* Competitive research report: Wispr Flow vs Hex vs WhisperFlow.
 * docx skill: R7 Swiss Tech cover (ST-1), Profile A formal fonts,
 * 3 sections (cover / TOC roman / body arabic), TOC + refresh hint,
 * tables with tableHeader+cantSplit, charts embedded aspect-true. */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  TableLayoutType, VerticalAlign, TableOfContents, SectionType,
} = require("docx");
const fs = require("fs");
const { imageSize: sizeOf } = require("image-size");

const ASSETS = "/home/z/my-project/download/research-assets";
const OUT = "/home/z/my-project/download/WhisperFlow-Competitive-Research-WisprFlow-Hex.docx";

/* ── ST-1 palette (design-system.md) ─────────────────────────── */
const P = {
  bg: "E2E8F0", primary: "0F172A", accent: "0042E6",
  cover: { titleColor: "0F172A", subtitleColor: "475569", metaColor: "475569", footerColor: "475569" },
  table: { headerBg: "475569", headerText: "FFFFFF", accentLine: "0042E6", innerLine: "CBD5E1", surface: "F1F5F9" },
};
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

/* ── cover layout helpers (design-system.md, verbatim logic) ── */
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."，。、；：！？", ..."的与和及之在于为", ..."-_—–·/", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = Math.min(charsPerLine, remaining.length);
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

/* ── R7 cover (decorations.md buildCoverR7, adapted) ────────── */
function buildCoverR7(config) {
  const C = P.cover;
  const padL = 600;
  const availW = 11906 - padL - 600;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availW, 36, 24);
  const titleSize = titlePt * 2;
  const lineH = Math.ceil(titlePt * 23);
  const topSpacer = titleLines.length <= 2 ? 1200 : 800;
  const subtitleSpacer = titleLines.length <= 2 ? 1400 : 800;
  const infoSpacer = titleLines.length <= 2 ? 2200 : 1200;
  const children = [];

  children.push(new Paragraph({
    spacing: { before: 600 },
    indent: { left: padL },
    children: [new TextRun({ text: "\uFF0B", size: 40, bold: true, color: C.titleColor,
      font: { ascii: "Arial", eastAsia: "SimHei" } })],
  }));
  children.push(new Paragraph({ spacing: { before: topSpacer } }));

  titleLines.forEach((line, i) => {
    const isLast = i === titleLines.length - 1;
    const runs = [new TextRun({ text: line, size: titleSize, color: C.titleColor,
      font: { ascii: "Arial", eastAsia: "Noto Sans SC" } })];
    if (isLast) runs.push(new TextRun({ text: " \u25A0", size: 24, color: P.accent, font: { ascii: "Arial" } }));
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: isLast ? 200 : 80, line: lineH, lineRule: "atLeast" },
      children: runs,
    }));
  });

  children.push(new Paragraph({ spacing: { before: subtitleSpacer } }));
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: 3800, right: 600 },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.titleColor, space: 14 } },
      spacing: { after: 200 },
      children: [new TextRun({ text: config.subtitle, size: 26, color: C.subtitleColor,
        font: { ascii: "Arial", eastAsia: "Noto Sans SC" }, characterSpacing: 40 })],
    }));
  }
  children.push(new Paragraph({
    spacing: { before: 600 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "C8D0DC", space: 0 } },
  }));
  children.push(new Paragraph({ spacing: { before: infoSpacer } }));

  const metaEntries = [
    { label: "PROJECT", value: "WhisperFlow — the printed signal" },
    { label: "SCOPE", value: "Wispr Flow · Hex · WhisperFlow" },
    { label: "SESSION", value: "Competitive research, v0.1.53 baseline" },
    { label: "DATE & EDITION", value: "2026-11-24 · Edition 1" },
  ];
  for (const entry of metaEntries) {
    children.push(new Paragraph({
      alignment: AlignmentType.RIGHT, indent: { right: 800 },
      border: { right: { style: BorderStyle.SINGLE, size: 12, color: P.accent, space: 16 } },
      spacing: { after: 20 },
      children: [new TextRun({ text: entry.label, size: 14, color: C.metaColor,
        font: { ascii: "Arial" }, characterSpacing: 20 })],
    }));
    children.push(new Paragraph({
      alignment: AlignmentType.RIGHT, indent: { right: 800 },
      border: { right: { style: BorderStyle.SINGLE, size: 12, color: P.accent, space: 16 } },
      spacing: { after: 280 },
      children: [new TextRun({ text: entry.value, size: 22, bold: true, color: C.titleColor,
        font: { ascii: "Arial", eastAsia: "Noto Sans SC" } })],
    }));
  }
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg },
        borders: noBorders, verticalAlign: VerticalAlign.TOP, children,
      })],
    })],
  })];
}

/* ── body helpers ──────────────────────────────────────────── */
const F = { ascii: "Times New Roman", eastAsia: "SimHei" };
const FB = { ascii: "Times New Roman", eastAsia: "SimSun" };

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary, font: F })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.primary, font: F })] });
}
function para(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: "000000", font: FB, ...opts })],
  });
}
function paraRuns(runs) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: 120 },
    children: runs.map(r => new TextRun({ size: 24, color: "000000", font: FB, ...r })),
  });
}
function bullet(text) {
  return new Paragraph({ bullet: { level: 0 }, alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: "000000", font: FB })] });
}
function chartPara(pngPath, displayWidth, captionText) {
  const buf = fs.readFileSync(pngPath);
  const dim = sizeOf(buf);
  const h = Math.round(displayWidth * dim.height / dim.width);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 60 },
      keepNext: true,
      children: [new ImageRun({ data: buf, transformation: { width: displayWidth, height: h }, type: "png" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
      children: [new TextRun({ text: captionText, italics: true, size: 21, color: "475569", font: FB })] }),
  ];
}
function gapTable(headers, rows, colWidths) {
  const mkCell = (text, isHeader, w) => new TableCell({
    children: [new Paragraph({
      alignment: AlignmentType.LEFT, spacing: { line: 280 },
      children: [new TextRun({ text, size: isHeader ? 21 : 21, bold: isHeader,
        color: isHeader ? P.table.headerText : "000000", font: FB })],
    })],
    shading: { type: ShadingType.CLEAR, fill: isHeader ? P.table.headerBg : "FFFFFF" },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    width: { size: w, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
    },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true,
        children: headers.map((t, i) => mkCell(t, true, colWidths[i])) }),
      ...rows.map(r => new TableRow({ cantSplit: true,
        children: r.map((t, i) => mkCell(t, false, colWidths[i])) })),
    ],
  });
}
function tableTitle(text) {
  return new Paragraph({ keepNext: true, spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 21, color: P.primary, font: F })] });
}

/* ── body content ───────────────────────────────────────────── */
const body = [];

body.push(h1("1. Executive Summary"));
body.push(para("This report maps the two most instructive competitors in the desktop voice-dictation space — Wispr Flow and Hex — against WhisperFlow at its v0.1.53 baseline, and recommends where the engine should go next. The two competitors embody opposite bets on the same product idea. Wispr Flow is the cloud-native polish machine: a managed pipeline of proprietary speech models plus fine-tuned Llama cleanup running on dedicated Baseten/AWS deployments, delivering clean, context-aware text in under 700 ms at p99, in 100-plus languages, on four platforms. Hex is the local-first maximalist: a free, MIT-licensed, Rust-native app for macOS, Windows and Linux that runs a zoo of twelve selectable local ASR models on your own machine and pastes the result where your cursor is."));
body.push(para("WhisperFlow already sits in a defensible third position: local-first like Hex, with an optional local LLM polish step like Wispr Flow's cleanup — but wrapped in a crafted interface (the printed signal brand, the halftone engine, the press-kit console) that neither competitor attempts. The strategic read of this research: do not chase Wispr Flow's cloud scale or Hex's model-zoo breadth head-on. Instead, close the four gaps that actually matter to users — streaming transcription, per-app output shaping, vocabulary biasing, and visible latency budgeting — and keep the privacy story that neither Wispr Flow's cloud pipeline nor Hex's raw transcripts can fully claim."));
body.push(para("The best-model-selection analysis (section 6) recommends a concrete engine roadmap: adopt Parakeet-style streaming ASR when a runtime is available, keep whisper.cpp large-v3-turbo as the accuracy anchor, bias it with vocabulary lists, and route polish through the existing local qwen3 tier so the whole pipeline stays on-device with an honest, measured latency budget."));

body.push(h1("2. Background & Objectives"));
body.push(para("WhisperFlow v0.1.53 ships a working local dictation app: whisper.cpp STT (base-en, small, large-v3-turbo variants), a local qwen3 polish tier with cloud fallback, edit-learning from corrections, a searchable history with the halftone DayStrip, and the press-kit console. The question this session set out to answer is what the two most successful products in the category chose to build instead, and which of their choices are worth adopting."));
body.push(para("Sources used: Wispr Flow's product and pricing pages (wisprflow.ai), its features page detailing dictation behavior (backtrack, filler removal, numbered lists, auto punctuation), its CTO's engineering notes on the Baseten infrastructure case study and the 'Why supporting 100 languages is hard' research post; Hex's landing page (anoma.ly/hex), its GitHub README and docs (8.5k stars, MIT), and the Mac AI Apps directory listing. All figures in this report come from those pages as retrieved on 2026-11-24; where an estimate was needed (the latency chart), it is labeled as an estimate."));

body.push(h1("3. The Competitors"));
body.push(h2("3.1 Wispr Flow — the cloud polish machine"));
body.push(para("Wispr Flow (San Francisco, Wispr Flow AI) sells voice-to-text that 'turns your thoughts into clear, polished text in any app or website'. The product runs on Mac, Windows, iPhone and Android, with voice sync across devices. Its differentiators cluster in three groups:"));
body.push(bullet("Speech layer: works in any app with a text field (Notion, Gmail, WhatsApp, Cursor…), 100+ languages, and it literally works while whispering — an explicit quiet-space feature."));
body.push(bullet("Refinement layer: cleanup while you speak — filler-word removal, automatic punctuation from pauses and tone, spoken punctuation marks, numbered-list formatting from spoken enumeration, and Backtrack: say 'Let's meet at 2… actually 3' and the corrected text lands instantly. This is the signature feature."));
body.push(bullet("Personalization layer: a dictionary that learns your corrections, industry terms added manually, voice snippets ('create a shortcut for things you say often'), and style adaptation — the CTO's framing: 'I write differently when texting my mom, my wife, and my colleagues.'"));
body.push(para("The engineering story is documented in the Baseten case study. The pipeline: speech recognition models feed fine-tuned Llama LLMs (Meta's open family) that structure, format and contextualize the transcript in real time — 'it can't just capture what the user says, it has to capture what the user means'. Latency is engineered to a p99 end-to-end budget under 700 milliseconds — 'we don't care at all about p50; we're optimizing the p99 experience for the p99 user' — which requires the Llama stage to generate 100+ tokens in under 250 ms, achieved with TensorRT-LLM on dedicated AWS deployments orchestrated through Baseten's Chains framework. Team and enterprise plans add SSO, HIPAA with BAA, SCIM provisioning, audit logs and admin control over model training. Free tier: dictation in any app, 100+ languages, dictionary and snippets, 30-day meeting history on desktop. Pro: $12/user/mo annual ($15 monthly) adding unlimited dictations and history, shared team dictionary, workspace, analytics. Growth: $23–33/user/mo with SSO and HIPAA. Enterprise: custom."));
body.push(para("The language scale-up is its own research program — the CTO's post details why 100 languages is hard: Spanish drops letters and runs 20% wordier than English; Italian needs intonation to separate question from statement; French needs pre-punctuation spaces; German uses different quote marks; and roughly half of users mix more than one language in daily speech, which breaks naive per-language routing. Their answer is per-language conventions handled by the pipeline, not just raw multilingual ASR."));
body.push(h2("3.2 Hex — the local-first maximalist"));
body.push(para("Hex (Anomaly Innovations, MIT-licensed, 8.5k GitHub stars, 576 forks) is local voice dictation for Mac, Windows, Linux, iOS and Android. The landing page pitch is one sentence: 'Hold Option, say what you mean, and Hex pastes it where you are.' Nothing leaves the machine after the first model download. Its differentiators:"));
body.push(bullet("Model zoo: the settings picker offers Parakeet v3 (25 European languages, auto-detects which you speak), Cohere Transcribe (fewest wrong words, 14 languages), Whisper large-v3-turbo, Qwen3-ASR 0.6B (Chinese + 29 more), SenseVoice Small, Nemotron 3.5 ASR (streaming, 27 languages), Granite Speech 5.0, plus one-language models (ivrit.ai Hebrew, GigaAM v3 Russian, KB-Whisper Swedish…) and the ability to add your own GGUF model file. Default on English: Parakeet, which writes while you talk so text is ready when you let go."));
body.push(bullet("Output pipeline: every dictation runs through steps you choose — word replacements, built-in cleanups, your own scripts, an optional OpenCode LLM rewrite — and the steps can differ per app or website. This is the per-app context idea, done locally."));
body.push(bullet("Vocabulary: one list of names Hex should know; Whisper and Qwen3-ASR read it during transcription (biasing at decode time), Parakeet via a Labs toggle, and the OpenCode rewrite uses it too."));
body.push(bullet("Ecosystem extras: annotate-with-screen-recording while you draw and talk; an authenticated local API and TypeScript SDK so your own tools can transcribe with the same model; a macOS Meetings lab; a real CLI (`hex transcribe meeting.m4a`); 7-day searchable history by default; replay-last-dictation hotkey; double-tap to lock recording."));
body.push(para("Privacy is absolute on mobile per its policy: 'no account, no analytics, no advertising, no tracking… Nothing you dictate or type is ever sent anywhere.' Development is agent-run — the README notes they take no pull requests and their agents turn issues around fast, with a QuickJS-embedded config system for latency-sensitive scripting."));

body.push(h1("4. Feature-Gap Matrix"));
body.push(para("The matrix scores each capability across the three products. Hex language coverage is approximate (its model zoo spans many languages per-model); WhisperFlow scores reflect v0.1.53. The chart that follows visualizes the same six headline capabilities."));
body.push(tableTitle("Table 1 — Capability matrix (✓ full · ◐ partial · ✗ absent)"));
body.push(gapTable(
  ["Capability", "Wispr Flow", "Hex", "WhisperFlow v0.1.53"],
  [
    ["Works in any app (cursor paste)", "✓", "✓", "✓"],
    ["Transcript cleanup / reformat", "✓ cloud Llama", "✓ local, optional LLM", "✓ local qwen3 tier"],
    ["Filler removal + auto punctuation", "✓", "✓ (cleanup steps)", "✓ polish prompt"],
    ["Backtrack mid-speech corrections", "✓", "✗", "✗"],
    ["Per-app output shaping", "◐ (style adapts)", "✓ (steps per app)", "◐ (per-app config)"],
    ["Vocabulary biasing at decode", "✓ (learns)", "✓ (list, per-model)", "✗ (learning only)"],
    ["Streaming (text while you speak)", "◐ (fast pipeline)", "✓ (Parakeet default)", "✗"],
    ["Language count", "100+", "≈12 models, multi-lang", "whisper multilingual"],
    ["Local-only / offline", "✗ (cloud)", "✓", "✓"],
    ["History search + visual", "✓", "✓ (7-day)", "✓ DayStrip (day/week/month)"],
    ["Mobile apps", "✓ iOS/Android", "✓ iOS/Android preview", "✗"],
    ["Meeting capture / notetaker", "✓ (Notetaker)", "◐ (macOS lab)", "✗"],
    ["Local API / SDK for tools", "✗", "✓ TS SDK + CLI", "✗"],
    ["Price", "Free tier; Pro $12–15/mo", "Free, MIT", "Free, open dev"],
    ["Brand / interface craft", "Polished SaaS", "Minimal utility", "✓ printed signal"],
  ],
  [28, 24, 24, 24]
));
body.push(...chartPara(`${ASSETS}/chart1-coverage.png`, 560, "Figure 1 — Capability coverage across the six headline dimensions."));

body.push(h1("5. Architecture & Latency"));
body.push(para("The two competitors optimize opposite ends of the same pipeline. Wispr Flow's stages run in the cloud with a published p99 budget under 700 ms end-to-end, of which the Llama cleanup stage alone must generate 100+ tokens in under 250 ms on TensorRT-LLM hardware. Hex runs everything on-device; its default Parakeet model streams text while you speak, so perceived latency is near-zero even though total decode time is longer. WhisperFlow's whisper.cpp decode is batch-at-end, then a local qwen3 polish pass — the slowest perceived path of the three, and the clearest engineering gap: streaming is the single most user-visible missing capability."));
body.push(...chartPara(`${ASSETS}/chart2-latency.png`, 560, "Figure 2 — Latency budget per stage. Wispr Flow's cloud budget is published (p99 < 700 ms); Hex and WhisperFlow stages are estimates from public architecture notes and local whisper.cpp behavior, not measured benchmarks."));
body.push(para("Two structural differences matter as much as latency. First, decode-time vocabulary biasing: Hex passes its vocabulary list into Whisper and Qwen3-ASR decoding, so names come out right without a cleanup pass; WhisperFlow learns from edits after the fact — slower to converge on the same result. Second, the output pipeline: Hex's chain of user-scriptable steps per app is the local-first equivalent of Wispr Flow's per-context style adaptation, and it is the most copyable idea in either product — it slots directly into WhisperFlow's existing per-app config surface."));

body.push(h1("6. Best-Model Selection — Recommendation"));
body.push(para("The engine question for WhisperFlow is which ASR models to offer and in what role, given the constraint set: local-first by principle, Windows-first by user base, latency-sensitive by product genre, and polish-capable through the existing qwen3 tier. The evidence from both competitors converges on a three-role model strategy rather than a single-model bet."));
body.push(...chartPara(`${ASSETS}/chart3-models.png`, 520, "Figure 3 — Selectable local ASR models per product. Wispr Flow's stack is closed/proprietary; breadth here is a Hex feature."));
body.push(tableTitle("Table 2 — Recommended model roles for the WhisperFlow engine"));
body.push(gapTable(
  ["Role", "Model today / candidate", "Why this role", "Priority"],
  [
    ["Accuracy anchor", "whisper.cpp large-v3-turbo (q5_0)", "Best multilingual accuracy per byte; Hex ships the same model as its any-language fallback. Keep as the quality ceiling and offline default on capable hardware.", "Keep"],
    ["Fast lane / streaming", "Parakeet-style streaming ASR (TDT-style)", "Hex's default writes while you talk — the perceived-latency winner. Requires a local streaming runtime on Windows; until one is proven, use Web Speech interim text as the streaming preview layer, labeled honestly as a browser service.", "High"],
    ["Decode biasing", "Vocabulary → whisper.cpp initial-prompt / GGML context", "Hex proves biasing works locally (Whisper/Qwen read the list at decode). WhisperFlow has the learning data already; feed learned names into the prompt instead of waiting for corrections.", "High"],
    ["Polish LLM", "qwen3.5-4b-q4 local tier (current)", "Wispr Flow validates the LLM-cleanup architecture itself (their Llama fine-tune). Keep local qwen3 as the privacy-preserving equivalent; cloud fallback stays optional.", "Keep"],
    ["Long-tail languages", "Qwen3-ASR 0.6B / SenseVoice small", "Only if CJK users ask; the whisper multilingual set already covers most needs. Don't chase 100 languages — Wispr Flow's own research post shows how expensive per-language correctness is.", "Low"],
  ],
  [16, 26, 42, 16]
));
body.push(para("The selection logic, in order: (1) keep whisper.cpp large-v3-turbo — both competitors effectively agree Whisper remains the local accuracy ceiling for arbitrary language, and Hex's Cohere/Parakeet choices confirm faster-but-narrower models trade accuracy for speed. (2) Add a streaming perception layer now — even before a local streaming runtime, showing Web Speech interim text while whisper.cpp runs the authoritative pass gives the Wispr-Flow-felt experience without lying about which model produced the final text; the brand's honesty rule (simulations labeled as simulations) applies here. (3) Wire vocabulary into decode — it is the cheapest accuracy win on the board: WhisperFlow already observes corrections through edit-learning, and initial-prompt biasing is a whisper.cpp feature, not a new dependency. (4) Keep qwen3 local polish — the Baseten case study is the strongest external validation that LLM cleanup is the right architecture; WhisperFlow's local version is the differentiator Wispr Flow cannot follow without giving up its cloud pipeline."));

body.push(h1("7. Findings & Recommendations"));
body.push(h2("7.1 What to adopt"));
body.push(bullet("Streaming perception (P0): interim text while the authoritative decode runs. The single biggest felt-latency gap versus both competitors; the veil/tray UI already has the right surface for it."));
body.push(bullet("Vocabulary biasing at decode (P0): feed learned names into whisper.cpp's initial prompt. Cheapest accuracy win; Hex demonstrates the pattern works locally."));
body.push(bullet("Output steps pipeline (P1): user-visible chain — word replacements, cleanup passes, optional LLM rewrite — with per-app overrides. Hex's most copyable idea; WhisperFlow's per-app config is the natural home."));
body.push(bullet("Latency budget as a product surface (P1): measure and display the per-stage budget (capture → decode → polish → paste) in the console diagnostics, with honesty about what is measured versus estimated. Wispr Flow's p99 discipline is the cultural lesson: budget for the slow user, not the median."));
body.push(bullet("Local API / SDK (P2): Hex's authenticated local transcribe API and TypeScript SDK turned the app into a platform for users' own tools. WhisperFlow's zero-dependency engine package is one thin HTTP/IPC layer away from the same."));
body.push(h2("7.2 What not to chase"));
body.push(bullet("Cloud pipeline scale: Wispr Flow's 100-language coverage and TensorRT-LLM serving are an infrastructure business. WhisperFlow's differentiator is that it doesn't need one."));
body.push(bullet("Meeting notetaker: both competitors bolt one on; it dilutes the dictation core and drags in consent/privacy complexity."));
body.push(bullet("A 12-model zoo: breadth is Hex's identity, not WhisperFlow's. Three roles (anchor, fast lane, polish) cover the user needs without a settings zoo."));
body.push(h2("7.3 Position"));
body.push(para("Wispr Flow sells polished output and charges for the pipeline; Hex sells sovereignty and gives it away. WhisperFlow's honest position is the crafted third option: local-first like Hex, LLM-polished like Wispr Flow, wrapped in an interface neither invests in — the printed-signal press room. The capability matrix shows WhisperFlow already ties or leads on local-first, history visualization and interface craft; the four adoptions above close every gap that a daily dictation user actually feels. The v0.1.54 queue that follows from this research: streaming interim text, decode-time vocabulary biasing, then the output-steps pipeline."));

/* ── document assembly ─────────────────────────────────────── */
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: { run: { font: F, size: 32, bold: true, color: P.primary },
        paragraph: { spacing: { before: 360, after: 160, line: 312 } } },
      heading2: { run: { font: F, size: 28, bold: true, color: P.primary },
        paragraph: { spacing: { before: 240, after: 120, line: 312 } } },
    },
  },
  sections: [
    { // cover — margin 0, R7 wrapper 16838 exact
      properties: { page: { size: { width: 11906, height: 16838 },
        margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR7({
        title: "Competitive Research: Wispr Flow, Hex & the WhisperFlow Engine",
        subtitle: "best-model selection · feature-gap matrix · architecture & latency",
      }),
    },
    { // TOC — roman numerals
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } },
      },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "475569" })] })] }) },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: F, color: P.primary })] }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({ spacing: { before: 200 },
          children: [new TextRun({
            text: "Note: this Table of Contents is generated via field codes. To refresh page numbers after editing, right-click the TOC and select \"Update Field.\"",
            italics: true, size: 18, color: "888888", font: FB })] }),
      ],
    },
    { // body — arabic, restart at 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "WhisperFlow · Competitive Research · 2026-11-24", size: 16, color: "888888", font: FB })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "475569" })] })] }) },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("wrote", OUT, buf.length, "bytes");
});
