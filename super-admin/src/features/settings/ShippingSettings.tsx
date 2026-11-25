'use client';

import { useState } from 'react';
import {
  Badge,
  Btn,
  Card,
  DataTable,
  ErrorState,
  Loading,
  NumberInput,
  SearchInput,
  Tabs,
  Toggle,
  Toolbar,
  useAction,
} from '@/components/ui';
import { TextField } from '@/design-system';
import { apiFetch, qs } from '@/lib/http';
import { useApi } from '@/lib/use-api';
import { Section, SettingsGroupPage } from './SettingsGroupPage';

interface Shipping {
  couriers: Array<{
    code: string;
    name: string;
    enabled: boolean;
    priority: number;
    trackingUrl: string;
  }>;
  fees: {
    freeDeliveryAboveRupees: number;
    standardRupees: number;
    expressRupees: number;
    codFeeRupees: number;
  };
  weightSlabs: Array<{ upToGrams: number; rupees: number }>;
  extraPerKgRupees: number;
}

interface Pincode {
  pincode: string;
  city: string;
  state: string;
  area: string | null;
  serviceable: boolean;
  codAvailable: boolean;
  sameDayAvailable: boolean;
  deliveryDays: number;
}

function Pincodes({ canEdit }: { canEdit: boolean }) {
  const run = useAction();
  const [q, setQ] = useState('');
  const [only, setOnly] = useState('');
  const { data, error, reload, setData } = useApi<{
    items: Pincode[];
    total: number;
    serviceableTotal: number;
  }>(`/admin/settings/shipping/pincodes${qs({ q, serviceable: only })}`);
  const [bulk, setBulk] = useState('');
  const update = async (pin: Pincode, patch: Partial<Pincode>) => {
    const row = await run(() =>
      apiFetch<Pincode>(`/admin/settings/shipping/pincodes/${pin.pincode}`, {
        method: 'PATCH',
        body: patch,
      }),
    );
    if (row && data)
      setData({ ...data, items: data.items.map((p) => (p.pincode === row.pincode ? row : p)) });
  };
  const pins = [...new Set(bulk.split(/[^0-9]+/).filter((p) => /^\d{6}$/.test(p)))];
  return (
    <div className="space-y-5">
      {canEdit && (
        <Card
          title="Change many PIN codes"
          description="Paste PIN codes (any separator), then choose what to do."
        >
          <textarea
            aria-label="PIN codes"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={3}
            placeholder="560001, 560002, 560003"
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-navy outline-none focus:border-teal focus:ring-4 focus:ring-teal/15"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">{pins.length} PIN codes</span>
            {(
              [
                ['Make serviceable', { serviceable: true }],
                ['Stop delivering', { serviceable: false }],
                ['Allow COD', { codAvailable: true }],
                ['No COD', { codAvailable: false }],
              ] as Array<[string, Partial<Pincode>]>
            ).map(([label, patch]) => (
              <Btn
                key={label}
                size="sm"
                disabled={pins.length === 0}
                onClick={async () => {
                  const result = await run(() =>
                    apiFetch<{ updated: number; notFound: number }>(
                      '/admin/settings/shipping/pincodes/bulk',
                      { method: 'POST', body: { pincodes: pins, ...patch } },
                    ),
                  );
                  if (result) {
                    window.alert(
                      `${result.updated} updated${result.notFound ? `, ${result.notFound} not in the pincode master` : ''}.`,
                    );
                    setBulk('');
                    await reload();
                  }
                }}
              >
                {label}
              </Btn>
            ))}
          </div>
        </Card>
      )}
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="PIN code, city, state or area" />
        <div className="sm:w-48">
          <select
            aria-label="Filter"
            value={only}
            onChange={(e) => setOnly(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy"
          >
            <option value="">All PIN codes</option>
            <option value="true">Serviceable</option>
            <option value="false">Not serviceable</option>
          </select>
        </div>
      </Toolbar>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-500">
            {data.serviceableTotal.toLocaleString('en-IN')} serviceable in total · showing{' '}
            {data.items.length} of {data.total.toLocaleString('en-IN')}
          </p>
          <DataTable
            caption="PIN codes"
            rows={data.items}
            rowKey={(p) => p.pincode}
            columns={[
              {
                key: 'pin',
                header: 'PIN code',
                primary: true,
                cell: (p) => <span className="font-mono">{p.pincode}</span>,
              },
              {
                key: 'place',
                header: 'Place',
                cell: (p) => [p.area, p.city, p.state].filter(Boolean).join(', '),
              },
              {
                key: 'svc',
                header: 'Delivers',
                cell: (p) => (
                  <Toggle
                    label="Serviceable"
                    checked={p.serviceable}
                    disabled={!canEdit}
                    onChange={(v) => void update(p, { serviceable: v })}
                  />
                ),
              },
              {
                key: 'cod',
                header: 'COD',
                cell: (p) => (
                  <Toggle
                    label="COD"
                    checked={p.codAvailable}
                    disabled={!canEdit}
                    onChange={(v) => void update(p, { codAvailable: v })}
                  />
                ),
              },
              {
                key: 'same',
                header: 'Same day',
                cell: (p) =>
                  p.sameDayAvailable ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>,
                hideOnMobile: true,
              },
              { key: 'days', header: 'Days', align: 'end', cell: (p) => p.deliveryDays },
            ]}
          />
        </>
      )}
    </div>
  );
}

/** Shipping (5.9 /settings/shipping): couriers, fees, weight slabs and serviceable PIN codes. */
export function ShippingSettings() {
  const [tab, setTab] = useState<'rules' | 'pincodes'>('rules');
  return (
    <SettingsGroupPage<Shipping>
      group="shipping"
      title="Shipping"
      description="Courier partners, delivery fees and weight slabs. PIN code changes save at once."
      validate={(d) => {
        const codes = d.couriers.map((c) => c.code);
        if (new Set(codes).size !== codes.length) return 'Each courier code must be different';
        if (d.couriers.some((c) => !/^[A-Z0-9_]{2,20}$/.test(c.code) || c.name.trim().length < 2))
          return 'Every courier needs a code (capitals) and a name';
        const slabs = d.weightSlabs.map((s) => s.upToGrams);
        if (slabs.some((g, i) => i > 0 && g <= slabs[i - 1])) return 'Weight slabs must go up';
        return null;
      }}
    >
      {(d, set, { canEdit }) => (
        <>
          <Tabs
            label="Shipping"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'rules', label: 'Couriers and fees' },
              { key: 'pincodes', label: 'Serviceable PIN codes' },
            ]}
          />
          {tab === 'pincodes' ? (
            <Pincodes canEdit={canEdit} />
          ) : (
            <>
              <Section
                title="Courier partners"
                description="Priority 1 is tried first. {awb} in the tracking link is replaced with the tracking number."
              >
                <ul className="space-y-4">
                  {d.couriers.map((c, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[8rem_minmax(0,1fr)_6rem_minmax(0,2fr)_auto] md:items-end"
                    >
                      <TextField
                        label="Code"
                        value={c.code}
                        maxLength={20}
                        onChange={(e) =>
                          set((x) => ({
                            ...x,
                            couriers: x.couriers.map((r, j) =>
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
                        value={c.name}
                        maxLength={60}
                        onChange={(e) =>
                          set((x) => ({
                            ...x,
                            couriers: x.couriers.map((r, j) =>
                              j === i ? { ...r, name: e.target.value } : r,
                            ),
                          }))
                        }
                      />
                      <NumberInput
                        label="Priority"
                        value={c.priority}
                        min={1}
                        max={99}
                        onChange={(v) =>
                          set((x) => ({
                            ...x,
                            couriers: x.couriers.map((r, j) =>
                              j === i ? { ...r, priority: v ?? 1 } : r,
                            ),
                          }))
                        }
                      />
                      <TextField
                        label="Tracking link"
                        value={c.trackingUrl}
                        maxLength={300}
                        onChange={(e) =>
                          set((x) => ({
                            ...x,
                            couriers: x.couriers.map((r, j) =>
                              j === i ? { ...r, trackingUrl: e.target.value.trim() } : r,
                            ),
                          }))
                        }
                      />
                      <div className="flex items-center gap-2">
                        <Toggle
                          label="On"
                          checked={c.enabled}
                          onChange={(v) =>
                            set((x) => ({
                              ...x,
                              couriers: x.couriers.map((r, j) =>
                                j === i ? { ...r, enabled: v } : r,
                              ),
                            }))
                          }
                        />
                        <Btn
                          tone="ghost"
                          aria-label={`Remove ${c.name}`}
                          onClick={() =>
                            set((x) => ({ ...x, couriers: x.couriers.filter((_, j) => j !== i) }))
                          }
                        >
                          ✕
                        </Btn>
                      </div>
                    </li>
                  ))}
                </ul>
                {d.couriers.length < 20 && (
                  <Btn
                    size="sm"
                    onClick={() =>
                      set((x) => ({
                        ...x,
                        couriers: [
                          ...x.couriers,
                          {
                            code: '',
                            name: '',
                            enabled: true,
                            priority: x.couriers.length + 1,
                            trackingUrl: '',
                          },
                        ],
                      }))
                    }
                  >
                    + Add courier
                  </Btn>
                )}
              </Section>
              <Section title="Delivery fees">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <NumberInput
                    label="Free delivery above"
                    unit="₹"
                    value={d.fees.freeDeliveryAboveRupees}
                    min={0}
                    max={100000}
                    onChange={(v) =>
                      set((x) => ({ ...x, fees: { ...x.fees, freeDeliveryAboveRupees: v ?? 0 } }))
                    }
                  />
                  <NumberInput
                    label="Standard delivery"
                    unit="₹"
                    value={d.fees.standardRupees}
                    min={0}
                    max={10000}
                    onChange={(v) =>
                      set((x) => ({ ...x, fees: { ...x.fees, standardRupees: v ?? 0 } }))
                    }
                  />
                  <NumberInput
                    label="Express delivery"
                    unit="₹"
                    value={d.fees.expressRupees}
                    min={0}
                    max={10000}
                    onChange={(v) =>
                      set((x) => ({ ...x, fees: { ...x.fees, expressRupees: v ?? 0 } }))
                    }
                  />
                  <NumberInput
                    label="Cash on delivery fee"
                    unit="₹"
                    value={d.fees.codFeeRupees}
                    min={0}
                    max={10000}
                    onChange={(v) =>
                      set((x) => ({ ...x, fees: { ...x.fees, codFeeRupees: v ?? 0 } }))
                    }
                  />
                </div>
              </Section>
              <Section
                title="Weight slabs"
                description="What the vendor pays for shipping by parcel weight."
              >
                <ul className="space-y-2">
                  {d.weightSlabs.map((s, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2"
                    >
                      <NumberInput
                        label="Up to"
                        unit="g"
                        value={s.upToGrams}
                        min={1}
                        max={100000}
                        onChange={(v) =>
                          set((x) => ({
                            ...x,
                            weightSlabs: x.weightSlabs.map((r, j) =>
                              j === i ? { ...r, upToGrams: v ?? 1 } : r,
                            ),
                          }))
                        }
                      />
                      <NumberInput
                        label="Fee"
                        unit="₹"
                        value={s.rupees}
                        min={0}
                        max={100000}
                        onChange={(v) =>
                          set((x) => ({
                            ...x,
                            weightSlabs: x.weightSlabs.map((r, j) =>
                              j === i ? { ...r, rupees: v ?? 0 } : r,
                            ),
                          }))
                        }
                      />
                      <Btn
                        tone="ghost"
                        aria-label="Remove slab"
                        onClick={() =>
                          set((x) => ({
                            ...x,
                            weightSlabs: x.weightSlabs.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        ✕
                      </Btn>
                    </li>
                  ))}
                </ul>
                {d.weightSlabs.length < 20 && (
                  <Btn
                    size="sm"
                    onClick={() =>
                      set((x) => ({
                        ...x,
                        weightSlabs: [
                          ...x.weightSlabs,
                          {
                            upToGrams: (x.weightSlabs.at(-1)?.upToGrams ?? 0) + 1000,
                            rupees: x.weightSlabs.at(-1)?.rupees ?? 40,
                          },
                        ],
                      }))
                    }
                  >
                    + Add slab
                  </Btn>
                )}
                <NumberInput
                  label="Each extra kg above the last slab"
                  unit="₹"
                  value={d.extraPerKgRupees}
                  min={0}
                  max={10000}
                  onChange={(v) => set((x) => ({ ...x, extraPerKgRupees: v ?? 0 }))}
                />
              </Section>
            </>
          )}
        </>
      )}
    </SettingsGroupPage>
  );
}
