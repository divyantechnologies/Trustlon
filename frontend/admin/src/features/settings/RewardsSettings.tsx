'use client';

import { NumberInput } from '@/components/ui';
import { Section, SettingsGroupPage } from './SettingsGroupPage';

interface Rewards {
  referral: { rewardRupees: number };
  affiliate: { commissionPercent: number; attributionDays: number };
  coins: {
    coinValuePaise: number;
    maxRedeemPercent: number;
    earnPerHundredRupees: number;
    expiryMonths: number;
  };
}

/** Rewards: referral reward, affiliate commission and Trustlon Coins. */
export function RewardsSettings() {
  return (
    <SettingsGroupPage<Rewards>
      group="rewards"
      title="Rewards"
      description="What customers earn for referrals, affiliate links and orders. Changes apply to new rewards only."
    >
      {(d, set) => (
        <>
          <Section title="Refer and earn">
            <NumberInput
              label="Reward for each referral"
              unit="₹"
              value={d.referral.rewardRupees}
              min={0}
              max={10000}
              hint="Paid after the friend’s first delivered order. 0 turns rewards off."
              onChange={(v) => set((x) => ({ ...x, referral: { rewardRupees: v ?? 0 } }))}
            />
          </Section>
          <Section title="Affiliates">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <NumberInput
                label="Commission"
                unit="% of order value"
                value={d.affiliate.commissionPercent}
                min={0}
                max={50}
                step={0.1}
                onChange={(v) =>
                  set((x) => ({ ...x, affiliate: { ...x.affiliate, commissionPercent: v ?? 0 } }))
                }
              />
              <NumberInput
                label="Shared link counts for"
                unit="days"
                value={d.affiliate.attributionDays}
                min={1}
                max={365}
                onChange={(v) =>
                  set((x) => ({ ...x, affiliate: { ...x.affiliate, attributionDays: v ?? 1 } }))
                }
              />
            </div>
          </Section>
          <Section title="Trustlon Coins">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <NumberInput
                label="Value of one coin"
                unit="paise"
                value={d.coins.coinValuePaise}
                min={1}
                max={10000}
                hint="100 paise = ₹1"
                onChange={(v) =>
                  set((x) => ({ ...x, coins: { ...x.coins, coinValuePaise: v ?? 1 } }))
                }
              />
              <NumberInput
                label="Coins earned per ₹100"
                value={d.coins.earnPerHundredRupees}
                min={0}
                max={100}
                step={0.1}
                onChange={(v) =>
                  set((x) => ({ ...x, coins: { ...x.coins, earnPerHundredRupees: v ?? 0 } }))
                }
              />
              <NumberInput
                label="Most of an order payable by coins"
                unit="%"
                value={d.coins.maxRedeemPercent}
                min={0}
                max={100}
                onChange={(v) =>
                  set((x) => ({ ...x, coins: { ...x.coins, maxRedeemPercent: v ?? 0 } }))
                }
              />
              <NumberInput
                label="Coins expire after"
                unit="months"
                value={d.coins.expiryMonths}
                min={1}
                max={120}
                onChange={(v) =>
                  set((x) => ({ ...x, coins: { ...x.coins, expiryMonths: v ?? 1 } }))
                }
              />
            </div>
          </Section>
        </>
      )}
    </SettingsGroupPage>
  );
}
