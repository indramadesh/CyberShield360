import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "@/features/auth/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import { App } from "./App";

// Same provider tree as main.tsx.
function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <TooltipProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </TooltipProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("App shell (blank-screen guard)", () => {
  it("renders the landing page without crashing", () => {
    renderAt("/");
    // Would throw before the Button asChild fix (Radix Slot single-child).
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Stay One\s*Step Ahead/i);
  });

  it("keeps the classic landing page (lazy-loaded)", async () => {
    renderAt("/classic");
    expect((await screen.findAllByText(/CyberShield/i)).length).toBeGreaterThan(0);
  });

  it("renders the app shell + dashboard route", () => {
    renderAt("/app");
    expect(screen.getByText(/What would you like to check/i)).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
  });

  it("asks guests to sign in on My reports", () => {
    renderAt("/app/reports");
    expect(screen.getByText(/Sign in to see your reports/i)).toBeTruthy();
  });

  it("renders settings", () => {
    renderAt("/app/settings");
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Reduce motion" })).toBeTruthy();
  });

  it("redirects the old intel route to news", () => {
    renderAt("/app/intel");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
  });

  it("opens Sign Up on /register; social sign-in is shown disabled, not faked", () => {
    renderAt("/register");
    expect(screen.getByRole("tab", { name: "Sign Up" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: /Create Account/i })).toBeTruthy();
    expect(screen.getByText(/Social sign-in coming soon/i)).toBeTruthy();
    for (const b of document.querySelectorAll("button[aria-hidden]")) expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it("on the landing page only Get Started / Watch Demo / Download act; everything else opens Sign Up", () => {
    localStorage.clear();
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByText("Tools").closest("a")?.getAttribute("href")).toBe("/login?mode=register&next=%2Fapp%2Fscan");
    expect(within(nav).getByText("Home").closest("a")?.getAttribute("href")).toBe("/login?mode=register&next=%2F");
    expect(screen.getByLabelText("CyberShield360 home").getAttribute("href")).toContain("/login?mode=register");
    for (const a of screen.getAllByRole("link", { name: /Get Started/ })) expect(a.getAttribute("href")).toContain("/login?mode=register");
    expect(screen.getByRole("button", { name: /Watch Demo/ })).toBeTruthy();
  });

  it("renders the content-engine pages", async () => {
    for (const [path, re] of [["/app/updates", /Today's Cybersecurity Updates/], ["/app/law", /Indian Cyber Law Tracker/],
      ["/app/quiz", /Daily Cybersecurity Quiz/], ["/app/news", /Latest Cybersecurity News/]] as const) {
      const { unmount } = renderAt(path);
      expect(await screen.findByRole("heading", { name: re })).toBeTruthy();
      unmount();
    }
  });

  it("shows a 404 for unknown routes", () => {
    renderAt("/definitely-not-a-page");
    expect(screen.getByText("404")).toBeTruthy();
  });
});
