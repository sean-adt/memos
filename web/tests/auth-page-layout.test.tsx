import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthPageLayout from "@/components/AuthPageLayout";
import { InstanceAccessMode } from "@/types/proto/api/v1/instance_service_pb";

const instance = vi.hoisted(() => ({
  instanceUrl: "https://notes.example.com",
  accessMode: 1,
  generalSetting: {} as { customProfile?: { title: string; logoUrl: string } },
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ profile: instance, generalSetting: instance.generalSetting }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
  loadLocale: vi.fn(),
}));

vi.mock("@/components/AuthFooter", () => ({ default: () => <div data-testid="auth-footer" /> }));

const renderLayout = (props?: { hideExplore?: boolean }) =>
  render(
    <MemoryRouter>
      <AuthPageLayout title="Sign in" {...props}>
        <div />
      </AuthPageLayout>
    </MemoryRouter>,
  );

describe("<AuthPageLayout>", () => {
  beforeEach(() => {
    instance.accessMode = InstanceAccessMode.PRIVATE;
    instance.generalSetting = {};
  });

  it.each([undefined, ""])("uses zenlayer when the configured title is %j", (title) => {
    if (title !== undefined) instance.generalSetting.customProfile = { title, logoUrl: "" };

    const { container } = renderLayout();

    expect(screen.getByText("zenlayer")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "/logo.webp");
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it.each(["Team Notes", "Memos", "zenlayer"])("preserves the custom title %j and logo", (title) => {
    instance.generalSetting.customProfile = { title, logoUrl: "/custom-logo.png" };

    const { container } = renderLayout();

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "/custom-logo.png");
  });

  it("links to Explore on public instances", () => {
    instance.accessMode = InstanceAccessMode.PUBLIC;
    renderLayout();

    expect(screen.getByRole("link", { name: /auth\.explore-public-memos/ })).toHaveAttribute("href", "/explore");
  });

  it("omits the band on private instances even when an instance URL is configured", () => {
    renderLayout();

    expect(screen.queryByRole("link", { name: /auth\.explore-public-memos/ })).not.toBeInTheDocument();
  });

  it("omits the band when hideExplore is set (first-run setup)", () => {
    instance.accessMode = InstanceAccessMode.PUBLIC;
    renderLayout({ hideExplore: true });

    expect(screen.queryByRole("link", { name: /auth\.explore-public-memos/ })).not.toBeInTheDocument();
  });
});
