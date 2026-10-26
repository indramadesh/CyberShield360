import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { RouteFallback } from "@/components/ui/states";
import { HomePage } from "@/features/landing/HomePage";
import { BrowserProtectionPage } from "@/features/extension/BrowserProtectionPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ScanReportPage } from "@/features/scanner/ScanReportPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { LearnPage } from "@/features/awareness/LearnPage";
import { IncidentPage } from "@/features/incidents/IncidentPage";
import { IntelPage } from "@/features/news/IntelPage";
import { AlertsPage } from "@/features/news/AlertsPage";
import { UpdatesPage } from "@/features/content/UpdatesPage";
import { LawPage } from "@/features/content/LawPage";
import { QuizPage } from "@/features/content/QuizPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { AboutPage, ContactPage, ForgotPasswordPage, NotFoundPage } from "@/features/info/InfoPages";

// Split out: legacy landings, admin, and the scanner (pulls in the QR decoder).
const LandingPage = lazy(() => import("@/features/dashboard/LandingPage").then((m) => ({ default: m.LandingPage })));
const LandingV2 = lazy(() => import("@/features/landing-v2/LandingV2").then((m) => ({ default: m.LandingV2 })));
const AdminPage = lazy(() => import("@/features/admin/AdminPage").then((m) => ({ default: m.AdminPage })));
const ScannerPage = lazy(() => import("@/features/scanner/ScannerPage").then((m) => ({ default: m.ScannerPage })));

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* Previous landing designs are kept, not deleted. */}
        <Route path="/classic" element={<LandingPage />} />
        <Route path="/v2" element={<LandingV2 />} />
        <Route path="/browser-protection" element={<BrowserProtectionPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="scan" element={<ScannerPage />} />
          <Route path="scans/:scanId" element={<ScanReportPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="incident" element={<IncidentPage />} />
          <Route path="news" element={<IntelPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="updates" element={<UpdatesPage />} />
          <Route path="law" element={<LawPage />} />
          <Route path="quiz" element={<QuizPage />} />
          <Route path="intel" element={<Navigate to="/app/news" replace />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundInApp />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

function NotFoundInApp() {
  return (
    <div className="py-20 text-center">
      <div className="font-display text-5xl font-bold text-brand-gradient">404</div>
      <h1 className="mt-2 font-display text-xl font-semibold">This page doesn't exist</h1>
      <p className="mt-2 text-muted-foreground">Use the sidebar to find what you need.</p>
    </div>
  );
}
