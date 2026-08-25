import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Autocomplete, TextField, InputAdornment, CircularProgress, Box, Typography, Chip } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import DesignServicesRoundedIcon from '@mui/icons-material/DesignServicesRounded';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const ICON = {
  ministry: <AccountBalanceRoundedIcon fontSize="small" color="primary" />,
  agency: <ApartmentRoundedIcon fontSize="small" color="action" />,
  service: <DesignServicesRoundedIcon fontSize="small" color="secondary" />,
};

function useDebounced(value, delay = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const term = useDebounced(input.trim(), 200);

  const { data, isFetching } = useQuery({
    queryKey: ['search', term],
    queryFn: () => api.get(`/catalogue/search?q=${encodeURIComponent(term)}`).then((r) => r.data.results || []),
    enabled: term.length > 0,
    staleTime: 60_000,
  });

  const options = term.length > 0 ? data || [] : [];

  return (
    <Autocomplete
      size="small"
      open={open && input.trim().length > 0}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options}
      loading={isFetching}
      filterOptions={(x) => x}
      autoHighlight
      clearOnBlur={false}
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.label)}
      isOptionEqualToValue={(o, v) => o.type === v.type && o.id === v.id}
      inputValue={input}
      onInputChange={(_e, v, reason) => { if (reason === 'input' || reason === 'clear') setInput(v); }}
      onChange={(_e, val) => { if (val && val.to) { navigate(val.to); setInput(''); setOpen(false); } }}
      noOptionsText={term.length ? 'No matches' : 'Type to search…'}
      renderOption={(props, o) => (
        <Box component="li" {...props} key={`${o.type}-${o.id}`}>
          <Box sx={{ mr: 1.5, display: 'flex' }}>{ICON[o.type]}</Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap>{o.label}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{o.sublabel}</Typography>
          </Box>
          <Chip size="small" label={o.type} sx={{ textTransform: 'capitalize', ml: 1 }} variant="outlined" />
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search services, agencies and forms…"
          InputProps={{
            ...params.InputProps,
            startAdornment: <InputAdornment position="start"><SearchRoundedIcon color="action" /></InputAdornment>,
            endAdornment: (
              <>
                {isFetching ? <CircularProgress size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 999,
              // Themed surface instead of two mode-branched rgba literals.
              bgcolor: 'surface.sunken',
              transition: (t) => `background-color ${t.motion.base}ms ${t.motion.ease}, box-shadow ${t.motion.base}ms ${t.motion.ease}`,
              pl: 1.5,
              '& fieldset': { borderColor: 'transparent' },
              '&:hover': { bgcolor: 'action.hover' },
              '&:hover fieldset': { borderColor: 'transparent' },
              '&.Mui-focused': {
                bgcolor: 'background.paper',
                // No glow — the 2px border below is the focus indicator. This used to
                // carry a soft blue halo that read as a blur around the field.
                boxShadow: 'none',
              },
              '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 2 },
            },
            '& .MuiOutlinedInput-input': { py: 1.5, fontSize: '1rem' },
          }}
        />
      )}
      sx={{ width: '100%' }}
    />
  );
}
