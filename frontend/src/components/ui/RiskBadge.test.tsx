import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiskBadge } from "./RiskBadge";

describe("RiskBadge", () => {
  it("communicates risk with text + icon, not color alone", () => {
    render(<RiskBadge level="HIGH" />);
    const el = screen.getByRole("status");
    // Accessible label present (text), independent of color.
    expect(el.getAttribute("aria-label")).toBe("High Risk");
    expect(el.textContent).toContain("High Risk");
  });

  it("renders a safe-but-not-guaranteed low state", () => {
    render(<RiskBadge level="LOW" />);
    expect(screen.getByRole("status").textContent).toContain("Low Risk");
  });
});
