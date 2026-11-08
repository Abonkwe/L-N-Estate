import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  Home,
  User,
  Search,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { getHousesApi, type House } from "@/api/houses";
import { getUnitsApi, getUnitApi, type Unit } from "@/api/units";
import { getTenantsApi, createTenantApi, type Tenant } from "@/api/tenants";
import { createLeaseApi } from "@/api/leases";
import { formatMoney, formatDate } from "@/lib/format";
import { Money } from "@/components/shared/Money";

export const NewLeasePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlUnitId = searchParams.get("unit_id")
    ? parseInt(searchParams.get("unit_id")!, 10)
    : null;
  const urlTenantId = searchParams.get("tenant_id")
    ? parseInt(searchParams.get("tenant_id")!, 10)
    : null;

  // Wizard Step: 1 = Unit, 2 = Tenant, 3 = Terms
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // STEP 1 STATE: House & Unit
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  // STEP 2 STATE: Tenant
  const [tenantMode, setTenantMode] = useState<"search" | "create">("search");
  const [tenantSearchQuery, setTenantSearchQuery] = useState("");
  const [debouncedTenantQuery, setDebouncedTenantQuery] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Inline tenant create form
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineFullName, setInlineFullName] = useState("");
  const [inlinePhone, setInlinePhone] = useState("");
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const [inlineTenantError, setInlineTenantError] = useState<string | null>(null);

  // STEP 3 STATE: Lease Terms
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState("");
  const [baseRentStr, setBaseRentStr] = useState("");
  const [waterFeeStr, setWaterFeeStr] = useState("0");
  const [wasteFeeStr, setWasteFeeStr] = useState("0");
  const [graceDays, setGraceDays] = useState(5);
  const [notes, setNotes] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmittingLease, setIsSubmittingLease] = useState(false);

  // Debounce tenant search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTenantQuery(tenantSearchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [tenantSearchQuery]);

  // Fetch Houses
  const { data: houses = [], isLoading: isHousesLoading } = useQuery<House[]>({
    queryKey: ["houses"],
    queryFn: getHousesApi,
  });

  // If urlUnitId is present, fetch that unit to preselect it and its house
  const { data: preselectedUnitData } = useQuery<Unit>({
    queryKey: ["unit", urlUnitId],
    queryFn: () => getUnitApi(urlUnitId!),
    enabled: !!urlUnitId,
  });

  useEffect(() => {
    if (preselectedUnitData) {
      setSelectedHouseId(preselectedUnitData.house_id);
      setSelectedUnit(preselectedUnitData);
      if (preselectedUnitData.listed_rent) {
        setBaseRentStr(String(preselectedUnitData.listed_rent));
      }
    }
  }, [preselectedUnitData]);

  // Default house selection once loaded
  useEffect(() => {
    if (!selectedHouseId && houses.length > 0 && !urlUnitId) {
      setSelectedHouseId(houses[0].id);
    }
  }, [houses, selectedHouseId, urlUnitId]);

  // Fetch Vacant Units for selected house
  const { data: vacantUnits = [], isLoading: isUnitsLoading } = useQuery<Unit[]>({
    queryKey: ["units", { house_id: selectedHouseId, vacant: true }],
    queryFn: () => getUnitsApi({ house_id: selectedHouseId ?? undefined, vacant: true }),
    enabled: !!selectedHouseId,
  });

  // Fetch Tenants for Search
  const { data: tenantsList = [], isLoading: isTenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["tenants", { q: debouncedTenantQuery }],
    queryFn: () => getTenantsApi(debouncedTenantQuery),
  });

  // Preselect tenant if urlTenantId is given
  useEffect(() => {
    if (urlTenantId && tenantsList.length > 0 && !selectedTenant) {
      const match = tenantsList.find((t) => t.id === urlTenantId);
      if (match) {
        setSelectedTenant(match);
      }
    }
  }, [urlTenantId, tenantsList, selectedTenant]);

  // Inline Tenant Creation Handler
  const handleCreateInlineTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineTenantError(null);

    if (inlineFullName.trim().length < 2) {
      setInlineTenantError("Full name must be at least 2 characters.");
      return;
    }

    setIsCreatingTenant(true);
    try {
      const newTenant = await createTenantApi({
        title: inlineTitle.trim() || null,
        full_name: inlineFullName.trim(),
        phone: inlinePhone.trim() || null,
      });

      setSelectedTenant(newTenant);
      setTenantMode("search");
      setInlineFullName("");
      setInlinePhone("");
      setInlineTitle("");
    } catch (err: unknown) {
      setInlineTenantError(
        err instanceof Error ? err.message : "Failed to create tenant"
      );
    } finally {
      setIsCreatingTenant(false);
    }
  };

  // Check 2-year duration warning on Step 3
  const isMoreThanTwoYears = useMemo(() => {
    if (!startDate || !endDate) return false;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (isNaN(start) || isNaN(end)) return false;
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    return diffDays > 730; // 2 years ~ 730 days
  }, [startDate, endDate]);

  // Base rent & caution deposit
  const numBaseRent = parseInt(baseRentStr, 10) || 0;
  const numWaterFee = parseInt(waterFeeStr, 10) || 0;
  const numWasteFee = parseInt(wasteFeeStr, 10) || 0;
  const monthlyTotal = numBaseRent + numWaterFee + numWasteFee;
  const calculatedDeposit = 2 * numBaseRent;

  // Submit New Lease
  const handleSubmitLease = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedUnit) {
      setFormError("Please select a vacant rental unit.");
      setCurrentStep(1);
      return;
    }

    if (!selectedTenant) {
      setFormError("Please select or register a tenant.");
      setCurrentStep(2);
      return;
    }

    if (!startDate) {
      setFormError("Start date is required.");
      return;
    }

    if (endDate && endDate <= startDate) {
      setFormError("End date must be after the start date.");
      return;
    }

    if (numBaseRent <= 0) {
      setFormError("Base rent must be a positive integer.");
      return;
    }

    setIsSubmittingLease(true);
    try {
      const createdLease = await createLeaseApi({
        unit_id: selectedUnit.id,
        tenant_id: selectedTenant.id,
        start_date: startDate,
        end_date: endDate.trim() ? endDate : null,
        base_rent: numBaseRent,
        water_fee: numWaterFee,
        waste_fee: numWasteFee,
        grace_days: graceDays,
        notes: notes.trim() || null,
      });

      // On success, go to /leases/:id
      navigate(`/leases/${createdLease.id}`);
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create lease contract"
      );
    } finally {
      setIsSubmittingLease(false);
    }
  };

  return (
    <div className="space-y-8 max-w-[960px] mx-auto pb-16">
      {/* Top Breadcrumb */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-primary transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Overview</span>
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-[28px] font-semibold text-ink leading-tight">
          Create new lease
        </h1>
        <p className="text-sm text-ink-2 mt-0.5">
          Link a tenant to a vacant unit, configure rent terms, and create the deposit agreement
        </p>
      </div>

      {/* STEP INDICATOR */}
      <div className="bg-surface border border-line rounded-panel p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {/* Step 1 */}
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`flex items-center gap-3 p-2.5 rounded-btn-sm text-left transition-colors ${
              currentStep === 1
                ? "bg-band/80 text-primary border border-primary/30"
                : selectedUnit
                ? "text-ink hover:bg-band/40"
                : "text-ink-2/60"
            }`}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                currentStep === 1
                  ? "bg-primary text-white"
                  : selectedUnit
                  ? "bg-paid text-white"
                  : "bg-band text-ink-2"
              }`}
            >
              {selectedUnit && currentStep !== 1 ? <Check className="w-4 h-4" /> : "1"}
            </span>
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-header-cap">
                Step 1
              </span>
              <span className="block text-xs font-medium truncate">
                {selectedUnit ? `${selectedUnit.house_name}, ${selectedUnit.label}` : "Unit & House"}
              </span>
            </div>
          </button>

          {/* Step 2 */}
          <button
            type="button"
            onClick={() => {
              if (selectedUnit) setCurrentStep(2);
            }}
            disabled={!selectedUnit}
            className={`flex items-center gap-3 p-2.5 rounded-btn-sm text-left transition-colors ${
              currentStep === 2
                ? "bg-band/80 text-primary border border-primary/30"
                : selectedTenant
                ? "text-ink hover:bg-band/40"
                : "text-ink-2/60"
            }`}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                currentStep === 2
                  ? "bg-primary text-white"
                  : selectedTenant
                  ? "bg-paid text-white"
                  : "bg-band text-ink-2"
              }`}
            >
              {selectedTenant && currentStep !== 2 ? <Check className="w-4 h-4" /> : "2"}
            </span>
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-header-cap">
                Step 2
              </span>
              <span className="block text-xs font-medium truncate">
                {selectedTenant ? selectedTenant.full_name : "Tenant Selection"}
              </span>
            </div>
          </button>

          {/* Step 3 */}
          <button
            type="button"
            onClick={() => {
              if (selectedUnit && selectedTenant) setCurrentStep(3);
            }}
            disabled={!selectedUnit || !selectedTenant}
            className={`flex items-center gap-3 p-2.5 rounded-btn-sm text-left transition-colors ${
              currentStep === 3
                ? "bg-band/80 text-primary border border-primary/30"
                : "text-ink-2/60"
            }`}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                currentStep === 3 ? "bg-primary text-white" : "bg-band text-ink-2"
              }`}
            >
              3
            </span>
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-header-cap">
                Step 3
              </span>
              <span className="block text-xs font-medium truncate">Rent Terms & Review</span>
            </div>
          </button>
        </div>
      </div>

      {/* Global Form Error Alert */}
      {formError && (
        <div
          role="alert"
          className="p-4 bg-overdue/10 border border-overdue/30 rounded-panel flex items-start gap-3 text-xs text-overdue font-medium"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">{formError}</div>
        </div>
      )}

      {/* STEP 1: CHOOSE HOUSE & VACANT UNIT */}
      {currentStep === 1 && (
        <div className="bg-surface border border-line rounded-panel shadow-sm overflow-hidden p-6 md:p-8 space-y-6">
          <div className="border-b border-line pb-3">
            <h2 className="text-base font-semibold text-ink flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <span>Step 1: Choose House and Vacant Unit</span>
            </h2>
            <p className="text-xs text-ink-2 mt-1">
              Select the building and choose from currently unoccupied units
            </p>
          </div>

          {/* House Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-2">
              Select House / Property
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {isHousesLoading ? (
                <div className="col-span-3 text-sm text-ink-2 py-4 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Loading houses...</span>
                </div>
              ) : (
                houses.map((house) => (
                  <button
                    key={house.id}
                    type="button"
                    onClick={() => {
                      setSelectedHouseId(house.id);
                      setSelectedUnit(null);
                    }}
                    className={`p-3.5 rounded-btn-sm border text-left transition-all ${
                      selectedHouseId === house.id
                        ? "bg-band/70 border-primary ring-1 ring-primary/30"
                        : "bg-surface border-line hover:bg-band/40"
                    }`}
                  >
                    <span className="block font-semibold text-sm text-ink">{house.name}</span>
                    <span className="block text-xs text-ink-2 mt-0.5">{house.address}</span>
                    <span className="block text-[11px] font-mono text-ink-2/80 mt-2">
                      {house.occupied_count} of {house.unit_count} units occupied
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Vacant Units */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-2">
              Vacant Units in Selected House
            </label>

            {isUnitsLoading ? (
              <div className="py-6 text-center text-sm text-ink-2 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Checking vacant units...</span>
              </div>
            ) : vacantUnits.length === 0 ? (
              <div className="p-6 bg-band/30 border border-line rounded-btn-sm text-center text-sm text-ink-2">
                <Home className="w-6 h-6 text-ink-2/40 mx-auto mb-2" />
                <p className="font-medium text-ink">No vacant units in this house</p>
                <p className="text-xs text-ink-2 mt-0.5">
                  All units are currently occupied. Select another house above to find vacant units.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {vacantUnits.map((unit) => {
                  const isSelected = selectedUnit?.id === unit.id;

                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => {
                        setSelectedUnit(unit);
                        if (unit.listed_rent) {
                          setBaseRentStr(String(unit.listed_rent));
                        }
                      }}
                      className={`p-4 rounded-btn-sm border text-left transition-all ${
                        isSelected
                          ? "bg-paid/10 border-paid ring-1 ring-paid/30 shadow-sm"
                          : "bg-surface border-line hover:bg-band/40"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-base text-ink">Unit {unit.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-paid" />}
                      </div>
                      <span className="block text-xs text-ink-2 capitalize mt-0.5">
                        {unit.unit_type}
                      </span>
                      {unit.description && (
                        <p className="text-xs text-ink-2/80 mt-1 line-clamp-2">
                          {unit.description}
                        </p>
                      )}
                      <div className="mt-3 pt-2 border-t border-row-line flex justify-between text-xs">
                        <span className="text-ink-2">Listed rent:</span>
                        <span className="font-mono font-semibold text-ink">
                          {unit.listed_rent ? <Money amount={unit.listed_rent} showUnit /> : "Not listed"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Next Button */}
          <div className="pt-4 border-t border-line flex justify-end">
            <button
              type="button"
              disabled={!selectedUnit}
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-2 h-11 sm:h-10 px-5 py-2.5 text-xs font-semibold bg-primary hover:bg-primary-hover active:bg-primary-hover text-white rounded-btn transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50 min-h-[44px] sm:min-h-[40px]"
            >
              <span>Next: Choose tenant</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: CHOOSE OR CREATE TENANT */}
      {currentStep === 2 && (
        <div className="bg-surface border border-line rounded-panel shadow-sm overflow-hidden p-6 md:p-8 space-y-6">
          <div className="border-b border-line pb-3">
            <h2 className="text-base font-semibold text-ink flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <span>Step 2: Choose Tenant</span>
            </h2>
            <p className="text-xs text-ink-2 mt-1">
              Select an existing registered tenant or register a new one inline
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex gap-2 p-1 bg-band/70 rounded-btn-sm w-fit border border-line">
            <button
              type="button"
              onClick={() => setTenantMode("search")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors ${
                tenantMode === "search"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              Search existing tenants
            </button>
            <button
              type="button"
              onClick={() => setTenantMode("create")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors ${
                tenantMode === "create"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              + Create new tenant inline
            </button>
          </div>

          {/* Selected Tenant Preview Chip */}
          {selectedTenant && (
            <div className="p-3 bg-paid/10 border border-paid/30 rounded-btn-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-paid" />
                <span className="text-xs text-ink font-medium">
                  Selected tenant:{" "}
                  <strong>
                    {selectedTenant.title ? selectedTenant.title + " " : ""}
                    {selectedTenant.full_name}
                  </strong>{" "}
                  ({selectedTenant.phone || "No phone"})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTenant(null)}
                className="text-xs text-overdue hover:underline font-semibold"
              >
                Change
              </button>
            </div>
          )}

          {/* Option A: Search Existing Tenants */}
          {tenantMode === "search" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-ink-2 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search tenant by full name or phone number..."
                  value={tenantSearchQuery}
                  onChange={(e) => setTenantSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {isTenantsLoading ? (
                <div className="py-6 text-center text-sm text-ink-2 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Searching tenants...</span>
                </div>
              ) : tenantsList.length === 0 ? (
                <div className="p-6 bg-band/30 border border-line rounded-btn-sm text-center text-sm text-ink-2">
                  <p className="font-medium text-ink">No tenants found</p>
                  <p className="text-xs text-ink-2 mt-1">
                    Try another search term or click &ldquo;Create new tenant inline&rdquo; above.
                  </p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-line rounded-panel divide-y divide-row-line">
                  {tenantsList.map((tenant) => {
                    const isSelected = selectedTenant?.id === tenant.id;

                    return (
                      <button
                        key={tenant.id}
                        type="button"
                        onClick={() => setSelectedTenant(tenant)}
                        className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-band/40 transition-colors ${
                          isSelected ? "bg-band/80 font-semibold text-primary" : "text-ink"
                        }`}
                      >
                        <div>
                          <span className="text-sm">
                            {tenant.title ? tenant.title + " " : ""}
                            {tenant.full_name}
                          </span>
                          <span className="block text-xs font-mono text-ink-2 mt-0.5">
                            {tenant.phone || "No phone recorded"}
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-paid" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Option B: Inline Tenant Creation */}
          {tenantMode === "create" && (
            <form
              onSubmit={handleCreateInlineTenant}
              className="p-5 bg-band/30 border border-line rounded-panel space-y-4"
            >
              <h3 className="text-xs font-bold uppercase tracking-header-cap text-ink">
                Quick Tenant Registration
              </h3>

              {inlineTenantError && (
                <div
                  role="alert"
                  className="p-3 bg-overdue/10 border border-overdue/30 rounded-btn-sm text-xs text-overdue font-medium"
                >
                  {inlineTenantError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-ink-2 mb-1">
                    Title
                  </label>
                  <select
                    value={inlineTitle}
                    onChange={(e) => setInlineTitle(e.target.value)}
                    className="w-full h-9 px-2 bg-surface border border-input-border rounded-input text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">(None)</option>
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Miss">Miss</option>
                    <option value="Dr">Dr</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-ink-2 mb-1">
                    Full Name <span className="text-overdue">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Full name (min 2 chars)"
                    value={inlineFullName}
                    onChange={(e) => setInlineFullName(e.target.value)}
                    className="w-full h-9 px-3 bg-surface border border-input-border rounded-input text-xs text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-ink-2 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={inlinePhone}
                    onChange={(e) => setInlinePhone(e.target.value)}
                    className="w-full h-9 px-3 bg-surface border border-input-border rounded-input text-xs font-mono text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTenantMode("search")}
                  className="px-3 py-1.5 text-xs border border-line rounded-btn-sm text-ink hover:bg-band"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTenant || inlineFullName.trim().length < 2}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-primary text-white rounded-btn-sm hover:bg-primary-hover disabled:opacity-50"
                >
                  {isCreatingTenant && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Register & select</span>
                </button>
              </div>
            </form>
          )}

          {/* Stepper Navigation */}
          <div className="pt-4 border-t border-line flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-line text-ink hover:bg-band rounded-btn transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Step 1</span>
            </button>
            <button
              type="button"
              disabled={!selectedTenant}
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-2 h-11 sm:h-10 px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary-hover active:bg-primary-hover text-white rounded-btn transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50 min-h-[44px] sm:min-h-[40px]"
            >
              <span>Next: Lease terms</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: RENT TERMS & REVIEW */}
      {currentStep === 3 && (
        <form onSubmit={handleSubmitLease} className="space-y-6">
          <div className="bg-surface border border-line rounded-panel shadow-sm overflow-hidden p-6 md:p-8 space-y-6">
            <div className="border-b border-line pb-3">
              <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span>Step 3: Lease Terms &amp; Confirmation</span>
              </h2>
              <p className="text-xs text-ink-2 mt-1">
                Configure rent rates, duration, and review financial terms before signing
              </p>
            </div>

            {/* DATES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="lease-start-date"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Start Date <span className="text-overdue">*</span>
                </label>
                <input
                  id="lease-start-date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="lease-end-date"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  End Date (Optional)
                </label>
                <input
                  id="lease-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* > 2 years Warning Callout */}
            {isMoreThanTwoYears && (
              <div className="p-3.5 bg-grace/10 border border-grace/30 rounded-btn-sm flex items-start gap-2.5 text-xs text-grace-text">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-grace" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Notice: Term exceeds 2 years</p>
                  <p className="leading-relaxed">
                    Standard residential tenancy agreements in Buea are typically 1 to 2 years.
                    The server remains the final authority for lease approval.
                  </p>
                </div>
              </div>
            )}

            {/* FINANCIAL TERMS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="base-rent-input"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Base Rent (FCFA) <span className="text-overdue">*</span>
                </label>
                <input
                  id="base-rent-input"
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="e.g. 70000"
                  value={baseRentStr}
                  onChange={(e) => setBaseRentStr(e.target.value)}
                  className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm font-mono text-ink text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="water-fee-input"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Water Fee (FCFA)
                </label>
                <input
                  id="water-fee-input"
                  type="number"
                  min="0"
                  step="1"
                  value={waterFeeStr}
                  onChange={(e) => setWaterFeeStr(e.target.value)}
                  className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm font-mono text-ink text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="waste-fee-input"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Waste Fee (FCFA)
                </label>
                <input
                  id="waste-fee-input"
                  type="number"
                  min="0"
                  step="1"
                  value={wasteFeeStr}
                  onChange={(e) => setWasteFeeStr(e.target.value)}
                  className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm font-mono text-ink text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Grace Days */}
            <div className="sm:w-1/3">
              <label
                htmlFor="grace-days-input"
                className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
              >
                Grace Days (Default: 5)
              </label>
              <input
                id="grace-days-input"
                type="number"
                min="0"
                max="30"
                step="1"
                value={graceDays}
                onChange={(e) => setGraceDays(parseInt(e.target.value, 10) || 0)}
                className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm font-mono text-ink text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Caution Deposit Read-Only Callout (Required by Brief) */}
            <div className="p-4 bg-band/60 border border-row-line rounded-panel space-y-1">
              <span className="block text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                Caution Deposit (Read-Only)
              </span>
              <p className="text-sm font-mono font-bold text-ink">
                2 &times; base rent = {formatMoney(calculatedDeposit, true)}{" "}
                <span className="text-xs font-sans font-normal text-ink-2">
                  (calculated when saved)
                </span>
              </p>
              <p className="text-[11px] text-ink-2">
                The security caution deposit is strictly set by the server as 2 months of base rent.
              </p>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="lease-notes-input"
                className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
              >
                Special Agreement Notes (Optional)
              </label>
              <textarea
                id="lease-notes-input"
                rows={3}
                placeholder="Additional contract terms, key handover notes, advance payment arrangements..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* REVIEW SUMMARY CARD */}
            <div className="p-5 bg-band/40 border border-line rounded-panel space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-header-cap text-ink">
                Agreement Summary Review
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between py-1 border-b border-row-line">
                  <span className="text-ink-2">Unit &amp; House:</span>
                  <span className="font-semibold text-ink">
                    {selectedUnit?.house_name}, Unit {selectedUnit?.label}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-row-line">
                  <span className="text-ink-2">Tenant:</span>
                  <span className="font-semibold text-ink">
                    {selectedTenant?.full_name}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-row-line">
                  <span className="text-ink-2">Start Date:</span>
                  <span className="font-mono text-ink">{formatDate(startDate)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-row-line">
                  <span className="text-ink-2">End Date:</span>
                  <span className="font-mono text-ink">
                    {endDate ? formatDate(endDate) : "Ongoing (No fixed end)"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-row-line">
                  <span className="text-ink-2">Monthly Total:</span>
                  <span className="font-mono font-bold text-ink">
                    <Money amount={monthlyTotal} showUnit />
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-row-line">
                  <span className="text-ink-2">Required Deposit:</span>
                  <span className="font-mono font-bold text-ink">
                    <Money amount={calculatedDeposit} showUnit />
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-line flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-1.5 h-11 sm:h-10 px-4 py-2 text-xs font-medium border border-line text-ink hover:bg-band rounded-btn transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] sm:min-h-[40px]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Step 2</span>
              </button>

              <button
                type="submit"
                disabled={isSubmittingLease || numBaseRent <= 0}
                className="inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-6 py-2.5 text-xs font-semibold bg-primary hover:bg-primary-hover active:bg-primary-hover text-white rounded-btn transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50 min-h-[44px] sm:min-h-[40px]"
              >
                {isSubmittingLease && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Create lease agreement</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
