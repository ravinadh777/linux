// Serves cached reference data (FR-P: regions, LAs, fee schedules, doc types, reason codes).
export function createReferenceService({ data }) {
  return {
    regions: () => data.regions || [],
    localAuthorities: () => data.localAuthorities || [],
    feeSchedules: () => data.feeSchedules || [],
    documentTypes: () => data.documentTypes || [],
    reasonCodes: (context) => (context ? data.reasonCodes?.[context] || [] : data.reasonCodes || {}),
    /**
     * GRO civil-registration list, grouped by category (Minister's change #3).
     * `expectedTotal` vs `items.length` lets the UI state honestly how much of the
     * 24-item list is configured, rather than implying the set is complete.
     */
    /**
     * MOHA Tint Waiver option lists + landing-page copy.
     *
     * `configured` is the important field. The MOHA API exposes no lookup endpoints,
     * so these lists are seeded from data/seed/reference/tint.json and may legitimately
     * be EMPTY until MOHA supplies the authoritative values. Reporting per-list
     * emptiness lets the form render an honest "awaiting reference data" state and
     * block that field, instead of the UI silently showing a select with no options
     * and the citizen assuming the page is broken.
     *
     * Keys prefixed `_` in the JSON are documentation and are not served.
     */
    tint: () => {
      const t = data.tint || {};
      const list = (k) => (Array.isArray(t[k]) ? t[k] : []);
      const lists = {
        exemptionCategories: list('exemptionCategories'),
        medicalConditions: list('medicalConditions'),
        vehicleTypes: list('vehicleTypes'),
        vehicleColours: list('vehicleColours'),
        vehicleMakes: list('vehicleMakes'),
      };
      return {
        ...lists,
        // Year of manufacture is derived, never stored: a hardcoded list would go
        // stale every January.
        vehicleYears: (() => {
          const now = new Date().getFullYear();
          const years = [];
          for (let y = now + 1; y >= 1950; y -= 1) years.push(String(y));
          return years;
        })(),
        vltLimits: list('vltLimits'),
        steps: list('steps'),
        requirements: t.requirements || {},
        minister: t.minister || null,
        permitValidityYears: t._permitValidityYears ?? null,
        testingLocationCount: t._testingLocationCount ?? null,
        testingLocationsUrl: t._testingLocationsUrl || '',
        configured: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length > 0])),
      };
    },

    civilRegistration: () => {
      const cr = data.civilRegistration || { categories: [], items: [], expectedTotal: 0 };
      const items = cr.items || [];
      return {
        expectedTotal: cr.expectedTotal || 0,
        configured: items.length,
        categories: (cr.categories || []).map((c) => ({
          ...c,
          items: items.filter((i) => i.category === c.code),
        })),
        items,
      };
    },
  };
}
