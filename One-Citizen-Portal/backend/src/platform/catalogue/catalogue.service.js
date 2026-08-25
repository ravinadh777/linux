// Service catalogue (FR-P9). Ministries → agencies → services. Loaded from seed at boot.
import { NotFoundError } from '../../lib/errors.js';

// Form field definitions live in the frontend (frontend/src/features/apply/forms). The
// catalogue serves service *metadata* only — the API never dictates form fields.
export function createCatalogueService({ data }) {
  const ministries = data || [];
  const allServices = ministries.flatMap((m) =>
    (m.agencies || []).flatMap((a) =>
      (a.services || []).map((s) => ({ ...s, ministryCode: m.code, ministryName: m.name, agencyCode: a.code, agencyName: a.name })),
    ),
  );

  return {
    ministries: () => ministries.map((m) => ({ code: m.code, name: m.name, agencyCount: (m.agencies || []).length })),

    agencies: (ministryCode) => {
      const m = ministries.find((x) => x.code === ministryCode);
      if (!m) throw new NotFoundError('Ministry not found');
      return { ministry: { code: m.code, name: m.name }, agencies: (m.agencies || []).map((a) => ({ code: a.code, name: a.name, serviceCount: (a.services || []).length })) };
    },

    // Flat list of every agency across all ministries — the catalogue entry point.
    agenciesAll: () =>
      ministries.flatMap((m) =>
        (m.agencies || []).map((a) => ({
          code: a.code, name: a.name, ministryCode: m.code, ministryName: m.name, serviceCount: (a.services || []).length,
          // Service names for the agency tile (shown instead of a count).
          services: (a.services || []).map((s) => s.name),
          // Redirect-only agencies (e.g. NIS) live in an external micro-frontend rather than an
          // internal services list. When present, the catalogue tile deep-links there instead.
          ...(a.externalUrl ? { externalUrl: a.externalUrl } : {}),
          ...(a.description ? { description: a.description } : {}),
        })),
      ),

    services: (agencyCode) => {
      for (const m of ministries) {
        const a = (m.agencies || []).find((x) => x.code === agencyCode);
        if (a) return { ministry: { code: m.code, name: m.name }, agency: { code: a.code, name: a.name }, services: a.services || [] };
      }
      throw new NotFoundError('Agency not found');
    },

    service: (id) => {
      const s = allServices.find((x) => x.id === id);
      if (!s) throw new NotFoundError('Service not found');
      return { ...s };
    },

    /** Dynamic search across ministries, agencies and services. */
    search: (q, limit = 20) => {
      const term = String(q || '').trim().toLowerCase();
      if (!term) return { results: [] };
      const results = [];
      for (const m of ministries) {
        if (m.name.toLowerCase().includes(term)) {
          results.push({ type: 'ministry', id: m.code, label: m.name, sublabel: 'Ministry', to: `/ministries/${m.code}` });
        }
        for (const a of m.agencies || []) {
          if (a.name.toLowerCase().includes(term)) {
            results.push({ type: 'agency', id: a.code, label: a.name, sublabel: m.name, to: `/agencies/${a.code}` });
          }
        }
      }
      for (const s of allServices) {
        if (s.name.toLowerCase().includes(term) || (s.description || '').toLowerCase().includes(term)) {
          results.push({ type: 'service', id: s.id, label: s.name, sublabel: `${s.agencyName} · ${s.ministryName}`, to: `/services/${s.id}` });
        }
      }
      return { results: results.slice(0, limit) };
    },

    full: () => ministries,
  };
}
