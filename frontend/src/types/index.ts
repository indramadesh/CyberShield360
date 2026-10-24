export type RiskLevel = "LOW" | "SUSPICIOUS" | "HIGH" | "CRITICAL";

export type FeatureKey =
  | "url_scanner"
  | "message_scanner"
  | "email_scanner"
  | "image_scanner"
  | "qr_scanner"
  | "website_scanner"
  | "threat_intelligence"
  | "cyber_news"
  | "cyber_law"
  | "awareness"
  | "incident_response"
  | "community_reports"
  | "campaign_detection";

export interface ThreatCategory {
  code: string;
  label: string;
}

export interface PublicConfig {
  app_name: string;
  env: string;
  demo_mode: boolean;
  features: Record<FeatureKey, boolean>;
  threat_categories: ThreatCategory[];
  risk_thresholds: { suspicious: number; high: number; critical: number };
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  request_id?: string;
}
