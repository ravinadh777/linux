import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';

// Protected: requires a logged-in session, else bounce to /login (remembering where they were).
export default function RequireAuth({ children }) {
  const token = useAuthStore((s) => s.accessToken);
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// Public-only: auth pages (login/register) are off-limits once signed in → send to dashboard.
export function PublicOnly({ children }) {
  const token = useAuthStore((s) => s.accessToken);
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
}
