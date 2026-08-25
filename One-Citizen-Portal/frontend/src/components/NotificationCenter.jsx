import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton, Badge, Tooltip, Popover, Box, Typography, Divider, Button, List, ListItemButton, ListItemText,
} from '@mui/material';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import CircleRoundedIcon from '@mui/icons-material/CircleRounded';
import { api, apiError } from '../lib/api.js';
import { useAuthStore } from '../stores/authStore.js';
import { toast } from '../stores/toastStore.js';
import { ListSkeleton, EmptyState, VisuallyHidden } from './ui.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const DAY = 86400000;
/** Bucket notifications by recency so the newest are visibly separated. */
function groupByRecency(items) {
  const now = Date.now();
  const buckets = new Map([['Today', []], ['This week', []], ['Earlier', []]]);
  for (const n of items) {
    const age = now - new Date(n.createdAt).getTime();
    const key = age < DAY ? 'Today' : age < 7 * DAY ? 'This week' : 'Earlier';
    buckets.get(key).push(n);
  }
  return [...buckets].filter(([, rows]) => rows.length);
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.accessToken);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [anchor, setAnchor] = useState(null);
  // Hover/focus state of the bell's tooltip, kept separate from `anchor` so the
  // tooltip can be suppressed while the panel is open — see the Tooltip below.
  const [tipOpen, setTipOpen] = useState(false);
  const seen = useRef(new Set());

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setItems(data.items || []);
      setUnread(data.unread || 0);
      (data.items || []).forEach((n) => seen.current.add(n.notificationId));
    } catch { /* non-fatal */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (token) load(); }, [token, load]);

  // Live stream over fetch (EventSource can't send the auth header). Best-effort with retry.
  useEffect(() => {
    if (!token) return undefined;
    let stopped = false;
    let ctrl;
    const connect = async () => {
      try {
        ctrl = new AbortController();
        const res = await fetch(`${API_BASE}/notifications/stream`, {
          headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error('stream failed');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done || stopped) break;
          buf += decoder.decode(value, { stream: true });
          let sep;
          while ((sep = buf.indexOf('\n\n')) !== -1) {
            const frame = buf.slice(0, sep); buf = buf.slice(sep + 2);
            const line = frame.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;
            try {
              const evt = JSON.parse(line.slice(5).trim());
              if (evt.kind === 'notification' && evt.notification) {
                const n = evt.notification;
                if (seen.current.has(n.notificationId)) continue;
                seen.current.add(n.notificationId);
                setItems((prev) => [n, ...prev]);
                setUnread((u) => u + 1);
                toast.info(n.title);
              }
            } catch { /* ignore malformed frame */ }
          }
        }
      } catch { /* fall through to retry */ }
      if (!stopped) setTimeout(connect, 5000); // reconnect
    };
    connect();
    return () => { stopped = true; ctrl?.abort(); };
  }, [token]);

  const grouped = useMemo(() => groupByRecency(items), [items]);

  const open = (e) => setAnchor(e.currentTarget);
  const close = () => setAnchor(null);

  const onClickItem = async (n) => {
    close();
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.notificationId === n.notificationId ? { ...x, isRead: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      try { await api.patch(`/notifications/${n.notificationId}/read`); } catch { /* non-fatal */ }
    }
    if (n.deepLinkTarget) navigate(n.deepLinkTarget);
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    try { await api.patch('/notifications/read-all'); } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <>
      {/* The tooltip is CONTROLLED so it can be forced shut while the panel is open.
          MUI puts tooltips at zIndex 1500 and popovers at 1300, and a tooltip does not
          dismiss on click — so hovering the bell and then clicking it left the
          "Notifications" tooltip painting on top of the panel it had just opened.
          `open={tipOpen && !anchor}` keeps normal hover/focus behaviour and suppresses
          it for exactly as long as the panel is up. No a11y cost: the IconButton
          already carries its own aria-label, including the unread count. */}
      <Tooltip
        title="Notifications"
        open={tipOpen && !anchor}
        onOpen={() => setTipOpen(true)}
        onClose={() => setTipOpen(false)}
      >
        <IconButton onClick={open} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Badge color="error" badgeContent={unread} max={99}>
            <NotificationsNoneRoundedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor} anchorEl={anchor} onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        // `overflow: hidden` on the paper so the list below is the only scroller —
        // the Popover paper scrolls by default, which nested two bars.
        //
        // maxWidth uses `dvw` in preference to `vw`. `100vw` counts the classic
        // scrollbar, so it can exceed the visible viewport and push a horizontal bar;
        // `dvw` excludes it. Scrollbars are now zero-width project-wide (index.css), so
        // the two currently measure the same — this is kept because it stays correct if
        // visible bars are ever restored, and the vw value remains as the fallback for
        // browsers without dvw support.
        slotProps={{
          paper: {
            sx: {
              width: 380,
              maxWidth: 'calc(100vw - 32px)',
              '@supports (width: 100dvw)': { maxWidth: 'calc(100dvw - 32px)' },
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 700 }}>Notifications</Typography>
          {items.some((n) => !n.isRead) && (
            <Button size="small" startIcon={<DoneAllRoundedIcon />} onClick={markAll}>Mark all read</Button>
          )}
        </Box>
        <Divider />
        {loading ? (
          // Skeleton rows rather than a spinner, so the panel does not resize when the
          // notifications land.
          <Box sx={{ p: 2 }} role="status" aria-busy="true" aria-label="Loading notifications">
            <ListSkeleton rows={3} avatar={false} />
          </Box>
        ) : items.length ? (
          <List className="oc-scroll" disablePadding sx={{ maxHeight: 420, overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {grouped.map(([bucket, rows]) => (
              <Box component="li" key={bucket} sx={{ listStyle: 'none' }}>
                {/* Grouped by recency: with more than a handful of notifications, a flat
                    list of "3h ago / 2d ago / 14/07/2026" gave no sense of what was new. */}
                <Typography
                  variant="caption"
                  sx={{ display: 'block', px: 2, py: 0.75, fontWeight: 700, color: 'text.secondary', bgcolor: 'surface.sunken' }}
                >
                  {bucket}
                </Typography>
                <List disablePadding>
                  {rows.map((n) => (
                    <ListItemButton
                      key={n.notificationId}
                      onClick={() => onClickItem(n)}
                      sx={{ alignItems: 'flex-start', bgcolor: n.isRead ? 'transparent' : 'primary.subtle' }}
                    >
                      <CircleRoundedIcon aria-hidden sx={{ fontSize: 9, mt: 1.25, mr: 1, flexShrink: 0, color: n.isRead ? 'transparent' : 'primary.main' }} />
                      <ListItemText
                        primary={
                          <>
                            {n.title}
                            {!n.isRead && <VisuallyHidden> (unread)</VisuallyHidden>}
                          </>
                        }
                        secondary={
                          <>
                            {n.message}
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                              {timeAgo(n.createdAt)}
                            </Typography>
                          </>
                        }
                        primaryTypographyProps={{ fontWeight: n.isRead ? 500 : 700, variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            ))}
          </List>
        ) : (
          <EmptyState
            dense
            icon={<NotificationsNoneRoundedIcon />}
            title="You are all caught up"
            hint="We will tell you here whenever one of your applications moves forward."
          />
        )}
      </Popover>
    </>
  );
}
