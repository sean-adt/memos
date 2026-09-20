import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import en from "@/locales/en.json";
import zhHans from "@/locales/zh-Hans.json";
import zhHant from "@/locales/zh-Hant.json";

const originalLanguage = i18n.language;

describe("home welcome translations", () => {
  afterEach(async () => {
    await i18n.changeLanguage(originalLanguage);
  });

  it.each([
    ["en", en, "Welcome back!", "Capture your thoughts and everyday inspiration."],
    ["zh-Hans", zhHans, "欢迎回来！", "记录此刻的想法，留住日常的灵感。"],
    ["zh-Hant", zhHant, "歡迎回來！", "記錄此刻的想法，留住日常的靈感。"],
  ] as const)("provides and loads the approved %s copy", async (locale, resource, title, description) => {
    expect(resource.home).toEqual({ "welcome-title": title, "welcome-description": description });
    await i18n.changeLanguage(locale);
    expect(i18n.t("home.welcome-title")).toBe(title);
    expect(i18n.t("home.welcome-description")).toBe(description);
  });

  it.each(["az", "fr"])("falls back to English for missing welcome copy in %s", async (locale) => {
    await i18n.changeLanguage(locale);
    expect(i18n.getResource(locale, "translation", "home.welcome-title")).toBeUndefined();
    expect(i18n.getResource(locale, "translation", "home.welcome-description")).toBeUndefined();
    expect(i18n.t("home.welcome-title")).toBe("Welcome back!");
    expect(i18n.t("home.welcome-description")).toBe("Capture your thoughts and everyday inspiration.");
  });
});
