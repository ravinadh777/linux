// ── AskGov agent engine (deterministic, file-data-backed) ─────────────────────────────
// This is the ONE swap seam for AI. `respond({ text, profile, context })` returns the
// agent turn `{ reply, actions, suggestions }`. To use a real model later, implement the
// same function signature + return shape (e.g. createAiEngine()) and inject it into
// createAssistantService — routes, the /assistant/message contract, and the whole UI stay
// exactly the same. Nothing downstream knows whether a rule engine or an LLM answered.

const INTENTS = [
  { test: /passport/, reply: 'Passports are handled by the Central Immigration & Passport Office (CIPO).', to: '/agencies/CIPO', label: 'Passport services' },
  { test: /(birth|death|marriage|certificate)/, reply: 'Civil certificates are issued by the General Register Office (GRO).', to: '/agencies/GRO', label: 'Certificate services' },
  { test: /(pension|old.?age)/, reply: 'The old-age pension is universal for residents aged 65+ and never auto-enrols — you always confirm.', to: '/services/old-age-pension', label: 'Old-Age Pension' },
  { test: /(grant|payout|cash)/, reply: 'Cash grant programmes are run by the Ministry of Finance.', to: '/services/cash-grant', label: 'Cash Grant' },
  { test: /(licence|license|driver|vehicle|tin|tax)/, reply: 'Tax and licensing services are provided by the Guyana Revenue Authority (GRA).', to: '/agencies/GRA', label: 'GRA services' },
  { test: /(appointment|book|slot)/, reply: 'You can book an appointment at any participating ministry office.', to: '/services/book-appointment/apply', label: 'Book an appointment' },
  { test: /(track|status|progress)/, reply: 'Here are your applications and appointments with their live status.', to: '/tracking', label: 'Open Tracking' },
  { test: /(home|house|construction|permit)/, reply: 'One Home Guyana provides a single-window construction permit with utility connections.', to: '/services/construction-permit', label: 'One Home' },
  { test: /(agenc|service|catalog|catalogue|browse)/, reply: 'Browse every government agency and its services here.', to: '/agencies', label: 'Browse agencies' },
];

const EXPLAIN = {
  'passport-new': 'A new adult passport from CIPO. Provide your personal, citizenship and contact details, attach your National ID, birth certificate and a passport photo, then submit. Biometrics and a decision follow.',
  'passport-renew': 'Renew an existing passport. You mainly confirm your current passport details and attach it plus your National ID and a recent photo.',
  'birth-cert': 'A certified copy of a birth record from the GRO. Give the record and requester details, choose how many copies, and how to collect it.',
  'driver-licence': "Apply for, renew or upgrade a driver's licence with the GRA. Include your details, licence class and an eye-test certificate.",
  'mv-licence': 'Renew a motor-vehicle licence with the GRA. Confirm the vehicle, insurance and fitness details.',
  'old-age-pension': 'The universal old-age pension for residents 65+. Give your details, address, next of kin and how you want to be paid.',
  'construction-permit': 'A single-window construction permit (One Home Guyana) that also coordinates water, electricity and gas connections.',
};

const rx = {
  email: /([\w.+-]+@[\w-]+\.[\w.-]+)/i,
  phone: /(\+?\d[\d ()-]{6,}\d)/,
  date: /\b(\d{4}-\d{2}-\d{2})\b/,
  name: /\b(?:my name is|i am|i'm)\s+([a-z][a-z .'-]{2,})/i,
};

const ALIASES = {
  fullname: 'fullName', personname: 'fullName', requestername: 'fullName', name: 'fullName',
  surname: 'surname', givennames: 'givenNames', title: 'title',
  nationalid: 'nationalId', requesterid: 'nationalId', tin: 'tin',
  dob: 'dob', dateofbirth: 'dob',
  sex: 'gender', gender: 'gender', maritalstatus: 'maritalStatus', occupation: 'occupation',
  phone: 'phone', mobile: 'phone', email: 'email',
  lot: 'lot', street: 'street', village: 'village', region: 'region',
  placeofbirth: 'placeOfBirth', countryofbirth: 'countryOfBirth',
  nationalityatbirth: 'nationalityAtBirth', presentnationality: 'presentNationality',
  mothersname: 'mothersName', mothersmaidenname: 'mothersMaidenName', fathersname: 'fathersName',
  nextofkin: 'nextOfKin', nextofkinrelationship: 'nextOfKinRelationship', nextofkinphone: 'nextOfKinPhone',
};

const isEmpty = (v, type) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0) || (type === 'checkbox' && v !== true);

// Confident value straight from the citizen's profile.
function fromProfile(field, profile) {
  const n = (field.name || '').toLowerCase();
  const key = ALIASES[n] || (field.type === 'email' ? 'email' : field.type === 'tel' || /phone|mobile/.test(n) ? 'phone' : null);
  if (!key) return undefined;
  const v = profile?.[key];
  if (v === undefined || v === null || v === '') return undefined;
  if (field.type === 'select' && Array.isArray(field.options) && !field.options.includes(v)) return undefined;
  return v;
}

// Best-guess fallback for fields the profile can't answer (so a draft feels complete).
function bestGuess(field) {
  const n = (field.name || '').toLowerCase();
  const t = field.type;
  if (t === 'select') return (field.options && field.options[0]) || '';
  if (t === 'multiselect') return field.options ? [field.options[0]] : [];
  if (t === 'number') {
    if (/storey/.test(n)) return 1;
    if (/floor|area/.test(n)) return 90;
    if (/cop/.test(n)) return 1;
    if (/household|people/.test(n)) return 3;
    if (/year/.test(n)) return 2018;
    return 1;
  }
  if (t === 'date') {
    if (/expiry/.test(n)) return '2027-12-31';
    if (/issue/.test(n)) return '2019-01-15';
    return '2026-08-01';
  }
  if (/passport/.test(n)) return 'R1234567';
  if (/reg(istration)?number|regnumber/.test(n)) return 'PXX 1234';
  if (/^make$/.test(n)) return 'Toyota';
  if (/^model$/.test(n)) return 'Corolla';
  if (/insurer/.test(n)) return 'GTM Insurance';
  if (/policy/.test(n)) return 'POL-2026-0088';
  if (/ndc|municipal/.test(n)) return 'Eccles/Ramsburg NDC';
  if (/^block$/.test(n)) return 'X';
  if (/account/.test(n)) return '0012345678';
  if (t === 'textarea') return 'Please process my request at your earliest convenience.';
  return '';
}

const formSuggestions = ['Fill from my profile', 'What documents do I need?', "What's left to fill?", 'Explain this service'];

export function createRuleEngine() {
  return {
    /** @returns {{reply:string, actions:Array, suggestions:string[]}} */
    respond({ text = '', profile = null, context = {} }) {
      const t = String(text).toLowerCase();
      const fields = Array.isArray(context.fields) ? context.fields : [];
      const values = context.values || {};
      const fileFields = fields.filter((f) => f.type === 'file');
      const fillable = fields.filter((f) => f.type !== 'file');
      const onForm = context.mode === 'form' && fields.length > 0;
      const serviceName = context.serviceName || 'this service';

      // ── Which documents? ──
      if (/(document|upload|bring|attach|paper|proof|evidence)/.test(t) && fileFields.length) {
        const req = fileFields.filter((f) => f.required).map((f) => f.label);
        const opt = fileFields.filter((f) => !f.required).map((f) => f.label);
        const lines = [`For ${serviceName} you'll need to upload:`, `• Required: ${req.join(', ') || 'none'}`];
        if (opt.length) lines.push(`• Optional: ${opt.join(', ')}`);
        return { reply: lines.join('\n'), actions: [], suggestions: formSuggestions };
      }

      // ── What's left / missing? ──
      if (onForm && /(missing|left|remaining|what.*(fill|complete)|incomplete|pending|still need)/.test(t)) {
        const missing = fields.filter((f) => f.required && isEmpty(values[f.name], f.type)).map((f) => f.label);
        if (!missing.length) return { reply: 'Everything required is filled in — you can review and submit whenever you’re ready.', actions: [], suggestions: ['Fill remaining optional fields', 'Explain this service'] };
        return { reply: `You still need to complete: ${missing.join(', ')}.`, actions: [], suggestions: ['Fill from my profile', 'What documents do I need?'] };
      }

      // ── Clear the form ──
      if (onForm && /(clear|reset|start over|empty the form|wipe)/.test(t)) {
        return { reply: 'I’ve cleared the form. Want me to fill it from your profile again?', actions: [{ type: 'clear' }], suggestions: ['Fill from my profile'] };
      }

      // ── Fill the form ──
      const wantsFill = /(fill|auto|populate|complete|draft|do it for me|help me fill|for me)/.test(t);
      if (fillable.length && (wantsFill || (onForm && text.trim() === ''))) {
        const vals = {};
        let fromProfileCount = 0;
        for (const f of fillable) {
          const p = fromProfile(f, profile);
          if (p !== undefined) { vals[f.name] = p; fromProfileCount += 1; continue; }
          const g = bestGuess(f);
          if (g !== '' && !(Array.isArray(g) && !g.length)) vals[f.name] = g;
        }
        // Overlay any explicit facts the citizen typed.
        const email = t.match(rx.email)?.[1];
        const phone = text.match(rx.phone)?.[1];
        const date = text.match(rx.date)?.[1];
        const name = text.match(rx.name)?.[1]?.trim();
        for (const f of fillable) {
          const n = f.name.toLowerCase();
          if (email && f.type === 'email') vals[f.name] = email;
          if (phone && (f.type === 'tel' || /phone|mobile/.test(n))) vals[f.name] = phone;
          if (date && f.type === 'date' && /dob|birth/.test(n)) vals[f.name] = date;
          if (name && /name/.test(n) && !/user/.test(n)) vals[f.name] = name;
        }
        const total = Object.keys(vals).length;
        const guessed = total - fromProfileCount;
        return {
          reply: `I’ve drafted ${total} field${total === 1 ? '' : 's'} — ${fromProfileCount} from your profile${guessed > 0 ? ` and ${guessed} as best-guess suggestions to review` : ''}. Please check each one, then submit yourself — I never submit on your behalf.`,
          actions: [{ type: 'prefill', values: vals }],
          suggestions: ["What's left to fill?", 'What documents do I need?', 'Clear the form'],
        };
      }

      // ── Explain a service ──
      if (/(explain|what is|what's this|about this|how does|tell me about)/.test(t)) {
        const ex = EXPLAIN[context.serviceId] || `${serviceName} is a government service. Complete each section, attach the listed documents, then submit — an accountable officer reviews and decides. I can fill it from your profile if you like.`;
        return { reply: ex, actions: [], suggestions: onForm ? formSuggestions : ['Book an appointment', 'Track my application'] };
      }

      // ── Eligibility ──
      if (/(eligib|qualif|entitled)/.test(t)) {
        return {
          reply: 'Residents aged 65+ qualify universally for the Old-Age Pension. Low-income households may qualify for Public Assistance. Suggestions are explainable and never auto-enrol you.',
          actions: [{ type: 'navigate', to: '/services/old-age-pension', label: 'Old-Age Pension' }],
          suggestions: ['Apply for pension', 'Apply for public assistance', 'Track my application'],
        };
      }

      // ── Navigation intents ──
      const matched = INTENTS.find((i) => i.test.test(t));
      if (matched) {
        return { reply: matched.reply, actions: [{ type: 'navigate', to: matched.to, label: matched.label }], suggestions: ['Track my application', 'What am I eligible for?', 'Book an appointment'] };
      }

      // ── Context-aware greeting / fallback ──
      if (onForm) {
        return {
          reply: `I’m AskGov. I can fill ${serviceName} from your profile, tell you which documents to bring, or check what’s left to complete. What would you like?`,
          actions: [],
          suggestions: formSuggestions,
        };
      }
      return {
        reply: "I'm AskGov, your government assistant. I can help you find a service, fill an application from your profile, book an appointment, or track your progress. What do you need?",
        actions: [{ type: 'navigate', to: '/agencies', label: 'Browse agencies' }],
        suggestions: ['Renew my passport', 'Apply for pension', 'Book an appointment', 'Track my application'],
      };
    },
  };
}
