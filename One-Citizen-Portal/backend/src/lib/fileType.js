// Content-based file-type sniffing (magic bytes) — never trust the extension (SECURITY §10).
export function sniffType(buf) {
  if (!buf || buf.length < 4) return null;
  const b = buf;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf'; // %PDF
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'; // \x89PNG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'; // JFIF/EXIF
  if (b[0] === 0x41 && b[1] === 0x43 && b[2] === 0x31) return 'dwg'; // 'AC1..' (AutoCAD DWG)
  const head = b.slice(0, 512).toString('latin1');
  if (/^\s*0\s*[\r\n]+\s*SECTION/i.test(head) || head.includes('AutoCAD DXF')) return 'dxf';
  return null;
}

export const FORMAT_MIME = Object.freeze({
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  dwg: 'application/acad',
  dxf: 'application/dxf',
});
