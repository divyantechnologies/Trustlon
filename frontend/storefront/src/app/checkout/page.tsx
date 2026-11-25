'use client';
import { useState } from 'react';
import { HomeHeader } from '@/features/home/components/HomeHeader';
import { HomeFooter } from '@/features/home/components/HomeFooter';
import { MarketplaceDialogs } from '@/features/home/components/MarketplaceDialogs';
import { button, card, secondary } from '@/features/product/components/primitives';
import { useCheckout } from '@/features/checkout/hooks/use-checkout';
import { CheckoutStepper } from '@/features/checkout/components/CheckoutStepper';
import { AddressSelector } from '@/features/checkout/components/AddressSelector';
import { GstinField, GSTIN_PATTERN } from '@/features/checkout/components/GstinField';
import { DeliveryOptions } from '@/features/checkout/components/DeliveryOptions';
import { PaymentMethods } from '@/features/checkout/components/PaymentMethods';
import { OrderSummary } from '@/features/checkout/components/OrderSummary';
import { PlaceOrderButton } from '@/features/checkout/components/PlaceOrderButton';
export default function CheckoutPage() {
  const { status, addresses, setAddresses, input, setInput, quote, loading, error, retry } = useCheckout();
  const [step, setStep] = useState(0);
  const [gstin, setGstin] = useState('');
  const [placed, setPlaced] = useState(false);
  const valid = !loading && !!quote && (step === 0 ? !!input.addressId && (!gstin || GSTIN_PATTERN.test(gstin)) : step === 1 ? quote.deliveryGroups.every(g => g.options.some(o => o.method === g.selected)) : !!input.paymentMethod);
  return <><HomeHeader /><main className="mx-auto max-w-7xl space-y-6 px-4 py-6 text-navy sm:px-6"><h1 className="text-3xl font-semibold">Checkout</h1>
    {status === 'guest' ? <div className={card}><p>Sign in to use your saved addresses and place an order.</p><a className={`${button} mt-4`} href="/login?next=/checkout">Sign in</a></div> : <>
      <CheckoutStepper step={step} />
      {loading && <p role="status" className={`${card} motion-safe:animate-pulse`}>Checking your cart and delivery options…</p>}
      {error && <div role="alert" className={card}><p>{error}</p><button className={`${secondary} mt-3`} onClick={retry}>Try again</button><a href="/cart" className={`${secondary} ml-3`}>Return to cart</a></div>}
      <div className="grid items-start gap-6 lg:grid-cols-3"><div className={`${card} space-y-6 lg:col-span-2`}>
        {step === 0 && <><AddressSelector addresses={addresses} value={input.addressId} onSaved={setAddresses} onSelect={addressId => setInput(old => ({ ...old, addressId, deliveries: undefined, paymentMethod: undefined }))} />{quote?.isB2B && <GstinField value={gstin} onChange={value => { setGstin(value); if (!value || GSTIN_PATTERN.test(value)) setInput(old => ({ ...old, gstin: value || undefined })); }} />}</>}
        {step === 1 && quote?.deliveryGroups.map(group => <DeliveryOptions key={group.vendorId} group={group} onChange={method => setInput(old => ({ ...old, deliveries: quote.deliveryGroups.map(g => ({ vendorId: g.vendorId, method: g.vendorId === group.vendorId ? method : g.selected })) }))} />)}
        {step === 2 && quote && <PaymentMethods available={quote.paymentMethods} value={input.paymentMethod} walletBalance={quote.walletBalance} onChange={paymentMethod => setInput(old => ({ ...old, paymentMethod }))} />}
        {step === 3 && quote && <><p className="text-sm text-slate-600">Shipping to {addresses.find(a => a.id === input.addressId)?.fullName}, {addresses.find(a => a.id === input.addressId)?.line1}, {quote.shippingState}</p><OrderSummary quote={quote} /><PlaceOrderButton input={input} fingerprint={quote.fingerprint} disabled={loading || !!error} onPlaced={() => setPlaced(true)} /></>}
        {!placed && <div className="flex justify-between gap-3"><button type="button" className={secondary} disabled={step === 0} onClick={() => setStep(s => s - 1)}>Back</button>{step < 3 && <button type="button" className={button} disabled={!valid} onClick={() => { if (step === 1 && quote) setInput(old => ({ ...old, deliveries: quote.deliveryGroups.map(g => ({ vendorId: g.vendorId, method: g.selected })) })); setStep(s => s + 1); }}>Next</button>}</div>}
      </div>{quote && <aside className={`${card} hidden lg:sticky lg:top-6 lg:block`}><OrderSummary quote={quote} /></aside>}</div>
    </>}
  </main><HomeFooter /><MarketplaceDialogs /></>;
}
