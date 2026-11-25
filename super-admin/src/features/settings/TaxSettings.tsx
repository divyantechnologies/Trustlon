'use client';

import { Btn, NumberInput } from '@/components/ui';
import { TextField } from '@/design-system';
import { Section, SettingsGroupPage } from './SettingsGroupPage';

interface Tax {
  operatorGstins: Array<{ stateCode: string; gstin: string }>;
  gstOnFeesPercent: number;
  tcsPercent: number;
  tdsPercent: number;
  eInvoiceThresholdCrore: number;
}

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Tax (5.9 /settings/tax): operator GSTINs, TCS and TDS, e-invoice threshold. Super Admin only. */
export function TaxSettings() {
  return (
    <SettingsGroupPage<Tax>
      group="tax"
      title="Tax"
      description="Trustlon’s own GST registrations and the marketplace tax rates. Rate changes apply to new invoices; past invoices keep their rates."
      superAdminOnly
      validate={(d) => {
        for (const row of d.operatorGstins) {
          if (!GSTIN.test(row.gstin)) return `${row.gstin || 'A GSTIN'} isn’t a valid GSTIN`;
          if (!row.gstin.startsWith(row.stateCode))
            return `${row.gstin} must start with its state code ${row.stateCode}`;
        }
        return null;
      }}
    >
      {(d, set) => (
        <>
          <Section title="Rates">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <NumberInput
                label="GST on Trustlon fees"
                unit="%"
                value={d.gstOnFeesPercent}
                onChange={(v) => set((x) => ({ ...x, gstOnFeesPercent: v ?? 0 }))}
                min={0}
                max={40}
                step={0.01}
              />
              <NumberInput
                label="TCS (Section 52, CGST Act)"
                unit="%"
                value={d.tcsPercent}
                onChange={(v) => set((x) => ({ ...x, tcsPercent: v ?? 0 }))}
                min={0}
                max={5}
                step={0.01}
              />
              <NumberInput
                label="TDS (Section 194-O)"
                unit="%"
                value={d.tdsPercent}
                onChange={(v) => set((x) => ({ ...x, tdsPercent: v ?? 0 }))}
                min={0}
                max={5}
                step={0.01}
              />
              <NumberInput
                label="E-invoice needed above turnover of"
                unit="₹ crore"
                value={d.eInvoiceThresholdCrore}
                onChange={(v) => set((x) => ({ ...x, eInvoiceThresholdCrore: v ?? 0 }))}
                min={0}
                max={1000}
                step={0.5}
              />
            </div>
          </Section>
          <Section
            title="Operator GSTIN per state"
            description="Used on commission invoices and for TCS returns."
          >
            {d.operatorGstins.length === 0 && (
              <p className="text-sm text-slate-500">None added yet.</p>
            )}
            <ul className="space-y-3">
              {d.operatorGstins.map((row, index) => (
                <li
                  key={index}
                  className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-end gap-2"
                >
                  <TextField
                    label="State code"
                    value={row.stateCode}
                    maxLength={2}
                    inputMode="numeric"
                    onChange={(e) =>
                      set((x) => ({
                        ...x,
                        operatorGstins: x.operatorGstins.map((r, i) =>
                          i === index ? { ...r, stateCode: e.target.value.replace(/\D/g, '') } : r,
                        ),
                      }))
                    }
                  />
                  <TextField
                    label="GSTIN"
                    value={row.gstin}
                    maxLength={15}
                    className="font-mono uppercase"
                    onChange={(e) => {
                      const gstin = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
                      set((x) => ({
                        ...x,
                        operatorGstins: x.operatorGstins.map((r, i) =>
                          i === index ? { stateCode: r.stateCode || gstin.slice(0, 2), gstin } : r,
                        ),
                      }));
                    }}
                  />
                  <Btn
                    tone="ghost"
                    aria-label={`Remove GSTIN ${row.gstin}`}
                    onClick={() =>
                      set((x) => ({
                        ...x,
                        operatorGstins: x.operatorGstins.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    ✕
                  </Btn>
                </li>
              ))}
            </ul>
            {d.operatorGstins.length < 40 && (
              <Btn
                size="sm"
                onClick={() =>
                  set((x) => ({
                    ...x,
                    operatorGstins: [...x.operatorGstins, { stateCode: '', gstin: '' }],
                  }))
                }
              >
                + Add GSTIN
              </Btn>
            )}
          </Section>
        </>
      )}
    </SettingsGroupPage>
  );
}
