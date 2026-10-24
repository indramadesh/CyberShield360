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
}

export type ScanType = "URL" | "MESSAGE" | "EMAIL" | "QR" | "IMAGE" | "WEBSITE";
