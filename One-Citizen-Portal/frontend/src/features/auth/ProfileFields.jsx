import { Grid, TextField, MenuItem, Typography, Box } from '@mui/material';
import { USER_PROFILE_FIELDS, PROFILE_SECTIONS } from './userFields.js';

// Renders the shared user-profile fields, grouped by section. `onChange` is a curried
// setter: onChange(key) → (event) => void. Used by BOTH RegisterPage (via its own
// step renderer) and ProfilePage.
//
// `errors` is optional ({ key: message }) so the profile page can surface the SAME
// validation the registration wizard runs — the rules live once, in userFields.js.
export default function ProfileFields({ form, onChange, onBlur, errors = {}, showHeadings = true }) {
  return (
    <>
      {PROFILE_SECTIONS.map((section) => {
        const fields = USER_PROFILE_FIELDS.filter((f) => f.section === section);
        // Sections whose fields are all required get a marker, so a citizen scanning
        // a long profile page can see at a glance which blocks actually matter.
        const anyRequired = fields.some((f) => f.required);
        return (
          <Box key={section} component="section">
            {showHeadings && (
              <Typography variant="subtitle2" component="h3"
                sx={{ color: 'primary.onSubtle', fontWeight: 800, mt: 2.5, mb: 1 }}>
                {section}
                {!anyRequired && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 500 }}>
                    optional
                  </Typography>
                )}
              </Typography>
            )}
            <Grid container spacing={2}>
              {fields.map((f) => {
                const err = errors[f.key];
                const common = {
                  name: f.key,
                  fullWidth: true,
                  size: 'small',
                  label: f.label,
                  required: !!f.required,
                  value: form[f.key] ?? '',
                  onChange: onChange(f.key),
                  onBlur: onBlur ? onBlur(f.key) : undefined,
                  error: !!err,
                  helperText: err || f.help || ' ',
                };
                return (
                  <Grid item xs={12} sm={f.sm} key={f.key}>
                    {f.type === 'select' ? (
                      <TextField {...common} select>
                        {/* Lets an optional select be cleared again after being set. */}
                        {!f.required && <MenuItem value=""><em>Not specified</em></MenuItem>}
                        {f.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                      </TextField>
                    ) : (
                      <TextField
                        {...common}
                        type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : f.type === 'tel' ? 'tel' : 'text'}
                        multiline={f.type === 'textarea'}
                        minRows={f.type === 'textarea' ? 2 : undefined}
                        placeholder={f.placeholder}
                        InputLabelProps={f.type === 'date' ? { shrink: true } : undefined}
                        inputProps={{
                          inputMode: f.inputMode,
                          maxLength: f.maxLength,
                          autoComplete: f.autoComplete,
                        }}
                      />
                    )}
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        );
      })}
    </>
  );
}
