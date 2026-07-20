"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import {
  Building2,
  CircleCheck,
  CircleX,
  QrCode,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { apiDeleteWithMeta, apiGet, apiPost, apiPut } from "@/lib/api";

type DeptRow = {
  id: number;
  name: string;
  is_active: boolean;
  department_group_id: number;
  department_group_name: string;
  department_group_display_order: number;
  created_at?: string;
  updated_at?: string;
};

type DepartmentGroup = {
  id: number;
  name: string;
  display_order: number;
  is_active: boolean;
};

type DeptListRes = {
  total: number;
  items: DeptRow[];
  groups: DepartmentGroup[];
};

type DepartmentDeleteResponse = {
  message: string;
  requires_confirmation?: boolean;
  user_count?: number;
  active_department_user_count?: number;
  response_count?: number;
  answer_count?: number;
  question_count?: number;
  qrcode_count?: number;
  affects_evaluation?: boolean;
  detached_users?: number;
  deactivated_users?: number;
  deleted_answers?: number;
  deleted_responses?: number;
  deleted_questions?: number;
  deleted_qrcodes?: number;
  recalculated?: boolean;
};

type ModalMode = "create" | "edit";
type StatusFilter = "all" | "active" | "inactive";
type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function normalizeDepartmentName(value: string) {
  return value.trim().toLowerCase();
}

function isDepartmentDeleteResponse(value: unknown): value is DepartmentDeleteResponse {
  return typeof value === "object" && value !== null && "message" in value;
}

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildDepartmentDependencyHtml(name: string, data: DepartmentDeleteResponse) {
  const dependencyItems: string[] = [];

  if ((data.user_count ?? 0) > 0) {
    dependencyItems.push(
      `ผู้ใช้งานที่ผูกกับหน่วยงาน ${formatCount(data.user_count)} บัญชี`,
    );
  }
  if ((data.response_count ?? 0) > 0) {
    dependencyItems.push(
      `แบบประเมินที่ส่งแล้ว ${formatCount(data.response_count)} รายการ`,
    );
  }
  if ((data.answer_count ?? 0) > 0) {
    dependencyItems.push(
      `คำตอบและความคิดเห็นที่เกี่ยวข้อง ${formatCount(data.answer_count)} รายการ`,
    );
  }
  if ((data.question_count ?? 0) > 0) {
    dependencyItems.push(
      `คำถามเฉพาะหน่วยงาน ${formatCount(data.question_count)} ข้อ`,
    );
  }
  if ((data.qrcode_count ?? 0) > 0) {
    dependencyItems.push(
      `QR Code ของหน่วยงาน ${formatCount(data.qrcode_count)} รายการ`,
    );
  }

  const effectItems: string[] = [];
  if ((data.user_count ?? 0) > 0) {
    effectItems.push("บัญชีผู้ใช้ที่ผูกกับหน่วยงานจะถูกยกเลิกการผูกหน่วยงาน");
  }
  if ((data.active_department_user_count ?? 0) > 0) {
    effectItems.push(
      `บัญชีหัวหน้าหน่วยงานหรือบุคลากร ${formatCount(data.active_department_user_count)} บัญชี จะถูกปิดใช้งานอัตโนมัติ`,
    );
  }
  if (data.affects_evaluation) {
    effectItems.push(
      "ผลการประเมิน ความคิดเห็น และคะแนนของหน่วยงานนี้จะถูกลบออก แล้วระบบจะคำนวณใหม่จากข้อมูลที่เหลือ",
    );
  }

  const dependencyList = dependencyItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const effectList = effectItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `
    <div class="space-y-3 text-left">
      <p>หน่วยงาน <strong>${escapeHtml(name)}</strong> ยังมีข้อมูลอ้างอิงดังนี้</p>
      <ul class="list-disc pl-5 space-y-1">
        ${dependencyList}
      </ul>
      ${
        effectItems.length > 0
          ? `
            <div class="pt-1">
              <p class="font-medium text-slate-700">เมื่อลบแล้วระบบจะดำเนินการดังนี้</p>
              <ul class="mt-2 list-disc pl-5 space-y-1">
                ${effectList}
              </ul>
            </div>
          `
          : ""
      }
      <p class="pt-1">ต้องการลบหน่วยงานนี้ต่อหรือไม่?</p>
    </div>
  `;
}

async function showSuccessAlert(title: string, text: string) {
  await Swal.fire({
    icon: "success",
    title,
    text,
    confirmButtonText: "ตกลง",
    confirmButtonColor: "#2563eb",
    showConfirmButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    timer: 2000,
    timerProgressBar: false,
    customClass: {
      popup:
        "rounded-3xl border border-emerald-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
  });
}

async function showErrorAlert(title: string, text: string) {
  await Swal.fire({
    icon: "error",
    title,
    text,
    confirmButtonText: "ตกลง",
    confirmButtonColor: "#dc2626",
    customClass: {
      popup:
        "rounded-3xl border border-rose-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
  });
}

function getStatusFilterStyle(status: StatusFilter): React.CSSProperties {
  if (status === "active") {
    return {
      backgroundColor: "#eff6ff",
      borderColor: "#93c5fd",
      color: "#1d4ed8",
      boxShadow: "0 8px 20px rgba(37, 99, 235, 0.08)",
    };
  }

  if (status === "inactive") {
    return {
      backgroundColor: "#f8fafc",
      borderColor: "#cbd5e1",
      color: "#334155",
      boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
    };
  }

  return {
    backgroundColor: "#f8fbff",
    borderColor: "#bfdbfe",
    color: "#1e3a8a",
    boxShadow: "0 8px 20px rgba(37, 99, 235, 0.06)",
  };
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  title,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <label
      className={`relative inline-flex items-center ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
      title={title}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <div className="relative h-5 w-10 rounded-full bg-slate-300 transition peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-100 peer-checked:bg-emerald-500 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white" />
    </label>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      เปิดใช้งาน
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      ปิดใช้งาน
    </span>
  );
}

function KpiCard({
  icon: Icon,
  title,
  value,
  sub,
  cardClass = "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
  iconClass = "from-sky-500 to-blue-600",
}: {
  icon: KpiIcon;
  title: string;
  value: number;
  sub?: string;
  cardClass?: string;
  iconClass?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-5 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 ${cardClass}`}
    >
      <div className="relative flex items-start gap-4">
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconClass} text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/35`}
          aria-hidden="true"
        >
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="text-2xl font-black leading-tight tracking-tight text-slate-900">
            {value.toLocaleString("th-TH")}
          </div>
          {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

const DEPT_OVERVIEW_THEMES = {
  total: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-sky-500 to-cyan-500",
  },
  active: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-emerald-500 to-teal-500",
  },
  inactive: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-slate-500 to-slate-600",
  },
} as const;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "ใช้งานอยู่" },
  { value: "inactive", label: "ปิดใช้งาน" },
];

export default function AdminDepartmentsPage() {
  const [items, setItems] = useState<DeptRow[]>([]);
  const [departmentGroups, setDepartmentGroups] = useState<DepartmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>("create");
  const [editing, setEditing] = useState<DeptRow | null>(null);
  const [name, setName] = useState("");
  const [departmentGroupId, setDepartmentGroupId] = useState<number | "">("");
  const [currentPage, setCurrentPage] = useState(1);

  const load = async () => {
    const res = await apiGet<DeptListRes>("/api/admin/departments");
    setItems(res.items ?? []);
    setDepartmentGroups(res.groups ?? []);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        await load();
      } catch (e: unknown) {
        await showErrorAlert(
          "โหลดข้อมูลไม่สำเร็จ",
          getErrorMessage(e, "โหลดข้อมูลไม่สำเร็จ")
        );
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [q, statusFilter]);

  const counts = useMemo(() => {
    const total = items.length;
    let active = 0;
    let inactive = 0;

    for (const row of items) {
      if (row.is_active) active += 1;
      else inactive += 1;
    }

    return { total, active, inactive };
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = [...items];

    if (statusFilter === "active") list = list.filter((d) => d.is_active);
    if (statusFilter === "inactive") list = list.filter((d) => !d.is_active);

    const keyword = q.trim().toLowerCase();
    if (keyword) {
      list = list.filter((d) => {
        const idText = String(d.id);
        const nameText = (d.name ?? "").toLowerCase();
        const groupNameText = (d.department_group_name ?? "").toLowerCase();
        return (
          idText.includes(keyword) ||
          nameText.includes(keyword) ||
          groupNameText.includes(keyword)
        );
      });
    }

    list.sort((a, b) => {
      const displayOrderDiff =
        Number(a.department_group_display_order ?? 0) -
        Number(b.department_group_display_order ?? 0);
      if (displayOrderDiff !== 0) {
        return displayOrderDiff;
      }

      const groupIdDiff =
        Number(a.department_group_id ?? 0) - Number(b.department_group_id ?? 0);
      if (groupIdDiff !== 0) {
        return groupIdDiff;
      }

      const aCreatedAt = a.created_at ? Date.parse(a.created_at) : 0;
      const bCreatedAt = b.created_at ? Date.parse(b.created_at) : 0;
      const createdAtDiff =
        (Number.isFinite(aCreatedAt) ? aCreatedAt : 0) -
        (Number.isFinite(bCreatedAt) ? bCreatedAt : 0);

      return createdAtDiff !== 0
        ? createdAtDiff
        : Number(a.id) - Number(b.id);
    });

    return list;
  }, [items, q, statusFilter]);

  const groupedItems = useMemo(() => {
    const groups: DeptRow[][] = [];

    for (const department of filteredItems) {
      const currentGroup = groups[groups.length - 1];
      const currentGroupId = currentGroup?.[0]?.department_group_id;

      if (
        currentGroup === undefined ||
        Number(currentGroupId) !== Number(department.department_group_id)
      ) {
        groups.push([department]);
      } else {
        currentGroup.push(department);
      }
    }

    return groups;
  }, [filteredItems]);

  const totalPages = Math.max(1, groupedItems.length);
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const paginatedItems = useMemo(() => {
    return groupedItems[safeCurrentPage - 1] ?? [];
  }, [groupedItems, safeCurrentPage]);

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    setName("");
    setDepartmentGroupId("");
    setOpen(true);
  };

  const openEdit = (row: DeptRow) => {
    setMode("edit");
    setEditing(row);
    setName(row.name);
    setDepartmentGroupId(Number(row.department_group_id));
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setMode("create");
    setName("");
    setDepartmentGroupId("");
  };

  const save = async () => {
    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        await showErrorAlert("บันทึกไม่สำเร็จ", "กรุณากรอกชื่อหน่วยงาน");
        return;
      }

      if (!Number.isInteger(departmentGroupId) || Number(departmentGroupId) <= 0) {
        await showErrorAlert("บันทึกไม่สำเร็จ", "กรุณาเลือกกลุ่มหน่วยงาน");
        return;
      }

      const normalizedName = normalizeDepartmentName(trimmedName);
      const duplicateDepartment = items.find(
        (item) =>
          normalizeDepartmentName(item.name) === normalizedName &&
          (mode === "create" || item.id !== editing?.id),
      );

      if (duplicateDepartment) {
        await showErrorAlert(
          "บันทึกไม่สำเร็จ",
          "มีชื่อหน่วยงานนี้อยู่ในระบบแล้ว",
        );
        return;
      }

      setBusy(true);

      if (mode === "create") {
        await apiPost("/api/admin/departments", {
          name: trimmedName,
          department_group_id: Number(departmentGroupId),
        });
      } else {
        if (!editing) {
          await showErrorAlert("บันทึกไม่สำเร็จ", "ไม่พบรายการที่ต้องแก้ไข");
          return;
        }
        await apiPut(`/api/admin/departments/${editing.id}`, {
          name: trimmedName,
          department_group_id: Number(departmentGroupId),
        });
      }

      await load();
      closeModal();
      await showSuccessAlert(
        mode === "create"
          ? "เพิ่มข้อมูลหน่วยงานสำเร็จ"
          : "แก้ไขข้อมูลหน่วยงานสำเร็จ",
        mode === "create"
          ? `สร้างหน่วยงาน "${trimmedName}" และ QR Code เรียบร้อยแล้ว`
          : `อัปเดตหน่วยงาน "${trimmedName}" เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      await showErrorAlert("บันทึกไม่สำเร็จ", getErrorMessage(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: DeptRow) => {
    try {
      const result = await Swal.fire({
        icon: "question",
        title: row.is_active ? "ปิดใช้งานหน่วยงาน" : "เปิดใช้งานหน่วยงาน",
        text: row.is_active
          ? `ต้องการปิดใช้งาน "${row.name}" ใช่ไหม?`
          : `ต้องการเปิดใช้งาน "${row.name}" ใช่ไหม?`,
        showCancelButton: true,
        confirmButtonText: row.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน",
        cancelButtonText: "ยกเลิก",
        focusCancel: true,
        confirmButtonColor: row.is_active ? "#dc2626" : "#2563eb",
        cancelButtonColor: "#0369a1",
        customClass: {
          popup:
            "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
          title: "text-xl font-semibold text-slate-900",
          htmlContainer: "text-sm leading-6 text-slate-500",
        },
      });
      if (!result.isConfirmed) return;

      setBusy(true);
      await apiPut(`/api/admin/departments/${row.id}/toggle-active`);
      await load();
      await showSuccessAlert(
        row.is_active ? "ปิดใช้งานหน่วยงานสำเร็จ" : "เปิดใช้งานหน่วยงานสำเร็จ",
        `${row.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}หน่วยงาน "${row.name}" เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      await showErrorAlert(
        "อัปเดตสถานะไม่สำเร็จ",
        getErrorMessage(e, "อัปเดตสถานะไม่สำเร็จ")
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteDept = async (row: DeptRow) => {
    try {
      const result = await Swal.fire({
        icon: "warning",
        title: "ลบหน่วยงาน",
        text: `ต้องการลบหน่วยงาน "${row.name}" ใช่ไหม?\nการกระทำนี้อาจมีผลกับข้อมูลที่เกี่ยวข้อง`,
        showCancelButton: true,
        confirmButtonText: "ลบข้อมูล",
        cancelButtonText: "ยกเลิก",
        focusCancel: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#2563eb",
        customClass: {
          popup:
            "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
          title: "text-xl font-semibold text-slate-900",
          htmlContainer: "text-sm leading-6 text-slate-500",
        },
      });

      if (!result.isConfirmed) return;

      setBusy(true);
      let response = await apiDeleteWithMeta<DepartmentDeleteResponse>(
        `/api/admin/departments/${row.id}`,
      );

      if (!response.ok) {
        if (
          response.status === 409 &&
          isDepartmentDeleteResponse(response.data) &&
          response.data.requires_confirmation
        ) {
          setBusy(false);

          const confirmForce = await Swal.fire({
            icon: "warning",
            title: "พบข้อมูลอ้างอิงของหน่วยงาน",
            html: buildDepartmentDependencyHtml(row.name, response.data),
            showCancelButton: true,
            confirmButtonText: "ยืนยันการลบข้อมูล",
            cancelButtonText: "ยกเลิก",
            focusCancel: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#2563eb",
            customClass: {
              popup:
                "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
              title: "text-xl font-semibold text-slate-900",
              htmlContainer: "text-sm leading-6 text-slate-500",
            },
          });

          if (!confirmForce.isConfirmed) return;

          setBusy(true);
          response = await apiDeleteWithMeta<DepartmentDeleteResponse>(
            `/api/admin/departments/${row.id}?force=true`,
          );
        }

        if (!response.ok) {
          throw new Error(response.error ?? "ลบหน่วยงานไม่สำเร็จ");
        }
      }

      const responseData = isDepartmentDeleteResponse(response.data)
        ? response.data
        : null;

      await load();
      await showSuccessAlert(
        responseData?.recalculated
          ? "ลบหน่วยงานและคำนวณผลใหม่สำเร็จ"
          : "ลบข้อมูลหน่วยงานสำเร็จ",
        responseData?.recalculated
          ? `ลบหน่วยงาน "${row.name}" พร้อมล้างผลการประเมินที่เกี่ยวข้อง และคำนวณผลใหม่จากข้อมูลที่เหลือเรียบร้อยแล้ว`
          : `ลบหน่วยงาน "${row.name}" และข้อมูลที่เกี่ยวข้องเรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      await showErrorAlert(
        "ลบหน่วยงานไม่สำเร็จ",
        getErrorMessage(e, "ลบหน่วยงานไม่สำเร็จ")
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl space-y-4 animate-pulse">
          <div className="h-44 rounded-[28px] border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
              />
            ))}
          </div>
          <div className="h-28 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
          <div className="h-80 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <Building2 className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sky-100/90">Administration</p>
                <h1 className="mt-1 text-2xl font-bold text-white">จัดการหน่วยงาน</h1>
                <div className="mt-4 h-1.5 w-20 rounded-full bg-white/25" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            icon={Building2}
            title="หน่วยงานทั้งหมด"
            value={counts.total}
            cardClass={DEPT_OVERVIEW_THEMES.total.cardClass}
            iconClass={DEPT_OVERVIEW_THEMES.total.iconClass}
          />
          <KpiCard
            icon={CircleCheck}
            title="เปิดใช้งาน"
            value={counts.active}
            cardClass={DEPT_OVERVIEW_THEMES.active.cardClass}
            iconClass={DEPT_OVERVIEW_THEMES.active.iconClass}
          />
          <KpiCard
            icon={CircleX}
            title="ปิดใช้งาน"
            value={counts.inactive}
            cardClass={DEPT_OVERVIEW_THEMES.inactive.cardClass}
            iconClass={DEPT_OVERVIEW_THEMES.inactive.iconClass}
          />
        </div>

        <div className="rounded-3xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ค้นหา (ชื่อหน่วยงาน)
              </label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="w-full sm:w-52">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                สถานะ
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                style={getStatusFilterStyle(statusFilter)}
                className={selectClass}
              >
                {STATUS_FILTERS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end pr-4 sm:pr-4">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-sky-500 hover:to-blue-500 disabled:opacity-60"
            disabled={busy}
          >
            + เพิ่มหน่วยงาน
          </button>
        </div>
        <div className="space-y-2">
          {paginatedItems.length > 0 ? (
            <div className="flex items-center gap-3 px-5 py-1 text-sm text-slate-800">
              <span className="font-semibold">
                {paginatedItems[0]?.department_group_name}
              </span>
              <span className="ml-auto rounded-full border border-sky-200 px-2.5 py-1 text-xs font-medium text-sky-700">
                {formatCount(paginatedItems.length)} หน่วยงาน
              </span>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-3xl border border-sky-100 bg-white/95 shadow-[0_20px_55px_rgba(37,99,235,0.10)]">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-[13px]">
              <thead className="bg-gradient-to-r from-sky-600 via-blue-600 to-blue-700 text-white">
                <tr className="border-b border-blue-700/30">
                  <th className="w-[80px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                    ลำดับ
                  </th>
                  <th className="border-r border-white/20 px-4 py-3.5 text-center text-sm font-bold">
                    ชื่อหน่วยงาน
                  </th>
                  <th className="w-[130px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                    สถานะ
                  </th>
                  <th className="w-[240px] px-3 py-3.5 text-center text-sm font-bold">
                    การทำงาน
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-slate-500"
                      colSpan={4}
                    >
                      {items.length === 0
                        ? "ไม่พบข้อมูลหน่วยงาน"
                        : "ไม่พบข้อมูลหน่วยงานที่ตรงกับเงื่อนไข"}
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((d, idx) => (
                        <tr
                          key={d.id}
                          className="border-b border-sky-100 transition last:border-b-0 hover:bg-sky-50/50"
                        >
                          <td className="border-r border-sky-100 px-3 py-3.5 text-center text-slate-500">
                            {idx + 1}
                          </td>

                          <td className="border-r border-sky-100 px-4 py-3.5 font-normal text-slate-900">
                            {d.name}
                          </td>

                          <td className="border-r border-sky-100 px-3 py-3.5 text-center">
                            <StatusBadge active={d.is_active} />
                          </td>

                          <td className="px-3 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <ToggleSwitch
                                checked={d.is_active}
                                onChange={() => toggleActive(d)}
                                disabled={busy}
                                title={
                                  d.is_active
                                    ? "คลิกเพื่อปิดใช้งาน"
                                    : "คลิกเพื่อเปิดใช้งาน"
                                }
                              />

                              <div className="mx-1 h-5 w-px bg-slate-200" />

                              <button
                                onClick={() => openEdit(d)}
                                className="rounded-lg border border-amber-400 bg-gradient-to-b from-amber-400 to-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-amber-500 hover:to-amber-600 disabled:opacity-50"
                                disabled={busy}
                              >
                                แก้ไข
                              </button>

                              <button
                                onClick={() => deleteDept(d)}
                                className="rounded-lg border border-red-500 bg-gradient-to-b from-red-500 to-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-red-600 hover:to-red-700 disabled:opacity-50"
                                disabled={busy}
                              >
                                ลบ
                              </button>
                            </div>
                          </td>
                        </tr>
                  ))
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
                กลุ่ม {groupedItems.length === 0 ? 0 : safeCurrentPage} / {groupedItems.length}
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
          </div>
        </div>

        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-sky-50 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
              <div className="relative rounded-t-3xl border-b border-white/15 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-6 py-4 text-white">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={busy}
                  className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-60"
                  aria-label="ปิด"
                  title="ปิด"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>

                <h3 className="text-lg font-bold">
                  {mode === "create" ? "เพิ่มหน่วยงาน" : "แก้ไขหน่วยงาน"}
                </h3>
                <p className="mt-1 text-sm text-sky-100/90">
                  กรอกชื่อหน่วยงาน แล้วระบบจะสร้าง QR Code ให้โดยอัตโนมัติ
                </p>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      กลุ่มหน่วยงาน
                    </label>
                    <select
                      value={departmentGroupId}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setDepartmentGroupId(Number.isInteger(value) && value > 0 ? value : "");
                      }}
                      className={selectClass}
                      disabled={busy || departmentGroups.length === 0}
                    >
                      <option value="">เลือกกลุ่มหน่วยงาน</option>
                      {departmentGroups.map((group) => {
                        const isCurrentGroup =
                          Number(editing?.department_group_id) === Number(group.id);

                        return (
                          <option
                            key={group.id}
                            value={group.id}
                            disabled={!group.is_active && !isCurrentGroup}
                          >
                            {group.name}
                            {!group.is_active ? " (ปิดใช้งาน)" : ""}
                          </option>
                        );
                      })}
                    </select>
                    {departmentGroups.length === 0 && (
                      <p className="mt-1.5 text-xs text-red-600">
                        ไม่พบกลุ่มหน่วยงาน กรุณาเพิ่มหรือเปิดใช้งานกลุ่มหน่วยงานก่อน
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      ชื่อหน่วยงาน
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                      autoFocus
                    />
                  </div>

                  {mode === "create" && (
                    <div className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                        <QrCode className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-sky-800">
                          สร้าง QR Code อัตโนมัติ
                        </div>
                        <div className="mt-1 text-xs leading-5 text-sky-700/90">
                          ระบบจะสร้างลิงก์และ QR Code สำหรับหน่วยงานนี้ทันทีหลังบันทึก
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={save}
                    disabled={busy}
                    className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {busy ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                  <button
                    onClick={closeModal}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 bg-red-500 px-4 py-2 text-white transition hover:bg-red-600 disabled:opacity-60"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
