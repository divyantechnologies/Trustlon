import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-navy">Page not found</h1>
        <Link href="/" className="mt-3 inline-block text-teal-600 hover:underline">
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
