'use client';

import Link from 'next/link';
import { BrandLogo as Logo } from '@/components/BrandLogo';
import { cn, typography, layouts } from '@/design-system';
import { useI18n, type Language } from '@/lib/i18n/language-provider';

const icons = {
  escrow: (
    <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6L12 3Zm-2.5 8.5h5m-5 3h3" />
  ),
  verified: (
    <path d="m9 12 2 2 4-4m-3-7 2.1 1.6 2.6-.1.8 2.5 2.1 1.5-.8 2.5.8 2.5-2.1 1.5-.8 2.5-2.6-.1L12 21l-2.1-1.6-2.6.1-.8-2.5-2.1-1.5.8-2.5-.8-2.5 2.1-1.5.8-2.5 2.6.1L12 3Z" />
  ),
  returns: <path d="M4 9h11a5 5 0 0 1 0 10H9M4 9l4-4M4 9l4 4" />,
};

function BrandPanel() {
  const { t, format } = useI18n();
  const points = [
    { icon: icons.escrow, title: t.brandPanel.escrowTitle, body: t.brandPanel.escrowBody },
    { icon: icons.verified, title: t.brandPanel.verifiedTitle, body: t.brandPanel.verifiedBody },
    { icon: icons.returns, title: t.brandPanel.returnsTitle, body: t.brandPanel.returnsBody },
  ];

  return (
    <aside className="relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal/20 via-transparent to-teal/10"
      />
      <div className="relative">
        <Logo inverted />
      </div>

      <div className="relative max-w-md">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
          {t.brandPanel.headline}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-white/70">{t.brandPanel.subheadline}</p>

        <ul className="mt-10 space-y-6">
          {points.map((point) => (
            <li key={point.title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-logo-accent"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {point.icon}
                </svg>
              </span>
              <div>
                <p className="font-medium">{point.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{point.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-white/50">
        {format(t.brandPanel.copyright, { year: new Date().getFullYear() })}
      </p>
    </aside>
  );
}

function LanguageSelect() {
  const { t, language, setLanguage } = useI18n();
  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 focus-within:ring-2 focus-within:ring-teal">
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="h-4 w-4 fill-none stroke-current"
        strokeWidth="1.5"
      >
        <circle cx="10" cy="10" r="7.5" />
        <path d="M2.5 10h15M10 2.5c2 2.2 3 4.7 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.7-3-7.5s1-5.3 3-7.5Z" />
      </svg>
      <span className="sr-only">{t.common.language}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="cursor-pointer appearance-none bg-transparent pr-1 outline-none"
      >
        <option value="en">English</option>
        <option value="hi">हिन्दी</option>
      </select>
    </label>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <BrandPanel />

      <div className="flex min-h-screen flex-col">
        <header className={cn('flex items-center justify-between py-5', layouts.pageGutter)}>
          <span className="lg:invisible">
            <Logo />
          </span>
          <LanguageSelect />
        </header>

        <main
          className={cn(
            'flex flex-1 items-start justify-center pb-12 pt-4 sm:items-center',
            layouts.pageGutter,
          )}
        >
          <div className="w-full max-w-[420px]">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 pb-6 text-xs text-slate-500">
          <Link href="/pages/terms" className="hover:text-navy">
            {t.footer.terms}
          </Link>
          <Link href="/pages/privacy" className="hover:text-navy">
            {t.footer.privacy}
          </Link>
          <Link href="/help" className="hover:text-navy">
            {t.footer.help}
          </Link>
        </footer>
      </div>
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className={cn(typography.pageTitle, 'tracking-tight')}>{title}</h1>
      {subtitle && <p className={cn('mt-2', typography.secondary)}>{subtitle}</p>}
    </div>
  );
}

export function StepProgress({ current, labels }: { current: number; labels: string[] }) {
  const { t, format } = useI18n();
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-navy">{labels[current - 1]}</span>
        <span className="text-slate-500">
          {format(t.common.stepOf, { current, total: labels.length })}
        </span>
      </div>
      <div
        className="mt-2 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}
      >
        {labels.map((label, index) => (
          <span
            key={label}
            className={`h-1 rounded-full transition-colors ${index < current ? 'bg-teal' : 'bg-slate-200'}`}
          />
        ))}
      </div>
    </div>
  );
}
