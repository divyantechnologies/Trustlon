'use client';

import { ListSelect } from '@/design-system/components/ListSelect';
import { LANGUAGE_GROUPS, LANGUAGES, useI18n, type Language } from '@/lib/i18n/language-provider';

const OPTIONS = LANGUAGES.map((language) => ({
  value: language.code,
  label: language.native,
  detail: language.code === 'en' ? undefined : language.name,
  short: language.native,
  keywords: language.name,
  lang: language.code,
  group: LANGUAGE_GROUPS.find((group) => group.key === language.group)?.label,
}));

function GlobeIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0 fill-none stroke-current"
      strokeWidth="1.5"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M2.5 10h15M10 2.5c2 2.2 3 4.7 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.7-3-7.5s1-5.3 3-7.5Z" />
    </svg>
  );
}

/**
 * The one language list used across the app: a small globe button in headers, or a full-width
 * field in forms. Pass `onChange` to also save the choice (e.g. to the customer's profile).
 */
export function LanguagePicker({
  variant = 'compact',
  value,
  onChange,
  label,
  hint,
  align = 'end',
}: {
  variant?: 'compact' | 'field';
  /** Defaults to the language the page is showing. */
  value?: Language;
  onChange?: (language: Language) => void;
  label?: string;
  hint?: React.ReactNode;
  align?: 'start' | 'end';
}) {
  const { t, language, setLanguage } = useI18n();
  return (
    <ListSelect<Language>
      label={label ?? t.common.language}
      hideLabel={variant === 'compact'}
      variant={variant}
      value={value ?? language}
      options={OPTIONS}
      searchable
      searchPlaceholder="Search language"
      icon={variant === 'compact' ? <GlobeIcon /> : undefined}
      align={align}
      hint={hint}
      onChange={(next) => {
        setLanguage(next);
        onChange?.(next);
      }}
    />
  );
}
