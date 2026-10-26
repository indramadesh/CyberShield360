import type { RiskLevel } from "@/types";

export interface EvidenceItem {
  indicator: string;
  summary: string;
  source: string;
  weight: number;
  detail?: Record<string, unknown>;
}

export interface ScanResult {
  scan_id: string;
  scan_type: string;
  status: string;
  risk_level: RiskLevel;
  risk_score: number;
  confidence: number;
  category: string;
  indicators: string[];
  evidence: EvidenceItem[];
  recommendations: string[];
  explanation: string;
  notes: string[];
  pii_found?: Record<string, number>;
  /** Present on GET /scans/{id}: redacted summary of what was scanned. */
  target?: string;
  created_at?: string;
}

export type ScanType = "URL" | "MESSAGE" | "EMAIL" | "QR" | "IMAGE" | "WEBSITE";
