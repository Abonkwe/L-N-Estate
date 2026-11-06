import React from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface SummaryStripItem {
  value: React.ReactNode;
  label: string;
  sublabel?: string;
  valueClassName?: string;
}

export type SummaryStripProps =
  | {
      items: SummaryStripItem[];
      className?: string;
      monthlyRentRoll?: never;
      leaseCount?: never;
      overdueCount?: never;
      graceCount?: never;
      expiringCount?: never;
      upToDateCount?: never;
    }
  | {
      monthlyRentRoll: number;
      leaseCount: number;
      overdueCount: number;
      graceCount: number;
      expiringCount: number;
      upToDateCount: number;
      className?: string;
      items?: never;
    };

export const SummaryStrip: React.FC<SummaryStripProps> = (props) => {
  if (props.items) {
    const { items, className } = props;
    const colCount = items.length;
    return (
      <div
        className={cn(
          "border-t-2 border-b border-line bg-transparent grid divide-y sm:divide-y-0 sm:divide-x divide-line",
          colCount === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
          className
        )}
      >
        {items.map((item, idx) => (
          <div key={idx} className="px-5 py-4 flex flex-col justify-center">
            <div
              className={cn(
                "text-[30px] font-mono font-medium text-ink tabular-nums leading-none tracking-tight",
                item.valueClassName
              )}
            >
              {item.value}
            </div>
            <div className="text-[13px] text-ink-2 mt-2 leading-none">
              {item.label}
              {item.sublabel && <span className="ml-1 text-ink-2/70">{item.sublabel}</span>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const {
    monthlyRentRoll,
    leaseCount,
    overdueCount,
    graceCount,
    expiringCount,
    upToDateCount,
    className,
  } = props;

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
