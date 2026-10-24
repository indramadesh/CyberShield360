import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "@/features/auth/useAuth";
import { App } from "./App";

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("App shell (blank-screen guard)", () => {
  it("renders the landing page without crashing", () => {
    renderAt("/");
    // Would throw before the Button asChild fix (Radix Slot single-child).
    expect(screen.getAllByText(/CyberShield 360/i).length).toBeGreaterThan(0);
  });

  it("renders the app shell + dashboard route", () => {
    renderAt("/app");
    expect(screen.getByText(/What would you like to check/i)).toBeTruthy();
  });
});
