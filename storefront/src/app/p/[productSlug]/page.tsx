import { ProductDetailsPage } from '@/features/product/ProductDetailsPage';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadProduct } from '@/features/product/server';
import { productJsonLd } from '@/features/product/helpers';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productSlug: string }>;
}): Promise<Metadata> {
  const { productSlug } = await params;
  const data = await loadProduct(productSlug).catch(() => undefined);
  if (!data) return { title: 'Product', robots: { index: false } };
  const p = data.product;
  const description = (
    p.description?.overview ??
    `${p.title}${p.brand ? ` by ${p.brand}` : ''}. Explore details, pricing and availability on Trustlon.`
  ).slice(0, 160);
  return {
    title: p.title,
    description,
    openGraph: { title: p.title, description, images: p.images.slice(0, 1).map((i) => i.url) },
    ...(productSlug.startsWith('demo-') ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function Page({ params }: { params: Promise<{ productSlug: string }> }) {
  const { productSlug } = await params;
  const data = await loadProduct(productSlug).catch(() => undefined);
  if (data === null) notFound();
  return (
    <>
      {data && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(productJsonLd(data.product)).replace(/</g, '\\u003c'),
          }}
        />
      )}
      <ProductDetailsPage key={productSlug} slug={productSlug} initial={data} />
    </>
  );
}
