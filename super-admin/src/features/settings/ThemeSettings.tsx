'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Btn, useAction } from '@/components/ui';
import { ListSelect, TextField, focusRing } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import type { BrandColor } from '@/design-system/tokens/colors';
import { apiUpload } from '@/lib/http';
import { useSiteConfig } from '@/lib/site-config';
import { FONT_CHOICES, type SiteTheme } from '@/lib/theme';
import { type GroupResponse, Section, SettingsGroupPage } from './SettingsGroupPage';

const COLOR_FIELDS: Array<{ key: BrandColor; label: string; help: string }> = [
  { key: 'navy', label: 'Primary', help: 'Headings, main buttons, dark panels' },
  { key: 'navyDark', label: 'Primary (hover)', help: 'Buttons when pointed at' },
  { key: 'navyLight', label: 'Primary (light)', help: 'Selected rows, soft backgrounds' },
  { key: 'teal', label: 'Accent', help: 'Links, highlights, success' },
  { key: 'tealDark', label: 'Accent (dark)', help: 'Accent text on white' },
  { key: 'tealLight', label: 'Accent (light)', help: 'Badges and soft highlights' },
  { key: 'cream', label: 'Page background', help: 'Behind cards and panels' },
  { key: 'logoAccent', label: 'Logo mark', help: 'The shield and icons on dark panels' },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

function ColorField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const invalid = !HEX.test(text);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <input
        type="color"
        aria-label={`${label} colour picker`}
        value={HEX.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className={cn(
          'h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white p-1',
          focusRing,
        )}
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-medium text-navy">
          {label}
        </label>
        <p className="truncate text-xs text-slate-500">{help}</p>
      </div>
      <input
        id={id}
        value={text}
        maxLength={7}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const next = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
          setText(next);
          if (HEX.test(next)) onChange(next.toUpperCase());
        }}
        className={cn(
          'h-9 w-24 shrink-0 rounded-md border px-2 font-mono text-sm uppercase text-navy outline-none',
          invalid ? 'border-red-600' : 'border-slate-300 focus:border-teal',
        )}
      />
    </div>
  );
}

function Preview() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-cream">
      <div className="flex items-center justify-between bg-white px-4 py-3">
        <span className="font-semibold text-navy">Preview</span>
        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-600">
          In stock
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="rounded-lg bg-navy p-4 text-white">
          <p className="text-xs text-white/70">Wallet balance</p>
          <p className="text-2xl font-semibold">₹2,450</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="font-medium text-navy">Wireless headphones</p>
          <p className="mt-1 text-sm text-slate-500">
            Sold by a verified seller · <span className="text-teal-600 underline">See details</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex h-10 items-center rounded-lg bg-navy px-4 text-sm font-semibold text-white">
              Add to cart
            </span>
            <span className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-navy">
              Wishlist
            </span>
          </div>
        </div>
        <div className="rounded-lg bg-navy-50 p-3 text-sm text-navy">
          A selected row looks like this.
        </div>
      </div>
    </div>
  );
}

function ThemeFields({
  d,
  set,
  saved,
  applySaved,
}: {
  d: SiteTheme;
  set: (update: (t: SiteTheme) => SiteTheme) => void;
  saved: SiteTheme;
  applySaved: (r: GroupResponse<SiteTheme>) => void;
}) {
  const run = useAction();
  const { previewTheme } = useSiteConfig();
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  // Show the draft across the whole panel while editing; put the saved theme back on leaving.
  useEffect(() => {
    if (Object.values(d.colors).every((c) => HEX.test(c))) previewTheme(d);
  }, [d, previewTheme]);
  useEffect(() => () => previewTheme(savedRef.current), [previewTheme]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="min-w-0 space-y-5">
        <Section title="Colours" description="The admin panel previews your changes as you edit.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {COLOR_FIELDS.map((f) => (
              <ColorField
                key={f.key}
                label={f.label}
                help={f.help}
                value={d.colors[f.key]}
                onChange={(value) =>
                  set((t) => ({ ...t, colors: { ...t.colors, [f.key]: value } }))
                }
              />
            ))}
          </div>
        </Section>
        <Section title="Text and shape">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ListSelect
              label="Font"
              value={d.font}
              onChange={(font) => set((t) => ({ ...t, font }))}
              options={FONT_CHOICES.map((f) => ({ value: f, label: f }))}
              hint="Indian and other scripts always use matching Noto fonts."
            />
            <ListSelect
              label="Corners"
              value={d.radius}
              onChange={(radius) => set((t) => ({ ...t, radius: radius as SiteTheme['radius'] }))}
              options={[
                { value: 'none', label: 'Square', detail: '0 px' },
                { value: 'small', label: 'Small', detail: '4 px' },
                { value: 'medium', label: 'Medium', detail: '8 px' },
                { value: 'large', label: 'Large', detail: '14 px' },
              ]}
            />
          </div>
        </Section>
        <Section title="Logo">
          <TextField
            label="Brand name"
            maxLength={40}
            value={d.logoText}
            hint="Shown next to the shield, and as the logo’s alt text."
            onChange={(e) => set((t) => ({ ...t, logoText: e.target.value }))}
          />
          <div className="flex flex-wrap items-center gap-3">
            {d.logoUrl ? (
              <img
                src={d.logoUrl}
                alt="Current logo"
                className="h-12 w-auto max-w-[200px] rounded-lg border border-slate-200 bg-white object-contain p-1"
              />
            ) : (
              <span className="text-sm text-slate-500">
                No image: the shield and brand name are used.
              </span>
            )}
            <Btn size="sm" loading={uploading} onClick={() => file.current?.click()}>
              {d.logoUrl ? 'Replace image' : 'Upload image'}
            </Btn>
            {d.logoUrl && (
              <Btn size="sm" tone="ghost" onClick={() => set((t) => ({ ...t, logoUrl: null }))}>
                Use text logo
              </Btn>
            )}
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={async (e) => {
                const chosen = e.target.files?.[0];
                e.target.value = '';
                if (!chosen) return;
                if (chosen.size > 1024 * 1024)
                  return void run(() => Promise.reject(new Error('Use an image of 1 MB or less.')));
                setUploading(true);
                const form = new FormData();
                form.append('logo', chosen);
                const result = await run(
                  () => apiUpload<GroupResponse<SiteTheme>>('/admin/settings/theme/logo', form),
                  'Logo uploaded and live',
                );
                setUploading(false);
                if (result) {
                  applySaved(result);
                }
              }}
            />
          </div>
          <p className="text-xs text-slate-500">
            PNG, JPG or WebP, up to 1 MB. A wide image about 40 px tall works best. Uploading saves
            the logo straight away.
          </p>
        </Section>
      </div>
      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <Preview />
      </aside>
    </div>
  );
}

/** Theme: colours, font, corners and logo for the storefront and every panel. */
export function ThemeSettings() {
  const { config, setConfig } = useSiteConfig();
  return (
    <SettingsGroupPage<SiteTheme>
      group="theme"
      title="Theme"
      description="Colours, font, corners and logo for the storefront and the panels. Customers see a saved change within a minute."
      validate={(t) =>
        Object.values(t.colors).some((c) => !HEX.test(c))
          ? 'Every colour needs a value like #13233F'
          : !t.logoText.trim()
            ? 'Add a brand name'
            : null
      }
      onSaved={(theme) => setConfig({ ...config, theme })}
    >
      {(d, set, ctx) => (
        <ThemeFields d={d} set={set} saved={ctx.saved} applySaved={ctx.applySaved} />
      )}
    </SettingsGroupPage>
  );
}
