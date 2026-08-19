import { describe, expect, it, vi, beforeEach } from "vitest";
import { chatgptDomProvider } from "../../src/browser/providers/chatgptDomProvider.js";

vi.mock("../../src/browser/actions/promptComposer.js", () => ({
  submitPrompt: vi.fn(),
}));
vi.mock("../../src/browser/actions/navigation.js", () => ({
  ensurePromptReady: vi.fn(),
}));
vi.mock("../../src/browser/actions/assistantResponse.js", () => ({
  waitForAssistantResponse: vi.fn(),
}));

const { submitPrompt } = await import("../../src/browser/actions/promptComposer.js");

function makeState(baselineTurns?: number | null) {
  return {
    runtime: {} as never,
    input: {} as never,
    logger: () => undefined,
    timeoutMs: 1_000,
    baselineTurns: baselineTurns === undefined ? null : baselineTurns,
  };
}

describe("chatgptDomProvider baselineTurns writeback", () => {
  beforeEach(() => {
    vi.mocked(submitPrompt).mockReset();
  });

  it("never raises a pre-submission baseline when the post-commit count includes the mounting assistant turn", async () => {
    vi.mocked(submitPrompt).mockResolvedValue(4 as never);
    const state = makeState(0);

    await chatgptDomProvider.submitPrompt?.(
      { prompt: "hello", evaluate: async () => undefined, delay: async () => undefined, log: () => undefined, state },
    );

    expect(state.baselineTurns).toBe(0);
  });

  it("seeds the baseline from the post-commit count only when the pre-submission read failed", async () => {
    vi.mocked(submitPrompt).mockResolvedValue(2 as never);
    const state = makeState(null);

    await chatgptDomProvider.submitPrompt?.(
      { prompt: "hello", evaluate: async () => undefined, delay: async () => undefined, log: () => undefined, state },
    );

    expect(state.baselineTurns).toBe(1);
  });

  it("keeps a lower post-commit count untouched instead of lowering the baseline", async () => {
    vi.mocked(submitPrompt).mockResolvedValue(1 as never);
    const state = makeState(3);

    await chatgptDomProvider.submitPrompt?.(
      { prompt: "hello", evaluate: async () => undefined, delay: async () => undefined, log: () => undefined, state },
    );

    expect(state.baselineTurns).toBe(3);
  });

  it("ignores a non-numeric post-commit count", async () => {
    vi.mocked(submitPrompt).mockResolvedValue(null as never);
    const state = makeState(null);

    await chatgptDomProvider.submitPrompt?.(
      { prompt: "hello", evaluate: async () => undefined, delay: async () => undefined, log: () => undefined, state },
    );

    expect(state.baselineTurns).toBeNull();
  });
});
