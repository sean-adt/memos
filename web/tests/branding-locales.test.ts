import { afterEach, describe, expect, it } from "vitest";
import i18n, { locales } from "@/i18n";

const originalLanguage = i18n.language;

describe("brand translations", () => {
  afterEach(async () => {
    await i18n.changeLanguage(originalLanguage);
  });

  it.each(locales)("credits zenlayer in %s, including locale fallbacks", async (locale) => {
    await i18n.changeLanguage(locale);

    expect(i18n.t("about.powered-by")).toContain("zenlayer");
    expect(i18n.t("common.sign-in-to-memos")).toContain("zenlayer");
  });

  it("keeps note terminology and interpolation intact", async () => {
    await i18n.changeLanguage("en");

    expect(i18n.t("common.memos")).toBe("Memos");
    expect(i18n.t("memo.count-memos-in-date", { count: 2, memos: "memos", date: "2026-09-20" })).toBe("2 memos in 2026-09-20");
    expect(i18n.t("setting.spaces.user-not-found", { username: "alice" })).toBe("No active zenlayer user found for @alice.");
  });
});
