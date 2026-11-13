import { ProductDetailsPage } from '@/features/product/ProductDetailsPage';

export default async function Page({ params }: { params: Promise<{ productSlug: string }> }) {
  const { productSlug } = await params;
  return <ProductDetailsPage slug={productSlug} />;
}
