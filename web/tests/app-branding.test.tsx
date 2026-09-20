import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

const indexHTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const manifestJSON = readFileSync(new URL("../public/site.webmanifest", import.meta.url), "utf8");

const instance = vi.hoisted(() => ({
  profile: { needsSetup: false },
  profileLoaded: true,
  generalSetting: {} as { customProfile?: { title: string; logoUrl: string } },
}));

vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => instance }));
vi.mock("@/hooks/useNavigateTo", () => ({ default: () => vi.fn() }));
vi.mock("@/hooks/useUserLocale", () => ({ useUserLocale: () => "ltr" }));
vi.mock("@/hooks/useUserTheme", () => ({ useUserTheme: vi.fn() }));
vi.mock("@/utils/oauth", () => ({ cleanupExpiredOAuthState: vi.fn() }));
vi.mock("react-router-dom", () => ({ Outlet: () => null, ScrollRestoration: () => null }));

describe("app branding metadata", () => {
  let originalTitle: string;
  let icon: HTMLLinkElement;

  beforeEach(() => {
    originalTitle = document.title;
    document.title = "Previous title";
    instance.generalSetting = {};
    icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = "/logo.webp";
    document.head.appendChild(icon);
  });

  afterEach(() => {
    document.title = originalTitle;
    icon.remove();
  });

  it("uses zenlayer in the HTML entry and installable app names", () => {
    const entry = new DOMParser().parseFromString(indexHTML, "text/html");

    expect(entry.title).toBe("zenlayer");
    expect(entry.querySelector('link[rel="manifest"]')).toHaveAttribute("href", "/site.webmanifest");
    expect(JSON.parse(manifestJSON)).toMatchObject({ name: "zenlayer", short_name: "zenlayer" });
    expect(indexHTML).toContain("<!-- memos.metadata.head -->");
    expect(indexHTML).toContain("<!-- memos.metadata.body -->");
  });

  it.each([undefined, ""])("sets the default document title when the configured title is %j", (title) => {
    if (title !== undefined) instance.generalSetting.customProfile = { title, logoUrl: "" };

    render(<App />);

    expect(document.title).toBe("zenlayer");
  });

  it.each(["Team Notes", "Memos", "zenlayer"])("honors the configured title %j and favicon", (title) => {
    instance.generalSetting.customProfile = { title, logoUrl: "/custom-logo.png" };

    render(<App />);

    expect(document.title).toBe(title);
    expect(icon).toHaveAttribute("href", "/custom-logo.png");
  });

  it.each([undefined, ""])("restores the default title when custom branding changes to %j", (title) => {
    instance.generalSetting.customProfile = { title: "Team Notes", logoUrl: "" };
    const { rerender } = render(<App />);
    expect(document.title).toBe("Team Notes");

    instance.generalSetting.customProfile = title === undefined ? undefined : { title, logoUrl: "" };
    rerender(<App />);

    expect(document.title).toBe("zenlayer");
  });
});
