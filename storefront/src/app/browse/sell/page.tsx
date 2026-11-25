import { redirect } from 'next/navigation';

/** Footer link from before the Become a vendor page existed. */
export default function Page() {
  redirect('/sell');
}
