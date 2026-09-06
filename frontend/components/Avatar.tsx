/**
 * Initials avatar. The hue is derived from the user id so the same person
 * keeps the same colour everywhere in the app without storing anything.
 */
const HUES = ['#0f766e', '#b45309', '#3b5bdb', '#a3335c', '#5b21b6', '#0e7490'];

function hueFor(seed: string) {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return HUES[sum % HUES.length];
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

export function Avatar({
  name,
  seed,
  size = 32,
  title,
}: {
  name: string;
  seed: string;
  size?: number;
  title?: string;
}) {
  return (
    <span
      title={title ?? name}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundColor: hueFor(seed),
        fontSize: Math.max(11, Math.round(size * 0.38)),
      }}
      className="inline-flex flex-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface"
    >
      {initialsOf(name)}
    </span>
  );
}
