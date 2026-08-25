// Appointments engine (FR-P5 / S1.6) — slot inventory + atomic booking with double-book
// prevention. Persistence is the JSON repository today; swapping to a DB needs no API change.
import { NotFoundError, ValidationError, ConflictError } from '../../lib/errors.js';
import { Mutex } from '../../lib/mutex.js';
import { resolveSubject } from '../../lib/authz.js';
import { SYSTEM_CTX } from '../../config/repositories.js';

// Participating offices (authoritative for slot inventory).
const OFFICES = [
  { code: 'cipo-georgetown', name: 'CIPO — Passport Office, Georgetown' },
  { code: 'cipo-berbice', name: 'CIPO — Berbice (New Amsterdam)' },
  { code: 'cipo-essequibo', name: 'CIPO — Essequibo (Anna Regina)' },
  { code: 'gro-georgetown', name: 'GRO — General Register Office, Georgetown' },
  { code: 'gra-lro', name: 'GRA — Licence Revenue Office, Georgetown' },
  { code: 'mhsss-regional', name: 'MHSSS — Regional Office' },
];

const START_HOUR = 8;   // 8:00 AM
const END_HOUR = 16;    // last slot starts 3:30 PM
const STEP_MIN = 30;

const pad = (n) => String(n).padStart(2, '0');
function to12(h, m) {
  const period = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${pad(m)} ${period}`;
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function baseSlots(date) {
  const out = [];
  for (let h = START_HOUR; h < END_HOUR; h += 1) {
    for (let m = 0; m < 60; m += STEP_MIN) {
      out.push({ id: `${date}_${pad(h)}${pad(m)}`, time24: `${pad(h)}:${pad(m)}`, label: to12(h, m), period: h < 12 ? 'Morning' : 'Afternoon' });
    }
  }
  return out;
}
const isWeekend = (date) => {
  const d = new Date(`${date}T00:00:00`);
  const g = d.getDay();
  return g === 0 || g === 6;
};

export function createAppointmentsService({ repos, events }) {
  // Per-(office,date) locks serialise the read-then-book so two citizens can't take one slot.
  const locks = new Map();
  const lockFor = (key) => {
    if (!locks.has(key)) locks.set(key, new Mutex());
    return locks.get(key);
  };

  const ctxFor = (auth) => ({ actor: auth.sub, roles: auth.roles, scope: { where: { ownerId: resolveSubject(auth) } } });

  // Times already taken at an office/date — read across ALL citizens (system ctx) so a slot
  // booked by anyone blocks everyone.
  async function bookedTimes(office, date) {
    const { items } = await repos.appointments.find({}, SYSTEM_CTX, { limit: 1000 });
    return new Set(items.filter((a) => a.office === office && a.date === date && a.status !== 'cancelled').map((a) => a.time24));
  }

  // Deterministic "busy" pattern → simulates other people's appointments so the calendar
  // shows a realistic mix even before real bookings exist. Stable per office/date.
  const busyByOthers = (office, date, index) => (hashStr(`${office}|${date}`) + index * 7) % 3 === 0;

  return {
    offices: () => OFFICES,

    async slots({ office, date }) {
      if (!office || !date) throw new ValidationError('office and date are required');
      if (!OFFICES.find((o) => o.code === office)) throw new NotFoundError('Office not found');
      if (isWeekend(date)) return { office, date, closed: true, reason: 'Weekend — office closed', slots: [], summary: { total: 0, available: 0 } };

      const booked = await bookedTimes(office, date);
      const slots = baseSlots(date).map((s, i) => ({
        ...s,
        available: !busyByOthers(office, date, i) && !booked.has(s.time24),
      }));
      return { office, date, closed: false, slots, summary: { total: slots.length, available: slots.filter((s) => s.available).length } };
    },

    async book({ auth, office, date, slotId, fullName, phone, purpose, notes }) {
      if (!office || !date || !slotId) throw new ValidationError('office, date and slotId are required');
      const officeRec = OFFICES.find((o) => o.code === office);
      if (!officeRec) throw new NotFoundError('Office not found');
      if (isWeekend(date)) throw new ValidationError('The office is closed on weekends.');
      const all = baseSlots(date);
      const idx = all.findIndex((s) => s.id === slotId);
      const slot = all[idx];
      if (!slot) throw new ValidationError('Invalid slot for this date.');

      return lockFor(`${office}|${date}`).runExclusive(async () => {
        // Re-check availability under the lock — this is the atomic block.
        const booked = await bookedTimes(office, date);
        if (busyByOthers(office, date, idx) || booked.has(slot.time24)) {
          throw new ConflictError('That slot has just been taken. Please choose another time.');
        }
        const ownerId = resolveSubject(auth);
        const reference = `APT-2026-${Math.floor(100000 + (Date.now() % 900000))}`;
        const rec = await repos.appointments.create(
          {
            ownerId,
            reference,
            office,
            officeName: officeRec.name,
            date,
            slotId,
            time24: slot.time24,
            timeLabel: slot.label,
            purpose: purpose || null,
            notes: notes || null,
            fullName: fullName || null,
            phone: phone || null,
            status: 'booked',
            timeline: [{ at: new Date().toISOString(), event: 'Booked', note: `${slot.label} confirmed at ${officeRec.name}.` }],
          },
          SYSTEM_CTX,
        );
        try {
          await events?.emit?.({ type: 'appointment.booked', payload: { appointmentId: rec.id, office, date, time: slot.time24, ownerId }, actor: auth.sub });
        } catch { /* eventing is best-effort */ }
        return rec;
      });
    },

    async listMine({ auth }) {
      const { items } = await repos.appointments.find({}, ctxFor(auth), { limit: 100 });
      return items.sort((a, b) => (`${a.date}${a.time24}` < `${b.date}${b.time24}` ? 1 : -1));
    },

    async get({ auth, id }) {
      const rec = await repos.appointments.findById(id, ctxFor(auth));
      if (!rec) throw new NotFoundError('Appointment not found');
      return rec;
    },
  };
}
