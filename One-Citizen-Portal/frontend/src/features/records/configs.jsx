import { cell } from './RecordsPage.jsx';
import { REGIONS } from '../apply/forms/regions.js';

// ─────────────────────────────────────────────────────────────────────────────
// Per-collection configuration for the generic RecordsPage.
//
// Field keys match the backend write allow-lists in
// backend/src/platform/records/records.service.js exactly — anything not on that
// list is dropped server-side, so these two must agree.
//
// Copy is written for a citizen, not a database: "Vehicles you own", not
// "Vehicle entities".
// ─────────────────────────────────────────────────────────────────────────────

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
const Glyph = ({ d, size = 22 }) => <svg aria-hidden viewBox="0 0 18 18" width={size} height={size} {...S}><path d={d} /></svg>;

export const VEHICLES = {
  collection: 'vehicles',
  title: 'Vehicles',
  subtitle: 'Vehicles registered to you. These pre-fill licence renewals and fitness applications.',
  addLabel: 'Add a vehicle',
  emptyTitle: 'No vehicles on record',
  emptyHint: 'Add a vehicle and its details will pre-fill your licence renewal and certificate of fitness applications.',
  icon: <Glyph d="M3 11l1.2-3.4A1.5 1.5 0 0 1 5.6 6.5h6.8a1.5 1.5 0 0 1 1.4 1.1L15 11v3H3zM5.5 14v1M12.5 14v1M3 11h12" />,
  columns: [
    { key: 'registration', header: 'Registration', render: cell.strong('registration') },
    { key: 'vehicle', header: 'Vehicle', render: (r) => [r.make, r.model, r.year && `(${r.year})`].filter(Boolean).join(' ') || '—' },
    { key: 'colour', header: 'Colour', render: cell.text('colour') },
    { key: 'licenceExpiry', header: 'Licence expires', render: cell.date('licenceExpiry') },
  ],
  fields: [
    { key: 'registration', label: 'Registration number', required: true, placeholder: 'PAA 1234' },
    { key: 'make', label: 'Make', placeholder: 'Toyota' },
    { key: 'model', label: 'Model', placeholder: 'Axio' },
    { key: 'year', label: 'Year', type: 'number', inputMode: 'numeric', placeholder: '2016' },
    { key: 'colour', label: 'Colour', placeholder: 'Silver' },
    { key: 'bodyType', label: 'Body type', placeholder: 'Sedan' },
    { key: 'engineNo', label: 'Engine number' },
    { key: 'chassisNo', label: 'Chassis number' },
    { key: 'licenceClass', label: 'Licence class', placeholder: 'MV' },
    { key: 'licenceExpiry', label: 'Licence expiry', type: 'date' },
    { key: 'insurer', label: 'Insurer' },
    { key: 'insuranceExpiry', label: 'Insurance expiry', type: 'date' },
    { key: 'fitnessExpiry', label: 'Fitness expiry', type: 'date' },
    { key: 'notes', label: 'Notes', full: true },
  ],
};

export const PROPERTIES = {
  collection: 'properties',
  title: 'Properties',
  subtitle: 'Land and buildings you own. These pre-fill building permits and property-rate payments.',
  addLabel: 'Add a property',
  emptyTitle: 'No properties on record',
  emptyHint: 'Add a property and its details will pre-fill construction permits and property-rate payments.',
  icon: <Glyph d="M3 8.5L9 3.5l6 5V16H3zM7.5 16v-4h3v4" />,
  columns: [
    { key: 'address', header: 'Address', render: (r) => <span className="font-bold">{[r.lot, r.street, r.village].filter(Boolean).join(', ') || '—'}</span> },
    { key: 'region', header: 'Region', render: cell.text('region') },
    { key: 'propertyType', header: 'Type', render: cell.text('propertyType') },
    { key: 'titleNumber', header: 'Title / transport', render: (r) => r.titleNumber || r.transportNumber || '—' },
  ],
  fields: [
    { key: 'lot', label: 'Lot / house number', placeholder: '12' },
    { key: 'street', label: 'Street / scheme', placeholder: 'Camp Street' },
    { key: 'village', label: 'Village / ward', required: true, placeholder: 'Georgetown' },
    { key: 'region', label: 'Region', type: 'select', required: true, options: REGIONS },
    { key: 'localAuthority', label: 'Local authority' },
    { key: 'propertyType', label: 'Property type', type: 'select', options: ['Residential', 'Commercial', 'Agricultural', 'Mixed use', 'Vacant land'] },
    { key: 'tenure', label: 'Tenure', type: 'select', options: ['Freehold', 'Leasehold', 'Transport', 'Rented'] },
    { key: 'titleNumber', label: 'Title number' },
    { key: 'transportNumber', label: 'Transport number' },
    { key: 'rateAccount', label: 'Property-rate account' },
    { key: 'valuation', label: 'Valuation (GYD)', type: 'number', inputMode: 'numeric' },
    { key: 'notes', label: 'Notes', full: true },
  ],
};

export const EMPLOYMENT = {
  collection: 'employment',
  title: 'Employment',
  subtitle: 'Your work history. This supports NIS contributions, loan letters and income declarations.',
  addLabel: 'Add employment',
  emptyTitle: 'No employment on record',
  emptyHint: 'Add your current and past jobs to support NIS claims and income declarations.',
  icon: <Glyph d="M2.5 6.5h13v8h-13zM6.5 6.5V4.5h5v2M2.5 10h13" />,
  columns: [
    { key: 'employer', header: 'Employer', render: cell.strong('employer') },
    { key: 'position', header: 'Position', render: cell.text('position') },
    { key: 'period', header: 'Period', render: (r) => `${r.startDate || '—'} → ${r.current ? 'present' : (r.endDate || '—')}` },
    { key: 'current', header: 'Status', render: cell.flag('current', 'Current') },
  ],
  fields: [
    { key: 'employer', label: 'Employer', required: true },
    { key: 'position', label: 'Position / job title' },
    { key: 'employmentType', label: 'Type', type: 'select', options: ['Full-time', 'Part-time', 'Self-employed', 'Contract', 'Casual'] },
    { key: 'employerTin', label: "Employer's TIN" },
    { key: 'startDate', label: 'Start date', type: 'date' },
    { key: 'endDate', label: 'End date', type: 'date', help: 'Leave blank if this is your current job' },
    { key: 'monthlySalary', label: 'Monthly salary (GYD)', type: 'number', inputMode: 'numeric' },
    { key: 'nisNumber', label: 'NIS number' },
    { key: 'current', label: 'This is my current job', type: 'checkbox', full: true },
    { key: 'notes', label: 'Notes', full: true },
  ],
};

export const FAMILY = {
  collection: 'family',
  title: 'Family',
  subtitle: 'The people in your household. Linking them supports dependant claims and child grants.',
  addLabel: 'Add a family member',
  emptyTitle: 'No family members added',
  emptyHint: 'Add the people in your household so their records link to yours for dependant and child-grant claims.',
  icon: <Glyph d="M7 4.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM2.5 15c0-2.5 2-3.9 4.5-3.9s4.5 1.4 4.5 3.9M12.5 6.2a2 2 0 1 1 0 4M13 11.8c1.7.3 2.9 1.5 2.9 3.4" />,
  columns: [
    { key: 'fullName', header: 'Name', render: cell.strong('fullName') },
    { key: 'relationship', header: 'Relationship', render: cell.text('relationship') },
    { key: 'dob', header: 'Date of birth', render: cell.date('dob') },
    { key: 'isDependant', header: 'Dependant', render: cell.flag('isDependant', 'Dependant') },
  ],
  fields: [
    { key: 'fullName', label: 'Full name', required: true },
    {
      key: 'relationship', label: 'Relationship', type: 'select', required: true,
      options: ['Spouse', 'Husband', 'Wife', 'Son', 'Daughter', 'Mother', 'Father', 'Brother', 'Sister', 'Guardian', 'Other'],
    },
    { key: 'dob', label: 'Date of birth', type: 'date' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
    { key: 'nationalId', label: 'National ID number' },
    { key: 'phone', label: 'Mobile number', type: 'tel', inputMode: 'tel' },
    { key: 'isDependant', label: 'This person depends on me financially', type: 'checkbox', full: true },
    { key: 'notes', label: 'Notes', full: true },
  ],
};

export const WALLET_METHODS = {
  collection: 'wallet',
  title: 'Payment methods',
  subtitle: 'How you pay for government services. Only enough to recognise a method is stored.',
  addLabel: 'Add a payment method',
  emptyTitle: 'No payment methods saved',
  emptyHint: 'Save a method so paying a bill takes one tap instead of re-entering details each time.',
  icon: <Glyph d="M3 5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3zM12 9h2" />,
  columns: [
    { key: 'label', header: 'Method', render: cell.strong('label') },
    { key: 'kind', header: 'Type', render: cell.text('kind') },
    { key: 'last4', header: 'Ending', render: (r) => (r.last4 ? `•••• ${r.last4}` : '—') },
    { key: 'isDefault', header: '', render: cell.flag('isDefault', 'Default') },
  ],
  fields: [
    {
      key: 'kind', label: 'Type', type: 'select', required: true,
      options: [
        { value: 'card', label: 'Debit / credit card' },
        { value: 'mmg', label: 'MMG Mobile Money' },
        { value: 'bank', label: 'Bank account' },
      ],
    },
    { key: 'label', label: 'Name for this method', required: true, placeholder: 'Republic Bank Visa' },
    { key: 'provider', label: 'Provider / bank', placeholder: 'Republic Bank' },
    {
      key: 'last4', label: 'Last 4 digits', maxLength: 4, inputMode: 'numeric', placeholder: '4242',
      pattern: '^\\d{4}$', patternHint: 'Enter exactly 4 digits.',
      help: 'Only the last 4 digits are stored — never the full number',
    },
    { key: 'expiryMonth', label: 'Expiry month', maxLength: 2, inputMode: 'numeric', placeholder: '09' },
    { key: 'expiryYear', label: 'Expiry year', maxLength: 4, inputMode: 'numeric', placeholder: '2029' },
    { key: 'isDefault', label: 'Use this as my default method', type: 'checkbox', full: true },
  ],
};
