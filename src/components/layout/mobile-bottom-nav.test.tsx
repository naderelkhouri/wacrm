import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-total-unread", () => ({
  useTotalUnread: () => 3,
}));

import { MobileBottomNav } from "./mobile-bottom-nav";
import { usePathname, useSearchParams } from "next/navigation";

describe("MobileBottomNav", () => {
  it("renders mobile navigation with core links and unread badge", () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileBottomNav, { onOpenMenu: vi.fn() }),
    );
    expect(html).toContain('aria-label="Mobile Navigation"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/inbox"');
    expect(html).toContain('href="/pipelines"');
    expect(html).toContain('href="/contacts"');
    expect(html).toContain("3"); // unread badge
  });

  it("hides completely when inside an active conversation thread on mobile", () => {
    vi.mocked(usePathname).mockReturnValue("/inbox");
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("c=test-conv-uuid") as unknown as ReturnType<typeof useSearchParams>,
    );

    const html = renderToStaticMarkup(
      React.createElement(MobileBottomNav, { onOpenMenu: vi.fn() }),
    );
    expect(html).toBe("");
  });
});
