import { apiFetch } from '@/lib/http';

export interface CountryInfo {
  code: string;
  name: string;
  postalLabel: string;
  postalPattern: string;
  postalExample: string;
  hasStates: boolean;
  stateRequired: boolean;
}

export interface PincodeSuggestion {
  pincode: string;
  area: string | null;
  city: string;
  state: string;
}

let countriesPromise: Promise<CountryInfo[]> | null = null;
const statesCache = new Map<string, Promise<string[]>>();

/** Address data from the API, cached for the visit. */
export const locationApi = {
  countries: () => {
    countriesPromise ??= apiFetch<{ items: CountryInfo[] }>('/location/countries')
      .then((r) => r.items)
      .catch((error) => {
        countriesPromise = null;
        throw error;
      });
    return countriesPromise;
  },

  states: (country: string) => {
    if (!statesCache.has(country)) {
      statesCache.set(
        country,
        apiFetch<{ items: string[] }>(`/location/countries/${country}/states`)
          .then((r) => r.items)
          .catch((error) => {
            statesCache.delete(country);
            throw error;
          }),
      );
    }
    return statesCache.get(country)!;
  },

  cities: (country: string, q: string, signal?: AbortSignal) =>
    apiFetch<{ items: string[] }>(
      `/location/countries/${country}/cities?q=${encodeURIComponent(q)}`,
      { signal },
    ).then((r) => r.items),

  searchPincodes: (q: string, signal?: AbortSignal) =>
    apiFetch<{ items: PincodeSuggestion[] }>(`/pincode/search?q=${encodeURIComponent(q)}`, {
      signal,
    }).then((r) => r.items),

  pincode: (pincode: string, signal?: AbortSignal) =>
    apiFetch<PincodeSuggestion>(`/pincode/${pincode}`, { signal }),
};

/** Country name in the visitor's language, falling back to the English name. */
export function countryName(code: string, locale: string, fallback: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

export function postalCodeValid(country: CountryInfo | undefined, value: string): boolean {
  if (!country) return value.trim().length > 0;
  return new RegExp(country.postalPattern, 'i').test(
    value.trim().toUpperCase().replace(/\s+/g, ' '),
  );
}
