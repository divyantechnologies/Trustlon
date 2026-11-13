'use client';
import { useRef, useState } from 'react';
import { Button, cn, focusRing } from '@/design-system';
import { Dialog } from '@/design-system';
import { ProductImage } from '../home/components/ProductImage';

export function MediaGallery({ name, images }: { name: string; images: string[] }) {
  const unique = [...new Set(images.filter(Boolean))];
  const safeImages = unique.length ? unique : [''];
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const startX = useRef<number | null>(null);
  const move = (direction: number) => setActive((index) => (index + direction + safeImages.length) % safeImages.length);
  return <section aria-label="Product images" className="min-w-0">
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button type="button" aria-label="Open full-size product image" onClick={() => setZoom(true)}
        onTouchStart={(event) => { startX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => { const end = event.changedTouches[0]?.clientX; if (startX.current !== null && end !== undefined && Math.abs(end-startX.current)>48) move(end<startX.current?1:-1); startX.current=null; }}
        className={cn('block aspect-square w-full cursor-zoom-in bg-navy-50',focusRing)}>
        <ProductImage src={safeImages[active]} alt={name} eager className="h-full w-full object-contain" />
      </button>
      {safeImages.length>1 && <>
        <button aria-label="Previous image" onClick={()=>move(-1)} className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm">‹</button>
        <button aria-label="Next image" onClick={()=>move(1)} className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm">›</button>
      </>}
      <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-600">Click to zoom</span>
    </div>
    {safeImages.length>1 && <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
      {safeImages.map((src,index)=><button key={`${src}-${index}`} onClick={()=>setActive(index)} aria-label={`Show image ${index+1}`} aria-pressed={active===index} className={cn('h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white',active===index?'border-teal-600':'border-slate-200')}>
        <ProductImage src={src} alt="" className="h-full w-full object-contain" />
      </button>)}
    </div>}
    <Dialog open={zoom} title={`${name} — image ${active+1}`} onClose={()=>setZoom(false)}>
      <div className="relative aspect-square max-h-[75dvh] bg-white">
        <ProductImage src={safeImages[active]} alt={name} className="h-full w-full object-contain" eager />
        {safeImages.length>1 && <div className="absolute inset-x-0 bottom-3 flex justify-center gap-3">
          <Button variant="secondary" onClick={()=>move(-1)} aria-label="Previous image">Previous</Button><Button variant="secondary" onClick={()=>move(1)} aria-label="Next image">Next</Button>
        </div>}
      </div>
    </Dialog>
  </section>;
}
