import { describe, expect, test } from "vitest";
import { getChromeProfilesToTryForTest } from "../../src/browser/cookies.js";

describe("ChatGPT browser cookies", () => {
  test("tries common Chrome profiles when using the default profile", () => {
    expect(getChromeProfilesToTryForTest("Default")).toEqual(["Default", "Profile 1", "Profile 2"]);
  });
});
