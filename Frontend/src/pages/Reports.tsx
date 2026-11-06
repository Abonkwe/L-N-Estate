import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  AlertCircle,
  RefreshCw,
  Loader2,
  Building,
  PieChart,
} from "lucide-react";
import { getMonthlyReportApi, type MonthlyReport } from "@/api/reports";
import { SummaryStrip } from "@/components/shared/SummaryStrip";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CATEGORY_NAMES: Record<string, string> = {
  repairs: "Repairs",
  installation: "Installation",
  maintenance: "Maintenance",
  water_bill: "Water Bill",
  tax: "Tax",
  other: "Other",
};

export const ReportsPage: React.FC = () => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(
    currentDate.getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    currentDate.getMonth() + 1
  );

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<MonthlyReport>({
    queryKey: ["reports", "monthly", { year: selectedYear, month: selectedMonth }],
    queryFn: () => getMonthlyReportApi(selectedYear, selectedMonth),
  });

  const availableYears = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

  const monthLabel = MONTH_NAMES[selectedMonth - 1] || `Month ${selectedMonth}`;

  // Process category entries sorted by amount descending
  const categoryEntries = React.useMemo(() => {
    if (!report?.expenses_by_category) return [];
    return Object.entries(report.expenses_by_category)
      .map(([cat, amount]) => ({
        key: cat,
        label: CATEGORY_NAMES[cat] || cat.replace(/_/g, " "),
        amount,
        percentage:
          report.expenses > 0
            ? Math.round((amount / report.expenses) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [report?.expenses_by_category, report?.expenses]);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink leading-tight">
            Reports
          </h1>
          <p className="text-sm text-ink-2 mt-0.5 font-normal">
            Monthly financial performance, rent collection, and expense tracking
          </p>
        </div>

        {/* Month & Year Pickers */}
        <div className="flex items-center gap-2 bg-surface border border-line rounded-panel p-1.5 shadow-sm">
          <Calendar className="w-4 h-4 text-ink-2 ml-2 shrink-0" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className="px-2.5 py-1.5 text-sm font-medium bg-transparent text-ink border-0 rounded focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          <span className="text-line">|</span>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-2.5 py-1.5 text-sm font-medium font-mono bg-transparent text-ink border-0 rounded focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Query Error State */}
      {isError && (
        <div
          role="alert"
          className="p-4 rounded-panel bg-[#FDF2F1] border border-overdue/30 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-overdue shrink-0" />
            <div className="text-sm text-overdue font-medium">
              {error instanceof Error ? error.message : "Failed to load monthly report"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-overdue/40 text-overdue rounded-btn-sm hover:bg-overdue/5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <div className="text-xs uppercase font-semibold tracking-header-cap text-ink-2">
            Loading monthly report for {monthLabel} {selectedYear}...
          </div>
        </div>
      ) : report ? (
        <>
          {/* SummaryStrip with Income, Expenses and Net */}
          <SummaryStrip
            items={[
              {
                label: "Total Income",
                sublabel: `(${monthLabel} ${selectedYear})`,
                value: formatMoney(report.income),
                valueClassName: "text-ink",
              },
              {
                label: "Total Expenses",
                sublabel: `(${monthLabel} ${selectedYear})`,
                value: formatMoney(report.expenses),
                valueClassName: "text-ink",
              },
              {
                label: "Net Performance",
                sublabel: report.net < 0 ? "deficit" : "surplus",
                value: formatMoney(report.net),
                valueClassName: report.net < 0 ? "text-overdue" : "text-ink",
              },
            ]}
          />

          {/* Section: By-House Breakdown */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                <Building className="w-4 h-4 text-ink-2" />
                <span>Performance by House</span>
              </h2>
              <span className="text-xs text-ink-2">
                {report.by_house.length} propert{report.by_house.length === 1 ? "y" : "ies"}
              </span>
            </div>

            <div className="bg-surface border border-line rounded-panel overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="border-b border-ink bg-band/30">
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                        House Name
                      </th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                        Income (FCFA)
                      </th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                        Expenses (FCFA)
                      </th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                        Net (FCFA)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-row-line">
                    {report.by_house.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-sm text-ink-2">
                          No house records available.
                        </td>
                      </tr>
                    ) : (
                      report.by_house.map((house) => {
                        const isNetNegative = house.net < 0;
                        return (
                          <tr
                            key={house.house_id}
                            className="hover:bg-band/20 transition-colors"
                          >
                            <td className="px-5 py-3.5 text-sm font-medium text-ink">
                              {house.house_name}
                            </td>
                            <td className="px-5 py-3.5 text-sm font-mono tabular-nums text-right text-ink">
                              {formatMoney(house.income)}
                            </td>
                            <td className="px-5 py-3.5 text-sm font-mono tabular-nums text-right text-ink">
                              {formatMoney(house.expenses)}
                            </td>
                            <td
                              className={cn(
                                "px-5 py-3.5 text-sm font-mono tabular-nums text-right font-medium",
                                isNetNegative ? "text-overdue font-semibold" : "text-ink"
                              )}
                            >
                              {formatMoney(house.net)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {report.by_house.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-line bg-band/40 font-semibold">
                        <td className="px-5 py-3.5 text-xs uppercase tracking-header-cap text-ink">
                          Total
                        </td>
                        <td className="px-5 py-3.5 text-sm font-mono tabular-nums text-right text-ink">
                          {formatMoney(report.income)}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-mono tabular-nums text-right text-ink">
                          {formatMoney(report.expenses)}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3.5 text-sm font-mono tabular-nums text-right",
                            report.net < 0 ? "text-overdue" : "text-ink"
                          )}
                        >
                          {formatMoney(report.net)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* Section: Expenses by Category */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                <PieChart className="w-4 h-4 text-ink-2" />
                <span>Expenses by Category</span>
              </h2>
              <span className="text-xs text-ink-2 font-mono tabular-nums">
                Total: {formatMoney(report.expenses, true)}
              </span>
            </div>

            <div className="bg-surface border border-line rounded-panel overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[550px]">
                  <thead>
                    <tr className="border-b border-ink bg-band/30">
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                        Category
                      </th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                        Amount (FCFA)
                      </th>
                      <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                        % of Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-row-line">
                    {categoryEntries.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-sm text-ink-2">
                          No expenses recorded for {monthLabel} {selectedYear}.
                        </td>
                      </tr>
                    ) : (
                      categoryEntries.map((cat) => (
                        <tr
                          key={cat.key}
                          className="hover:bg-band/20 transition-colors"
                        >
                          <td className="px-5 py-3.5 text-sm font-medium text-ink">
                            {cat.label}
                          </td>
                          <td className="px-5 py-3.5 text-sm font-mono tabular-nums text-right text-ink">
                            {formatMoney(cat.amount)}
                          </td>
                          <td className="px-5 py-3.5 text-sm font-mono tabular-nums text-right text-ink-2">
                            {cat.percentage.toFixed(1)}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {categoryEntries.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-line bg-band/40 font-semibold">
                        <td className="px-5 py-3.5 text-xs uppercase tracking-header-cap text-ink">
                          Total Categorized Expenses
                        </td>
                        <td className="px-5 py-3.5 text-sm font-mono tabular-nums text-right text-ink">
                          {formatMoney(report.expenses)}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-mono tabular-nums text-right text-ink-2">
                          100.0%
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

