import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "@/features/auth/useAuth";
import { ScanResult } from "./ScanResult";
import type { ScanResult as Result } from "./types";

const result: Result = {
  scan_id: "scan_1",
  scan_type: "URL",
  status: "COMPLETE",
  risk_level: "HIGH",
  risk_score: 76,
  confidence: 0.82,
  category: "PHISHING",
  indicators: ["intel_match", "suspicious_tokens"],
  evidence: [
    { indicator: "intel_match", summary: "Threat intelligence match found.", source: "intel", weight: 40 },
    { indicator: "no_https", summary: "The link does not use HTTPS.", source: "domain", weight: 8 },
  ],
  recommendations: ["Do not enter your password or OTP.", "This is an assessment, not a guarantee."],
  explanation: "Based on the detected indicators, this content shows signs of phishing.",
  notes: [],
  pii_found: {},
};

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter><AuthProvider>{ui}</AuthProvider></MemoryRouter></QueryClientProvider>);
}

describe("ScanResult", () => {
  it("shows risk and confidence separately", () => {
    wrap(<ScanResult result={result} />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("High Risk");
    expect(screen.getByText(/82%/)).toBeTruthy();
    expect(screen.getByText(/PHISHING/)).toBeTruthy();
    expect(screen.getByText(/Risk Score 76\/100/)).toBeTruthy();
  });

  it("lists evidence and keeps technical details on their own tab", () => {
    wrap(<ScanResult result={result} />);
    expect(screen.getByText(/does not use HTTPS/)).toBeTruthy();
    expect(screen.queryByText(/Scan ID:/)).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Technical Details" }));
    expect(screen.getByText(/Scan ID:/)).toBeTruthy();
  });
});
