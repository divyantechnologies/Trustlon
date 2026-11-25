'use client';

import { useState } from 'react';
import { Badge, Tabs, TextArea, Toggle } from '@/components/ui';
import { ListSelect, TextField } from '@/design-system';
import { humanize } from '@/lib/format';
import { Section, SettingsGroupPage } from './SettingsGroupPage';

interface Template {
  sms: { enabled: boolean; en: string; hi: string };
  email: { enabled: boolean; subjectEn: string; subjectHi: string; en: string; hi: string };
  whatsapp: { enabled: boolean; templateName: string; en: string; hi: string };
}

interface Notifications {
  templates: Record<string, Template>;
}

const EVENT_NAMES: Record<string, string> = {
  ORDER_PLACED: 'Order placed',
  ORDER_SHIPPED: 'Order shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  ORDER_DELIVERED: 'Order delivered',
  ORDER_CANCELLED: 'Order cancelled',
  RETURN_APPROVED: 'Return approved',
  REFUND_PROCESSED: 'Refund processed',
  PRICE_DROP: 'Price drop alert',
  KYC_APPROVED: 'Seller KYC approved',
  KYC_REJECTED: 'Seller KYC needs action',
  PAYOUT_SENT: 'Seller payout sent',
};

const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])];

/** Notification templates (5.9 /settings/notifications, spec 8): SMS, email and WhatsApp in English and Hindi. */
export function NotificationSettings() {
  const [event, setEvent] = useState('ORDER_PLACED');
  const [channel, setChannel] = useState<'sms' | 'email' | 'whatsapp'>('sms');
  return (
    <SettingsGroupPage<Notifications>
      group="notifications"
      title="Notifications"
      description="What customers and sellers receive for each event. Words in {curly brackets} are filled in automatically; keep them."
      validate={(d) => {
        for (const [key, t] of Object.entries(d.templates)) {
          if (t.sms.en.length > 320 || t.sms.hi.length > 320)
            return `${EVENT_NAMES[key] ?? key}: SMS is longer than 320 characters`;
        }
        return null;
      }}
    >
      {(d, set) => {
        const t = d.templates[event];
        const update = (patch: Partial<Template[typeof channel]>) =>
          set((x) => ({
            ...x,
            templates: {
              ...x.templates,
              [event]: {
                ...x.templates[event],
                [channel]: { ...x.templates[event][channel], ...patch },
              },
            },
          }));
        const c = t[channel] as Template['sms'] &
          Partial<Template['email']> &
          Partial<Template['whatsapp']>;
        const needed = placeholders(d.templates[event].sms.en + d.templates[event].email.en);
        const missingHi = needed.filter((p) => !c.hi.includes(p));
        return (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,20rem)_1fr] md:items-end">
              <ListSelect
                label="Event"
                value={event}
                onChange={setEvent}
                options={Object.keys(d.templates).map((k) => ({
                  value: k,
                  label: EVENT_NAMES[k] ?? humanize(k),
                  detail: [
                    d.templates[k].sms.enabled && 'SMS',
                    d.templates[k].email.enabled && 'Email',
                    d.templates[k].whatsapp.enabled && 'WhatsApp',
                  ]
                    .filter(Boolean)
                    .join(' · '),
                }))}
              />
              <p className="flex flex-wrap gap-1.5 text-xs text-slate-500">
                Fills in:{' '}
                {needed.map((p) => (
                  <Badge key={p}>{p}</Badge>
                ))}
              </p>
            </div>
            <Tabs
              label="Channel"
              value={channel}
              onChange={setChannel}
              tabs={[
                { key: 'sms', label: 'SMS' },
                { key: 'email', label: 'Email' },
                { key: 'whatsapp', label: 'WhatsApp' },
              ]}
            />
            <Section
              title={`${EVENT_NAMES[event] ?? event} · ${channel === 'sms' ? 'SMS' : channel === 'email' ? 'Email' : 'WhatsApp'}`}
            >
              <Toggle
                label="Send this message"
                checked={c.enabled}
                onChange={(v) => update({ enabled: v })}
              />
              {channel === 'whatsapp' && (
                <TextField
                  label="Approved template name"
                  value={c.templateName ?? ''}
                  maxLength={60}
                  hint="As approved in WhatsApp Business Manager."
                  onChange={(e) => update({ templateName: e.target.value.trim() })}
                />
              )}
              {channel === 'email' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <TextField
                    label="Subject (English)"
                    value={c.subjectEn ?? ''}
                    maxLength={150}
                    onChange={(e) => update({ subjectEn: e.target.value })}
                  />
                  <TextField
                    label="Subject (Hindi)"
                    lang="hi"
                    value={c.subjectHi ?? ''}
                    maxLength={150}
                    onChange={(e) => update({ subjectHi: e.target.value })}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextArea
                  label="English"
                  value={c.en}
                  rows={channel === 'email' ? 8 : 4}
                  maxLength={channel === 'sms' ? 320 : channel === 'email' ? 5000 : 1000}
                  hint={
                    channel === 'sms'
                      ? `${c.en.length}/320 · ${Math.ceil(Math.max(1, c.en.length) / 160)} SMS part(s)`
                      : undefined
                  }
                  onChange={(v) => update({ en: v })}
                />
                <TextArea
                  label="Hindi"
                  value={c.hi}
                  rows={channel === 'email' ? 8 : 4}
                  maxLength={channel === 'sms' ? 320 : channel === 'email' ? 5000 : 1000}
                  error={missingHi.length ? `Missing ${missingHi.join(', ')}` : undefined}
                  hint={
                    channel === 'sms'
                      ? `${c.hi.length}/320 · Hindi SMS uses 70 characters per part`
                      : undefined
                  }
                  onChange={(v) => update({ hi: v })}
                />
              </div>
            </Section>
          </>
        );
      }}
    </SettingsGroupPage>
  );
}
