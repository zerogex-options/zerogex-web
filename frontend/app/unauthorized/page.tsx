import Link from 'next/link';

type UnauthorizedPageProps = {
  searchParams: Promise<{
    required?: string;
    current?: string;
    path?: string;
  }>;
};

export default async function UnauthorizedPage({ searchParams }: UnauthorizedPageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen px-6 py-12 flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
        <h1 className="text-3xl font-bold">Access denied</h1>
        <p className="mt-4 text-[var(--color-text-secondary)]">
          Your current tier does not grant permission for this page.
        </p>

        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt className="text-[var(--color-text-secondary)]">Requested path</dt>
            <dd className="font-medium">{params.path ?? 'Unknown'}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt className="text-[var(--color-text-secondary)]">Current tier</dt>
            <dd className="font-medium">{params.current ?? 'public'}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-2">
            <dt className="text-[var(--color-text-secondary)]">Required tier</dt>
            <dd className="font-medium">{params.required ?? 'starter'}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
          <Link href="/login" className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-black font-semibold">
            Switch tier
          </Link>
          <Link href="/" className="text-[var(--color-brand-primary)] hover:underline">
            Back to Landing
          </Link>
        </div>
      </section>
    </main>
  );
}
