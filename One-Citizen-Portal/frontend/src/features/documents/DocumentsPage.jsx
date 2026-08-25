import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import {
  PageHeader, SectionCard, Button, EmptyState, ErrorState, GridSkeleton, Chip,
} from '../../ui/index.js';
import { DigitalDocumentCard } from '../dashboard/IdCards.jsx';
import DocumentCard from '../../components/DocumentViewer.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Documents — the prototype's document set, in two parts:
//
//   1. Digital documents the state HOLDS for the citizen (National ID, GECOM ID,
//      TIN, passport, licence). Derived from the reference document-type registry
//      crossed with what the citizen's profile actually contains, so a card only
//      appears when there is a real number behind it.
//
//   2. Files the citizen has UPLOADED to their vault (/documents), with the
//      existing preview + download behaviour untouched.
//
// MINISTER'S CHANGE #6: GECOM National Identification Card is part of the digital
// set — it comes from data/seed/reference/document-types.json (`gecom_id`), so it
// is reference data, not a hardcoded card.
// ─────────────────────────────────────────────────────────────────────────────

const get = (url) => api.get(url).then((r) => r.data);

/**
 * Which profile field backs each digital document. Only types listed here can
 * render as a digital card; everything else in the registry is an uploadable file.
 */
const DIGITAL = [
  { code: 'national_id', profileKey: 'nationalId', accent: 'primary' },
  { code: 'gecom_id', profileKey: 'gecomId', accent: 'gold' },
  { code: 'tin_letter', profileKey: 'tin', accent: 'primary', titleOverride: 'Taxpayer Identification Number (TIN)' },
  { code: 'passport', profileKey: 'passportNumber', accent: 'primary', expiryKey: 'passportExpiry' },
  { code: 'driver_licence', profileKey: 'licenceNumber', accent: 'primary', expiryKey: 'licenceExpiry', titleOverride: "Driver's Licence" },
];

export default function DocumentsPage() {
  const navigate = useNavigate();

  const me = useQuery({ queryKey: ['me'], queryFn: () => get('/me') });
  const types = useQuery({ queryKey: ['document-types'], queryFn: () => get('/reference/document-types') });
  const vault = useQuery({ queryKey: ['documents'], queryFn: () => get('/documents').then((d) => d.items || []) });

  const profile = me.data?.profile || {};
  const typeByCode = Object.fromEntries((types.data || []).map((t) => [t.code, t]));

  // A digital card only renders when the citizen actually holds that number.
  const digital = DIGITAL
    .map((d) => {
      const t = typeByCode[d.code];
      const number = profile[d.profileKey];
      if (!number) return null;
      return {
        ...d,
        title: d.titleOverride || t?.label || d.code,
        issuer: t?.issuer,
        number,
        expiry: d.expiryKey ? profile[d.expiryKey] : 'No expiry',
      };
    })
    .filter(Boolean);

  const files = vault.data || [];

  return (
    <div className="w-full">
      <PageHeader
        title="Documents"
        subtitle="The documents government holds for you, and the files you have uploaded."
      />

      {/* ── Digital documents ─────────────────────────────────────────────────── */}
      <div className="mb-[18px]">
        <SectionCard
          title="Your digital documents"
          actionLabel="Update details"
          onAction={() => navigate('/profile')}
        >
          {me.isLoading || types.isLoading ? <GridSkeleton count={3} />
            : me.error ? <ErrorState error={me.error} title="Could not load your documents" onRetry={me.refetch} />
            : digital.length === 0 ? (
              <EmptyState
                icon={<GlyphId />}
                title="No digital documents yet"
                hint="Once your National ID, GECOM ID, TIN or passport number is on your profile, each appears here as a digital document."
                action={<Button onClick={() => navigate('/profile')}>Add my details</Button>}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-[18px] xl:gap-5">
                {digital.map((d) => (
                  <DigitalDocumentCard
                    key={d.code}
                    title={d.title}
                    issuer={d.issuer}
                    number={d.number}
                    expiry={d.expiry}
                    accent={d.accent}
                    status={<Chip tone="ok">Held</Chip>}
                  />
                ))}
              </div>
            )}
        </SectionCard>
      </div>

      {/* ── Uploaded files ────────────────────────────────────────────────────── */}
      <SectionCard title={files.length ? `Uploaded files (${files.length})` : 'Uploaded files'}>
        {vault.isLoading ? <GridSkeleton count={2} cols="sm:grid-cols-2" />
          : vault.error ? <ErrorState error={vault.error} title="Could not load your files" onRetry={vault.refetch} />
          : files.length === 0 ? (
            <EmptyState
              icon={<GlyphFile />}
              title="No files uploaded"
              hint="Documents you upload while applying for a service are stored here and reused, so you never submit the same file twice."
              action={<Button variant="secondary" onClick={() => navigate('/agencies')}>Browse services</Button>}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {files.map((d) => <DocumentCard key={d.documentId} doc={d} />)}
            </div>
          )}
      </SectionCard>
    </div>
  );
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
function GlyphId() { return <svg aria-hidden viewBox="0 0 18 18" width="22" height="22" {...S}><path d="M2.5 4.5h13v9h-13zM5.5 7.5h3v3h-3zM10.5 8h3M10.5 10.5h3" /></svg>; }
function GlyphFile() { return <svg aria-hidden viewBox="0 0 18 18" width="22" height="22" {...S}><path d="M5 2.5h5l3 3V15.5H5zM10 2.5v3h3" /></svg>; }
