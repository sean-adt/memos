import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import UpdateCustomizedProfileDialog from "@/components/UpdateCustomizedProfileDialog";

const instance = vi.hoisted(() => ({
  generalSetting: { customProfile: { title: "Team Notes", logoUrl: "/custom-logo.png", description: "Our notes" } },
  updateSetting: vi.fn(),
}));

vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => instance }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("react-hot-toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? children : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

describe("<UpdateCustomizedProfileDialog>", () => {
  it("restores zenlayer as the default name and saves it only on request", async () => {
    instance.updateSetting.mockResolvedValue(undefined);
    render(<UpdateCustomizedProfileDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText("setting.system.server-name")).toHaveValue("Team Notes");
    fireEvent.click(screen.getByRole("button", { name: "common.restore" }));

    expect(screen.getByLabelText("setting.system.server-name")).toHaveValue("zenlayer");
    expect(screen.getByLabelText("setting.system.customize-server.icon-url")).toHaveValue("/logo.webp");
    expect(screen.getByLabelText("setting.system.customize-server.description")).toHaveValue("");
    expect(instance.updateSetting).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(instance.updateSetting).toHaveBeenCalledTimes(1));
    expect(instance.updateSetting.mock.calls[0][0]).toMatchObject({
      name: "instance/settings/GENERAL",
      value: {
        case: "generalSetting",
        value: { customProfile: { title: "zenlayer", logoUrl: "/logo.webp", description: "" } },
      },
    });
  });
});
