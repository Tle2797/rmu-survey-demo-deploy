"use client";

import React, { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import {
  CheckCircle2,
  Clock3,
  Search,
  UserCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import Swal from "sweetalert2";
import OverviewCard from "@/app/components/overview-card";
import { apiGet, apiPut } from "@/lib/api";
import { getThaiAlertMessage } from "@/lib/alert-message";

type RoleCode = "admin" | "exec" | "dept_head" | "staff";
type ApprovalStatus = "pending" | "approved" | "rejected";
type StatusFilter = "all" | ApprovalStatus;

type ApprovalRow = {
  id: number;
  username: string;
  email: string | null;
  role: RoleCode;
  department_id: number;
  department_name?: string;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  approval_status: ApprovalStatus;
  approval_reviewed_at?: string | null;
  rejected_reason?: string | null;
  approval_reviewed_by_username?: string | null;
  reviewer_title?: string | null;
  reviewer_first_name?: string | null;
  reviewer_last_name?: string | null;
  created_at?: string;
};

type ApprovalsResponse = {
  total: number;
  counts: Record<ApprovalStatus, number>;
  items: ApprovalRow[];
};

type ApprovalActionResponse = {
  item: ApprovalRow;
  email_sent?: boolean;
  email_error?: string | null;
};

type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

const PAGE_SIZE = 10;
const USER_APPROVALS_UPDATED_EVENT = "user-approvals:updated";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100";

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100";

const roleLabels: Record<RoleCode, string> = {
  admin: "แอดมิน",
  exec: "ผู้บริหารมหาวิทยาลัย",
  dept_head: "หัวหน้าหน่วยงาน",
  staff: "เจ้าหน้าที่หน่วยงาน",
};

const statusLabels: Record<ApprovalStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
};

function KpiCard({
  icon,
  title,
  value,
  iconClass,
}: {
  icon: KpiIcon;
  title: string;
  value: number;
  iconClass: string;
}) {
  return (
    <OverviewCard icon={icon} title={title} value={value} iconClass={iconClass} />
  );
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const classes: Record<ApprovalStatus, string> = {
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rejected: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function RoleBadge({
  role,
  roleName,
}: {
  role: RoleCode;
  roleName: string;
}) {
  const roleClass: Record<RoleCode, string> = {
    admin: "border-violet-200 bg-violet-50 text-violet-700",
    exec: "border-amber-200 bg-amber-50 text-amber-700",
    dept_head: "border-sky-200 bg-sky-50 text-sky-700",
    staff: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${roleClass[role]}`}>
      <span className="whitespace-normal leading-4">{roleName}</span>
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function fullName(row: ApprovalRow) {
  const firstPart = `${row.title ?? ""}${row.first_name ?? ""}`.trim();
  const lastPart = (row.last_name ?? "").trim();

  if (firstPart && lastPart) return `${firstPart} ${lastPart}`;
  return firstPart || lastPart || "-";
}

export default function UserApprovalsPage() {
  const [items, setItems] = useState<ApprovalRow[]>([]);
  const [counts, setCounts] = useState<Record<ApprovalStatus, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = async () => {
    const res = await apiGet<ApprovalsResponse>("/api/admin/user-approvals?status=all");
    setItems(res.items ?? []);
    setCounts(
      res.counts ?? {
        pending: 0,
        approved: 0,
        rejected: 0,
      },
    );
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        await loadData();
      } catch (error: unknown) {
        setError(getThaiAlertMessage(error, "โหลดข้อมูลผู้ลงทะเบียนไม่สำเร็จ"));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [q, statusFilter]);

  const filteredItems = useMemo(() => {
    let list = [...items];
    if (statusFilter !== "all") {
      list = list.filter((item) => item.approval_status === statusFilter);
    }

    const keyword = q.trim().toLowerCase();
    if (keyword) {
      list = list.filter((item) => {
        const values = [
          fullName(item),
          item.username,
          item.email ?? "",
          item.department_name ?? "",
          roleLabels[item.role] ?? item.role,
        ];
        return values.some((value) => value.toLowerCase().includes(keyword));
      });
    }

    return list;
  }, [items, q, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredItems, safeCurrentPage]);
  const startItem =
    filteredItems.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;

  const totalSelfRegistered =
    counts.pending + counts.approved + counts.rejected;

  async function approveUser(row: ApprovalRow) {
    const result = await Swal.fire({
      icon: "question",
      title: "อนุมัติผู้ใช้งาน",
      text: `ต้องการอนุมัติ ${fullName(row)} ใช่ไหม?`,
      showCancelButton: true,
      confirmButtonText: "อนุมัติ",
      cancelButtonText: "ยกเลิก",
      focusCancel: true,
      confirmButtonColor: "#059669",
      cancelButtonColor: "#64748b",
    });

    if (!result.isConfirmed) return;

    try {
      setBusyId(row.id);
      const res = await apiPut<ApprovalActionResponse>(
        `/api/admin/user-approvals/${row.id}/approve`,
      );
      await loadData();
      window.dispatchEvent(new Event(USER_APPROVALS_UPDATED_EVENT));
      await Swal.fire({
        icon: res.email_sent === false ? "warning" : "success",
        title: "อนุมัติเรียบร้อย",
        text:
          res.email_sent === false
            ? "ผู้ใช้สามารถเข้าสู่ระบบได้แล้ว แต่ระบบส่งอีเมลแจ้งผู้ใช้ไม่สำเร็จ"
            : "ผู้ใช้สามารถเข้าสู่ระบบได้แล้ว และระบบส่งอีเมลแจ้งผู้ใช้เรียบร้อยแล้ว",
        timer: res.email_sent === false ? undefined : 1600,
        showConfirmButton: res.email_sent === false,
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
    } catch (error: unknown) {
      await Swal.fire({
        icon: "error",
        title: "อนุมัติไม่สำเร็จ",
        text: getThaiAlertMessage(error, "กรุณาลองใหม่อีกครั้ง"),
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function rejectUser(row: ApprovalRow) {
    const result = await Swal.fire({
      icon: "warning",
      title: "ไม่อนุมัติผู้ใช้งาน",
      input: "textarea",
      inputLabel: "เหตุผล",
      inputPlaceholder: "ระบุเหตุผลถ้าต้องการ",
      showCancelButton: true,
      confirmButtonText: "ไม่อนุมัติ",
      cancelButtonText: "ยกเลิก",
      focusCancel: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });

    if (!result.isConfirmed) return;

    const reason = typeof result.value === "string" ? result.value.trim() : "";

    try {
      setBusyId(row.id);
      const res = await apiPut<ApprovalActionResponse>(
        `/api/admin/user-approvals/${row.id}/reject`,
        reason ? { reason } : {},
      );
      await loadData();
      window.dispatchEvent(new Event(USER_APPROVALS_UPDATED_EVENT));
      await Swal.fire({
        icon: res.email_sent === false ? "warning" : "success",
        title: "บันทึกผลเรียบร้อย",
        text:
          res.email_sent === false
            ? "บันทึกผลไม่อนุมัติแล้ว แต่ระบบส่งอีเมลแจ้งผู้ใช้ไม่สำเร็จ"
            : "ผู้ใช้ไม่ได้รับการอนุมัติ และระบบส่งอีเมลแจ้งเหตุผลเรียบร้อยแล้ว",
        timer: res.email_sent === false ? undefined : 1600,
        showConfirmButton: res.email_sent === false,
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
    } catch (error: unknown) {
      await Swal.fire({
        icon: "error",
        title: "บันทึกผลไม่สำเร็จ",
        text: getThaiAlertMessage(error, "กรุณาลองใหม่อีกครั้ง"),
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 font-sans">
        <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 text-slate-600 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
            กำลังโหลดข้อมูลผู้ลงทะเบียน...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 font-sans">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <UserCheck className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sky-100/90">
                  Administration
                </p>
                <h1 className="mt-1 text-2xl font-bold text-white">
                  อนุมัติผู้ใช้งาน
                </h1>
                <div className="mt-4 h-1.5 w-20 rounded-full bg-white/25" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700 shadow-sm">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="px-2 font-bold text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <KpiCard
            icon={UsersRound}
            title="ลงทะเบียนทั้งหมด"
            value={totalSelfRegistered}
            iconClass="from-sky-500 to-blue-600"
          />
          <KpiCard
            icon={Clock3}
            title="รออนุมัติ"
            value={counts.pending}
            iconClass="from-amber-500 to-orange-500"
          />
          <KpiCard
            icon={UserCheck}
            title="อนุมัติแล้ว"
            value={counts.approved}
            iconClass="from-emerald-500 to-teal-500"
          />
          <KpiCard
            icon={XCircle}
            title="ไม่อนุมัติ"
            value={counts.rejected}
            iconClass="from-red-500 to-rose-500"
          />
        </div>

        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ค้นหา (ชื่อผู้ใช้ / อีเมล / ตำแหน่ง / หน่วยงาน)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder=""
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>

            <div className="w-full sm:w-56">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                สถานะ
              </label>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className={selectClass}
              >
                <option value="all">ทั้งหมด</option>
                <option value="pending">รออนุมัติ</option>
                <option value="approved">อนุมัติแล้ว</option>
                <option value="rejected">ไม่อนุมัติ</option>
              </select>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-sky-100 bg-white/95 shadow-[0_20px_55px_rgba(37,99,235,0.10)]">
          <div className="overflow-hidden">
            <table className="w-full table-fixed border-collapse text-[13px]">
              <thead className="bg-gradient-to-r from-sky-600 via-blue-600 to-blue-700 text-white">
                <tr className="border-b border-blue-700/30">
                  <th className="w-[5%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">ลำดับ</th>
                  <th className="w-[12%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">ตำแหน่ง</th>
                  <th className="w-[16%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">หน่วยงาน</th>
                  <th className="w-[15%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">ชื่อ นามสกุล</th>
                  <th className="w-[10%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">ชื่อผู้ใช้</th>
                  <th className="w-[17%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">อีเมล</th>
                  <th className="w-[10%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">วันที่ลงทะเบียน</th>
                  <th className="w-[15%] px-3 py-3.5 text-center text-sm font-bold">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      ไม่พบข้อมูลผู้ลงทะเบียน
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((row, index) => {
                    const busy = busyId === row.id;
                    return (
                      <tr key={row.id} className="border-b border-sky-100 align-top transition last:border-b-0 hover:bg-sky-50/50">
                        <td className="border-r border-sky-100 px-3 py-3.5 text-center text-slate-500">
                          {startItem + index}
                        </td>
                        <td className="border-r border-sky-100 px-3 py-3.5">
                          <RoleBadge
                            role={row.role}
                            roleName={roleLabels[row.role] ?? row.role}
                          />
                        </td>
                        <td className="border-r border-sky-100 px-3 py-3.5 leading-5 text-slate-700">
                          <span className="block whitespace-normal break-words leading-5" title={row.department_name || undefined}>
                            {row.department_name || "-"}
                          </span>
                        </td>
                        <td className="border-r border-sky-100 px-3 py-3.5 font-normal leading-5 text-slate-900">
                          <span className="block truncate" title={fullName(row)}>
                            {fullName(row)}
                          </span>
                        </td>
                        <td className="border-r border-sky-100 px-3 py-3.5 text-slate-600">
                          <span className="block truncate" title={row.username}>
                            {row.username}
                          </span>
                        </td>
                        <td className="border-r border-sky-100 px-3 py-3.5 text-slate-600">
                          <span className="block truncate" title={row.email || "-"}>
                            {row.email || "-"}
                          </span>
                        </td>
                        <td className="border-r border-sky-100 px-3 py-3.5 text-slate-600">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex flex-col items-center justify-center gap-1.5 text-center">
                            <StatusBadge status={row.approval_status} />
                            {row.approval_status === "rejected" && row.rejected_reason && (
                              <div className="line-clamp-2 text-[11px] leading-4 text-red-500">
                                {row.rejected_reason}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {row.approval_status !== "approved" && (
                              <button
                                type="button"
                                onClick={() => approveUser(row)}
                                disabled={busyId !== null}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500 bg-gradient-to-b from-emerald-500 to-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-emerald-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {busy ? "กำลังบันทึก" : "อนุมัติ"}
                              </button>
                            )}
                            {row.approval_status === "pending" && (
                              <button
                                type="button"
                                onClick={() => rejectUser(row)}
                                disabled={busyId !== null}
                                className="rounded-lg border border-red-500 bg-gradient-to-b from-red-500 to-red-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-red-600 hover:to-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                ไม่อนุมัติ
                              </button>
                            )}
                            {row.approval_status === "approved" && (
                              <span className="text-xs text-slate-400">
                                {formatDate(row.approval_reviewed_at)}
                              </span>
                            )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end border-t border-sky-100 bg-sky-50/30 px-4 py-3">
            <div className="flex items-center gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage <= 1}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
              >
                ย้อนกลับ
              </button>
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm">
                หน้า {safeCurrentPage} / {totalPages}
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
