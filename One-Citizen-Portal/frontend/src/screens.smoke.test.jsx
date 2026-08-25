// Renders every screen with mocked API data to surface runtime crashes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { buildTheme } from './theme/theme.js';

// ---- Mock the API module (all importers resolve to this same file) ----
function mockGet(url) {
  if (url.endsWith('/me')) return { id: 'idn_citizen_1', name: 'Jane Persaud', identifier: '1990-1234', phone: '6001234', roles: ['citizen'] };
  if (url.endsWith('/appointments/offices')) return { items: [{ code: 'cipo-georgetown', name: 'CIPO — Georgetown' }] };
  if (url.includes('/appointments/slots')) return { office: 'cipo-georgetown', date: '2026-07-20', closed: false, slots: [{ id: '2026-07-20_0900', time24: '09:00', label: '9:00 AM', period: 'Morning', available: true }], summary: { total: 1, available: 1 } };
  if (url.endsWith('/appointments')) return { items: [{ id: 'apt1', reference: 'APT-1', officeName: 'CIPO — Georgetown', date: '2026-07-20', timeLabel: '9:00 AM', purpose: 'New application', status: 'booked' }] };
  if (url.endsWith('/dashboard/reminders')) return { items: [{ id: 'r1', title: 'Case', detail: 'OC-1', deepLink: '/tracking/1' }, { id: 'r2', title: 'MV licence due', payNowDeepLink: '/services/mv-licence' }] };
  if (url.endsWith('/dashboard/suggestions')) return { items: [{ id: 's1', programme: 'Old-Age Pension', explanation: '65+ eligible', deepLink: '/services/old-age-pension' }] };
  if (url.endsWith('/dashboard/deadlines')) return { urgent: { title: 'Urgent: Payment Due Soon', message: 'Property tax due', amount: 1250, daysLeft: 3, payDeepLink: '/services/tin-register' }, items: [{ id: 'd1', title: 'Property Tax Payment', icon: 'money', dueDate: 'Dec 15, 2025', daysLeft: 3, amount: 1000, payDeepLink: '/services/tin-register' }] };
  if (url.endsWith('/dashboard/notifications')) return { items: [{ id: 'n1', title: 'Tax Payment Reminder', message: 'Due in 3 days', timeAgo: '2 hours ago' }] };
  if (url.endsWith('/dashboard/pension')) return { monthlyAmount: 800, nextPayment: '2024 - 12 - 01', yearsOfService: 32, status: 'Active' };
  if (url.endsWith('/dashboard/cases')) return { items: [{ id: '1', reference: 'OC-1', appNumber: 'OC-1', service: 'New Passport', category: 'CIPO', ministry: 'Home Affairs', status: 'submitted', submittedAt: '2026-07-01T10:00:00Z', nextStep: 'Document check in progress' }] };
  if (url.endsWith('/catalogue/agencies')) return { items: [{ code: 'CIPO', name: 'CIPO', ministryCode: 'MOHA', ministryName: 'Home Affairs', serviceCount: 2 }] };
  if (url.includes('/catalogue/agencies/')) return { ministry: { code: 'MOHA', name: 'Home Affairs' }, agency: { code: 'CIPO', name: 'CIPO' }, services: [{ id: 'passport-new', name: 'New Passport', description: 'Apply', requiredAssurance: 2 }] };
  if (url.includes('/catalogue/services/')) return {
    id: 'passport-new', name: 'New Passport', description: 'Apply', ministryCode: 'MOHA', ministryName: 'Home Affairs', agencyCode: 'CIPO', agencyName: 'CIPO', prerequisites: ['National ID'], requiredAssurance: 2,
    form: { sections: [{ title: 'A', fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'sex', label: 'Sex', type: 'select', required: true, options: ['Female', 'Male'] },
      { name: 'utilities', label: 'Utilities', type: 'multiselect', options: ['Water'] },
      { name: 'docId', label: 'National ID', type: 'file', docType: 'national_id', required: true },
    ] }] },
  };
  if (url.match(/\/applications\/[^/]+$/)) return { id: '1', serviceName: 'New Passport', ministryName: 'Home Affairs', reference: 'OC-1', status: 'submitted', lanes: [{ name: 'Verification', status: 'in_progress', sla: '5 days' }], timeline: [{ at: '2026-07-01T10:00:00Z', event: 'Submitted', note: 'received' }], documents: [{ field: 'docId', label: 'National ID', type: 'national_id', documentId: 'doc1', filename: 'id.pdf' }], form: { fullName: 'Jane' } };
  if (url.endsWith('/applications')) return { items: [{ id: '1', serviceName: 'New Passport', ministryName: 'Home Affairs', reference: 'OC-1', status: 'submitted' }] };

  // ── Endpoints that answer with a BARE ARRAY, not { items } ─────────────────
  // These were missing, so they fell through to the `{}` default below and the
  // screens crashed on `.map is not a function`. The suite still reported 20/20
  // because an error boundary swallowed each one — the assertions were passing
  // against a caught-error render, not the real screen. Shapes below match the
  // service functions: reference.service.js returns `data.<key> || []` directly.
  if (url.endsWith('/reference/document-types')) {
    return [
      { code: 'national_id', label: 'National ID Card', issuer: 'GECOM', formats: ['pdf'], maxMb: 25 },
      { code: 'passport', label: 'Passport', issuer: 'CIPO', formats: ['pdf'], maxMb: 25 },
    ];
  }
  if (url.endsWith('/reference/local-authorities')) return [{ code: 'GT', name: 'Georgetown' }];
  if (url.endsWith('/reference/fee-schedules')) return [{ code: 'passport-new', amount: 6000, currency: 'GYD' }];

  // Owner-scoped record collections — all `{ items }`.
  if (/\/(vehicles|properties|employment|family|wallet|messages|business|documents)$/.test(url)) {
    return { items: [] };
  }

  return {};
}
vi.mock('./lib/api.js', () => ({
  api: { get: (url) => Promise.resolve({ data: mockGet(url) }), post: () => Promise.resolve({ data: {} }) },
  apiError: (e) => (e && e.message) || 'error',
}));

import DashboardPage from './features/dashboard/DashboardPage.jsx';
import AgenciesPage from './features/catalogue/AgenciesPage.jsx';
import ServicesPage from './features/catalogue/ServicesPage.jsx';
import ServiceDetailPage from './features/catalogue/ServiceDetailPage.jsx';
import ApplyPage from './features/apply/ApplyPage.jsx';
import AppointmentBookingPage from './features/appointments/AppointmentBookingPage.jsx';
import TrackingPage from './features/tracking/TrackingPage.jsx';
import TrackingDetailPage from './features/tracking/TrackingDetailPage.jsx';
import LoginPage from './features/auth/LoginPage.jsx';

function renderScreen(element, { path = '*', url = '/' } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={buildTheme('light')}>
        <MemoryRouter initialEntries={[url]}>
          <Routes><Route path={path} element={element} /></Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
const noSpinner = async (c) => waitFor(() => expect(c.querySelector('.MuiCircularProgress-root')).toBeNull(), { timeout: 3000 });

beforeEach(() => { if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }); });

describe('screens render without crashing (with data)', () => {
  // These anchors deliberately prefer MOCK DATA (a citizen's name, a reference, a
  // service name) over UI copy: the point of this suite is "the screen rendered
  // without crashing", and anchoring on prose meant every wording improvement
  // showed up as a test failure rather than as the copy change it was.
  it('Login', async () => { const { container } = renderScreen(<LoginPage />, { path: '/login', url: '/login' }); await noSpinner(container); expect(await screen.findByLabelText(/Email address/i)).toBeTruthy(); });
  it('Dashboard', async () => { const { container } = renderScreen(<DashboardPage />); await noSpinner(container); expect(await screen.findByText(/Jane Persaud/)).toBeTruthy(); });
  it('Agencies', async () => { const { container } = renderScreen(<AgenciesPage />, { path: '/agencies', url: '/agencies' }); await noSpinner(container); expect(await screen.findByText(/CIPO/)).toBeTruthy(); });
  it('Services', async () => { const { container } = renderScreen(<ServicesPage />, { path: '/agencies/:code', url: '/agencies/CIPO' }); await noSpinner(container); expect(await screen.findByText(/New Passport/)).toBeTruthy(); });
  it('ServiceDetail', async () => { const { container } = renderScreen(<ServiceDetailPage />, { path: '/services/:id', url: '/services/passport-new' }); await noSpinner(container); expect(await screen.findByText(/How it works/)).toBeTruthy(); });
  it('Apply', async () => { const { container } = renderScreen(<ApplyPage />, { path: '/services/:id/apply', url: '/services/passport-new/apply' }); await noSpinner(container); expect(await screen.findByText(/Your progress/)).toBeTruthy(); });
  it('AppointmentBooking', async () => { const { container } = renderScreen(<AppointmentBookingPage />, { path: '/services/book-appointment/apply', url: '/services/book-appointment/apply' }); await noSpinner(container); expect(await screen.findByText(/Your appointment/)).toBeTruthy(); });
  it('Tracking', async () => { const { container } = renderScreen(<TrackingPage />); await noSpinner(container); expect(await screen.findByText(/OC-1/)).toBeTruthy(); });
  // findAll: the lane name appears both in the stepper and in the "currently with"
  // banner, which is correct — the page states where the application sits twice.
  it('TrackingDetail', async () => { const { container } = renderScreen(<TrackingDetailPage />, { path: '/tracking/:id', url: '/tracking/1' }); await noSpinner(container); expect((await screen.findAllByText(/Verification/)).length).toBeGreaterThan(0); });
});

// ─────────────────────────────────────────────────────────────────────────────
// Modules added in the prototype redesign. Each is rendered against the mocked API
// to prove it mounts and reaches a real state (content OR its empty state) rather
// than crashing — the same contract as the suite above.
// ─────────────────────────────────────────────────────────────────────────────
import DocumentsPage from './features/documents/DocumentsPage.jsx';
import PaymentsPage from './features/payments/PaymentsPage.jsx';
import PermitsPage from './features/permits/PermitsPage.jsx';
import CivilRegistrationPage from './features/civil/CivilRegistrationPage.jsx';
import MessagesPage from './features/messages/MessagesPage.jsx';
import SettingsPage from './features/settings/SettingsPage.jsx';
import {
  VehiclesPage, PropertiesPage, EmploymentPage, FamilyPage, WalletMethodsPage,
} from './features/records/pages.jsx';

describe('redesign modules render without crashing', () => {
  // Element FACTORIES, not elements: `it.each` receives these as arguments rather
  // than rendering them as a list, so building them lazily also avoids the
  // react/jsx-key rule firing on a non-list array.
  const cases = [
    ['Documents', () => <DocumentsPage />, /digital documents/i],
    ['Payments', () => <PaymentsPage />, /Payments/],
    ['Permits', () => <PermitsPage />, /Permits/],
    ['CivilRegistration', () => <CivilRegistrationPage />, /Civil registration/i],
    ['Messages', () => <MessagesPage />, /Messages/],
    ['Settings', () => <SettingsPage />, /Appearance/],
    ['Vehicles', () => <VehiclesPage />, /Vehicles/],
    ['Properties', () => <PropertiesPage />, /Properties/],
    ['Employment', () => <EmploymentPage />, /Employment/],
    ['Family', () => <FamilyPage />, /Family/],
    ['Wallet', () => <WalletMethodsPage />, /Payment methods/i],
  ];

  it.each(cases)('%s', async (_name, makeElement, matcher) => {
    const { container } = renderScreen(makeElement());
    await noSpinner(container);
    expect((await screen.findAllByText(matcher)).length).toBeGreaterThan(0);
  });
});
