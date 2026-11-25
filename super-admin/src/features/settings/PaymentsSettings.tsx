'use client';

import { useState } from 'react';
import { NumberInput, Toggle } from '@/components/ui';
import { ListSelect, TextField } from '@/design-system';
import { Section, SettingsGroupPage } from './SettingsGroupPage';

interface Payments {
  gateway: {
    provider: 'RAZORPAY';
    mode: 'test' | 'live';
    keyId: string;
    keySecret: string | null;
    webhookSecret: string | null;
  };
  methods: { upi: boolean; card: boolean; netbanking: boolean; wallet: boolean; cod: boolean };
  emi: { enabled: boolean; minOrderRupees: number; tenures: number[]; noCostTenures: number[] };
  paymentFeePercent: number;
}

const METHODS: Array<[keyof Payments['methods'], string]> = [
  ['upi', 'UPI'],
  ['card', 'Credit and debit cards'],
  ['netbanking', 'Net banking'],
  ['wallet', 'Trustlon wallet'],
  ['cod', 'Cash on delivery'],
];

const listText = (list: number[]) => list.join(', ');
const parseList = (text: string) =>
  [
    ...new Set(
      text
        .split(/[,\s]+/)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 48),
    ),
  ]
    .sort((a, b) => a - b)
    .slice(0, 10);

function Secret({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (!editing && value) {
    return (
      <div>
        <p className="mb-1.5 text-sm font-medium text-navy">{label}</p>
        <div className="flex items-center gap-2">
          <code className="rounded bg-slate-100 px-2 py-1 text-sm">{value}</code>
          <button
            type="button"
            className="text-sm text-teal-600 hover:underline"
            onClick={() => setEditing(true)}
          >
            Replace
          </button>
        </div>
      </div>
    );
  }
  return (
    <TextField
      label={label}
      type="password"
      autoComplete="off"
      value={value && !value.startsWith('••••') ? value : ''}
      placeholder={value ? 'Leave empty to keep the saved one' : ''}
      onChange={(e) => onChange(e.target.value || value)}
      hint="Stored encrypted. Never shown again after saving."
    />
  );
}

/** Payments (5.9 /settings/payments): gateway keys, payment methods, EMI. Super Admin only. */
export function PaymentsSettings() {
  return (
    <SettingsGroupPage<Payments>
      group="payments"
      title="Payments"
      description="Payment gateway keys, which payment methods customers see, and EMI options. Card data never touches Trustlon servers."
      superAdminOnly
      validate={(d) =>
        d.gateway.mode === 'live' && !d.gateway.keyId.startsWith('rzp_live_')
          ? 'Live mode needs a live key ID (rzp_live_…)'
          : null
      }
    >
      {(d, set) => (
        <>
          <Section title="Gateway" description="Razorpay. Use test keys until launch.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ListSelect
                label="Mode"
                value={d.gateway.mode}
                onChange={(mode) =>
                  set((x) => ({ ...x, gateway: { ...x.gateway, mode: mode as 'test' | 'live' } }))
                }
                options={[
                  { value: 'test', label: 'Test', detail: 'no real money' },
                  { value: 'live', label: 'Live', detail: 'real payments' },
                ]}
              />
              <TextField
                label="Key ID"
                value={d.gateway.keyId}
                maxLength={80}
                onChange={(e) =>
                  set((x) => ({ ...x, gateway: { ...x.gateway, keyId: e.target.value.trim() } }))
                }
              />
              <Secret
                label="Key secret"
                value={d.gateway.keySecret}
                onChange={(v) => set((x) => ({ ...x, gateway: { ...x.gateway, keySecret: v } }))}
              />
              <Secret
                label="Webhook secret"
                value={d.gateway.webhookSecret}
                onChange={(v) =>
                  set((x) => ({ ...x, gateway: { ...x.gateway, webhookSecret: v } }))
                }
              />
            </div>
            <NumberInput
              label="Gateway fee charged to vendors"
              unit="% of order value"
              value={d.paymentFeePercent}
              onChange={(v) => set((x) => ({ ...x, paymentFeePercent: v ?? 0 }))}
              min={0}
              max={10}
              step={0.01}
            />
          </Section>
          <Section
            title="Payment methods"
            description="Turned-off methods disappear from checkout."
          >
            <div className="divide-y divide-slate-100">
              {METHODS.map(([key, label]) => (
                <Toggle
                  key={key}
                  label={label}
                  checked={d.methods[key]}
                  onChange={(v) => set((x) => ({ ...x, methods: { ...x.methods, [key]: v } }))}
                />
              ))}
            </div>
          </Section>
          <Section title="EMI">
            <Toggle
              label="Offer EMI at checkout"
              checked={d.emi.enabled}
              onChange={(v) => set((x) => ({ ...x, emi: { ...x.emi, enabled: v } }))}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <NumberInput
                label="Minimum order"
                unit="₹"
                value={d.emi.minOrderRupees}
                onChange={(v) => set((x) => ({ ...x, emi: { ...x.emi, minOrderRupees: v ?? 0 } }))}
                min={0}
              />
              <TextField
                key={`t-${listText(d.emi.tenures)}`}
                label="Tenures (months)"
                defaultValue={listText(d.emi.tenures)}
                onBlur={(e) =>
                  set((x) => ({ ...x, emi: { ...x.emi, tenures: parseList(e.target.value) } }))
                }
                hint="Comma separated, e.g. 3, 6, 9, 12"
              />
              <TextField
                key={`n-${listText(d.emi.noCostTenures)}`}
                label="No-cost EMI tenures"
                defaultValue={listText(d.emi.noCostTenures)}
                onBlur={(e) =>
                  set((x) => ({
                    ...x,
                    emi: { ...x.emi, noCostTenures: parseList(e.target.value) },
                  }))
                }
                hint="Trustlon pays the interest"
              />
            </div>
          </Section>
        </>
      )}
    </SettingsGroupPage>
  );
}
