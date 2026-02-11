import Link from "next/link";
import { cardClass } from "@/lib/ui/ui";

interface EmptyWalletsProps {
  title: string;
  maxWidth?: string;
}

export function EmptyWallets({ title, maxWidth = "max-w-6xl" }: EmptyWalletsProps) {
  return (
    <div className={`mx-auto ${maxWidth} px-4 py-6`}>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h1>
      <div className={`mt-8 ${cardClass} py-12 text-center`}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No wallet configured. Set up a wallet on the{" "}
          <Link
            href="/setup"
            className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Setup page
          </Link>{" "}
          first.
        </p>
      </div>
    </div>
  );
}
