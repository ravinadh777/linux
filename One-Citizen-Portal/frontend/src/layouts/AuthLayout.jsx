import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';

// Full-bleed passthrough — LoginPage / RegisterPage own their own split layout.
//
// This is the SINGLE owner of the viewport height for the auth pages. It used to set
// `minHeight: 100vh` and AuthScaffold set it again on its own root, so the inner
// element was as tall as the viewport *inside* an element already that tall — which,
// once the registration form's content was added, guaranteed the page overflowed.
//
// `100dvh` rather than `100vh`: on mobile browsers `100vh` measures the viewport with
// the URL bar hidden, so a "full height" page is always slightly taller than what is
// actually visible and every screen gets a small phantom vertical scroll.
export default function AuthLayout() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Outlet />
    </Box>
  );
}
