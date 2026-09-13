import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">404</p>
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="text-muted-foreground">The page you were looking for does not exist.</p>
        <Link href="/" className="inline-flex rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90">
          Go home
        </Link>
      </div>
    </main>
  );
}
