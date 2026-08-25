import { Component } from 'react';
import { Box, Button, Typography, Card, CardContent, Stack } from '@mui/material';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';

// Catches render errors so one failing screen doesn't blank the whole app.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  // eslint-disable-next-line no-unused-vars
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Screen error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <Card sx={{ maxWidth: 540, width: '100%' }}>
            <CardContent sx={{ textAlign: 'center', p: { xs: 3, sm: 4 } }}>
              <Box aria-hidden sx={{
                width: 56, height: 56, mx: 'auto', mb: 2, borderRadius: '50%',
                display: 'grid', placeItems: 'center', bgcolor: 'warning.subtle', color: 'warning.main',
              }}>
                <ReportProblemRoundedIcon sx={{ fontSize: 30 }} />
              </Box>
              <Typography variant="h5" component="h1">This page did not load properly</Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, mb: 1 }}>
                Something went wrong while showing this page. Nothing you have submitted has been lost.
              </Typography>
              {/* The raw message is kept but demoted — it is for whoever the citizen
                  reports the problem to, not the first thing they should read. */}
              {this.state.error?.message && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3, fontFamily: 'monospace' }}>
                  {this.state.error.message}
                </Typography>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
                {/* Retry first: a transient render error usually clears on re-mount, and this
                    keeps the citizen where they were. The only option before was to leave
                    the page entirely for the dashboard. */}
                <Button variant="contained" startIcon={<ReplayRoundedIcon />} onClick={() => this.setState({ error: null })}>
                  Try again
                </Button>
                <Button variant="outlined" startIcon={<HomeRoundedIcon />}
                  onClick={() => { this.setState({ error: null }); window.location.assign('/dashboard'); }}>
                  Go to dashboard
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      );
    }
    return this.props.children;
  }
}
