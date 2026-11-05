import React from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

interface MoneyProps {
  amount: number | null | undefined;
  showUnit?: boolean;
  className?: string;
}

export const Money: React.FC<MoneyProps> = ({ amount, showUnit = false, className }) => {
  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {formatMoney(amount, showUnit)}
    </span>
  );
};

