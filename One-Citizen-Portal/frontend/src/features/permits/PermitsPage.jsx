import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, SectionCard, ServiceTile, EmptyState, ErrorState, GridSkeleton, Chip, Button,
} from '../../ui/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// MINISTER'S CHANGE #2 — one consolidated Permits section listing every permit
// across the issuing bodies: Ministry of Housing, the Police Force, Firearms and
// the Ministry of Home Affairs.
//
// Built ENTIRELY from the live catalogue (/catalogue/agencies + per-agency
// services) rather than a hardcoded list, so a permit added to the catalogue
// appears here with no code change — and nothing appears that does not really
// exist.
//
// Grouping is by issuing body. A body with no permits currently in the catalogue is
// shown with an explicit "not yet available online" note instead of being hidden,
// so a citizen looking for a firearms licence learns where it stands rather than
// concluding the portal has nothing.
// ─────────────────────────────────────────────────────────────────────────────

const get = (url) => api.get(url).then((r) => r.data);

/**
 * The permit-issuing bodies the Minister named, with the keywords that identify a
 * permit-type service in the catalogue. Matching is on the catalogue's own text, so
 * this stays correct as the catalogue grows.
 */
const BODIES = [
  {
    id: 'housing',
    name: 'Ministry of Housing & Water',
    blurb: 'Building, construction and utility connection permits.',
    agencyCodes: ['OHG', 'CHPA'],
    keywords: ['permit', 'construction', 'building', 'housing', 'utilities'],
  },
  {
    id: 'homeaffairs',
    name: 'Ministry of Home Affairs',
    blurb: 'Trade, business and general government licences.',
    agencyCodes: ['MOHA'],
    keywords: ['licence', 'license', 'permit', 'trade'],
  },
  {
    id: 'police',
    name: 'Guyana Police Force',
    blurb: 'Police clearance certificates and related permits.',
    agencyCodes: ['GPF'],
    keywords: ['police', 'clearance', 'certificate of character'],
  },
  {
    id: 'firearms',
    name: 'Firearms Licensing',
    blurb: 'Firearm licences, renewals and transfers.',
    agencyCodes: ['FLA', 'MOHA'],
    keywords: ['firearm', 'weapon', 'ammunition'],
  },
];

const isPermitish = (name = '', desc = '', keywords = []) => {
  const hay = `${name} ${desc}`.toLowerCase();
  return keywords.some((k) => hay.includes(k));
};

export default function PermitsPage() {
  const navigate = useNavigate();

  const agencies = useQuery({ queryKey: ['agencies-all'], queryFn: () => get('/catalogue/agencies') });
  const agencyList = useMemo(() => agencies.data?.items || [], [agencies.data]);

  // Fetch services for every agency that could hold a permit, then group by body.
  const relevantCodes = useMemo(() => {
    const wanted = new Set(BODIES.flatMap((b) => b.agencyCodes));
    return agencyList.filter((a) => wanted.has(a.code)).map((a) => a.code);
  }, [agencyList]);

  const services = useQuery({
    queryKey: ['permit-services', relevantCodes],
    enabled: relevantCodes.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        relevantCodes.map((code) =>
          get(`/catalogue/agencies/${code}/services`)
            .then((d) => (d.services || []).map((s) => ({ ...s, agencyCode: code, agencyName: d.agency?.name })))
            .catch(() => []),
        ),
      );
      return results.flat();
    },
  });

  const allServices = services.data || [];

  const groups = BODIES.map((body) => ({
    ...body,
    services: allServices.filter(
      (s) => body.agencyCodes.includes(s.agencyCode) && isPermitish(s.name, s.description, body.keywords),
    ),
  }));

  const totalPermits = groups.reduce((n, g) => n + g.services.length, 0);
  const loading = agencies.isLoading || services.isLoading;

  return (
    <div className="w-full">
      <PageHeader
        title="Permits"
        subtitle="Every permit and licence government issues, grouped by the body that issues it."
      />

      {loading ? <GridSkeleton count={4} />
        : agencies.error ? <ErrorState error={agencies.error} title="Could not load permits" onRetry={agencies.refetch} />
        : (
          <div className="oc-stack">
            {totalPermits === 0 && (
              <SectionCard>
                <EmptyState
                  icon={<GlyphStamp />}
                  title="No permits available online yet"
                  hint="Permits are being brought onto the portal body by body. Contact the help desk for the current in-person process."
                  action={<Button onClick={() => navigate('/help/contact')}>Contact support</Button>}
                />
              </SectionCard>
            )}

            {groups.map((g) => (
              <SectionCard
                key={g.id}
                title={g.name}
                action={<Chip tone={g.services.length ? 'ok' : 'muted'} dot={false}>
                  {g.services.length ? `${g.services.length} available` : 'Not yet online'}
                </Chip>}
              >
                <p className="text-sm text-muted dark:text-d-muted -mt-2 mb-4">{g.blurb}</p>

                {g.services.length === 0 ? (
                  <div className="rounded-tile bg-tint dark:bg-d-tint p-3.5">
                    <p className="text-sm">
                      These permits are not yet available to apply for online. You can still{' '}
                      <button type="button" className="oc-link" onClick={() => navigate('/help/centers')}>
                        visit a service centre
                      </button>{' '}
                      or{' '}
                      <button type="button" className="oc-link" onClick={() => navigate('/help/contact')}>
                        contact the help desk
                      </button>.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 xl:gap-3.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6">
                    {g.services.map((s) => (
                      <ServiceTile
                        key={s.id}
                        icon={<GlyphStamp size={20} />}
                        label={s.name}
                        sub={s.agencyName}
                        onClick={() => navigate(`/services/${s.id}`)}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>
            ))}
          </div>
        )}
    </div>
  );
}

function GlyphStamp({ size = 22 }) {
  return (
    <svg aria-hidden viewBox="0 0 18 18" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h6v4l2 2v2H4V9l2-2zM4 13h10v2H4z" />
    </svg>
  );
}
