'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Btn,
  Card,
  DataTable,
  ErrorState,
  Loading,
  NumberInput,
  PageHeader,
  Tabs,
  Toggle,
  useAction,
} from '@/components/ui';
import { ImageField } from '@/components/ImageField';
import { Dialog, ListSelect, TextField } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { ApiError, apiFetch } from '@/lib/http';
import { dateTime, fromLocalInput, humanize, toLocalInput } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface Banner {
  id: string;
  placement: 'HOME_HERO' | 'HOME_STRIP' | 'HOME_WIDE' | 'HOME_SIDE';
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  href: string;
  tagLabel: string | null;
  highlights: string[];
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

interface Section {
  key: string;
  title: string | null;
  subtitle: string | null;
  isEnabled: boolean;
  sortOrder: number;
}

const PLACEMENTS = [
  { value: 'HOME_HERO', label: 'Home carousel', detail: '1600 × 600' },
  { value: 'HOME_STRIP', label: 'Sale strip', detail: 'thin bar' },
  { value: 'HOME_WIDE', label: 'Wide banner', detail: '1600 × 300' },
  { value: 'HOME_SIDE', label: 'Side ad', detail: '400 × 600' },
] as const;

const SECTION_NAMES: Record<string, string> = {
  HERO_BANNERS: 'Banner carousel',
  CATEGORY_TILES: 'Category tiles',
  DEALS_OF_THE_DAY: 'Deals of the day',
  TRUSTLON_ORIGINALS: 'Trustlon Originals (own brand)',
  FEATURED_STORES: 'Featured brand stores',
  LOCAL_SELLERS: 'Local sellers',
  RECENTLY_VIEWED: 'Recently viewed',
  RECOMMENDED: 'Recommended for you',
  TRUST_STRIP: 'Trust strip',
};

const EMPTY: Omit<Banner, 'id'> = {
  placement: 'HOME_HERO',
  eyebrow: '',
  title: '',
  subtitle: '',
  ctaLabel: 'Shop now',
  imageUrl: '',
  mobileImageUrl: null,
  href: '/',
  tagLabel: '',
  highlights: [],
  priority: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
};

function bannerState(b: Banner) {
  const now = Date.now();
  if (!b.isActive) return { label: 'Off', tone: 'neutral' as const };
  if (b.endsAt && new Date(b.endsAt).getTime() < now)
    return { label: 'Ended', tone: 'neutral' as const };
  if (b.startsAt && new Date(b.startsAt).getTime() > now)
    return { label: 'Scheduled', tone: 'info' as const };
  return { label: 'Live', tone: 'success' as const };
}

function HomeSections() {
  const { can } = useAuth();
  const run = useAction();
  const { data, error, reload, setData } = useApi<Section[]>('/admin/marketing/home-sections');
  const [draft, setDraft] = useState<Section[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setDraft([...data].sort((a, b) => a.sortOrder - b.sortOrder));
  }, [data]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const editable = can('marketing:edit');
  const move = (index: number, by: number) => {
    const next = [...draft];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    setDraft(next.map((s, i) => ({ ...s, sortOrder: i })));
  };
  const dirty =
    JSON.stringify(draft) !== JSON.stringify([...data].sort((a, b) => a.sortOrder - b.sortOrder));
  return (
    <Card
      title="Home page sections"
      description="Turn sections on or off, rename them and change their order."
    >
      <ol className="divide-y divide-slate-100">
        {draft.map((s, index) => (
          <li
            key={s.key}
            className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center"
          >
            <span className="hidden text-sm tabular-nums text-slate-400 sm:block">{index + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy">
                {SECTION_NAMES[s.key] ?? humanize(s.key)}
              </p>
            </div>
            <TextField
              label="Heading on the home page"
              value={s.title ?? ''}
              maxLength={80}
              disabled={!editable}
              onChange={(e) =>
                setDraft(draft.map((x) => (x.key === s.key ? { ...x, title: e.target.value } : x)))
              }
            />
            <div className="flex items-center gap-1">
              <Btn
                size="sm"
                tone="ghost"
                disabled={!editable || index === 0}
                onClick={() => move(index, -1)}
                aria-label={`Move ${SECTION_NAMES[s.key]} up`}
              >
                ↑
              </Btn>
              <Btn
                size="sm"
                tone="ghost"
                disabled={!editable || index === draft.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`Move ${SECTION_NAMES[s.key]} down`}
              >
                ↓
              </Btn>
              <Toggle
                label="Shown"
                checked={s.isEnabled}
                disabled={!editable}
                onChange={(on) =>
                  setDraft(draft.map((x) => (x.key === s.key ? { ...x, isEnabled: on } : x)))
                }
              />
            </div>
          </li>
        ))}
      </ol>
      {editable && (
        <div className="mt-3 flex gap-2">
          <Btn
            tone="primary"
            disabled={!dirty}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              const result = await run(
                () =>
                  apiFetch<Section[]>('/admin/marketing/home-sections', {
                    method: 'PUT',
                    body: {
                      sections: draft.map((s) => ({
                        key: s.key,
                        isEnabled: s.isEnabled,
                        sortOrder: s.sortOrder,
                        title: s.title?.trim() || undefined,
                        subtitle: s.subtitle ?? undefined,
                      })),
                    },
                  }),
                'Home page updated',
              );
              setSaving(false);
              if (result) setData(result);
            }}
          >
            Save sections
          </Btn>
          <Btn
            disabled={!dirty}
            onClick={() => setDraft([...data].sort((a, b) => a.sortOrder - b.sortOrder))}
          >
            Undo
          </Btn>
        </div>
      )}
    </Card>
  );
}

function BannerEditor({
  banner,
  onClose,
  onSaved,
}: {
  banner: Banner | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Omit<Banner, 'id'>>(EMPTY);
  const [highlights, setHighlights] = useState('');
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!banner) return;
    const value = banner === 'new' ? EMPTY : banner;
    setForm({ ...value });
    setHighlights(value.highlights.join(', '));
    setError(null);
  }, [banner]);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const fieldError = (name: string) => (error?.field === name ? error.message : undefined);

  return (
    <Dialog
      open={Boolean(banner)}
      title={banner === 'new' ? 'New banner' : 'Edit banner'}
      onClose={() => !saving && onClose()}
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (!form.title.trim()) return setError({ field: 'title', message: 'Add a title' });
          if (!form.imageUrl) return setError({ field: 'imageUrl', message: 'Add an image' });
          setSaving(true);
          setError(null);
          const body = {
            ...form,
            eyebrow: form.eyebrow?.trim() || undefined,
            subtitle: form.subtitle?.trim() || undefined,
            tagLabel: form.tagLabel?.trim() || undefined,
            mobileImageUrl: form.mobileImageUrl || undefined,
            highlights: highlights
              .split(',')
              .map((h) => h.trim())
              .filter(Boolean)
              .slice(0, 6),
            startsAt: form.startsAt ?? undefined,
            endsAt: form.endsAt ?? undefined,
          };
          try {
            await apiFetch(
              banner === 'new'
                ? '/admin/marketing/banners'
                : `/admin/marketing/banners/${(banner as Banner).id}`,
              {
                method: banner === 'new' ? 'POST' : 'PATCH',
                body,
              },
            );
            onSaved();
            onClose();
          } catch (err) {
            setError({
              field: err instanceof ApiError ? err.field : undefined,
              message: err instanceof Error ? err.message : 'Couldn’t save',
            });
          } finally {
            setSaving(false);
          }
        }}
      >
        <ListSelect
          label="Where it shows"
          value={form.placement}
          onChange={(v) => set('placement', v as Banner['placement'])}
          options={PLACEMENTS.map((p) => ({ ...p }))}
        />
        <TextField
          label="Small text above the title (optional)"
          value={form.eyebrow ?? ''}
          maxLength={60}
          onChange={(e) => set('eyebrow', e.target.value)}
        />
        <TextField
          label="Title"
          value={form.title}
          maxLength={120}
          onChange={(e) => set('title', e.target.value)}
          error={fieldError('title')}
        />
        <TextField
          label="Subtitle (optional)"
          value={form.subtitle ?? ''}
          maxLength={240}
          onChange={(e) => set('subtitle', e.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Button text"
            value={form.ctaLabel}
            maxLength={40}
            onChange={(e) => set('ctaLabel', e.target.value)}
          />
          <TextField
            label="Link"
            value={form.href}
            maxLength={300}
            hint="A store path like /c/fashion or an https:// link"
            onChange={(e) => set('href', e.target.value.trim())}
            error={fieldError('href')}
          />
        </div>
        <ImageField
          label="Image (desktop)"
          kind="banner"
          value={form.imageUrl || null}
          onChange={(url) => set('imageUrl', url ?? '')}
          hint={PLACEMENTS.find((p) => p.value === form.placement)?.detail}
        />
        {error?.field === 'imageUrl' && <p className="text-xs text-red-600">{error.message}</p>}
        <ImageField
          label="Image for phones (optional)"
          kind="banner"
          value={form.mobileImageUrl}
          onChange={(url) => set('mobileImageUrl', url)}
          hint="Taller crop, about 800 × 800"
        />
        {form.placement === 'HOME_STRIP' && (
          <TextField
            label="Offer chips"
            value={highlights}
            hint="Separate with commas, up to 6. e.g. SALE 70%, CODE NY70"
            onChange={(e) => setHighlights(e.target.value)}
          />
        )}
        {form.placement === 'HOME_HERO' && (
          <TextField
            label="Tag on the image (optional)"
            value={form.tagLabel ?? ''}
            maxLength={80}
            onChange={(e) => set('tagLabel', e.target.value)}
          />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Starts (optional)"
            type="datetime-local"
            value={toLocalInput(form.startsAt)}
            onChange={(e) => set('startsAt', fromLocalInput(e.target.value))}
          />
          <TextField
            label="Ends (optional)"
            type="datetime-local"
            value={toLocalInput(form.endsAt)}
            onChange={(e) => set('endsAt', fromLocalInput(e.target.value))}
            error={fieldError('endsAt')}
          />
        </div>
        <NumberInput
          label="Priority"
          value={form.priority}
          onChange={(v) => set('priority', v ?? 0)}
          min={-100}
          max={100}
          hint="Higher shows first."
        />
        <Toggle label="Active" checked={form.isActive} onChange={(v) => set('isActive', v)} />
        {error && !['title', 'imageUrl', 'href', 'endsAt'].includes(error.field ?? '') && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.message}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Btn onClick={onClose} disabled={saving}>
            Cancel
          </Btn>
          <Btn type="submit" tone="primary" loading={saving}>
            Save banner
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}

/** Banners and home page (5.7 BannerManager + HomepageSections). */
export function BannersPage() {
  const { can } = useAuth();
  const run = useAction();
  const { data, error, reload } = useApi<Banner[]>('/admin/marketing/banners');
  const [tab, setTab] = useState<'banners' | 'sections'>('banners');
  const [editing, setEditing] = useState<Banner | 'new' | null>(null);
  const [placement, setPlacement] = useState('');

  const rows = (data ?? []).filter((b) => !placement || b.placement === placement);

  return (
    <div>
      <PageHeader
        title="Banners and home page"
        description="Schedule banners for the home page and choose which sections show, in what order."
        actions={
          tab === 'banners' &&
          can('marketing:create') && (
            <Btn tone="primary" size="sm" onClick={() => setEditing('new')}>
              New banner
            </Btn>
          )
        }
      />
      <Tabs
        label="Home page content"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'banners', label: 'Banners', count: data?.length },
          { key: 'sections', label: 'Sections' },
        ]}
      />
      {tab === 'sections' ? (
        <HomeSections />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className="mb-4 sm:w-64">
            <ListSelect
              label="Placement"
              hideLabel
              value={placement}
              onChange={setPlacement}
              options={[
                { value: '', label: 'All placements' },
                ...PLACEMENTS.map((p) => ({ ...p })),
              ]}
            />
          </div>
          <DataTable
            caption="Banners"
            rows={rows}
            rowKey={(b) => b.id}
            columns={[
              {
                key: 'banner',
                header: 'Banner',
                primary: true,
                cell: (b) => (
                  <span className="flex items-center gap-3">
                    <img
                      src={b.imageUrl}
                      alt=""
                      className="h-12 w-20 shrink-0 rounded border border-slate-200 object-cover"
                    />
                    <span className="min-w-0">
                      <span className="block break-words font-medium text-navy">{b.title}</span>
                      <span className="block truncate text-xs text-slate-500">{b.href}</span>
                    </span>
                  </span>
                ),
              },
              {
                key: 'placement',
                header: 'Placement',
                cell: (b) => PLACEMENTS.find((p) => p.value === b.placement)?.label ?? b.placement,
              },
              {
                key: 'state',
                header: 'State',
                cell: (b) => <Badge tone={bannerState(b).tone}>{bannerState(b).label}</Badge>,
              },
              {
                key: 'when',
                header: 'Runs',
                cell: (b) =>
                  b.startsAt || b.endsAt
                    ? `${b.startsAt ? dateTime(b.startsAt) : 'Now'} – ${b.endsAt ? dateTime(b.endsAt) : 'no end'}`
                    : 'Always',
                hideOnMobile: true,
              },
              { key: 'priority', header: 'Priority', align: 'end', cell: (b) => b.priority },
              {
                key: 'actions',
                header: 'Actions',
                cell: (b) =>
                  can('marketing:edit') && (
                    <span className="flex gap-1.5">
                      <Btn size="sm" onClick={() => setEditing(b)}>
                        Edit
                      </Btn>
                      <Btn
                        size="sm"
                        tone="ghost"
                        className="text-red-600"
                        onClick={async () => {
                          if (!window.confirm(`Delete the banner “${b.title}”?`)) return;
                          await run(
                            () =>
                              apiFetch(`/admin/marketing/banners/${b.id}`, { method: 'DELETE' }),
                            'Banner deleted',
                          );
                          await reload();
                        }}
                      >
                        Delete
                      </Btn>
                    </span>
                  ),
              },
            ]}
          />
        </>
      )}
      <BannerEditor
        banner={editing}
        onClose={() => setEditing(null)}
        onSaved={() => void reload()}
      />
    </div>
  );
}
