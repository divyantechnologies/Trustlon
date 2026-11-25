import { NextResponse } from 'next/server';
import { LANGUAGES } from '@/lib/i18n/languages';

/** Languages the storefront ships (read by the admin panel's Settings › Localisation). */
export function GET() {
  return NextResponse.json(
    {
      languages: LANGUAGES.map(({ code, api, name, native, dir, locale }) => ({
        code,
        api,
        name,
        native,
        dir,
        locale,
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
