import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Dialog } from '@mui/material';
import { api } from '../../lib/api.js';
import {
  PageHeader, SectionCard, Button, EmptyState, ErrorState, ListSkeleton,
  Chip, DataTable, ServiceTile,
} from '../../ui/index.js';
import { PAYMENT_CHANNELS, ChannelGlyph } from './channels.jsx';
import QrTicket from './QrTicket.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// MINISTER'S CHANGE #5 — one unified Payments section covering GPL, GWI, MMG and
// Transportation (ferry) ticketing, with QR-code issuance.
//
// HONEST SCOPE NOTE, stated in the UI as well as here: there is no payment
// integration in this build (MOCK_INTEGRATIONS=true) and no payment or QR endpoint.
// So this screen does two real things and is explicit about the third:
//   • Amounts due are REAL — from /dashboard/deadlines (title, amount, dueDate,
//     daysLeft, payDeepLink), the same source the dashboard uses.
//   • Fees are REAL — from /reference/fee-schedules.
//   • Settlement is NOT wired. Each channel states that it opens the agency's own
//     payment route, and the QR is generated locally from the reference the citizen
//     already holds. Nothing pretends a payment was taken.
//
// The QR encodes a payment REFERENCE, not card data — it is the thing a ferry
// clerk or agency cashier scans to look the payment up.
// ─────────────────────────────────────────────────────────────────────────────

const get = (url) => api.get(url).then((r) => r.data);
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(() => new Set());
  const [ticket, setTicket] = useState(null);

  const deadlines = useQuery({ queryKey: ['deadlines'], queryFn: () => get('/dashboard/deadlines') });
  const fees = useQuery({ queryKey: ['fee-schedules'], queryFn: () => get('/reference/fee-schedules') });

  const dues = useMemo(() => deadlines.data?.items || [], [deadlines.data]);
  const feeList = useMemo(() => fees.data || [], [fees.data]);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const total = useMemo(
    () => dues.filter((d) => selected.has(d.id)).reduce((sum, d) => sum + Number(d.amount || 0), 0),
    [dues, selected],
  );

  const columns = [
    {
      key: 'select',
      header: '',
      width: 40,
      render: (r) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggle(r.id)}
          aria-label={`Select ${r.title} for payment`}
          className="w-[18px] h-[18px] accent-primary cursor-pointer"
        />
      ),
    },
    { key: 'title', header: 'What is due', render: (r) => <span className="font-bold">{r.title}</span> },
    { key: 'dueDate', header: 'Due', render: (r) => r.dueDate || '—' },
    {
      key: 'daysLeft',
      header: 'Time left',
      render: (r) => <Chip tone={r.daysLeft <= 7 ? 'danger' : 'ok'} dot={false}>{r.daysLeft} days</Chip>,
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span className="font-bold tabular-nums">{money(r.amount)}</span> },
  ];

  return (
    <div className="w-full">
      <PageHeader
        title="Payments"
        subtitle="Everything you owe government in one place — utilities, licences, rates and ferry tickets."
      />

      {/* ── Amounts due — real data ────────────────────────────────────────────── */}
      <div className="mb-[18px]">
        <SectionCard
          title="Due now"
          action={selected.size > 0 && (
            <span className="text-sm font-bold text-muted dark:text-d-muted tabular-nums">
              {selected.size} selected · {money(total)}
            </span>
          )}
        >
          {deadlines.isLoading ? <ListSkeleton rows={3} avatar={false} />
            : deadlines.error ? <ErrorState error={deadlines.error} title="Could not load what you owe" onRetry={deadlines.refetch} />
            : dues.length === 0 ? (
              <EmptyState
                icon={<GlyphCheck />}
                title="Nothing due right now"
                hint="When a bill, licence renewal or property rate falls due, it appears here with the amount and the date."
              />
            ) : (
              <>
                <DataTable columns={columns} rows={dues} getKey={(r) => r.id} />
                <div className="flex flex-wrap items-center justify-between gap-3.5 mt-4 pt-4 border-t border-line dark:border-d-line">
                  <p className="text-sm text-muted dark:text-d-muted">
                    Selecting items opens the paying agency&apos;s own payment page — this portal does not
                    take the payment itself.
                  </p>
                  <Button
                    variant="gold"
                    disabled={selected.size === 0}
                    onClick={() => {
                      const first = dues.find((d) => selected.has(d.id));
                      navigate(first?.payDeepLink || '/agencies');
                    }}
                  >
                    Pay {selected.size > 0 ? money(total) : ''}
                  </Button>
                </div>
              </>
            )}
        </SectionCard>
      </div>

      {/* ── Channels — GPL · GWI · MMG · Ferry ─────────────────────────────────── */}
      <div className="mb-[18px]">
        <SectionCard title="Pay a provider">
          <div className="grid gap-3 xl:gap-3.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6">
            {PAYMENT_CHANNELS.map((c) => (
              <ServiceTile
                key={c.id}
                icon={<ChannelGlyph name={c.glyph} />}
                label={c.label}
                sub={c.agency}
                onClick={() => (c.issuesQr ? setTicket(c) : navigate(c.to))}
              />
            ))}
          </div>
          <p className="text-sm text-muted dark:text-d-muted mt-4">
            Each provider is paid on its own secure page. The ferry issues a QR ticket you show
            when boarding.
          </p>
        </SectionCard>
      </div>

      {/* ── Fee schedule — real reference data ─────────────────────────────────── */}
      <SectionCard title="Government fee schedule">
        {fees.isLoading ? <ListSkeleton rows={4} avatar={false} />
          : fees.error ? <ErrorState error={fees.error} title="Could not load the fee schedule" onRetry={fees.refetch} />
          : feeList.length === 0 ? <EmptyState icon={<GlyphCheck />} title="No fees published" />
          : (
            <DataTable
              getKey={(r) => r.code}
              rows={feeList}
              columns={[
                { key: 'service', header: 'Service', render: (r) => <span className="font-bold">{r.service}</span> },
                { key: 'agency', header: 'Agency', render: (r) => r.agency || '—' },
                { key: 'amount', header: 'Fee', align: 'right', render: (r) => <span className="font-bold tabular-nums">{money(r.amount)} {r.currency}</span> },
              ]}
            />
          )}
      </SectionCard>

      {/* ── QR ticket ─────────────────────────────────────────────────────────── */}
      <Dialog open={!!ticket} onClose={() => setTicket(null)} maxWidth="xs" fullWidth aria-labelledby="qr-title">
        {ticket && <QrTicket channel={ticket} onClose={() => setTicket(null)} />}
      </Dialog>
    </div>
  );
}

function GlyphCheck() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.5l3.2 3.2L14 6" />
    </svg>
  );
}
