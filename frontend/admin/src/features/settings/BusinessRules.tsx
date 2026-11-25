'use client';

import { NumberInput, Toggle } from '@/components/ui';
import { Section, SettingsGroupPage, setIn } from './SettingsGroupPage';

interface Rules {
  defaultCommissionPercent: number;
  escrowReleaseDays: number;
  returnWindowDays: number;
  codValueCapRupees: number;
  instantPayoutFeePercent: number;
  trustScore: { verifiedMin: number; warningBelow: number; suspensionReviewBelow: number };
  authenticityCheckAboveRupees: number;
  moderateEdits: boolean;
  maxQuantityPerItem: number;
  recordRetentionYears: number;
  sellerCallbackDays: number;
}

/** Business rules (5.9 /settings/business-rules), Super Admin only. */
export function BusinessRules() {
  return (
    <SettingsGroupPage<Rules>
      group="business-rules"
      title="Business rules"
      description="Defaults for commission, escrow, returns and Trust Score. A category or vendor rate overrides the default commission."
      superAdminOnly
      validate={(d) =>
        d.trustScore.suspensionReviewBelow > d.trustScore.warningBelow ||
        d.trustScore.warningBelow > d.trustScore.verifiedMin
          ? 'Trust Score thresholds must go: suspension review ≤ warning ≤ verified'
          : null
      }
    >
      {(d, set) => {
        const num = (
          path: string[],
          label: string,
          opts: { unit?: string; min: number; max: number; step?: number; hint?: string },
        ) => (
          <NumberInput
            label={label}
            value={path.reduce<any>((o, k) => o[k], d)}
            onChange={(v) => set((x) => setIn(x, path, v ?? 0))}
            {...opts}
          />
        );
        return (
          <>
            <Section title="Money" description="Applies to new orders and payouts.">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {num(['defaultCommissionPercent'], 'Default commission', {
                  unit: '%',
                  min: 0,
                  max: 50,
                  step: 0.1,
                  hint: 'Of the item price, when no category or vendor rate is set.',
                })}
                {num(['instantPayoutFeePercent'], 'Instant payout fee', {
                  unit: '%',
                  min: 0,
                  max: 10,
                  step: 0.1,
                })}
                {num(['escrowReleaseDays'], 'Escrow release', {
                  unit: 'days after return window',
                  min: 0,
                  max: 60,
                })}
                {num(['codValueCapRupees'], 'Cash on delivery limit', {
                  unit: '₹ per order',
                  min: 0,
                  max: 1000000,
                })}
              </div>
            </Section>
            <Section title="Orders and returns">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {num(['returnWindowDays'], 'Default return window', {
                  unit: 'days',
                  min: 0,
                  max: 90,
                  hint: 'For categories without their own window.',
                })}
                {num(['maxQuantityPerItem'], 'Most of one item per order', { min: 1, max: 1000 })}
                {num(['recordRetentionYears'], 'Keep order and tax records', {
                  unit: 'years',
                  min: 1,
                  max: 20,
                  hint: 'After an account is deleted. GST law needs 8.',
                })}
                {num(['sellerCallbackDays'], 'Seller team calls back within', {
                  unit: 'working days',
                  min: 1,
                  max: 30,
                })}
              </div>
            </Section>
            <Section title="Catalog quality">
              {num(
                ['authenticityCheckAboveRupees'],
                'Authenticity check for listings priced from',
                { unit: '₹', min: 0, max: 10000000 },
              )}
              <Toggle
                label="Send edits of live listings back to moderation"
                checked={d.moderateEdits}
                onChange={(v) => set((x) => ({ ...x, moderateEdits: v }))}
              />
            </Section>
            <Section
              title="Trust Score thresholds"
              description="Scores run from 0 to 100 and are recalculated daily."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {num(['trustScore', 'verifiedMin'], 'Verified badge at or above', {
                  min: 0,
                  max: 100,
                })}
                {num(['trustScore', 'warningBelow'], 'Warning below', { min: 0, max: 100 })}
                {num(['trustScore', 'suspensionReviewBelow'], 'Suspension review below', {
                  min: 0,
                  max: 100,
                })}
              </div>
            </Section>
          </>
        );
      }}
    </SettingsGroupPage>
  );
}
