/** Compose class names; conflicting Tailwind utilities are not merged. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

// Compatibility with the existing UI helper API.
export { cn as cx };
