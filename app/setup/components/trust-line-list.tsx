"use client";

interface TrustLineBadge {
  currency: string;
  issuerAddress: string;
}

interface TrustLineListProps {
  badges: TrustLineBadge[];
}

export function TrustLineList({ badges }: TrustLineListProps) {
  if (badges.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={`${badge.currency}:${badge.issuerAddress}`}
          title={badge.issuerAddress}
          className="inline-flex items-center bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 shadow-sm dark:bg-blue-900/50 dark:text-blue-200"
        >
          {badge.currency}
        </span>
      ))}
    </div>
  );
}
