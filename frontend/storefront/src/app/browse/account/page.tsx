import { redirect } from 'next/navigation';

/** Old link from before My Account existed. */
export default function Page() {
  redirect('/account');
}
