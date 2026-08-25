import { useEffect, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from './queryClient.js';
import { buildTheme } from '../theme/theme.js';
import { useUiStore } from '../stores/uiStore.js';
import { AppRoutes } from '../routes/router.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import Toast from '../components/Toast.jsx';

export default function App() {
  const mode = useUiStore((s) => s.mode);
  const textScale = useUiStore((s) => s.textScale);

  // Memoised so the theme object stays referentially stable between renders.
  // Rebuilding it every render invalidates emotion's cache and re-serialises
  // every style in the app — noticeable on the low-end phones this portal targets.
  const theme = useMemo(() => buildTheme(mode, textScale), [mode, textScale]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* No <CssBaseline />: Tailwind's preflight is the baseline now (see
          index.css @layer base). Mounting both meant two resets fighting over
          margins, box-sizing and typography. MUI is kept only for the five
          behavioural primitives, whose visuals index.css neutralises. */}
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
          <Toast />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
