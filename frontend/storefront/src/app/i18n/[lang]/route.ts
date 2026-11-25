import { NextResponse } from 'next/server';
import { builtInDictionary } from '@/lib/i18n/dictionaries';
import { isLanguage } from '@/lib/i18n/languages';

/** Built-in text of one language, before admin edits (read by Settings › Localisation). */
export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLanguage(lang)) return NextResponse.json({ message: 'Unknown language' }, { status: 404 });
  return NextResponse.json(
    { language: lang, dictionary: await builtInDictionary(lang) },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
