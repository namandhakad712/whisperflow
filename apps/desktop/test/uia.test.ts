import { describe, expect, it } from "vitest";
import { parseFocusedElementOutput } from "../src/main/system/uia";

describe("parseFocusedElementOutput", () => {
  it("parses an editable text box", () => {
    const info = parseFocusedElementOutput(
      ["NAME=Message", "CLASS=Edit", "CTRL=ControlType.Edit", "VALUE=hello world", "READONLY=False"].join("\n"),
    );
    expect(info?.value).toBe("hello world");
    expect(info?.isEditable).toBe(true);
    expect(info?.isUrl).toBe(false);
    expect(info?.controlType).toBe("ControlType.Edit");
  });

  it("treats a readonly box as not editable", () => {
    const info = parseFocusedElementOutput(
      ["NAME=Body", "CTRL=ControlType.Edit", "VALUE=fixed", "READONLY=True"].join("\n"),
    );
    expect(info?.isEditable).toBe(false);
  });

  it("reads the page URL out of a focused browser document", () => {
    const info = parseFocusedElementOutput(
      ["NAME=Telegram Web", "CTRL=ControlType.Document", "VALUE=https://web.telegram.org/k/", "READONLY=False"].join(
        "\n",
      ),
    );
    expect(info?.isUrl).toBe(true);
    expect(info?.value).toBe("https://web.telegram.org/k/");
    // contentEditable documents are writable targets
    expect(info?.isEditable).toBe(true);
  });

  it("survives newlines escaped by the probe", () => {
    const info = parseFocusedElementOutput(
      ["CTRL=ControlType.Edit", "VALUE=line one\\nline two", "READONLY=False"].join("\n"),
    );
    expect(info?.value).toBe("line one\nline two");
  });

  it("returns null for failure markers", () => {
    expect(parseFocusedElementOutput("NO_FOCUS")).toBeNull();
    expect(parseFocusedElementOutput("ERR Object reference")).toBeNull();
    expect(parseFocusedElementOutput("")).toBeNull();
    expect(parseFocusedElementOutput("NO_VALUE")).not.toBeNull(); // still an element, just no value pattern
  });
});
