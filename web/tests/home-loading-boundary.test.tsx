import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoFilter } from "@/contexts/MemoFilterContext";
import Home from "@/pages/Home";

const state = vi.hoisted(() => ({
  user: { name: "users/1" } as { name: string } | undefined,
  isUserSettingsInitialized: true,
  useGrid: false,
  hasMemos: true,
  filters: [] as MemoFilter[],
  claimHomeAutoFocus: () => true,
  memoViewProps: undefined as Record<string, unknown> | undefined,
  selectedSpaceName: undefined as string | undefined,
  editorProps: undefined as Record<string, unknown> | undefined,
  listProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/components/MemoEditor", () => ({
  default: (props: Record<string, unknown>) => {
    state.editorProps = props;
    return <div data-testid="memo-editor" />;
  },
}));

vi.mock("@/components/MemoView", () => ({
  default: (props: Record<string, unknown>) => {
    state.memoViewProps = props;
    return <div data-testid="memo-view" />;
  },
}));

vi.mock("@/components/PagedMemoList", () => ({
  default: ({
    renderer,
    renderLeading,
    ...props
  }: {
    renderer: (memo: { name: string }, options: { compact: boolean }) => React.ReactNode;
    renderLeading: (options: { useGrid: boolean }) => React.ReactNode;
  } & Record<string, unknown>) => {
    state.listProps = props;
    return (
      <>
        {renderLeading({ useGrid: state.useGrid })}
        {state.hasMemos && renderer({ name: "memos/1" }, { compact: false })}
      </>
    );
  },
  getMemoKey: (memo: { name: string }) => memo.name,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isUserSettingsInitialized: state.isUserSettingsInitialized }),
}));

vi.mock("@/contexts/GlobalMemoEditorContext", () => ({
  useGlobalMemoEditor: () => ({ claimHomeAutoFocus: state.claimHomeAutoFocus }),
}));

vi.mock("@/contexts/MemoFilterContext", () => ({
  useMemoFilterContext: () => ({ filters: state.filters }),
}));

vi.mock("@/contexts/NewMemoContext", () => ({
  NewMemoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({
    selectedSpaceName: state.selectedSpaceName,
    memoFilter: state.selectedSpaceName ? `space == "${state.selectedSpaceName}"` : undefined,
  }),
}));

vi.mock("@/hooks", () => ({
  useMemoFilters: () => "",
  useMemoSorting: () => ({ listSort: undefined, orderBy: "create_time desc" }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => state.user,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("<Home>", () => {
  beforeEach(() => {
    state.user = { name: "users/1" };
    state.isUserSettingsInitialized = true;
    state.useGrid = false;
    state.hasMemos = true;
    state.filters = [];
    state.selectedSpaceName = undefined;
    state.editorProps = undefined;
    state.listProps = undefined;
    state.memoViewProps = undefined;
    state.claimHomeAutoFocus = () => true;
  });

  it("renders the editor and memo cards synchronously without blank placeholders", () => {
    render(<Home />);

    expect(screen.getByTestId("memo-editor")).toBeInTheDocument();
    expect(screen.getByTestId("memo-view")).toBeInTheDocument();
    expect(state.listProps).toMatchObject({ contextFilter: undefined });
    expect(state.editorProps).toMatchObject({ cacheKey: "home-memo-editor", defaultSpace: undefined });
    expect(state.editorProps).toMatchObject({
      autoFocus: state.claimHomeAutoFocus,
      placeholder: "editor.any-thoughts",
      defaultCreateTime: undefined,
    });
    expect(state.memoViewProps).toMatchObject({ showSpace: true, showVisibility: true, showPinned: true });
  });

  it("filters the feed and sets new memo placement to the selected Space", () => {
    state.selectedSpaceName = "spaces/product";
    render(<Home />);

    expect(state.memoViewProps).toMatchObject({ showSpace: false });
    expect(state.listProps).toMatchObject({ contextFilter: 'space == "spaces/product"' });
    expect(state.editorProps).toMatchObject({
      cacheKey: "home-memo-editor:spaces/product",
      defaultSpace: "spaces/product",
    });
  });

  it.each([false, true])("keeps one accessible welcome card above the editor and memos (grid=%s)", (useGrid) => {
    state.useGrid = useGrid;
    render(<Home />);

    const cards = screen.getAllByRole("region", { name: "home.welcome-title" });
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(within(card).getByRole("heading", { level: 2 })).toHaveTextContent("home.welcome-title");
    expect(within(card).getByText("home.welcome-description")).toBeInTheDocument();
    expect(card.querySelector("button, a, input, select, textarea, [tabindex], [contenteditable]")).toBeNull();
    const editor = screen.getByTestId("memo-editor");
    expect(card.nextElementSibling).toBe(editor);
    expect(card.parentElement).toHaveClass("w-full");
    expect(card.parentElement?.nextElementSibling).toBe(screen.getByTestId("memo-view"));
    expect(state.editorProps?.className).toBe(useGrid ? undefined : "mb-2");
  });

  it("keeps the welcome card and editor when the memo list is empty", () => {
    state.hasMemos = false;
    render(<Home />);

    expect(screen.getAllByRole("region", { name: "home.welcome-title" })).toHaveLength(1);
    expect(screen.getByTestId("memo-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("memo-view")).not.toBeInTheDocument();
  });

  it("waits for settings before showing the welcome card and editor without delaying memo cards", () => {
    state.isUserSettingsInitialized = false;
    const { container, rerender } = render(<Home />);

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByTestId("memo-editor")).not.toBeInTheDocument();
    expect(container.firstElementChild?.children).toHaveLength(1);
    expect(screen.getByTestId("memo-view")).toBeInTheDocument();

    state.isUserSettingsInitialized = true;
    rerender(<Home />);
    expect(screen.getAllByRole("region", { name: "home.welcome-title" })).toHaveLength(1);
    expect(screen.getByTestId("memo-editor")).toBeInTheDocument();
  });

  it("hides the welcome card without a current user and preserves the existing editor boundary", () => {
    state.user = undefined;
    render(<Home />);

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByTestId("memo-editor")).toBeInTheDocument();
    expect(screen.getByTestId("memo-view")).toBeInTheDocument();
  });

  it("remounts the editor for Space drafts while keeping a single card through Space, filter and layout changes", () => {
    const { rerender } = render(<Home />);
    const allEditor = screen.getByTestId("memo-editor");

    state.selectedSpaceName = "spaces/product";
    rerender(<Home />);
    const spaceEditor = screen.getByTestId("memo-editor");
    expect(spaceEditor).not.toBe(allEditor);
    expect(state.editorProps).toMatchObject({ cacheKey: "home-memo-editor:spaces/product", defaultSpace: "spaces/product" });
    expect(screen.getAllByRole("region", { name: "home.welcome-title" })).toHaveLength(1);

    state.filters = [{ factor: "displayTime", value: "2026-09-10" }];
    state.useGrid = true;
    rerender(<Home />);
    expect(screen.getByTestId("memo-editor")).toBe(spaceEditor);
    const createTime = state.editorProps?.defaultCreateTime as Date;
    expect([createTime.getFullYear(), createTime.getMonth(), createTime.getDate()]).toEqual([2026, 8, 10]);
    expect(state.editorProps).toMatchObject({ autoFocus: state.claimHomeAutoFocus, placeholder: "editor.any-thoughts" });
    expect(screen.getAllByRole("region", { name: "home.welcome-title" })).toHaveLength(1);

    state.selectedSpaceName = undefined;
    state.filters = [];
    state.useGrid = false;
    rerender(<Home />);
    expect(screen.getByTestId("memo-editor")).not.toBe(spaceEditor);
    expect(state.editorProps).toMatchObject({ cacheKey: "home-memo-editor", defaultSpace: undefined, defaultCreateTime: undefined });
    expect(state.listProps).toMatchObject({ contextFilter: undefined });
    expect(screen.getAllByRole("region", { name: "home.welcome-title" })).toHaveLength(1);
  });
});
