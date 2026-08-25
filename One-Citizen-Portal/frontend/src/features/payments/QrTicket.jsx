import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { Button, DataRow, Chip } from '../../ui/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// QR issuance for Minister's change #5.
//
// The code encodes a payment/booking REFERENCE — never card data. It is the thing a
// ferry clerk or agency cashier scans to look the record up, exactly like the
// reference printed on a paper ticket.
//
// Encoded with `qrcode.react` — a real, scannable QR with proper Reed-Solomon error
// correction. Deliberately a library rather than hand-rolled: QR error correction is
// the class of thing you do not implement yourself. It renders locally as SVG, so
// nothing is sent to a third-party image service to be turned into a picture (and the
// portal's CSP would block one anyway).
//
// HONEST LABELLING: there is no payment or ticketing endpoint in this build, so the
// dialog says plainly that this is a reference to present, not proof of payment. The
// reference derives from the citizen's own identifier, so it is real and stable —
// not invented data.
// ─────────────────────────────────────────────────────────────────────────────
import { QRCodeSVG } from 'qrcode.react';

const get = (url) => api.get(url).then((r) => r.data);

/** Deterministic, human-readable reference. Same citizen + channel + day → same code. */
function buildReference(channelId, subject) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const tail = String(subject || 'GUEST').replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase();
  return `GY-${channelId.toUpperCase()}-${day}-${tail}`;
}

export default function QrTicket({ channel, onClose }) {
  const me = useQuery({ queryKey: ['me'], queryFn: () => get('/me') });

  const reference = useMemo(
    () => buildReference(channel.id, me.data?.profile?.nationalId || me.data?.id || me.data?.email),
    [channel.id, me.data],
  );

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="qr-title" className="oc-page-title">{channel.label}</h2>
          <p className="text-sm text-muted dark:text-d-muted mt-1">{channel.agency}</p>
        </div>
        <Chip tone="warn" dot={false}>Reference only</Chip>
      </div>

      <div className="mt-5 flex justify-center">
        {/* White quiet zone is required for a scanner to lock on, so the wrapper stays
            white in dark mode too. `level="M"` survives a creased printout. */}
        <div className="p-4 bg-white rounded-card border border-line">
          <QRCodeSVG
            value={reference}
            size={200}
            level="M"
            marginSize={2}
            bgColor="#FFFFFF"
            fgColor="#1A1A1A"
            title={`QR code for reference ${reference}`}
          />
        </div>
      </div>

      <p className="text-center font-mono text-sm font-bold mt-3.5 break-all">{reference}</p>

      <dl className="mt-4 pt-4 border-t border-line dark:border-d-line m-0">
        <DataRow label="Issued to" value={me.data?.name} />
        <DataRow label="Issued" value={new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} />
        <DataRow label="Channel" value={channel.agency} />
      </dl>

      <div className="mt-4 p-3 rounded-tile bg-warn-tint text-warn-text">
        <p className="text-sm">
          <b>This is a reference, not proof of payment.</b> Show it at the counter or gate so the
          clerk can find your record. Payment is taken by the agency, not by this portal.
        </p>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 mt-5">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button variant="secondary" onClick={() => window.print()}>Print</Button>
      </div>
    </div>
  );
}
