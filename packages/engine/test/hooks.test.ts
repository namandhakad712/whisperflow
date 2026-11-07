import { describe, expect, it, vi } from "vitest";
import { runHooks } from "../src/hooks/runHooks.js";
import type { DictationResult } from "../src/orchestrator/DictationSession.js";
import type { HookItem } from "@whisperflow/shared";

function item(partial: Partial<HookItem>): HookItem {
  return {
    id: "h1",
    name: "test",
    event: "dictation",
    kind: "command",
    target: "cat",
    enabled: true,
    ...partial,
  };
}

const result: DictationResult = { raw: "hello world", final: "hello world" };

describe("runHooks", () => {
  it("spawns a command with the transcript on STDIN (never in argv)", async () => {
    let written = "";
    const child = {
      stdin: {
        write(chunk: string) {
          written += chunk;
          return true;
        },
        end() {},
      },
      on(event: string, handler: () => void) {
        if (event === "close") handler();
        return child;
      },
    };
    const spawnFn = vi.fn(() => child);
    await runHooks([item({ kind: "command", target: "tee /tmp/out.txt" })], result, {
      spawnFn: spawnFn as never,
    });
    expect(spawnFn).toHaveBeenCalledWith("tee", ["/tmp/out.txt"], expect.anything());
    expect(written).toBe("hello world");
  });

  it("posts webhooks with the documented body", async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    await runHooks([item({ kind: "webhook", target: "https://example.test/hook" })], result, {
      fetch: fetch as never,
    });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://example.test/hook");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.app).toBe("WhisperFlow");
    expect(body.event).toBe("dictation");
    expect(body.text).toBe("hello world");
    expect(typeof body.timestamp).toBe("number");
  });

  it("skips disabled hooks and empty final text", async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    await runHooks(
      [item({ enabled: false, kind: "webhook" }), item({ kind: "webhook" })],
      { raw: "", final: "" },
      { fetch: fetch as never },
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never throws — a failing webhook only logs", async () => {
    const logger = vi.fn();
    const fetch = vi.fn(() => Promise.reject(new Error("network down")));
    await expect(
      runHooks([item({ kind: "webhook" })], result, { fetch: fetch as never, logger }),
    ).resolves.toBeUndefined();
    expect(logger).toHaveBeenCalled();
  });
});