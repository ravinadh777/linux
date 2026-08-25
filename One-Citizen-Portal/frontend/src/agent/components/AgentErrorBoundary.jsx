// Error boundary (Phase 9 — error boundaries + centralized error handling). Keeps a
// render fault in the agent UI from taking down the whole app shell; offers a reset.
import { Component } from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';

export class AgentErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[AskGov] panel error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Stack spacing={1.5} alignItems="center" textAlign="center">
            <ReportProblemRoundedIcon color="warning" sx={{ fontSize: 40 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>AskGov ran into a problem</Typography>
            <Typography variant="body2" color="text.secondary">The assistant panel failed to render. You can reload it.</Typography>
            <Button variant="contained" size="small" onClick={() => this.setState({ hasError: false })}>Reload assistant</Button>
          </Stack>
        </Box>
      );
    }
    return this.props.children;
  }
}
