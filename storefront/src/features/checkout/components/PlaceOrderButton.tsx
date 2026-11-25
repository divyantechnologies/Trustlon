'use client';
import { useRef, useState } from 'react';
import { checkoutApi } from '../api';
import type { CheckoutInput, CreatedOrder, PaymentVerification } from '../types';
import { button } from '../../product/components/primitives';
type Callback = Omit<PaymentVerification, 'orderId'>;
type RazorpayInstance = { open: () => void; on: (event: string, fn: () => void) => void };
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance } }
let script: Promise<void> | undefined;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  script ??= new Promise<void>((resolve, reject) => {
    const element = document.createElement('script'); element.src = 'https://checkout.razorpay.com/v1/checkout.js'; element.async = true;
    element.onload = () => window.Razorpay ? resolve() : reject(new Error('Payment checkout could not load.'));
    element.onerror = () => { element.remove(); script = undefined; reject(new Error('Payment checkout could not load. Please retry.')); };
    document.head.appendChild(element);
  });
  return script;
}
export function PlaceOrderButton({ input, fingerprint, disabled, onPlaced }: { input: CheckoutInput; fingerprint: string; disabled?: boolean; onPlaced: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);
  const locked = useRef(false);
  const request = useRef<{ key: string; fingerprint: string; order?: CreatedOrder } | undefined>(undefined);
  async function place() {
    if (locked.current || disabled || complete) return;
    locked.current = true; setBusy(true); setMessage('Preparing secure checkout…');
    let opened = false;
    const unlock = () => { locked.current = false; setBusy(false); };
    try {
      await loadRazorpay();
      if (!request.current || request.current.fingerprint !== fingerprint) {
        let key: string | null = null;
        try { key = sessionStorage.getItem(`tl_checkout_${fingerprint}`); } catch { /* Storage can be disabled. */ }
        request.current = { key: key ?? crypto.randomUUID(), fingerprint };
        try { sessionStorage.setItem(`tl_checkout_${fingerprint}`, request.current.key); } catch { /* In-memory retry still works. */ }
      }
      const attempt = request.current;
      attempt.order ??= await checkoutApi.create({ ...input, checkoutKey: attempt.key, fingerprint });
      const order = attempt.order;
      const gateway = await checkoutApi.gateway(order.id);
      const checkout = new window.Razorpay!({
        key: gateway.keyId, order_id: gateway.orderId, amount: gateway.amount, currency: gateway.currency, name: 'Trustlon',
        prefill: { method: input.paymentMethod?.toLowerCase() },
        retry: { enabled: false },
        modal: { ondismiss: () => { setMessage('Payment is pending. You can retry before the 15-minute reservation expires.'); unlock(); } },
        handler: async (response: Callback) => {
          setMessage('Verifying payment…');
          try {
            const result = await checkoutApi.verify({ ...response, orderId: order.id });
            if (result.confirmed) { setComplete(true); setMessage(`Order ${order.orderNumber} confirmed.`); onPlaced(); }
            else setMessage(result.message ?? 'Payment is processing. Check your orders for confirmation.');
          } catch (e) { setMessage(`${e instanceof Error ? e.message : 'Verification is pending.'} Check My orders before retrying payment.`); }
          finally { unlock(); }
        },
      });
      checkout.on('payment.failed', () => { setMessage('Payment failed. Your reservation will be released. Check My orders before trying again.'); unlock(); });
      checkout.open(); opened = true; setMessage('Complete payment in the secure checkout window.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not place your order. Please try again.'); }
    finally { if (!opened) unlock(); }
  }
  return <div className="space-y-3"><button type="button" className={`${button} w-full`} disabled={disabled || busy || complete} onClick={() => void place()}>{complete ? 'Order confirmed' : busy ? 'Processing…' : 'Place order'}</button><p role="status" className="text-sm text-teal-700">{message}</p>{request.current?.order && <a className="text-sm text-teal-700 underline" href={`/account/orders/${request.current.order.id}`}>View order status</a>}</div>;
}
