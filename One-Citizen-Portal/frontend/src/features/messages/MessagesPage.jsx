import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PageHeader, SectionCard, Button, EmptyState, ErrorState, ListSkeleton, Chip, cx,
} from '../../ui/index.js';
import { useRecords } from '../records/useRecords.js';

// ─────────────────────────────────────────────────────────────────────────────
// Messages — secure messages sent BY government agencies TO the citizen.
//
// Reads the real /messages collection. A citizen cannot compose one (enforced
// server-side in records.service.js) and cannot delete one — "Archive" sets a flag
// so an agency's message is never destroyed by its recipient. The only citizen
// actions are read and archive, which is exactly what the backend permits.
//
// Marking read updates the sidebar's unread badge through the shared
// `records-summary` invalidation in useRecords.
// ─────────────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const navigate = useNavigate();
  const { items, isLoading, error, refetch, update } = useRecords('messages');
  const [openId, setOpenId] = useState(null);

  const unread = items.filter((m) => !m.isRead).length;

  const openMessage = (m) => {
    setOpenId((cur) => (cur === m.id ? null : m.id));
    if (!m.isRead) update.mutate({ id: m.id, isRead: true });
  };

  const markAllRead = () => {
    items.filter((m) => !m.isRead).forEach((m) => update.mutate({ id: m.id, isRead: true }));
  };

  return (
    <div className="w-full">
      <PageHeader
        title="Messages"
        subtitle="Secure messages from government agencies about your applications and records."
        actions={unread > 0 && (
          <Button variant="secondary" onClick={markAllRead}>Mark all as read</Button>
        )}
      />

      <SectionCard
        title={items.length ? `Inbox${unread ? ` — ${unread} unread` : ''}` : undefined}
      >
        {isLoading ? <ListSkeleton rows={4} />
          : error ? <ErrorState error={error} title="Could not load your messages" onRetry={refetch} />
          : items.length === 0 ? (
            <EmptyState
              icon={<GlyphMail />}
              title="No messages"
              hint="When an agency needs to tell you something about an application or a record, it arrives here. You will also get a notification."
              action={<Button variant="secondary" onClick={() => navigate('/tracking')}>View my applications</Button>}
            />
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col">
              {items.map((m) => {
                const isOpen = openId === m.id;
                return (
                  <li key={m.id} className="border-b border-line dark:border-d-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openMessage(m)}
                      aria-expanded={isOpen}
                      className={cx(
                        'w-full text-left py-3.5 px-2 -mx-2 rounded-btn flex items-start gap-3',
                        'hover:bg-tint/50 dark:hover:bg-d-tint/50 transition-colors duration-fast ease-standard',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cx('w-2 h-2 rounded-full mt-2 shrink-0', m.isRead ? 'bg-transparent' : 'bg-danger')}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className={cx('text-base truncate', m.isRead ? 'font-semibold' : 'font-bold')}>
                            {m.subject}
                          </span>
                          {!m.isRead && <Chip tone="danger" dot={false}>New</Chip>}
                        </span>
                        {m.agencyName && (
                          <span className="block text-sm text-muted dark:text-d-muted mt-0.5">{m.agencyName}</span>
                        )}
                        {isOpen && m.body && (
                          <span className="block text-base mt-3 whitespace-pre-wrap">{m.body}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-micro text-muted dark:text-d-muted">
                          {m.sentAt ? new Date(m.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </span>
                    </button>

                    {isOpen && (
                      <div className="flex flex-wrap gap-2 pb-3.5 px-2">
                        {m.applicationId && (
                          <Button size="sm" onClick={() => navigate(`/tracking/${m.applicationId}`)}>
                            View the application
                          </Button>
                        )}
                        {/* Archive, not delete — an agency's message is never destroyed
                            by its recipient. */}
                        <Button size="sm" variant="secondary" onClick={() => update.mutate({ id: m.id, archived: true })}>
                          Archive
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
      </SectionCard>
    </div>
  );
}

function GlyphMail() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" width="22" height="22"
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 5h13v8h-13zM2.5 5.5l6.5 5 6.5-5" />
    </svg>
  );
}
