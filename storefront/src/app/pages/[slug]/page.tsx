import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
import { Markdown, markdownClass } from '@/lib/markdown';
import { loadCmsPage, seoMetadata } from '@/lib/site-config.server';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadCmsPage(slug);
  if (!page) return { title: 'Page not found' };
  return seoMetadata(page.seo, { title: page.title });
}

/** Policy and information pages written in Admin › Marketing › Pages (5.7 CmsPages). */
export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  const page = await loadCmsPage(slug);
  if (!page) notFound();
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Trustlon home">
            <BrandLogo />
          </Link>
          <Link href="/" className="text-sm font-medium text-teal-600 hover:underline">
            Continue shopping
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <article className="rounded-lg border border-slate-200 bg-white p-5 sm:p-10">
          <h1 className="text-2xl font-semibold text-navy sm:text-3xl">{page.title}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Last updated{' '}
            {new Date(page.updatedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <Markdown source={page.body} className={`mt-6 ${markdownClass}`} />
        </article>
      </main>
    </div>
  );
}

export const revalidate = 60;
