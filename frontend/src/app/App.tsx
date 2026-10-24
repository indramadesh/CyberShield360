import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { LandingPage } from "@/features/dashboard/LandingPage";
import { LandingV2 } from "@/features/landing-v2/LandingV2";
import { BrowserProtectionPage } from "@/features/extension/BrowserProtectionPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ScannerPage } from "@/features/scanner/ScannerPage";
import { LearnPage } from "@/features/awareness/LearnPage";
import { IncidentPage } from "@/features/incidents/IncidentPage";
import { IntelPage } from "@/features/news/IntelPage";
import { AdminPage } from "@/features/admin/AdminPage";
import { LoginPage } from "@/features/auth/LoginPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/v2" element={<LandingV2 />} />
      <Route path="/browser-protection" element={<BrowserProtectionPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="scan" element={<ScannerPage />} />
        <Route path="learn" element={<LearnPage />} />
        <Route path="incident" element={<IncidentPage />} />
        <Route path="intel" element={<IntelPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
