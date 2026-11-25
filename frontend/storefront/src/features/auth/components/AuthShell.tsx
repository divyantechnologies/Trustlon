'use client';

import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useI18n } from '@/lib/i18n/language-provider';
import { useSiteConfig } from '@/lib/site-config';

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
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 110% -10%, rgb(var(--tl-logo-accent) / 0.22), transparent 60%), radial-gradient(40rem 30rem at -20% 110%, rgb(var(--tl-logo-accent) / 0.12), transparent 60%)',
        }}
      />
      <div className="relative">
        <BrandLogo inverted />
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
                  className="h-5 w-5"
                  fill="none"
                  stroke="rgb(var(--tl-logo-accent))"
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

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { features } = useSiteConfig().config;

  return (
    <div className="grid grid-cols-1 min-h-screen bg-white lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <BrandPanel />

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <span className="lg:invisible">
            <BrandLogo />
          </span>
          <LanguagePicker />
        </header>

        <main className="flex flex-1 items-start justify-center px-6 pb-12 pt-4 sm:items-center sm:px-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 pb-6 text-xs text-slate-500">
          {(
            [
              [t.footer.terms, '/pages/terms'],
              [t.footer.privacy, '/pages/privacy'],
              [t.footer.help, '/pages/help'],
              [t.footer.sell, '/sell'],
            ] as const
          )
            .filter(([, href]) => href !== '/sell' || features.sellPage)
            .map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-navy">
              {label}
            </Link>
          ))}
        </footer>
      </div>
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-[28px]">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function StepProgress({ current, labels }: { current: number; labels: string[] }) {
  const { t, format } = useI18n();
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-navy">{labels[current - 1]}</span>
        <span className="text-slate-500">{format(t.common.stepOf, { current, total: labels.length })}</span>
      </div>
      <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}>
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
