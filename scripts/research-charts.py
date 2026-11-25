"""Charts for the Wispr Flow vs Hex vs WhisperFlow competitive report.
ST-1 Swiss Tech palette accent #0042E6, per docx skill chart templates."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import numpy as np

fm.fontManager.addfont('/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf')
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
plt.rcParams['font.sans-serif'] = ['Noto Sans SC', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

OUT = "/home/z/my-project/download/research-assets"
import os
os.makedirs(OUT, exist_ok=True)

ACCENT = "#0042E6"      # ST-1 Klein blue
SLATE = "#475569"
TEXT = "#0F172A"
GRID = "#E0E0E0"

def style(ax):
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", alpha=0.3, color=GRID)
    ax.tick_params(colors=TEXT, labelsize=10)

# ── Chart 1: capability coverage grouped bars ──────────────────────
cats = ["Languages", "Cleanup /\nreformat", "Per-app\ncontext", "Local-first", "Price\n(free tier)", "History\nsearch"]
groups = {
    "Wispr Flow": [100, 100, 100, 0, 100, 100],
    "Hex":        [30, 100, 100, 100, 100, 100],
    "WhisperFlow": [20, 100, 60, 100, 100, 100],
}
colors = [ACCENT, SLATE, "#D4875A"]
fig, ax = plt.subplots(figsize=(10, 5.6), constrained_layout=True)
x = np.arange(len(cats))
w = 0.8 / 3
for i, (name, vals) in enumerate(groups.items()):
    off = (i - 1.5 + 0.5) * w
    ax.bar(x + off, vals, w, label=name, color=colors[i], edgecolor="white")
ax.set_xticks(x)
ax.set_xticklabels(cats, fontsize=10)
ax.set_ylabel("capability score (0–100)", fontsize=11)
ax.set_title("Capability coverage — Wispr Flow vs Hex vs WhisperFlow (v0.1.53)",
             fontsize=13, pad=14, color=TEXT)
ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0), frameon=False, fontsize=10)
style(ax)
ax.set_ylim(0, 115)
fig.savefig(f"{OUT}/chart1-coverage.png", dpi=200)
plt.close(fig)

# ── Chart 2: latency budget waterfall-style bars ──────────────────
stages = ["Audio capture\n+ VAD", "STT decode\n(local)", "Polish LLM\n(qwen3 4B)", "Text paste\nto field"]
wisp = [90, 350, 230, 30]      # cloud pipeline, ~700 ms p99 total
hexl = [90, 420, 0, 30]        # local, no LLM by default
wf = [90, 500, 250, 30]        # whisper.cpp + qwen3 polish
labels_pos = np.arange(len(stages))
fig, ax = plt.subplots(figsize=(10, 5.2), constrained_layout=True)
w = 0.8 / 3
for i, (name, vals, col) in enumerate(zip(["Wispr Flow (cloud)", "Hex (local, no LLM)", "WhisperFlow (local)"],
                                           [wisp, hexl, wf], colors)):
    off = (i - 1.5 + 0.5) * w
    bars = ax.bar(labels_pos + off, vals, w, label=name, color=col, edgecolor="white")
    for b, v in zip(bars, vals):
        ax.text(b.get_x() + b.get_width() / 2, v + 12, str(v), ha="center", va="bottom",
                 fontsize=9, color=TEXT)
ax.set_xticks(labels_pos)
ax.set_xticklabels(stages, fontsize=10)
ax.set_ylabel("stage latency (ms, est.)", fontsize=11)
ax.set_title("End-to-end latency budget per stage — estimated from public architecture notes",
             fontsize=13, pad=14, color=TEXT)
ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1.0), frameon=False, fontsize=10)
style(ax)
fig.savefig(f"{OUT}/chart2-latency.png", dpi=200)
plt.close(fig)

# ── Chart 3: model zoo breadth ────────────────────────────────────
names = ["WhisperFlow", "Hex", "Wispr Flow"]
model_counts = [6, 12, "closed"]
fig, ax = plt.subplots(figsize=(8.6, 4.6), constrained_layout=True)
bars = ax.bar(names[:2], model_counts[:2], 0.55, color=[colors[2], colors[1]], edgecolor="white")
for b, v in zip(bars, model_counts[:2]):
    ax.text(b.get_x() + b.get_width() / 2, v + 0.25, str(v), ha="center", fontsize=11, color=TEXT)
ax.set_ylabel("selectable local ASR models", fontsize=11)
ax.set_title("Local ASR model breadth — Hex ships a 12-model zoo; Wispr Flow's is closed",
             fontsize=13, pad=14, color=TEXT)
style(ax)
ax.set_ylim(0, 14)
fig.savefig(f"{OUT}/chart3-models.png", dpi=200)
plt.close(fig)

for f in ["chart1-coverage", "chart2-latency", "chart3-models"]:
    p = f"{OUT}/{f}.png"
    from PIL import Image
    im = Image.open(p)
    print(p, im.size)
print("charts done")
