import { describe, expect, it } from "vitest";
import { normalizeTelegramPhone } from "./telegram-phone";

describe("normalizeTelegramPhone", () => {
  it("adds the China country code to a domestic mobile number", () => {
    expect(normalizeTelegramPhone("138 1234 5678")).toBe("+8613812345678");
  });

  it("preserves an international number", () => {
    expect(normalizeTelegramPhone("+8613812345678")).toBe("+8613812345678");
  });

  it("converts 0086 and bare 86 prefixes", () => {
    expect(normalizeTelegramPhone("008613812345678")).toBe("+8613812345678");
    expect(normalizeTelegramPhone("8613812345678")).toBe("+8613812345678");
  });
});
