import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

describe("ScanResult", () => {
  it("shows risk and confidence separately", () => {
    render(<ScanResult result={result} />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("High Risk");
    expect(screen.getByText(/82%/)).toBeTruthy();
    expect(screen.getByText(/PHISHING/)).toBeTruthy();
  });

  it("lists evidence and keeps technical details collapsed by default", () => {
    render(<ScanResult result={result} />);
    expect(screen.getByText(/does not use HTTPS/)).toBeTruthy();
    expect(screen.queryByText(/Scan ID:/)).toBeNull();
    fireEvent.click(screen.getByText(/Show technical details/));
    expect(screen.getByText(/Scan ID:/)).toBeTruthy();
  });
});
