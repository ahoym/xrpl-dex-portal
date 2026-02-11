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
    <div className="mt-2 flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={`${badge.currency}:${badge.issuerAddress}`}
          title={badge.issuerAddress}
          className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
        >
          {badge.currency}
        </span>
      ))}
    </div>
  );
}
