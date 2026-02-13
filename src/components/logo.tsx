import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Back to Home">
      <img src="/centxo-logo.png" alt="Centxo" className="h-10 w-10 rounded-lg" />
      <span className="text-xl font-bold text-primary hidden sm:inline-block">
        Centxo
      </span>
    </Link>
  );
}
