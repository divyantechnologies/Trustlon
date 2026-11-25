'use client';

import { Btn, Toggle } from '@/components/ui';
import { useSiteConfig } from '@/lib/site-config';
import { Section, SettingsGroupPage } from './SettingsGroupPage';

interface Features {
  sellPage: boolean;
  referralProgram: boolean;
  internationalAddresses: boolean;
  pincodeLookup: boolean;
  deleteReasons: string[];
}

const SWITCHES: Array<[keyof Omit<Features, 'deleteReasons'>, string, string]> = [
  [
    'sellPage',
    'Sell on Trustlon page',
    'Off shows a “closed for now” message and stops new seller forms.',
  ],
  [
    'referralProgram',
    'Refer and earn',
    'Off hides it from the account menu and stops new referral rewards.',
  ],
  ['internationalAddresses', 'Addresses outside India', 'Off allows Indian addresses only.'],
  ['pincodeLookup', 'PIN code lookup', 'Fills city and state from the India Post service.'],
];

/** Features: storefront on/off switches and account deletion reasons. */
export function FeaturesSettings() {
  const { config, setConfig } = useSiteConfig();
  return (
    <SettingsGroupPage<Features>
      group="features"
      title="Features"
      description="Turn parts of the storefront on or off. Customers see the change within a minute."
      validate={(d) =>
        d.deleteReasons.length === 0 || d.deleteReasons.some((r) => r.trim().length < 2)
          ? 'Each deletion reason needs at least 2 characters'
          : null
      }
      onSaved={(value) => {
        const { deleteReasons, ...features } = value;
        setConfig({ ...config, features, account: { deleteReasons } });
      }}
    >
      {(d, set) => (
        <>
          <Section title="Storefront features">
            <div className="divide-y divide-slate-100">
              {SWITCHES.map(([key, label, help]) => (
                <Toggle
                  key={key}
                  label={label}
                  description={help}
                  checked={d[key]}
                  onChange={(v) => set((x) => ({ ...x, [key]: v }))}
                />
              ))}
            </div>
          </Section>
          <Section
            title="Reasons for deleting an account"
            description="The choices in Account settings › Delete account. Up to 12."
          >
            <ol className="space-y-2">
              {d.deleteReasons.map((reason, i) => (
                <li key={i} className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`reason-${i}`}>
                    Reason {i + 1}
                  </label>
                  <input
                    id={`reason-${i}`}
                    value={reason}
                    maxLength={80}
                    onChange={(e) =>
                      set((x) => ({
                        ...x,
                        deleteReasons: x.deleteReasons.map((r, j) =>
                          j === i ? e.target.value : r,
                        ),
                      }))
                    }
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm text-navy outline-none focus:border-teal focus:ring-4 focus:ring-teal/15"
                  />
                  <Btn
                    tone="ghost"
                    aria-label={`Move reason ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() =>
                      set((x) => {
                        const next = [...x.deleteReasons];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        return { ...x, deleteReasons: next };
                      })
                    }
                  >
                    ↑
                  </Btn>
                  <Btn
                    tone="ghost"
                    aria-label={`Remove reason ${i + 1}`}
                    disabled={d.deleteReasons.length <= 1}
                    onClick={() =>
                      set((x) => ({
                        ...x,
                        deleteReasons: x.deleteReasons.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    ✕
                  </Btn>
                </li>
              ))}
            </ol>
            {d.deleteReasons.length < 12 && (
              <Btn
                size="sm"
                onClick={() => set((x) => ({ ...x, deleteReasons: [...x.deleteReasons, ''] }))}
              >
                + Add a reason
              </Btn>
            )}
          </Section>
        </>
      )}
    </SettingsGroupPage>
  );
}
