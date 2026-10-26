import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="num text-5xl font-semibold text-accent">404</p>
      <h1 className="mt-3 text-lg font-semibold">This page doesn&apos;t exist</h1>
      <p className="mt-1 text-sm text-muted">Check the address, or head back to your command center.</p>
      <Link href="/" className="mt-5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg">Go to Command Center</Link>
    </div>
  );
}
