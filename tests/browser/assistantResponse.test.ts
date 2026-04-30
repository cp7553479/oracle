import { describe, expect, test } from "vitest";
import { waitForAssistantResponse } from "../../src/browser/actions/assistantResponse.js";

describe("waitForAssistantResponse", () => {
  test("does not finish while the stop button is still visible", async () => {
    let calls = 0;
    const runtime = {
      evaluate: async () => {
        calls += 1;
        return {
          result: {
            value:
              calls === 1
                ? {
                    complete: false,
                    hasGeneratedImage: true,
                    stopVisible: true,
                    snapshot: {
                      text: "Pro thinking\nGenerating a more detailed image — hang tight.",
                      html: '<img src="/backend-api/estuary/content?id=file_pending">',
                    },
                  }
                : {
                    complete: true,
                    hasGeneratedImage: true,
                    stopVisible: false,
                    snapshot: {
                      text: "Done",
                      html: '<img src="/backend-api/estuary/content?id=file_done">',
                    },
                  },
          },
        };
      },
    };

    const response = await waitForAssistantResponse(runtime as never, 2_000, () => {});

    expect(calls).toBe(2);
    expect(response.text).toBe("Done");
  });

  test("does not return stable assistant text while the stop button remains visible", async () => {
    const runtime = {
      evaluate: async () => ({
        result: {
          value: {
            complete: false,
            hasGeneratedImage: false,
            stopVisible: true,
            snapshot: {
              text: "Partial response that is still being generated",
              html: "<p>Partial response that is still being generated</p>",
            },
          },
        },
      }),
    };

    await expect(waitForAssistantResponse(runtime as never, 50, () => {})).rejects.toThrow(
      "Unable to capture assistant response",
    );
  });
});
