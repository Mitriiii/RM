import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Freyo</h1>
      <p className="mt-2 text-sm text-slate-600">
        Scaffold in progress.{' '}
        <Link href="/diagnostic" className="font-medium text-slate-900 underline">
          Try the empty-kilometre diagnostic
        </Link>
        .
      </p>
    </main>
  );
}
