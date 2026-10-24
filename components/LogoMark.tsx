// A lit doorway: flat arch plus the light it casts. Keep in sync with app/icon.svg (the favicon).
export default function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#15171C" />
      <path d="M12 24 H20 L24 32 H8 Z" fill="#9EDBC8" opacity=".3" />
      <path d="M12 24 V14 a4 4 0 0 1 8 0 V24 Z" fill="#9EDBC8" />
    </svg>
  );
}
