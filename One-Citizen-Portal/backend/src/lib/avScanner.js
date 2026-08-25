// Anti-virus scan adapter. Mock in the reference build (detects the EICAR test string or a
// sentinel); production swaps in ClamAV / a scanning service (SECURITY §10, §13).
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export function createAvScanner({ mode = 'mock' } = {}) {
  return {
    /** @returns {Promise<'clean'|'infected'>} */
    async scan(buffer) {
      if (mode === 'mock' || mode === 'off') {
        const s = buffer.toString('latin1');
        if (s.includes(EICAR) || s.includes('__INFECTED__')) return 'infected';
        return 'clean';
      }
      // Real scanners integrated here in production.
      return 'clean';
    },
  };
}
