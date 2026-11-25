export const RADII = [5, 10, 25] as const;
export type Radius = (typeof RADII)[number];
export const PINCODE_KEY = 'tl_pincode';

export function pincodeError(value: string): string | undefined {
  return /^[1-9][0-9]{5}$/.test(value)
    ? undefined
    : 'Enter a six-digit pincode that does not start with 0.';
}

export function parseRadius(value: string | null): Radius {
  return value === '5' ? 5 : value === '25' ? 25 : 10;
}

export function largerRadius(value: Radius): Radius | null {
  return value === 5 ? 10 : value === 10 ? 25 : null;
}

export function localUrl(pincode: string, radius: Radius): string {
  return `/local?${new URLSearchParams({ pincode, radius: String(radius) })}`;
}
