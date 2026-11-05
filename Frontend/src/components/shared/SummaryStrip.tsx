import React from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

interface SummaryStripProps {
  monthlyRentRoll: number;
  leaseCount: number;
  overdueCount: number;
  graceCount: number;
  expiringCount: number;
  upToDateCount: number;
  className?: string;
}

export const SummaryStrip: React.FC<SummaryStripProps> = ({
  monthlyRentRoll,
  leaseCount,
  overdueCount,
  graceCount,
  expiringCount,
  upToDateCount,
  className,
}) => {
  return (
    <div
      className={cn(
        "border-t-2 border-b border-line bg-transparent grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-line",
        className
      )}
    >
      {/* 1. Monthly Rent Roll (full width on mobile) */}
      <div className="col-span-2 md:col-span-1 px-5 py-4 flex flex-col justify-center">
        <div className="text-[30px] font-mono font-medium text-ink tabular-nums leading-none tracking-tight">
          {formatMoney(monthlyRentRoll)}
        </div>
        <div className="text-[13px] text-ink-2 mt-2 leading-none">
          FCFA monthly rent roll, {leaseCount} lease{leaseCount === 1 ? "" : "s"}
        </div>
      </div>

      {/* 2. Overdue */}
      <div className="px-5 py-4 flex flex-col justify-center">
        <div className="text-[30px] font-mono font-medium text-overdue tabular-nums leading-none tracking-tight">
          {overdueCount}
        </div>
        <div className="text-[13px] text-ink-2 mt-2 leading-none">
          Overdue
        </div>
      </div>

      {/* 3. In grace period */}
      <div className="px-5 py-4 flex flex-col justify-center">
        <div className="text-[30px] font-mono font-medium text-ink tabular-nums leading-none tracking-tight">
          {graceCount}
        </div>
        <div className="text-[13px] text-ink-2 mt-2 leading-none">
          In grace period
        </div>
      </div>

      {/* 4. Expiring soon */}
      <div className="px-5 py-4 flex flex-col justify-center">
        <div className="text-[30px] font-mono font-medium text-ink tabular-nums leading-none tracking-tight">
          {expiringCount}
        </div>
        <div className="text-[13px] text-ink-2 mt-2 leading-none">
          Expiring soon
        </div>
      </div>

      {/* 5. Up to date */}
      <div className="px-5 py-4 flex flex-col justify-center">
        <div className="text-[30px] font-mono font-medium text-ink tabular-nums leading-none tracking-tight">
          {upToDateCount}
        </div>
        <div className="text-[13px] text-ink-2 mt-2 leading-none">
          Up to date
        </div>
      </div>
    </div>
  );
};
