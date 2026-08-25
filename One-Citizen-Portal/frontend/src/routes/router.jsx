import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth, { PublicOnly } from './guards.jsx';
import AppShell from '../layouts/AppShell.jsx';
import AuthLayout from '../layouts/AuthLayout.jsx';
import LoginPage from '../features/auth/LoginPage.jsx';
import RegisterPage from '../features/auth/RegisterPage.jsx';
import DashboardPage from '../features/dashboard/DashboardPage.jsx';
import AgenciesPage from '../features/catalogue/AgenciesPage.jsx';
import ServicesPage from '../features/catalogue/ServicesPage.jsx';
import ServiceDetailPage from '../features/catalogue/ServiceDetailPage.jsx';
import ApplyPage from '../features/apply/ApplyPage.jsx';
import AppointmentBookingPage from '../features/appointments/AppointmentBookingPage.jsx';
import TrackingPage from '../features/tracking/TrackingPage.jsx';
import TrackingDetailPage from '../features/tracking/TrackingDetailPage.jsx';
import ProfilePage from '../features/profile/ProfilePage.jsx';
import EligibilityPage from '../features/eligibility/EligibilityPage.jsx';
import FaqsPage from '../features/help/FaqsPage.jsx';
import ContactPage from '../features/help/ContactPage.jsx';
import CentersPage from '../features/help/CentersPage.jsx';
import HowBenefitsWorkPage from '../features/help/HowBenefitsWorkPage.jsx';
// ── Modules added in the prototype redesign ──────────────────────────────────
import DocumentsPage from '../features/documents/DocumentsPage.jsx';
import PaymentsPage from '../features/payments/PaymentsPage.jsx';
import PermitsPage from '../features/permits/PermitsPage.jsx';
import CivilRegistrationPage from '../features/civil/CivilRegistrationPage.jsx';
import MessagesPage from '../features/messages/MessagesPage.jsx';
import SettingsPage from '../features/settings/SettingsPage.jsx';
import {
  VehiclesPage, PropertiesPage, EmploymentPage, FamilyPage, WalletMethodsPage,
} from '../features/records/pages.jsx';
// Tint Waiver uses the existing /services/:id and /services/:id/apply routes for its
// two catalogue services. It needs ONE route of its own: the detail view, because its
// applications live in the MOHA API and so cannot be served by /tracking/:id (which
// reads the portal's own applications table).
import TintApplicationDetailPage from '../features/tint/TintApplicationDetailPage.jsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnly><AuthLayout /></PublicOnly>}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>


      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/agencies" element={<AgenciesPage />} />
        <Route path="/agencies/:code" element={<ServicesPage />} />
        {/* Ministries level removed — redirect any old links to the agencies catalogue. */}
        <Route path="/ministries" element={<Navigate to="/agencies" replace />} />
        <Route path="/ministries/:code" element={<Navigate to="/agencies" replace />} />
        <Route path="/services/:id" element={<ServiceDetailPage />} />
        {/* Dedicated calendar booking flow — takes precedence over the generic form. */}
        <Route path="/services/book-appointment/apply" element={<AppointmentBookingPage />} />
        <Route path="/services/:id/apply" element={<ApplyPage />} />
        <Route path="/tracking" element={<TrackingPage />} />
        <Route path="/tracking/:id" element={<TrackingDetailPage />} />
        {/* MOHA-backed tint application detail — GET /v1/applications/:id */}
        <Route path="/tint/applications/:id" element={<TintApplicationDetailPage />} />
        {/* ── Documents, payments, permits, civil registration ───────────────── */}
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        {/* Minister #2 — one consolidated Permits section. */}
        <Route path="/permits" element={<PermitsPage />} />
        {/* Minister #3 — the GRO civil-registration list. */}
        <Route path="/civil-registration" element={<CivilRegistrationPage />} />

        {/* ── Citizen records (real, owner-scoped APIs) ──────────────────────── */}
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/employment" element={<EmploymentPage />} />
        <Route path="/wallet" element={<WalletMethodsPage />} />
        <Route path="/messages" element={<MessagesPage />} />

        {/* Account + help & support */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/eligibility" element={<EligibilityPage />} />
        <Route path="/help/faqs" element={<FaqsPage />} />
        <Route path="/help/contact" element={<ContactPage />} />
        <Route path="/help/centers" element={<CentersPage />} />
        <Route path="/help/how-benefits-work" element={<HowBenefitsWorkPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
