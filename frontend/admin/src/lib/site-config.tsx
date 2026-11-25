'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { applyTheme, DEFAULT_CONFIG, type SiteConfig, type SiteTheme } from './theme';

interface SiteConfigValue {
  config: SiteConfig;
  /** Shows a theme at once (admin preview or after saving). */
  previewTheme: (theme: SiteTheme) => void;
  /** Replaces the whole config, e.g. after an admin saves business settings. */
  setConfig: (config: SiteConfig) => void;
}

const SiteConfigContext = createContext<SiteConfigValue | null>(null);

/**
 * Theme, feature switches and public rules from /admin. Loaded on the server in app/layout.tsx,
 * so the first paint already uses them.
 */
export function SiteConfigProvider({
  initial,
  children,
}: {
  initial: SiteConfig;
  children: React.ReactNode;
}) {
  const [config, setConfigState] = useState<SiteConfig>(initial);

  const previewTheme = useCallback((theme: SiteTheme) => {
    applyTheme(theme);
    setConfigState((current) => ({ ...current, theme }));
  }, []);

  const setConfig = useCallback((next: SiteConfig) => {
    applyTheme(next.theme);
    setConfigState(next);
  }, []);

  const value = useMemo(
    () => ({ config, previewTheme, setConfig }),
    [config, previewTheme, setConfig],
  );
  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

/** Works outside the provider too (tests, isolated components) with the default config. */
export function useSiteConfig(): SiteConfigValue {
  return (
    useContext(SiteConfigContext) ?? {
      config: DEFAULT_CONFIG,
      previewTheme: () => undefined,
      setConfig: () => undefined,
    }
  );
}
