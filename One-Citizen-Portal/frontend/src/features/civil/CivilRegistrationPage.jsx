import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, SectionCard, ServiceTile, EmptyState, ErrorState, GridSkeleton, Chip, Button,
} from '../../ui/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// MINISTER'S CHANGE #3 — the GRO civil-registration list, grouped by births,
// deaths and marriages.
//
// Driven entirely by /reference/civil-registration, which reads
// data/seed/reference/civil-registration.json. The Minister asked for 24 items;
// the list supplied so far covers the 3 that exist as real catalogue services.
//
// The screen states that honestly ("3 of 24 listed") rather than implying the set is
// complete, and adding the remaining 21 is a JSON edit with no code change. An item
// with no `serviceId` renders WITHOUT an apply action instead of linking to a route
// that does not exist.
// ─────────────────────────────────────────────────────────────────────────────

const get = (url) => api.get(url).then((r) => r.data);

export default function CivilRegistrationPage() {
  const navigate = useNavigate();

  const cr = useQuery({
    queryKey: ['civil-registration'],
    queryFn: () => get('/reference/civil-registration'),
  });

  const data = cr.data;
  const categories = data?.categories || [];
  const configured = data?.configured ?? 0;
  const expected = data?.expectedTotal ?? 0;
  const partial = expected > 0 && configured < expected;

  return (
    <div className="w-full">
      <PageHeader
        title="Civil registration"
        subtitle="Birth, death and marriage records held by the General Register Office."
        actions={data && (
          <Chip tone={partial ? 'warn' : 'ok'} dot={false}>
            {configured} of {expected} listed
          </Chip>
        )}
      />

      {cr.isLoading ? <GridSkeleton count={3} />
        : cr.error ? <ErrorState error={cr.error} title="Could not load the civil registration list" onRetry={cr.refetch} />
        : (
          <div className="oc-stack">
            {/* Says plainly how much of the list is configured, so nobody mistakes a
                partial list for the whole set. */}
            {partial && (
              <div className="oc-card bg-warn-tint border-warn/30">
                <p className="text-sm text-warn-text">
                  <b>{configured} of {expected} services are listed here.</b> The remaining{' '}
                  {expected - configured} are being added to the catalogue. For anything not shown,
                  the General Register Office can help in person.
                </p>
                <div className="mt-3">
                  <Button size="sm" variant="secondary" onClick={() => navigate('/help/centers')}>
                    Find a service centre
                  </Button>
                </div>
              </div>
            )}

            {categories.length === 0 ? (
              <SectionCard>
                <EmptyState
                  icon={<GlyphCert />}
                  title="No civil registration services listed"
                  hint="The list has not been configured yet. The General Register Office can help in person in the meantime."
                  action={<Button onClick={() => navigate('/help/contact')}>Contact support</Button>}
                />
              </SectionCard>
            ) : (
              categories.map((c) => (
                <SectionCard
                  key={c.code}
                  title={c.label}
                  action={<Chip tone={c.items.length ? 'ok' : 'muted'} dot={false}>{c.items.length}</Chip>}
                >
                  {c.description && (
                    <p className="text-sm text-muted dark:text-d-muted -mt-2 mb-4">{c.description}</p>
                  )}

                  {c.items.length === 0 ? (
                    <p className="text-sm text-muted dark:text-d-muted">
                      Nothing listed in this category yet.
                    </p>
                  ) : (
                    <div className="grid gap-3 xl:gap-3.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6">
                      {c.items.map((item) => (
                        item.serviceId ? (
                          <ServiceTile
                            key={item.code}
                            icon={<GlyphCert size={20} />}
                            label={item.label}
                            sub={item.agency}
                            onClick={() => navigate(`/services/${item.serviceId}`)}
                          />
                        ) : (
                          // No applyable service — presented as information, not a
                          // link that would 404.
                          <div key={item.code} className="oc-tile cursor-default opacity-80">
                            <span aria-hidden className="oc-tile-icon"><GlyphCert size={20} /></span>
                            <span className="oc-tile-label block">{item.label}</span>
                            <span className="block text-micro text-muted dark:text-d-muted mt-1">In person only</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </SectionCard>
              ))
            )}
          </div>
        )}
    </div>
  );
}

function GlyphCert({ size = 22 }) {
  return (
    <svg aria-hidden viewBox="0 0 18 18" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 3h10v8H4zM6.5 13.5l2.5-2 2.5 2v-3M6.5 6h5M6.5 8.5h3" />
    </svg>
  );
}
