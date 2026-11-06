import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft,
  User,
  Phone,
  FileText,
  Users,
  Home,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  getTenantApi,
  createTenantApi,
  updateTenantApi,
  type Tenant,
  type IdDocType,
} from "@/api/tenants";
import { getLeasesApi, type LeaseItem } from "@/api/leases";
import { StatusMarker } from "@/components/shared/StatusMarker";
import { formatMoney, formatDate } from "@/lib/format";

interface TenantDetailProps {
  isNew?: boolean;
}

const tenantSchema = z.object({
  full_name: z.string().trim().min(2, "Full name must be at least 2 characters"),
  title: z.string().optional().nullable(),
  id_doc_type: z.enum(["nic", "residence_permit", "passport"] as const).optional().nullable(),
  id_doc_number: z.string().optional().nullable(),
  id_issued_at: z.string().optional().nullable(),
  id_issued_on: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp_number: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  next_of_kin_name: z.string().optional().nullable(),
  next_of_kin_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const TenantDetailPage: React.FC<TenantDetailProps> = ({ isNew = false }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tenantId = !isNew && id ? parseInt(id, 10) : NaN;
  const isCreateMode = isNew || isNaN(tenantId);

  // Form state
  const [title, setTitle] = useState("");
  const [fullName, setFullName] = useState("");
  const [idDocType, setIdDocType] = useState<IdDocType | "">("");
  const [idDocNumber, setIdDocNumber] = useState("");
  const [idIssuedAt, setIdIssuedAt] = useState("");
  const [idIssuedOn, setIdIssuedOn] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [email, setEmail] = useState("");
  const [nextOfKinName, setNextOfKinName] = useState("");
  const [nextOfKinPhone, setNextOfKinPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Fetch tenant data when editing
  const {
    data: tenant,
    isLoading: isTenantLoading,
    isError: isTenantError,
    error: tenantError,
  } = useQuery<Tenant>({
    queryKey: ["tenants", tenantId],
    queryFn: () => getTenantApi(tenantId),
    enabled: !isCreateMode,
  });

  // Fetch tenant leases when editing
  const {
    data: leases = [],
    isLoading: isLeasesLoading,
  } = useQuery<LeaseItem[]>({
    queryKey: ["leases", { tenant_id: tenantId }],
    queryFn: () => getLeasesApi({ tenant_id: tenantId }),
    enabled: !isCreateMode,
  });

  // Populate form with existing tenant data
  useEffect(() => {
    if (tenant && !isCreateMode) {
      setTitle(tenant.title || "");
      setFullName(tenant.full_name || "");
      setIdDocType(tenant.id_doc_type || "");
      setIdDocNumber(tenant.id_doc_number || "");
      setIdIssuedAt(tenant.id_issued_at || "");
      setIdIssuedOn(tenant.id_issued_on || "");
      setPhone(tenant.phone || "");
      setWhatsappNumber(tenant.whatsapp_number || "");
      setEmail(tenant.email || "");
      setNextOfKinName(tenant.next_of_kin_name || "");
      setNextOfKinPhone(tenant.next_of_kin_phone || "");
      setNotes(tenant.notes || "");
      setFormError(null);
      setValidationErrors({});
    }
  }, [tenant, isCreateMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setValidationErrors({});
    setSaveSuccessMsg(null);

    const payload = {
      full_name: fullName.trim(),
      title: title.trim() || null,
      id_doc_type: (idDocType as IdDocType) || null,
      id_doc_number: idDocNumber.trim() || null,
      id_issued_at: idIssuedAt.trim() || null,
      id_issued_on: idIssuedOn || null,
      phone: phone.trim() || null,
      whatsapp_number: whatsappNumber.trim() || null,
      email: email.trim() || null,
      next_of_kin_name: nextOfKinName.trim() || null,
      next_of_kin_phone: nextOfKinPhone.trim() || null,
      notes: notes.trim() || null,
    };

    // Zod validation
    const result = tenantSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) {
          fieldErrors[issue.path[0].toString()] = issue.message;
        }
      }
      setValidationErrors(fieldErrors);
      setFormError("Please correct the form errors below.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isCreateMode) {
        const created = await createTenantApi(payload);
        queryClient.invalidateQueries({ queryKey: ["tenants"] });
        navigate(`/tenants/${created.id}`, { replace: true });
      } else {
        await updateTenantApi(tenantId, payload);
        queryClient.invalidateQueries({ queryKey: ["tenants"] });
        queryClient.invalidateQueries({ queryKey: ["tenants", tenantId] });
        setSaveSuccessMsg("Tenant details saved successfully.");
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save tenant information"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isCreateMode && isTenantLoading) {
    return (
      <div className="space-y-6 max-w-[900px] mx-auto animate-pulse py-8">
        <div className="h-6 w-32 bg-line/40 rounded-sm" />
        <div className="h-96 bg-surface border border-line rounded-panel" />
      </div>
    );
  }

  if (!isCreateMode && (isTenantError || !tenant)) {
    return (
      <div className="max-w-[900px] mx-auto py-12 space-y-4">
        <Link
          to="/tenants"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tenants</span>
        </Link>
        <div className="p-5 bg-[#FDF2F1] border border-overdue/30 rounded-panel flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-overdue shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-overdue">Tenant not found</h3>
            <p className="text-xs text-ink-2 mt-1">
              {tenantError instanceof Error ? tenantError.message : "Unable to retrieve tenant record"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[960px] mx-auto pb-16">
      {/* Back button */}
      <div>
        <Link
          to="/tenants"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-primary transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Tenants</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink leading-tight">
            {isCreateMode ? "New tenant" : `${tenant?.title ? tenant.title + " " : ""}${tenant?.full_name}`}
          </h1>
          <p className="text-sm text-ink-2 mt-0.5">
            {isCreateMode
              ? "Register a new tenant record with contract and ID details"
              : "Tenancy agreement identification and personal details"}
          </p>
        </div>

        {!isCreateMode && (
          <Link
            to={`/leases/new?tenant_id=${tenantId}`}
            className="inline-flex items-center gap-1.5 h-10 px-4 text-xs font-semibold bg-primary hover:bg-primary-hover active:bg-[#174BB0] text-white rounded-btn transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New lease for this tenant</span>
          </Link>
        )}
      </div>

      {/* Form Error Banner */}
      {formError && (
        <div
          role="alert"
          className="p-4 bg-[#FDF2F1] border border-overdue/30 rounded-panel flex items-start gap-3 text-xs text-overdue font-medium"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">{formError}</div>
        </div>
      )}

      {/* Save Success Banner */}
      {saveSuccessMsg && (
        <div
          role="status"
          className="p-4 bg-[#EBF7EE] border border-paid/30 rounded-panel flex items-center gap-3 text-xs text-paid font-medium"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* MAIN FORM CARD */}
      <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-panel shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          {/* SECTION 1: PERSONAL INFORMATION */}
          <section className="space-y-4">
            <div className="border-b border-line pb-2">
              <h2 className="text-sm font-semibold uppercase tracking-header-cap text-ink flex items-center gap-2">
                <User className="w-4 h-4 text-ink-2" />
                <span>Personal Information</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {/* Title */}
              <div className="sm:col-span-1">
                <label
                  htmlFor="tenant-title"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Title
                </label>
                <select
                  id="tenant-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">(None)</option>
                  <option value="Mr">Mr</option>
                  <option value="Mrs">Mrs</option>
                  <option value="Miss">Miss</option>
                  <option value="Dr">Dr</option>
                  <option value="Prof">Prof</option>
                  <option value="Chief">Chief</option>
                </select>
              </div>

              {/* Full Name */}
              <div className="sm:col-span-3">
                <label
                  htmlFor="tenant-full-name"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Full Name <span className="text-overdue">*</span>
                </label>
                <input
                  id="tenant-full-name"
                  type="text"
                  placeholder="e.g. Collins Ngwa"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className={`w-full h-10 px-3.5 bg-surface border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary ${
                    validationErrors.full_name ? "border-overdue" : "border-input-border"
                  }`}
                />
                {validationErrors.full_name && (
                  <p className="text-[11px] text-overdue mt-1">{validationErrors.full_name}</p>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 2: IDENTIFICATION DOCUMENT */}
          <section className="space-y-4">
            <div className="border-b border-line pb-2">
              <h2 className="text-sm font-semibold uppercase tracking-header-cap text-ink flex items-center gap-2">
                <FileText className="w-4 h-4 text-ink-2" />
                <span>Identification Document</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* ID Type */}
              <div>
                <label
                  htmlFor="id-doc-type"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Document Type
                </label>
                <select
                  id="id-doc-type"
                  value={idDocType}
                  onChange={(e) => setIdDocType(e.target.value as IdDocType | "")}
                  className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select document type</option>
                  <option value="nic">National ID Card (CNI)</option>
                  <option value="residence_permit">Residence Permit</option>
                  <option value="passport">Passport</option>
                </select>
              </div>

              {/* ID Number */}
              <div>
                <label
                  htmlFor="id-doc-number"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Document Number
                </label>
                <input
                  id="id-doc-number"
                  type="text"
                  placeholder="e.g. 100234567"
                  value={idDocNumber}
                  onChange={(e) => setIdDocNumber(e.target.value)}
                  className="w-full h-10 px-3.5 bg-surface border border-input-border rounded-input text-sm font-mono text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Issued At */}
              <div>
                <label
                  htmlFor="id-issued-at"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Where Issued
                </label>
                <input
                  id="id-issued-at"
                  type="text"
                  placeholder="e.g. Buea Police Station"
                  value={idIssuedAt}
                  onChange={(e) => setIdIssuedAt(e.target.value)}
                  className="w-full h-10 px-3.5 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Issued On */}
              <div>
                <label
                  htmlFor="id-issued-on"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  When Issued
                </label>
                <input
                  id="id-issued-on"
                  type="date"
                  value={idIssuedOn}
                  onChange={(e) => setIdIssuedOn(e.target.value)}
                  className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </section>

          {/* SECTION 3: CONTACT INFORMATION */}
          <section className="space-y-4">
            <div className="border-b border-line pb-2">
              <h2 className="text-sm font-semibold uppercase tracking-header-cap text-ink flex items-center gap-2">
                <Phone className="w-4 h-4 text-ink-2" />
                <span>Contact Details</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Phone */}
              <div>
                <label
                  htmlFor="tenant-phone"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Primary Phone
                </label>
                <input
                  id="tenant-phone"
                  type="tel"
                  placeholder="e.g. +237 670 00 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3.5 bg-surface border border-input-border rounded-input text-sm font-mono text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label
                  htmlFor="tenant-whatsapp"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  WhatsApp Number
                </label>
                <input
                  id="tenant-whatsapp"
                  type="tel"
                  placeholder="e.g. +237 670 00 00 00"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="w-full h-10 px-3.5 bg-surface border border-input-border rounded-input text-sm font-mono text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="tenant-email"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Email Address
                </label>
                <input
                  id="tenant-email"
                  type="email"
                  placeholder="e.g. tenant@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3.5 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </section>

          {/* SECTION 4: NEXT OF KIN & NOTES */}
          <section className="space-y-4">
            <div className="border-b border-line pb-2">
              <h2 className="text-sm font-semibold uppercase tracking-header-cap text-ink flex items-center gap-2">
                <Users className="w-4 h-4 text-ink-2" />
                <span>Next of Kin & Notes</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="next-of-kin-name"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Next of Kin Name
                </label>
                <input
                  id="next-of-kin-name"
                  type="text"
                  placeholder="e.g. Mary Ngwa (Sister)"
                  value={nextOfKinName}
                  onChange={(e) => setNextOfKinName(e.target.value)}
                  className="w-full h-10 px-3.5 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="next-of-kin-phone"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                >
                  Next of Kin Phone
                </label>
                <input
                  id="next-of-kin-phone"
                  type="tel"
                  placeholder="e.g. +237 670 11 22 33"
                  value={nextOfKinPhone}
                  onChange={(e) => setNextOfKinPhone(e.target.value)}
                  className="w-full h-10 px-3.5 bg-surface border border-input-border rounded-input text-sm font-mono text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="tenant-notes"
                className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
              >
                Contract / General Notes (optional)
              </label>
              <textarea
                id="tenant-notes"
                rows={3}
                placeholder="Special clauses, references, employer information..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </section>
        </div>

        {/* Submit Actions */}
        <div className="px-6 md:px-8 py-4 bg-band/30 border-t border-line flex items-center justify-end gap-3">
          <Link
            to="/tenants"
            className="px-4 py-2 text-xs font-medium border border-line text-ink hover:bg-band rounded-btn transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary-hover active:bg-[#174BB0] text-white rounded-btn transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isCreateMode ? "Create tenant" : "Save changes"}</span>
          </button>
        </div>
      </form>

      {/* SECTION 5: TENANT'S LEASES (Detail page only) */}
      {!isCreateMode && (
        <section className="space-y-3 pt-4">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Leases</h2>
              <p className="text-xs text-ink-2">
                Lease contracts associated with this tenant
              </p>
            </div>
            <Link
              to={`/leases/new?tenant_id=${tenantId}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New lease</span>
            </Link>
          </div>

          <div className="bg-surface border border-line rounded-panel overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-ink bg-band/30">
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                      Unit & House
                    </th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                      Duration
                    </th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                      Monthly (FCFA)
                    </th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                      Paid Through
                    </th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                      Payment Status
                    </th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLeasesLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-ink-2">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span>Loading leases...</span>
                        </div>
                      </td>
                    </tr>
                  ) : leases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-ink-2 bg-band/10">
                        No leases recorded for this tenant yet.
                      </td>
                    </tr>
                  ) : (
                    leases.map((lease) => (
                      <tr
                        key={lease.id}
                        className="border-b border-row-line hover:bg-band/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-[14.5px] font-medium text-ink">
                          <Link
                            to={`/leases/${lease.id}`}
                            className="hover:text-primary hover:underline inline-flex items-center gap-1.5"
                          >
                            <Home className="w-4 h-4 text-ink-2" />
                            <span>
                              {lease.house_name}, {lease.unit_label}
                            </span>
                          </Link>
                        </td>

                        <td className="px-5 py-3.5 text-[13.5px] font-mono text-ink tabular-nums whitespace-nowrap">
                          {formatDate(lease.start_date)} &ndash;{" "}
                          {lease.end_date ? formatDate(lease.end_date) : "Ongoing"}
                        </td>

                        <td className="px-5 py-3.5 text-[14.5px] font-mono font-medium text-ink text-right tabular-nums whitespace-nowrap">
                          {formatMoney(lease.monthly_total)}
                        </td>

                        <td className="px-5 py-3.5 text-[14.5px] font-mono text-ink tabular-nums whitespace-nowrap">
                          {formatDate(lease.paid_through)}
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <StatusMarker
                            status={lease.payment_status}
                            daysOverdue={lease.days_overdue}
                            daysUntilExpiry={lease.days_until_expiry}
                            graceDays={lease.grace_days}
                          />
                        </td>

                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <Link
                            to={`/leases/${lease.id}`}
                            className="inline-flex items-center justify-center h-7 px-3 text-xs font-medium border border-line text-primary hover:bg-primary/5 rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            View lease
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
