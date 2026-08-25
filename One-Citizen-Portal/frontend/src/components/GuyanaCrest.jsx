// Stylized emblem evoking the Guyana coat of arms (shield with water + Victoria Regia lily,
// gold border, Cacique-crown crest, motto banner). A dignified placeholder for the official arms.
export default function GuyanaCrest({ size = 40 }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 48 56" role="img" aria-label="Government of Guyana emblem">
      {/* Cacique crown */}
      <g fill="#d32f2f">
        <path d="M14 9 L18 3 L22 9 Z" />
        <path d="M20 9 L24 2 L28 9 Z" />
        <path d="M26 9 L30 3 L34 9 Z" />
      </g>
      <rect x="13" y="9" width="22" height="3" rx="1.5" fill="#e0a12b" />
      {/* Shield */}
      <path d="M24 13 C31 14 39 15 39 15 L39 30 C39 41 31 47 24 50 C17 47 9 41 9 30 L9 15 C9 15 17 14 24 13 Z"
        fill="#ffffff" stroke="#e0a12b" strokeWidth="2" />
      {/* Sky / upper field */}
      <path d="M11 16.5 C17 15.6 24 15 24 15 C24 15 31 15.6 37 16.5 L37 30 L11 30 Z" fill="#eaf3ff" />
      {/* Green stem + lily (Victoria Regia) */}
      <path d="M24 30 L24 22" stroke="#2e7d32" strokeWidth="1.6" />
      <circle cx="24" cy="20" r="3.4" fill="#43a047" />
      <circle cx="24" cy="20" r="1.5" fill="#fff8e1" />
      {/* Water waves */}
      <g stroke="#1e88e5" strokeWidth="1.8" fill="none" strokeLinecap="round">
        <path d="M11 33 q3.5 -3 7 0 t7 0 t7 0" />
        <path d="M11 38 q3.5 -3 7 0 t7 0 t7 0" />
        <path d="M11 43 q3.5 -3 6 0 t6 0 t6 0" />
      </g>
      {/* Motto banner */}
      <path d="M4 50 L44 50 L40 55 L8 55 Z" fill="#0d47a1" />
    </svg>
  );
}
