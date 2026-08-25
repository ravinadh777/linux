import { getServiceForm } from '../apply/forms/index.js';

/**
 * The section/field definitions for a Tint service, for READ-ONLY rendering.
 *
 * Reuses the very same definitions the apply form is built from, so the detail view's
 * labels are guaranteed to match the labels the citizen filled in, and a field added
 * to the form shows up on the detail page with no second edit. The alternative —
 * hand-listing formData keys on the detail page — drifts the first time a label
 * changes and quietly shows the citizen a different question than the one they answered.
 */
export const sectionsFor = (serviceId) => getServiceForm(serviceId)?.sections || [];
