import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  Edit2,
  X,
  Receipt,
} from "lucide-react";
import {
  getExpensesApi,
  type ExpenseOut,
  type ExpenseCategory,
} from "@/api/expenses";
import { getHousesApi, type House } from "@/api/houses";
import { getUnitsApi, type Unit } from "@/api/units";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { formatMoney, formatDate } from "@/lib/format";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  repairs: "Repairs",
  installation: "Installation",
  maintenance: "Maintenance",
  water_bill: "Water Bill",
  tax: "Tax",
  cleaning: "Cleaning",
  waste_removal: "Waste Removal",
  sewage_removal: "Sewage Removal",
  other: "Other",
};

export const ExpensesPage: React.FC = () => {
  // Filters state
  const [houseIdFilter, setHouseIdFilter] = useState<number | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "all">("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseOut | null>(null);

  // Fetch houses for dropdown
  const { data: houses = [] } = useQuery<House[]>({
    queryKey: ["houses"],
    queryFn: getHousesApi,
  });

  // Fetch all units for mapping unit_id to unit label
  const { data: allUnits = [] } = useQuery<Unit[]>({
    queryKey: ["units", "all"],
    queryFn: () => getUnitsApi(),
  });

  const unitsMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const u of allUnits) {
      map.set(u.id, u.label);
    }
    return map;
  }, [allUnits]);

  // Expenses query
  const queryParams = {
    house_id: houseIdFilter === "all" ? null : houseIdFilter,
    category: categoryFilter === "all" ? null : categoryFilter,
    date_from: dateFrom || null,
    date_to: dateTo || null,
  };

  const {
    data: expenses = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ExpenseOut[]>({
    queryKey: ["expenses", queryParams],
    queryFn: () => getExpensesApi(queryParams),
  });

  // Calculate total of filtered rows
  const totalAmount = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const hasActiveFilters =
    houseIdFilter !== "all" ||
    categoryFilter !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const handleClearFilters = () => {
    setHouseIdFilter("all");
    setCategoryFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const handleOpenAddExpense = () => {
    setSelectedExpense(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditExpense = (expense: ExpenseOut) => {
    setSelectedExpense(expense);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink leading-tight">
            Expenses
          </h1>
          <p className="text-sm text-ink-2 mt-0.5 font-normal">
            Operational spending, repairs, utility bills, and maintenance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenAddExpense}
            className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-4 bg-primary hover:bg-primary-hover active:bg-primary-hover text-white text-sm font-medium rounded-btn transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px] sm:min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>Add expense</span>
          </button>
        </div>
      </div>

      {/* Query Error State */}
      {isError && (
        <div
          role="alert"
          className="p-4 rounded-panel bg-overdue/10 border border-overdue/30 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-overdue shrink-0" />
            <div className="text-sm text-overdue font-medium">
              {error instanceof Error ? error.message : "Failed to load expenses"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-overdue/40 text-overdue rounded-btn-sm hover:bg-overdue/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-overdue min-h-[36px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-surface border border-line rounded-panel p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* House Filter */}
          <div>
            <label className="block text-xs font-semibold text-ink-2 uppercase tracking-header-cap mb-1">
              House
            </label>
            <select
              value={houseIdFilter}
              onChange={(e) => {
                const val = e.target.value;
                setHouseIdFilter(val === "all" ? "all" : parseInt(val, 10));
              }}
              className="w-full px-3 py-2 text-sm bg-surface border border-input-border rounded-input text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All houses</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-semibold text-ink-2 uppercase tracking-header-cap mb-1">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value as ExpenseCategory | "all");
              }}
              className="w-full px-3 py-2 text-sm bg-surface border border-input-border rounded-input text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All categories</option>
              {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-xs font-semibold text-ink-2 uppercase tracking-header-cap mb-1">
              From date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-surface border border-input-border rounded-input text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-xs font-semibold text-ink-2 uppercase tracking-header-cap mb-1">
              To date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-surface border border-input-border rounded-input text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="pt-2 flex items-center justify-between border-t border-row-line">
            <span className="text-xs text-ink-2">
              Filters active &bull; Showing {expenses.length} result{expenses.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Expenses Table */}
      <div className="bg-surface border border-line rounded-panel overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-ink bg-band/30">
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Date
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  House &amp; Unit
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Category
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Description &amp; Paid To
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                  Amount (FCFA)
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-row-line">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      <span className="text-xs text-ink-2 uppercase tracking-header-cap font-semibold">
                        Loading expenses...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Receipt className="w-8 h-8 text-ink-2/40 mx-auto" />
                      <div className="text-base font-semibold text-ink">
                        No expenses found
                      </div>
                      <p className="text-sm text-ink-2">
                        {hasActiveFilters
                          ? "No expenses match the selected filters. Try broadening the criteria."
                          : "No expenses recorded yet. Click 'Add expense' to record your first operational cost."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => {
                  const unitLabel = expense.unit_id
                    ? unitsMap.get(expense.unit_id) || `Unit #${expense.unit_id}`
                    : null;

                  return (
                    <tr
                      key={expense.id}
                      className="hover:bg-band/20 transition-colors"
                    >
                      {/* Date */}
                      <td className="px-5 py-3.5 text-sm text-ink whitespace-nowrap">
                        {formatDate(expense.incurred_on)}
                      </td>

                      {/* House & Unit */}
                      <td className="px-5 py-3.5 text-sm text-ink whitespace-nowrap">
                        <div className="font-medium text-ink">
                          {expense.house_name}
                        </div>
                        <div className="text-xs text-ink-2 mt-0.5">
                          {unitLabel ? unitLabel : "Entire house"}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-band border border-line text-ink">
                          {CATEGORY_LABELS[expense.category] || expense.category}
                        </span>
                      </td>

                      {/* Description & Paid To */}
                      <td className="px-5 py-3.5 text-sm text-ink-2 max-w-xs">
                        <div className="text-ink line-clamp-1">
                          {expense.description || "—"}
                        </div>
                        {expense.paid_to && (
                          <div className="text-xs text-ink-2/70 mt-0.5">
                            Paid to: {expense.paid_to}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-3.5 text-sm font-mono tabular-nums text-right font-medium text-ink whitespace-nowrap">
                        {formatMoney(expense.amount)}
                      </td>

                      {/* Edit Action (NO DELETE) */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEditExpense(expense)}
                          className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 text-xs font-medium text-primary hover:text-white border border-primary/40 hover:bg-primary rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                          title="Edit expense details"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Total of the filtered rows */}
            {expenses.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-line bg-band/40 font-medium">
                  <td
                    colSpan={4}
                    className="px-5 py-3.5 text-xs uppercase tracking-header-cap text-ink font-semibold"
                  >
                    Total Expenses ({expenses.length} item{expenses.length === 1 ? "" : "s"})
                  </td>
                  <td className="px-5 py-3.5 text-sm font-mono tabular-nums text-right font-bold text-ink whitespace-nowrap">
                    {formatMoney(totalAmount, true)}
                  </td>
                  <td className="px-5 py-3.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add / Edit Expense Dialog */}
      <ExpenseFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        expense={selectedExpense}
        onSuccess={() => refetch()}
      />
    </div>
  );
};

