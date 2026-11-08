import React from "react";
import { cn } from "@/lib/cn";

export type PaymentStatus = "up_to_date" | "expiring_soon" | "grace" | "overdue" | "ended";

interface StatusMarkerProps {
  status: PaymentStatus;
  daysOverdue?: number;
  daysUntilExpiry?: number;
  graceDays?: number;
  label?: string;
  className?: string;
}

export const StatusMarker: React.FC<StatusMarkerProps> = ({
  status,
  daysOverdue = 0,
  daysUntilExpiry = 0,
  graceDays = 5,
  label,
  className,
}) => {
  let markerBg = "";
  let textColor = "";
  let defaultLabel = "";

  switch (status) {
    case "overdue":
      markerBg = "bg-overdue";
      textColor = "text-overdue";
      defaultLabel = `Overdue, ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`;
      break;

    case "grace": {
      markerBg = "bg-grace-marker";
      textColor = "text-grace-text";
      const day = Math.min(Math.max(Math.abs(daysUntilExpiry) || 1, 1), graceDays);
      defaultLabel = `Grace period, day ${day} of ${graceDays}`;
      break;
    }

    case "expiring_soon":
      markerBg = "bg-expiring-marker";
      textColor = "text-expiring-text";
      defaultLabel = `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`;
      break;

    case "up_to_date":
      markerBg = "bg-paid";
      textColor = "text-paid";
      defaultLabel = "Paid up";
      break;

    case "ended":
      markerBg = "bg-ink-2";
      textColor = "text-ink-2";
      defaultLabel = "Ended";
      break;

    default:
      markerBg = "bg-ink-2";
      textColor = "text-ink-2";
      defaultLabel = status;
  }

  const text = label || defaultLabel;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn("w-[9px] h-[9px] rounded-[2px] shrink-0", markerBg)}
        aria-hidden="true"
      />
      <span className={cn("text-[14px] font-medium leading-none", textColor)}>
        {text}
      </span>
    </div>
  );
};

