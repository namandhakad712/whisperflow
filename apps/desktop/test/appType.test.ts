import { describe, expect, it } from "vitest";
import {
  AI_PROCESS_NAMES,
  AppType,
  classifyMeeting,
  EMAIL_PROCESS_NAMES,
  getAppType,
  isMessagingApp,
  isTerminalApp,
  MeetingPlatform,
  TERMINAL_PROCESS_NAMES,
} from "../src/main/system/appType";

describe("getAppType (reference app's classifier)", () => {
  it("classifies email clients by process name", () => {
    expect(getAppType("OUTLOOK")).toBe(AppType.Email);
    expect(getAppType("mail")).toBe(AppType.Email);
    expect(getAppType("thunderbird")).toBe(AppType.Email);
  });

  it("classifies web mail by url/host match", () => {
    expect(getAppType("chrome", "Mail - someone@mail.google.com")).toBe(AppType.Email);
    expect(getAppType("msedge", "outlook.live.com")).toBe(AppType.Email);
  });

  it("classifies AI apps ahead of email (their match order)", () => {
    expect(getAppType("cursor")).toBe(AppType.AI);
    expect(getAppType("chatgpt")).toBe(AppType.AI);
    expect(getAppType("firefox", "chatgpt.com")).toBe(AppType.AI);
    // their list literally contains "wispr flow" (their own app); note the spelling
    expect(getAppType("wispr flow")).toBe(AppType.AI);
    expect(getAppType("whisper flow")).toBe(AppType.Other);
  });

  it("falls back to other", () => {
    expect(getAppType("notepad")).toBe(AppType.Other);
    expect(getAppType("WINWORD")).toBe(AppType.Other);
  });

  it("keeps the exported lists verbatim from the reference build", () => {
    expect(EMAIL_PROCESS_NAMES).toContain("kiwi for gmail");
    expect(EMAIL_PROCESS_NAMES).toContain("notion mail");
    expect(AI_PROCESS_NAMES).toContain("notebooklm");
    expect(TERMINAL_PROCESS_NAMES).toContain("windowsterminal");
    expect(AI_PROCESS_NAMES).toHaveLength(16);
    expect(TERMINAL_PROCESS_NAMES).toHaveLength(9);
  });
});

describe("terminal / messaging predicates", () => {
  it("flags terminals for the instruct-mode gate", () => {
    expect(isTerminalApp("WindowsTerminal")).toBe(true);
    expect(isTerminalApp("pwsh")).toBe(true);
    expect(isTerminalApp("Code")).toBe(false);
  });

  it("flags chat clients", () => {
    expect(isMessagingApp("slack")).toBe(true);
    expect(isMessagingApp("Telegram")).toBe(true);
    // their list spells it "msteams" — no hyphen
    expect(isMessagingApp("msteams")).toBe(true);
    expect(isMessagingApp("ms-teams")).toBe(false);
    expect(isMessagingApp("notepad")).toBe(false);
  });
});

describe("classifyMeeting", () => {
  it("detects native meeting clients", () => {
    expect(classifyMeeting("zoom.exe")).toBe(MeetingPlatform.Zoom);
    expect(classifyMeeting("ms-teams")).toBe(MeetingPlatform.Teams);
    expect(classifyMeeting("webex")).toBe(MeetingPlatform.Webex);
    expect(classifyMeeting("discord")).toBe(MeetingPlatform.Discord);
  });

  it("detects browser meetings from the window title", () => {
    expect(classifyMeeting("chrome", "Weekly sync - Google Meet")).toBe(MeetingPlatform.Meet);
    expect(classifyMeeting("chrome", "abc-defg-hij - Meet")).toBe(MeetingPlatform.Meet);
    expect(classifyMeeting("firefox", "Design review — Zoom")).toBe(MeetingPlatform.Zoom);
    expect(classifyMeeting("msedge", "Standup | Microsoft Teams")).toBe(MeetingPlatform.Teams);
    expect(classifyMeeting("slack")).toBe(MeetingPlatform.Slack);
  });

  it("returns null for ordinary apps", () => {
    expect(classifyMeeting("notepad")).toBeNull();
    expect(classifyMeeting("OUTLOOK", "Inbox - Outlook")).toBeNull();
  });
});
