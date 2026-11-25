'use client';
import { useEffect, useId, useMemo, useState } from 'react';
import { CityField } from '@/components/location';
import { Alert, Button, cn, focusRing, ListSelect, MobileField, TextField } from '@/design-system';
import { useAuth } from '@/features/auth';
import { formatMoney } from '@/features/account/format';
import { CategoryNav } from '@/features/home/components/CategoryNav';
import { HomeFooter } from '@/features/home/components/HomeFooter';
import { HomeHeader } from '@/features/home/components/HomeHeader';
import { Icon } from '@/features/home/components/Icon';
import { MarketplaceDialogs } from '@/features/home/components/MarketplaceDialogs';
import { ApiError } from '@/lib/http';
import { useI18n } from '@/lib/i18n/language-provider';
import { useSiteConfig } from '@/lib/site-config';
import {
  GSTIN_SHAPE,
  isValidEmail,
  isValidName,
  suggestEmail,
  toMobileE164,
} from '@/lib/validation';
import { DEFAULT_COUNTRY, type CountryCode } from '@/lib/phone';
import { sellApi, type CommissionRates, type FeeBreakdown } from './api';

const VENDOR_PANEL_URL = process.env.NEXT_PUBLIC_VENDOR_PANEL_URL?.replace(/\/$/, '') || null;
const START_HREF = VENDOR_PANEL_URL ? `${VENDOR_PANEL_URL}/register` : '#start';

const percent = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)}%`;

function StartSellingLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={START_HREF}
      className={cn(
        'inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-teal px-6 text-sm font-semibold text-navy shadow-sm hover:bg-teal/90',
        focusRing,
        className,
      )}
    >
      {children}
      <Icon name="arrow" className="h-4 w-4" />
    </a>
  );
}

/* Hero */

function HeroSection({ rates }: { rates: CommissionRates | null }) {
  const { t, format } = useI18n();
  const steps = [
    [t.sell.paid1Title, t.sell.paid1Body],
    [t.sell.paid2Title, t.sell.paid2Body],
    [t.sell.paid3Title, t.sell.paid3Body],
    [t.sell.paid4Title, t.sell.paid4Body],
  ];
  const lowest = rates?.categories.length
    ? Math.min(...rates.categories.map((c) => c.commissionPercent))
    : null;
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 110% -10%, rgb(var(--tl-logo-accent) / 0.22), transparent 60%), radial-gradient(40rem 30rem at -20% 110%, rgb(var(--tl-logo-accent) / 0.12), transparent 60%)',
        }}
      />
      <div className="relative mx-auto grid grid-cols-1 max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:px-8 lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/15">
            <Icon name="shield" className="h-3.5 w-3.5 text-teal" />
            {t.sell.badge}
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {t.sell.heroTitle}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
            {t.sell.heroBody}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <StartSellingLink>{t.sell.startSelling}</StartSellingLink>
            <a
              href="#fees"
              className={cn(
                'inline-flex h-12 items-center justify-center rounded-lg border border-white/30 px-6 text-sm font-semibold text-white hover:bg-white/10',
                focusRing,
              )}
            >
              {t.sell.calculateFees}
            </a>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-2 gap-6 border-t border-white/15 pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-white/60">{t.sell.statCommission}</dt>
              <dd className="mt-1 text-xl font-semibold">
                {lowest !== null ? format(t.sell.statFrom, { rate: percent(lowest) }) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/60">{t.sell.statRegistration}</dt>
              <dd className="mt-1 text-xl font-semibold">{t.sell.statRegistrationValue}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/60">{t.sell.statPayments}</dt>
              <dd className="mt-1 text-xl font-semibold">{t.sell.statPaymentsValue}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg bg-white/5 p-6 ring-1 ring-white/15">
          <p className="text-sm font-semibold">{t.sell.paidTitle}</p>
          <ol className="mt-5 space-y-5">
            {steps.map(([title, body], index) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal text-sm font-semibold text-navy">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-0.5 text-sm text-white/60">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* Benefits */

function BenefitsGrid({ rates }: { rates: CommissionRates | null }) {
  const { t, format } = useI18n();
  const lowest = rates
    ? Math.min(...rates.categories.map((c) => c.commissionPercent), rates.defaultCommissionPercent)
    : null;
  const benefits = [
    {
      icon: 'bag' as const,
      title: t.sell.benefit1Title,
      body: format(t.sell.benefit1Body, { rate: lowest !== null ? percent(lowest) : '—' }),
    },
    { icon: 'lock' as const, title: t.sell.benefit2Title, body: t.sell.benefit2Body },
    { icon: 'star' as const, title: t.sell.benefit3Title, body: t.sell.benefit3Body },
    { icon: 'check' as const, title: t.sell.benefit4Title, body: t.sell.benefit4Body },
  ];
  return (
    <section
      aria-labelledby="benefits-title"
      className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
    >
      <h2 id="benefits-title" className="text-2xl font-semibold text-navy sm:text-3xl">
        {t.sell.benefitsTitle}
      </h2>
      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((benefit) => (
          <li key={benefit.title} className="rounded-lg border border-slate-200 bg-white p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Icon name={benefit.icon} className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold text-navy">{benefit.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{benefit.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Fee calculator */

function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const toPaise = (rupees: string) => {
  const value = Number(rupees.replace(/[,\s₹]/g, ''));
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
};

function FeeCalculator({ rates, failed }: { rates: CommissionRates | null; failed: boolean }) {
  const ids = { price: useId(), shipping: useId() };
  const { language, t, format } = useI18n();
  const [price, setPrice] = useState('999');
  const [categoryId, setCategoryId] = useState('');
  const [gstRate, setGstRate] = useState(18);
  const [shipping, setShipping] = useState('');
  const [result, setResult] = useState<FeeBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const input = useDebounced(
    useMemo(
      () => ({ price, categoryId, gstRate, shipping }),
      [price, categoryId, gstRate, shipping],
    ),
  );

  useEffect(() => {
    if (!rates) return;
    const pricePaise = toPaise(input.price);
    const shippingPaise = input.shipping ? toPaise(input.shipping) : 0;
    if (!Number.isFinite(pricePaise) || pricePaise < 100) {
      setResult(null);
      setError(t.sell.priceError);
      return;
    }
    if (!Number.isFinite(shippingPaise) || shippingPaise < 0) {
      setError(t.sell.shippingError);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    sellApi
      .calculate(
        {
          pricePaise,
          categoryId: input.categoryId || undefined,
          gstRateBps: input.gstRate * 100,
          shippingPaise: shippingPaise || undefined,
        },
        controller.signal,
      )
      .then(setResult)
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setResult(null);
        setError(caught instanceof ApiError && caught.message ? caught.message : t.sell.calcError);
      })
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
    // Messages follow the language; the calculation itself doesn't depend on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, rates]);

  const rows: Array<[string, number]> = result
    ? [
        [
          format(t.sell.rowCommission, { rate: percent(result.commissionBps / 100) }),
          result.commissionPaise,
        ],
        [
          format(t.sell.rowPayment, { rate: percent(rates?.fees.paymentFeePercent ?? 0) }),
          result.paymentFeePaise,
        ],
        [
          format(t.sell.rowGst, { rate: percent(rates?.fees.gstOnFeesPercent ?? 0) }),
          result.gstOnFeesPaise,
        ],
        [format(t.sell.rowTcs, { rate: percent(rates?.fees.tcsPercent ?? 0) }), result.tcsPaise],
        [format(t.sell.rowTds, { rate: percent(rates?.fees.tdsPercent ?? 0) }), result.tdsPaise],
        ...(result.shippingPaise > 0
          ? ([[t.sell.rowShipping, result.shippingPaise]] as Array<[string, number]>)
          : []),
      ]
    : [];

  return (
    <section id="fees" aria-labelledby="fees-title" className="scroll-mt-6 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 id="fees-title" className="text-2xl font-semibold text-navy sm:text-3xl">
          {t.sell.feesTitle}
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">{t.sell.feesIntro}</p>
        {failed ? (
          <div className="mt-8">
            <Alert>{t.sell.feesLoadError}</Alert>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="space-y-5 rounded-lg border border-slate-200 bg-cream p-6">
              <TextField
                id={ids.price}
                label={t.sell.priceLabel}
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <ListSelect
                label={t.sell.categoryLabel}
                value={categoryId || 'OTHER'}
                disabled={!rates}
                onChange={(next) => setCategoryId(next === 'OTHER' ? '' : next)}
                searchPlaceholder={t.sell.categorySearch}
                options={[
                  {
                    value: 'OTHER',
                    label: t.sell.categoryOther,
                    detail: format(t.sell.commissionDetail, {
                      rate: percent(rates?.defaultCommissionPercent ?? 10),
                    }),
                  },
                  ...(rates?.categories ?? []).map((category) => ({
                    value: category.id,
                    label: (language === 'hi' && category.nameHi) || category.name,
                    detail: format(t.sell.commissionDetail, {
                      rate: percent(category.commissionPercent),
                    }),
                    keywords: category.name,
                  })),
                ]}
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <ListSelect
                  label={t.sell.gstLabel}
                  value={String(gstRate)}
                  onChange={(next) => setGstRate(Number(next))}
                  options={(rates?.gstRates ?? [0, 5, 18, 40]).map((rate) => ({
                    value: String(rate),
                    label: `${rate}%`,
                  }))}
                />
                <TextField
                  id={ids.shipping}
                  label={t.sell.shippingLabel}
                  inputMode="decimal"
                  placeholder="0"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                />
              </div>
            </div>

            <div
              className="rounded-lg border border-slate-200 bg-white p-6"
              aria-live="polite"
              aria-busy={loading}
            >
              {error ? (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              ) : !result ? (
                <div className="space-y-3" aria-hidden>
                  {[0, 1, 2, 3].map((n) => (
                    <div key={n} className="h-6 animate-pulse rounded bg-slate-100" />
                  ))}
                </div>
              ) : (
                <div className={cn('transition-opacity', loading && 'opacity-60')}>
                  <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg bg-navy p-5 text-white">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/70">
                        {t.sell.youReceive}
                      </p>
                      <p className="mt-1 text-3xl font-semibold">
                        {formatMoney(result.netPayoutPaise)}
                      </p>
                    </div>
                    <p className="text-sm text-white/70">
                      {format(t.sell.netShare, {
                        percent: percent(result.netPercent),
                        price: formatMoney(result.pricePaise),
                      })}
                    </p>
                  </div>
                  <dl className="mt-5 divide-y divide-slate-100 text-sm">
                    <div className="flex justify-between gap-4 py-2.5">
                      <dt className="text-slate-600">{t.sell.sellingPrice}</dt>
                      <dd className="font-medium text-navy">{formatMoney(result.pricePaise)}</dd>
                    </div>
                    {rows.map(([label, amount]) => (
                      <div key={label} className="flex justify-between gap-4 py-2.5">
                        <dt className="text-slate-600">{label}</dt>
                        <dd className="whitespace-nowrap text-navy">− {formatMoney(amount)}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between gap-4 py-2.5 font-semibold">
                      <dt className="text-navy">{t.sell.netPayout}</dt>
                      <dd className="text-teal-600">{formatMoney(result.netPayoutPaise)}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-xs leading-relaxed text-slate-500">
                    {format(t.sell.feesNote, { gst: formatMoney(result.gstCollectedPaise) })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* Commission table */

function CommissionTable({ rates }: { rates: CommissionRates }) {
  const { language, t, format } = useI18n();
  if (rates.categories.length === 0) return null;
  return (
    <section aria-labelledby="rates-title" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <h2 id="rates-title" className="text-2xl font-semibold text-navy sm:text-3xl">
        {t.sell.ratesTitle}
      </h2>
      <p className="mt-2 text-slate-600">
        {format(t.sell.ratesIntro, { rate: percent(rates.defaultCommissionPercent) })}
      </p>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rates.categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <span className="font-medium text-navy">
              {(language === 'hi' && category.nameHi) || category.name}
            </span>
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-sm font-semibold text-teal-600">
              {percent(category.commissionPercent)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Steps */

function StepsSection() {
  const { t, format } = useI18n();
  const steps = [
    [t.sell.step1Title, t.sell.step1Body],
    [t.sell.step2Title, t.sell.step2Body],
    [t.sell.step3Title, t.sell.step3Body],
    [t.sell.step4Title, t.sell.step4Body],
  ];
  return (
    <section aria-labelledby="steps-title" className="bg-navy-50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 id="steps-title" className="text-2xl font-semibold text-navy sm:text-3xl">
          {t.sell.stepsTitle}
        </h2>
        <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([title, body], index) => (
            <li key={title} className="relative rounded-lg border border-slate-200 bg-white p-6">
              <span className="text-sm font-semibold text-teal-600">
                {format(t.sell.stepLabel, { number: index + 1 })}
              </span>
              <h3 className="mt-2 font-semibold text-navy">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* Lead form */

interface LeadErrors {
  contactName?: string;
  businessName?: string;
  mobile?: string;
  email?: string;
  city?: string;
  gstin?: string;
}

function LeadForm({ rates }: { rates: CommissionRates | null }) {
  const { user } = useAuth();
  const { language, t } = useI18n();
  const [values, setValues] = useState({
    contactName: '',
    businessName: '',
    email: '',
    city: '',
    category: '',
    gstin: '',
  });
  const [national, setNational] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setValues((current) => ({
      ...current,
      contactName: current.contactName || user.fullName,
      email: current.email || user.email,
    }));
  }, [user]);

  const set =
    (key: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFailure(null);
    const mobile = toMobileE164(national, phoneCountry);
    const found: LeadErrors = {};
    if (!isValidName(values.contactName)) found.contactName = t.sell.errName;
    if (values.businessName.trim().length < 2) found.businessName = t.sell.errBusiness;
    if (!mobile) found.mobile = t.sell.errMobile;
    if (!isValidEmail(values.email)) found.email = t.sell.errEmail;
    if (values.city.trim().length < 2) found.city = t.sell.errCity;
    if (values.gstin.trim() && !GSTIN_SHAPE.test(values.gstin.trim().toUpperCase())) {
      found.gstin = t.sell.errGstin;
    }
    setErrors(found);
    if (Object.keys(found).length > 0 || !mobile) return;
    setBusy(true);
    try {
      const result = await sellApi.createLead({
        contactName: values.contactName.trim(),
        businessName: values.businessName.trim(),
        mobile,
        email: values.email.trim().toLowerCase(),
        city: values.city.trim(),
        categoryId: values.category || undefined,
        gstin: values.gstin.trim().toUpperCase() || undefined,
      });
      setDone(result.message);
    } catch (caught) {
      if (caught instanceof ApiError && caught.field && caught.field in values) {
        setErrors({ [caught.field as keyof LeadErrors]: caught.message } as LeadErrors);
      } else if (caught instanceof ApiError && caught.status === 429) {
        setFailure(t.sell.errTooMany);
      } else {
        setFailure(caught instanceof ApiError && caught.message ? caught.message : t.sell.errSend);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="start"
      aria-labelledby="start-title"
      className="scroll-mt-6 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
    >
      <div className="grid grid-cols-1 gap-8 rounded-lg border border-slate-200 bg-white p-6 sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <h2 id="start-title" className="text-2xl font-semibold text-navy sm:text-3xl">
            {t.sell.leadTitle}
          </h2>
          <p className="mt-3 text-slate-600">{t.sell.leadIntro}</p>
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            {[t.sell.need1, t.sell.need2, t.sell.need3].map((item) => (
              <li key={item} className="flex gap-2">
                <Icon name="check" className="h-5 w-5 shrink-0 text-teal-600" />
                {item}
              </li>
            ))}
          </ul>
          {VENDOR_PANEL_URL && (
            <p className="mt-6 text-sm text-slate-600">
              {t.sell.selfServe}{' '}
              <a href={START_HREF} className="font-semibold text-teal-600 hover:underline">
                {t.sell.selfServeLink}
              </a>
            </p>
          )}
        </div>

        {done ? (
          <div className="flex flex-col items-start justify-center gap-4" role="status">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <Icon name="check" className="h-6 w-6" />
            </span>
            <p className="text-lg font-semibold text-navy">{t.sell.received}</p>
            <p className="text-slate-600">{done}</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              label={t.sell.nameLabel}
              autoComplete="name"
              value={values.contactName}
              error={errors.contactName}
              onChange={set('contactName')}
            />
            <TextField
              label={t.sell.businessLabel}
              autoComplete="organization"
              value={values.businessName}
              error={errors.businessName}
              onChange={set('businessName')}
            />
            <MobileField
              label={t.sell.mobileLabel}
              country={phoneCountry}
              onCountryChange={setPhoneCountry}
              locale={language}
              placeholder={t.placeholders.mobile}
              value={national}
              error={errors.mobile}
              onChange={(e) => setNational(e.target.value)}
            />
            <TextField
              label={t.sell.emailLabel}
              type="email"
              autoComplete="email"
              value={values.email}
              error={errors.email}
              hint={
                suggestEmail(values.email) ? (
                  <span>
                    {t.sell.didYouMean}{' '}
                    <button
                      type="button"
                      className="font-semibold text-teal-600 underline underline-offset-2"
                      onClick={() =>
                        setValues((current) => ({
                          ...current,
                          email: suggestEmail(current.email) ?? current.email,
                        }))
                      }
                    >
                      {suggestEmail(values.email)}
                    </button>
                    ?
                  </span>
                ) : undefined
              }
              onChange={set('email')}
            />
            <CityField
              label={t.sell.cityLabel}
              country="IN"
              value={values.city}
              error={errors.city}
              onChange={(city) => setValues((current) => ({ ...current, city }))}
            />
            <ListSelect
              label={t.sell.categoryOptional}
              placeholder={t.sell.categoryPlaceholder}
              value={values.category}
              onChange={(category) => setValues((current) => ({ ...current, category }))}
              searchPlaceholder={t.sell.categorySearch}
              options={(rates?.categories ?? []).map((category) => ({
                value: category.id,
                label: (language === 'hi' && category.nameHi) || category.name,
                keywords: category.name,
              }))}
            />
            <div className="sm:col-span-2">
              <TextField
                label={t.sell.gstinLabel}
                autoCapitalize="characters"
                maxLength={15}
                value={values.gstin}
                error={errors.gstin}
                hint={t.sell.gstinHint}
                onChange={set('gstin')}
              />
            </div>
            {failure && (
              <div className="sm:col-span-2">
                <Alert>{failure}</Alert>
              </div>
            )}
            <div className="sm:col-span-2">
              <p className="mb-4 text-xs text-slate-500">{t.sell.privacyNote}</p>
              <div className="sm:w-56">
                <Button type="submit" loading={busy}>
                  {t.sell.requestCall}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

/* FAQ */

function FaqSection() {
  const { t } = useI18n();
  const faqs = [
    [t.sell.faq1Q, t.sell.faq1A],
    [t.sell.faq2Q, t.sell.faq2A],
    [t.sell.faq3Q, t.sell.faq3A],
    [t.sell.faq4Q, t.sell.faq4A],
    [t.sell.faq5Q, t.sell.faq5A],
    [t.sell.faq6Q, t.sell.faq6A],
  ];
  return (
    <section aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
      <h2 id="faq-title" className="text-2xl font-semibold text-navy sm:text-3xl">
        {t.sell.faqTitle}
      </h2>
      <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {faqs.map(([question, answer]) => (
          <details key={question} className="group px-5 py-4">
            <summary
              className={cn(
                'flex cursor-pointer list-none items-center justify-between gap-4 rounded font-medium text-navy [&::-webkit-details-marker]:hidden',
                focusRing,
              )}
            >
              {question}
              <Icon
                name="down"
                className="h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180"
              />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{answer}</p>
          </details>
        ))}
      </div>
      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <p className="text-slate-600">{t.sell.readyText}</p>
        <StartSellingLink className="bg-navy text-white hover:bg-navy-700">
          {t.sell.startSelling}
        </StartSellingLink>
      </div>
    </section>
  );
}

/** /sell: Become a vendor (spec 3.12). Public, no sign-in needed. */
export function SellPage() {
  const { t } = useI18n();
  const { features } = useSiteConfig().config;
  const [rates, setRates] = useState<CommissionRates | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    sellApi
      .commissionRates(controller.signal)
      .then(setRates)
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, []);

  return (
    <>
      <HomeHeader />
      <CategoryNav />
      <main className="bg-cream">
        {features.sellPage ? (
          <>
            <HeroSection rates={rates} />
            <BenefitsGrid rates={rates} />
            <FeeCalculator rates={rates} failed={failed} />
            {rates && <CommissionTable rates={rates} />}
            <StepsSection />
            <LeadForm rates={rates} />
            <FaqSection />
          </>
        ) : (
          // Turned off in Admin › Settings › Features.
          <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
            <h1 className="text-3xl font-semibold text-navy">{t.sell.closedTitle}</h1>
            <p className="mt-3 text-slate-600">{t.sell.closedBody}</p>
          </section>
        )}
      </main>
      <HomeFooter />
      <MarketplaceDialogs />
    </>
  );
}
