import { describe, expect, test } from "vitest";
import {
  alignPromptEchoPair,
  buildPromptEchoMatcher,
  extractConversationIdFromUrl,
} from "../../src/browser/reattachHelpers.ts";

describe("alignPromptEchoPair", () => {
  test("rejects transient WEB conversation URLs", () => {
    expect(extractConversationIdFromUrl("https://chatgpt.com/c/WEB:temporary-id")).toBeUndefined();
    expect(
      extractConversationIdFromUrl("https://chatgpt.com/c/6a5f70c1-17b8-83ec-8436-276c875dc5a3"),
    ).toBe("6a5f70c1-17b8-83ec-8436-276c875dc5a3");
  });

  test("aligns answer text when text is a prompt echo", () => {
    const matcher = buildPromptEchoMatcher("Echo prompt");
    expect(matcher).not.toBeNull();
    const result = alignPromptEchoPair("Echo prompt", "Real answer", matcher);
    expect(result.answerText).toBe("Real answer");
    expect(result.answerMarkdown).toBe("Real answer");
    expect(result.isEcho).toBe(false);
  });

  test("aligns answer markdown when markdown is a prompt echo", () => {
    const matcher = buildPromptEchoMatcher("Echo prompt");
    expect(matcher).not.toBeNull();
    const result = alignPromptEchoPair("Real answer", "Echo prompt", matcher);
    expect(result.answerText).toBe("Real answer");
    expect(result.answerMarkdown).toBe("Real answer");
    expect(result.isEcho).toBe(false);
  });

  test("keeps echo flag when both text and markdown are prompt echoes", () => {
    const matcher = buildPromptEchoMatcher("Echo prompt");
    expect(matcher).not.toBeNull();
    const result = alignPromptEchoPair("Echo prompt", "Echo prompt", matcher);
    expect(result.isEcho).toBe(true);
  });
});
