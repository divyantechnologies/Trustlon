import type { Metadata } from 'next';
import { HomePage } from '@/features/home';
import { loadSeo, seoMetadata } from '@/lib/site-config.server';

/** Home page title and description from Admin › Marketing › SEO. */
export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata(await loadSeo('HOME', 'home'));
}

export default function Page() {
  return <HomePage />;
}
