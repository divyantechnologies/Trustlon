'use client';
import { useEffect, useState } from 'react';
import type { Address, AddressInput } from '@/features/account/types';
import { accountApi } from '@/features/account/api';
import { homeApi } from '@/features/home/api';
import { button, field, secondary } from '../../product/components/primitives';
export function AddressSelector({ addresses, value, onSelect, onSaved }: { addresses: Address[]; value?: string; onSelect: (id: string) => void; onSaved: (addresses: Address[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState<AddressInput>({ label: 'HOME', fullName: '', mobile: '', line1: '', pincode: '', country: 'IN', city: '', state: '' });
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState(false);
  const [validPin, setValidPin] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let cancelled = false;
    setValidPin(''); setInput(old => ({ ...old, city: '', state: '' }));
    if (!/^[1-9]\d{5}$/.test(input.pincode)) { setLookup(false); return; }
    setLookup(true); setMessage('');
    homeApi.serviceability(input.pincode).then(pin => {
      if (cancelled) return;
      if (!pin.serviceable || !pin.city || !pin.state) { setMessage('Delivery is not available at this pincode yet.'); return; }
      setInput(old => ({ ...old, city: pin.city!, state: pin.state! })); setValidPin(input.pincode);
    }).catch(() => { if (!cancelled) setMessage('Could not check this pincode. Please try again.'); })
      .finally(() => { if (!cancelled) setLookup(false); });
    return () => { cancelled = true; };
  }, [input.pincode]);
  return <div className="space-y-4"><fieldset className="space-y-3"><legend className="mb-3 text-xl font-semibold">Shipping address</legend>
    {addresses.map(address => <label key={address.id} className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 p-4"><input type="radio" name="address" checked={value === address.id} disabled={!address.delivery.serviceable} onChange={() => onSelect(address.id)} className="mt-1 accent-teal-700 focus-visible:ring-2 focus-visible:ring-teal-600" /><span><strong>{address.fullName}</strong><span className="mt-1 block text-sm text-slate-600">{address.line1}, {address.city}, {address.state} {address.pincode}</span>{!address.delivery.serviceable && <span className="text-sm text-slate-500">Delivery is not available at this address.</span>}</span></label>)}
    {!addresses.length && <p className="text-slate-500">Add an address to continue.</p>}
  </fieldset><button type="button" className={secondary} onClick={() => setAdding(v => !v)}>{adding ? 'Cancel' : 'Add new address'}</button>
    {adding && <form className="grid gap-4 sm:grid-cols-2" onSubmit={async e => {
      e.preventDefault(); if (busy || validPin !== input.pincode) return;
      setBusy(true); setMessage('');
      try { const result = await accountApi.createAddress(input); onSaved(result.items); const created = result.items.find(a => !addresses.some(old => old.id === a.id)); if (created) onSelect(created.id); setAdding(false); }
      catch (e) { setMessage(e instanceof Error ? e.message : 'Please try again.'); }
      finally { setBusy(false); }
    }}>
      {(['fullName', 'mobile', 'line1', 'pincode', 'city', 'state'] as const).map(key => <label key={key} className="text-sm"><span>{{ fullName: 'Full name', mobile: 'Mobile number', line1: 'House number and street', pincode: 'Pincode', city: 'City', state: 'State' }[key]}</span><input className={`${field} mt-1 focus-visible:ring-2 focus-visible:ring-teal-600`} required readOnly={key === 'city' || key === 'state'} value={input[key]} inputMode={key === 'pincode' || key === 'mobile' ? 'numeric' : 'text'} maxLength={key === 'pincode' ? 6 : key === 'mobile' ? 20 : 120} pattern={key === 'pincode' ? '[1-9][0-9]{5}' : undefined} onChange={e => setInput(old => ({ ...old, [key]: e.target.value }))} /></label>)}
      <button className={button} disabled={busy || lookup || validPin !== input.pincode}>{busy ? 'Saving…' : lookup ? 'Checking pincode…' : 'Save address'}</button>
    </form>}
    <p role="status" className="text-sm text-teal-700">{message}</p>
  </div>;
}
