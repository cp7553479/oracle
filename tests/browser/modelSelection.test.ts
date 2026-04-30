import { describe, expect, test } from "vitest";
import { buildCreateImageModeExpressionForTest } from "../../src/browser/actions/composerMode.js";
import { mapModelToBrowserLabel, normalizeChatGptModelForBrowser } from "../../src/cli/browserConfig.js";

describe("ChatGPT browser model labels", () => {
  test("maps OpenAI browser models to the current ChatGPT mode picker labels", () => {
    expect(mapModelToBrowserLabel("gpt-5.5-pro")).toBe("Pro");
    expect(mapModelToBrowserLabel("gpt-5.4-pro")).toBe("Pro");
    expect(mapModelToBrowserLabel("gpt-5-pro")).toBe("Pro");
    expect(mapModelToBrowserLabel("gpt-5.4")).toBe("Thinking");
    expect(mapModelToBrowserLabel("gpt-5.2")).toBe("Thinking");
    expect(mapModelToBrowserLabel("gpt-5.2-thinking")).toBe("Thinking");
    expect(mapModelToBrowserLabel("gpt-5.2-instant")).toBe("Instant");
    expect(mapModelToBrowserLabel("gpt-5.3-instant")).toBe("Instant");
  });

  test("keeps browser-only Instant and Thinking aliases distinct", () => {
    expect(normalizeChatGptModelForBrowser("gpt-5.2-instant")).toBe("gpt-5.2-instant");
    expect(normalizeChatGptModelForBrowser("gpt-5.2-thinking")).toBe("gpt-5.2-thinking");
    expect(normalizeChatGptModelForBrowser("gpt-5.3-instant")).toBe("gpt-5.3-instant");
  });

  test("create-image mode selector understands current localized ChatGPT labels", () => {
    const expression = buildCreateImageModeExpressionForTest();

    expect(expression).toContain("Create image");
    expect(expression).toContain("创建图片");
    expect(expression).toContain("composer-plus-btn");
  });
});
