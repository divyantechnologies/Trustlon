'use client';

import { Btn, NumberInput, Toggle } from '@/components/ui';
import { TextField } from '@/design-system';
import { Section, SettingsGroupPage } from '@/features/settings/SettingsGroupPage';

interface Prime {
  enabled: boolean;
  plans: Array<{ code: string; name: string; months: number; priceRupees: number }>;
  benefits: string[];
  freeDeliveryThresholdRupees: number;
  coinsMultiplier: number;
}

/** Trustlon Prime (5.7 PrimeSettings): membership price, benefits, free-delivery threshold. */
export function PrimePage() {
  return (
    <SettingsGroupPage<Prime>
      group="prime"
      back={null}
      title="Trustlon Prime"
      description="Membership plans and benefits. Price changes apply to new and renewing members."
      validate={(d) => {
        const codes = d.plans.map((p) => p.code);
        if (d.enabled && d.plans.length === 0)
          return 'Add at least one plan before turning Prime on';
        if (new Set(codes).size !== codes.length) return 'Each plan code must be different';
        if (d.plans.some((p) => !/^[A-Z0-9_]{2,20}$/.test(p.code) || p.name.trim().length < 2))
          return 'Every plan needs a code (capitals) and a name';
        if (d.benefits.some((b) => b.trim().length < 2))
          return 'Benefits need at least 2 characters';
        return null;
      }}
    >
      {(d, set) => (
        <>
          <Section title="Programme">
            <Toggle
              label="Offer Trustlon Prime"
              description="Off hides Prime from the storefront. Current members keep their benefits until their plan ends."
              checked={d.enabled}
              onChange={(v) => set((x) => ({ ...x, enabled: v }))}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <NumberInput
                label="Free delivery for members above"
                unit="₹"
                value={d.freeDeliveryThresholdRupees}
                min={0}
                max={100000}
                hint="0 means always free."
                onChange={(v) => set((x) => ({ ...x, freeDeliveryThresholdRupees: v ?? 0 }))}
              />
              <NumberInput
                label="Coins multiplier"
                unit="×"
                value={d.coinsMultiplier}
                min={1}
                max={10}
                step={0.5}
                onChange={(v) => set((x) => ({ ...x, coinsMultiplier: v ?? 1 }))}
              />
            </div>
          </Section>
          <Section title="Plans">
            <ul className="space-y-3">
              {d.plans.map((p, i) => (
                <li
                  key={i}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[8rem_minmax(0,1fr)_7rem_8rem_auto] sm:items-end"
                >
                  <TextField
                    label="Code"
                    value={p.code}
                    maxLength={20}
                    onChange={(e) =>
                      set((x) => ({
                        ...x,
                        plans: x.plans.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                              }
                            : r,
                        ),
                      }))
                    }
                  />
                  <TextField
                    label="Name"
                    value={p.name}
                    maxLength={40}
                    onChange={(e) =>
                      set((x) => ({
                        ...x,
                        plans: x.plans.map((r, j) =>
                          j === i ? { ...r, name: e.target.value } : r,
                        ),
                      }))
                    }
                  />
                  <NumberInput
                    label="Months"
                    value={p.months}
                    min={1}
                    max={36}
                    onChange={(v) =>
                      set((x) => ({
                        ...x,
                        plans: x.plans.map((r, j) => (j === i ? { ...r, months: v ?? 1 } : r)),
                      }))
                    }
                  />
                  <NumberInput
                    label="Price"
                    unit="₹"
                    value={p.priceRupees}
                    min={0}
                    max={100000}
                    onChange={(v) =>
                      set((x) => ({
                        ...x,
                        plans: x.plans.map((r, j) => (j === i ? { ...r, priceRupees: v ?? 0 } : r)),
                      }))
                    }
                  />
                  <Btn
                    tone="ghost"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => set((x) => ({ ...x, plans: x.plans.filter((_, j) => j !== i) }))}
                  >
                    ✕
                  </Btn>
                </li>
              ))}
            </ul>
            {d.plans.length < 6 && (
              <Btn
                size="sm"
                onClick={() =>
                  set((x) => ({
                    ...x,
                    plans: [...x.plans, { code: '', name: '', months: 3, priceRupees: 399 }],
                  }))
                }
              >
                + Add plan
              </Btn>
            )}
          </Section>
          <Section title="Benefits" description="Shown on the Prime page, in this order.">
            <ol className="space-y-2">
              {d.benefits.map((b, i) => (
                <li key={i} className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`benefit-${i}`}>
                    Benefit {i + 1}
                  </label>
                  <input
                    id={`benefit-${i}`}
                    value={b}
                    maxLength={120}
                    onChange={(e) =>
                      set((x) => ({
                        ...x,
                        benefits: x.benefits.map((r, j) => (j === i ? e.target.value : r)),
                      }))
                    }
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm text-navy outline-none focus:border-teal focus:ring-4 focus:ring-teal/15"
                  />
                  <Btn
                    tone="ghost"
                    aria-label={`Remove benefit ${i + 1}`}
                    onClick={() =>
                      set((x) => ({ ...x, benefits: x.benefits.filter((_, j) => j !== i) }))
                    }
                  >
                    ✕
                  </Btn>
                </li>
              ))}
            </ol>
            {d.benefits.length < 12 && (
              <Btn size="sm" onClick={() => set((x) => ({ ...x, benefits: [...x.benefits, ''] }))}>
                + Add benefit
              </Btn>
            )}
          </Section>
        </>
      )}
    </SettingsGroupPage>
  );
}
