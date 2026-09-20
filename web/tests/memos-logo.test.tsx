import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemosLogo from "@/components/MemosLogo";

const instance = vi.hoisted(() => ({
  generalSetting: {} as { customProfile?: { title: string; logoUrl: string } },
}));

vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => instance }));

describe("<MemosLogo>", () => {
  beforeEach(() => {
    instance.generalSetting = {};
  });

  it.each([undefined, ""])("uses zenlayer when the configured title is %j", (title) => {
    if (title !== undefined) instance.generalSetting.customProfile = { title, logoUrl: "" };

    const { container } = render(<MemosLogo />);

    expect(screen.getByText("zenlayer")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "/full-logo.webp");
  });

  it.each(["Team Notes", "Memos", "zenlayer"])("preserves the custom title %j and logo", (title) => {
    instance.generalSetting.customProfile = { title, logoUrl: "/custom-logo.png" };

    const { container } = render(<MemosLogo />);

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "/custom-logo.png");
  });

  it.each(["md", "header", "sm"] as const)("shows the brand in the %s compact variant and hides it when collapsed", (size) => {
    const { container, rerender } = render(<MemosLogo compact size={size} />);

    expect(screen.getByText("zenlayer")).toBeInTheDocument();

    rerender(<MemosLogo compact size={size} collapsed />);

    expect(screen.queryByText("zenlayer")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "/full-logo.webp");
  });

  it("hides the custom title while keeping the logo when collapsed", () => {
    instance.generalSetting.customProfile = { title: "Team Notes", logoUrl: "/custom-logo.png" };

    const { container } = render(<MemosLogo collapsed />);

    expect(screen.queryByText("Team Notes")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "/custom-logo.png");
  });
});
