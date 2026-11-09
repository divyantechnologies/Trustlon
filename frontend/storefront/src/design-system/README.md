# Trustlon design system

This directory owns storefront tokens, shared presentation patterns, and UI components.
Tailwind 3 consumes the token exports through `tailwind.config.ts`. Global styles import
`styles/utilities.css` once. Existing layouts and authentication behaviour are preserved.

## Structure

```text
design-system/
  tokens/
    colors.ts
    typography.ts
    spacing.ts
    radius.ts
    shadows.ts
    index.ts
  components/
    Button/index.tsx
    TextField/index.tsx
    PasswordField/index.tsx
    PhoneField/index.tsx
    Checkbox/index.tsx
    Alert/index.tsx
    Field.tsx
    index.ts
  styles/
    utilities.css
    index.ts
  utils/cn.ts
  index.ts
  README.md
```

## Tokens and conventions

- `colors` defines `navy` (default, 700, 50), `teal` (default, 600, 50),
  `cream`, and `logo-accent`. Exact brand values live only in `tokens/colors.ts`.
- `white`, `slate`, and `red` reference Tailwind's original colours. Use
  `text-slate-500`, `border-slate-300`, `text-red-600`, and `bg-red-50` as appropriate.
- Navy is for primary actions and headings; navy-700 is the primary hover state.
  Teal is for focus, progress, and selection; teal-600 is for links and success text.
  Cream is the default page background; white is for forms and cards.
- The logo accent is restricted to logos and icons on navy panels.
- `typography.fontFamily.sans` references Inter and Noto Sans Devanagari, loaded
  once by `next/font` in the root layout. Do not load fonts in components.
- `typography.pageTitle`: `text-2xl font-semibold text-navy`.
  `typography.body`: `text-sm text-navy`.
  `typography.secondary`: `text-sm text-slate-500`.
- `spacing`, `radius`, and `shadows` reference the existing Tailwind scales rather
  than copying their values. `dimensions.buttonHeight` and `dimensions.inputHeight`
  reference spacing 11: `h-11` (44px at the default 16px root font size).
- Use `rounded-lg` for ordinary controls/surfaces and `shadow-sm` only where useful.
  Small checkboxes and circular indicators retain their purpose-specific shape.

## Components

| Component | API and behaviour |
| --- | --- |
| Button | `variant`: primary (default), secondary, outline, destructive, link; `loading`, `disabled`, native button props. Loading disables interaction and sets aria-busy. |
| TextField | Native input props/ref plus `label`, `error`, `hint`, `aside`. |
| PasswordField | Text-field props plus required `showLabel` and `hideLabel`; preserves visibility toggle. |
| PhoneField | Native input props/ref plus `label`, `countryLabel`, `country`, `onCountryChange`, `locale`, `error`, `hint`, `aside`. Keeps the existing country-code/phone logic. |
| Checkbox | Native checkbox props/ref plus `label`, `error`; teal checked/focus state. |
| Alert | `tone`: error (default), success, info. Error uses role=alert; other tones use role=status. |
| Field | Shared label, hint, and validation wrapper used by all fields. |

Regular button variants are 44px tall. Link buttons remain inline for field-aside
and sentence-level actions. Use only one prominent navy primary action per screen.
Field errors remain associated with their controls; preserve these accessible IDs.

```tsx
import { Button, TextField, Alert, cn, typography, layouts } from '@/design-system';

export function Example() {
  return (
    <section className="ds-card">
      <h1 className={cn(typography.pageTitle, 'mb-6')}>Contact details</h1>
      <form className={layouts.form}>
        <Alert tone="info">Check your email before continuing.</Alert>
        <TextField label="Email" name="email" type="email" autoComplete="email" />
        <Button type="submit">Continue</Button>
      </form>
    </section>
  );
}
```

## Styling patterns

- Button variants and Alert tones own their styling; do not reconstruct them per page.
- `inputClass(invalid)` is the shared field pattern, including OTP boxes. PhoneField
  uses focus-within on its compound control so its country picker shares the field ring.
- `focusRing` is the shared keyboard focus pattern for custom interactive controls.
- `layouts.form`, `layouts.spaciousForm`, and `layouts.pageGutter` reuse existing form
  spacing and responsive horizontal padding. Combine with Tailwind flex/grid utilities.
- `.ds-card` combines a white surface, subtle border/shadow, radius, and padding.
  Bare surfaces can use `bg-white`; no duplicate one-utility CSS aliases are necessary.
- `cn` composes conditional classes; `cx` is a compatibility alias. Neither resolves
  conflicting Tailwind utilities: avoid passing contradictory classes.

## Maintenance

1. Import components and styling patterns from `@/design-system` in application code.
   Tokens-only consumers (root metadata or Tailwind) may use `@/design-system/tokens`
   to avoid crossing client component boundaries.
2. Old `components/ui` entry points are compatibility re-exports only. Never add a
   second implementation there. Internal design-system modules use direct relative
   imports rather than importing their own root barrel.
3. Add a token to the appropriate `tokens` module, export it through `tokens/index.ts`,
   and connect it to Tailwind only if necessary. Reference Tailwind defaults for
   standard scales; never repeat brand hex values in CSS, configuration, or components.
4. Keep styling patterns small. Prefer component variants and native Tailwind utilities.
   Add composite CSS only when it represents a reusable pattern, not a utility alias.
5. Preserve props, refs, accessible labels, focus/disabled/error/loading states,
   country selection, and form behaviour when extending components. Keep API calls,
   validation schemas, and auth state in the feature layer.
6. Run `npm run typecheck -w frontend/storefront` and
   `npm run build -w frontend/storefront` from the repository root after changes.
   Next's font build requires access to Google Fonts unless cached.

## Dialog

`Dialog` uses the native modal dialog: pass `open`, `title`, `onClose`, and children.
It supports Escape, focus containment/restoration, backdrop dismissal, and body scroll locking.
Keep forms and feature state in the caller; do not nest open dialogs.
