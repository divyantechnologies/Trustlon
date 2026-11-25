'use client';
import { useEffect, useState } from 'react';
import type { Product } from '../types';
import { Modal, ProductImage, secondary } from './primitives';
export function ProductGallery({
  product,
  selectedImage,
}: {
  product: Product;
  selectedImage?: string;
}) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [video, setVideo] = useState(false);
  const images = selectedImage
    ? [
        { url: selectedImage, alt: product.title },
        ...product.images.filter((i) => i.url !== selectedImage),
      ]
    : product.images;
  useEffect(() => {
    setIndex(0);
    setVideo(false);
  }, [product.id, selectedImage]);
  const current = images[index] ?? images[0];
  return (
    <div className="min-w-0 space-y-4">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
        {video && product.video ? (
          <video
            className="h-full w-full"
            src={product.video}
            controls
            preload="metadata"
            aria-label={`${product.title} video`}
          />
        ) : (
          <button
            className="h-full w-full cursor-zoom-in"
            disabled={!current}
            aria-label="Zoom product image"
            onClick={() => setZoom(true)}
          >
            <ProductImage
              src={current?.url}
              alt={current?.alt ?? product.title}
              eager
              className="h-full w-full object-contain"
            />
          </button>
        )}
        {!video && current && (
          <span className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500">
            Click to zoom ↗
          </span>
        )}
      </div>
      {(images.length > 1 || product.video) && (
        <div className="flex gap-3 overflow-x-auto pb-1" aria-label="Product media">
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              aria-label={`View image ${i + 1}`}
              aria-pressed={!video && index === i}
              onClick={() => {
                setIndex(i);
                setVideo(false);
              }}
              className={`h-20 w-20 shrink-0 rounded-xl border-2 bg-white p-2 ${!video && index === i ? 'border-teal-600' : 'border-slate-200'}`}
            >
              <ProductImage src={img.url} alt={img.alt} className="h-full w-full object-contain" />
            </button>
          ))}
          {product.video && (
            <button className={secondary} onClick={() => setVideo(true)} aria-pressed={video}>
              Play video
            </button>
          )}
        </div>
      )}
      {zoom && current && (
        <Modal title={product.title} onClose={() => setZoom(false)}>
          <div className="max-h-[65vh] overflow-auto">
            <img src={current.url} alt={current.alt} className="w-full min-w-[800px]" />
          </div>
        </Modal>
      )}
    </div>
  );
}
