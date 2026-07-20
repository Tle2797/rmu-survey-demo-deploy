"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import { ClipboardList, CircleCheck, CircleX, X } from "lucide-react";
import Swal from "sweetalert2";
import { apiDeleteWithMeta, apiGet, apiPost, apiPut } from "@/lib/api";

type SurveyRow = {
  id: number;
  year_be: number;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type SurveyListRes = {
  total: number;
  items: SurveyRow[];
};

type SurveyDeleteResponse = {
  message: string;
  requires_confirmation?: boolean;
  question_count?: number;
  response_count?: number;
  answer_count?: number;
  survey_time_slot_count?: number;
  affects_evaluation?: boolean;
  deleted_answers?: number;
  deleted_responses?: number;
  deleted_questions?: number;
  deleted_survey_time_slots?: number;
  recalculated?: boolean;
};

type ModalMode = "create" | "edit";
type StatusFilter = "all" | "active" | "inactive";
type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

const PAGE_SIZE = 10;
const SURVEY_TITLE_PREFIX = "แบบประเมินการให้บริการ ปี";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "ใช้งานอยู่" },
  { value: "inactive", label: "ปิดใช้งาน" },
];

const SURVEY_OVERVIEW_THEMES = {
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

function getDefaultYearBe() {
  return new Date().getFullYear() + 543;
}

function getCurrentYearBe() {
  const currentYearCe = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
    }).format(new Date()),
  );

  return currentYearCe + 543;
}

function buildSurveyTitle(yearBe: number) {
  return `${SURVEY_TITLE_PREFIX} ${yearBe}`;
}

function getNextSurveyYearBe(items: SurveyRow[]) {
  const latestYearBe = items.reduce(
    (latest, item) => Math.max(latest, Number(item.year_be) || 0),
    0,
  );

  return latestYearBe >= 2500 ? latestYearBe + 1 : getDefaultYearBe();
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function isSurveyDeleteResponse(value: unknown): value is SurveyDeleteResponse {
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

function buildSurveyDependencyHtml(title: string, data: SurveyDeleteResponse) {
  const dependencyItems: string[] = [];

  if ((data.question_count ?? 0) > 0) {
    dependencyItems.push(`คำถามของแบบสอบถาม ${formatCount(data.question_count)} ข้อ`);
  }
  if ((data.response_count ?? 0) > 0) {
    dependencyItems.push(`แบบประเมินที่ส่งแล้ว ${formatCount(data.response_count)} รายการ`);
  }
  if ((data.answer_count ?? 0) > 0) {
    dependencyItems.push(`คำตอบและความคิดเห็น ${formatCount(data.answer_count)} รายการ`);
  }
  if ((data.survey_time_slot_count ?? 0) > 0) {
    dependencyItems.push(
      `การผูกช่วงเวลาของแบบสอบถาม ${formatCount(data.survey_time_slot_count)} รายการ`,
    );
  }

  const effectItems: string[] = [];
  if (data.affects_evaluation) {
    effectItems.push(
      "ผลการประเมิน ความคิดเห็น และคะแนนของแบบสอบถามนี้จะถูกลบออก แล้วระบบจะคำนวณใหม่จากข้อมูลที่เหลือ",
    );
  }
  if ((data.question_count ?? 0) > 0) {
    effectItems.push("คำถามทั้งหมดของแบบสอบถามนี้จะถูกลบออก");
  }
  if ((data.survey_time_slot_count ?? 0) > 0) {
    effectItems.push("การผูกช่วงเวลากับแบบสอบถามนี้จะถูกลบออก");
  }

  const dependencyList = dependencyItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const effectList = effectItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `
    <div class="space-y-3 text-left">
      <p>แบบสอบถาม <strong>${escapeHtml(title)}</strong> ยังมีข้อมูลอ้างอิงดังนี้</p>
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
      <p class="pt-1">ต้องการลบข้อมูลต่อหรือไม่?</p>
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
      ใช้งานอยู่
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

export default function AdminSurveysPage() {
  const [items, setItems] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>("create");
  const [editing, setEditing] = useState<SurveyRow | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [yearBe, setYearBe] = useState<number>(getDefaultYearBe());
  const [currentPage, setCurrentPage] = useState(1);

  const load = async () => {
    const res = await apiGet<SurveyListRes>("/api/admin/surveys");
    setItems(res.items ?? []);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        await load();
      } catch (e: unknown) {
        setError(getErrorMessage(e, "โหลดข้อมูลไม่สำเร็จ"));
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
        const titleText = (d.title ?? "").toLowerCase();
        const yearText = String(d.year_be);
        return titleText.includes(keyword) || yearText.includes(keyword);
      });
    }

    list.sort((a, b) => {
      if (a.year_be !== b.year_be) {
        return b.year_be - a.year_be;
      }

      return b.id - a.id;
    });

    return list;
  }, [items, q, statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [filteredItems.length]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredItems, safeCurrentPage]);
  const startItem =
    filteredItems.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;

  const openCreate = () => {
    const nextYearBe = getNextSurveyYearBe(items);
    setMode("create");
    setEditing(null);
    setTitle(buildSurveyTitle(nextYearBe));
    setDescription("");
    setYearBe(nextYearBe);
    setOpen(true);
  };

  const openEdit = (row: SurveyRow) => {
    setMode("edit");
    setEditing(row);
    setTitle(row.title);
    setDescription(row.description ?? "");
    setYearBe(row.year_be);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setMode("create");
    setTitle("");
    setDescription("");
    setYearBe(getNextSurveyYearBe(items));
  };

  const save = async () => {
    try {
      setError("");

      if (!yearBe || yearBe < 2500) {
        throw new Error("กรุณากรอกปีการศึกษาให้ถูกต้อง (พ.ศ.)");
      }

      const isCreate = mode === "create";
      const payloadTitle = title.trim();
      if (!payloadTitle) {
        throw new Error("กรุณากรอกชื่อแบบสอบถาม");
      }

      const payloadDescription = description.trim();
      const payload: {
        title: string;
        description?: string;
        year_be: number;
      } = {
        title: payloadTitle,
        year_be: yearBe,
      };
      if (payloadDescription) {
        payload.description = payloadDescription;
      }

      setBusy(true);

      if (isCreate) {
        await apiPost("/api/admin/surveys", payload);
      } else {
        if (!editing) throw new Error("ไม่พบรายการที่ต้องแก้ไข");
        await apiPut(`/api/admin/surveys/${editing.id}`, payload);
      }

      await load();
      closeModal();
      await showSuccessAlert(
        isCreate ? "เพิ่มแบบสอบถามสำเร็จ" : "แก้ไขแบบสอบถามสำเร็จ",
        isCreate
          ? `สร้างแบบสอบถาม "${payloadTitle}" เรียบร้อยแล้ว`
          : `อัปเดตแบบสอบถาม "${payloadTitle}" เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: SurveyRow) => {
    try {
      setError("");

      const nextActive = !row.is_active;
      const currentYearBe = getCurrentYearBe();
      if (nextActive && row.year_be < currentYearBe) {
        await Swal.fire({
          icon: "warning",
          title: "ไม่สามารถเปิดแบบสอบถามย้อนหลังได้",
          text: `ปีการศึกษา ${row.year_be} เป็นปีก่อน พ.ศ. ${currentYearBe} ระบบอนุญาตให้เปิดเฉพาะปีปัจจุบันหรือปีอนาคต`,
          confirmButtonText: "ตกลง",
          confirmButtonColor: "#2563eb",
          customClass: {
            popup:
              "rounded-3xl border border-amber-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
            title: "text-xl font-semibold text-slate-900",
            htmlContainer: "text-sm leading-6 text-slate-500",
          },
        });
        return;
      }

      const result = await Swal.fire({
        icon: "question",
        title: nextActive ? "เปิดใช้งานแบบสอบถาม" : "ปิดใช้งานแบบสอบถาม",
        text: nextActive
          ? `ต้องการเปิดใช้งานแบบสอบถาม "${row.title}" ใช่ไหม?`
          : `ต้องการปิดใช้งานแบบสอบถาม "${row.title}" ใช่ไหม?`,
        showCancelButton: true,
        confirmButtonText: nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน",
        cancelButtonText: "ยกเลิก",
        focusCancel: true,
        confirmButtonColor: nextActive ? "#2563eb" : "#dc2626",
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
      await apiPut(`/api/admin/surveys/${row.id}/toggle-active`);
      await load();
      await showSuccessAlert(
        nextActive ? "เปิดใช้งานแบบสอบถามสำเร็จ" : "ปิดใช้งานแบบสอบถามสำเร็จ",
        `${nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}แบบสอบถาม "${row.title}" เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "อัปเดตสถานะไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const deleteSurvey = async (row: SurveyRow) => {
    try {
      setError("");

      const result = await Swal.fire({
        icon: "warning",
        title: "ลบแบบสอบถาม",
        text: `ต้องการลบแบบสอบถาม "${row.title}" ใช่ไหม?\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
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
      let response = await apiDeleteWithMeta<SurveyDeleteResponse>(
        `/api/admin/surveys/${row.id}`,
      );

      if (!response.ok) {
        if (
          response.status === 409 &&
          isSurveyDeleteResponse(response.data) &&
          response.data.requires_confirmation
        ) {
          setBusy(false);

          const confirmForce = await Swal.fire({
            icon: "warning",
            title: "พบข้อมูลอ้างอิงของแบบสอบถาม",
            html: buildSurveyDependencyHtml(row.title, response.data),
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
          response = await apiDeleteWithMeta<SurveyDeleteResponse>(
            `/api/admin/surveys/${row.id}?force=true`,
          );
        }

        if (!response.ok) {
          throw new Error(response.error ?? "ลบข้อมูลไม่สำเร็จ");
        }
      }

      const responseData = isSurveyDeleteResponse(response.data) ? response.data : null;
      await load();
      await showSuccessAlert(
        responseData?.recalculated
          ? "ลบแบบสอบถามและคำนวณผลใหม่สำเร็จ"
          : "ลบแบบสอบถามสำเร็จ",
        responseData?.recalculated
          ? `ลบแบบสอบถาม "${row.title}" พร้อมล้างผลการประเมินที่เกี่ยวข้อง และคำนวณผลใหม่จากข้อมูลที่เหลือเรียบร้อยแล้ว`
          : `ลบแบบสอบถาม "${row.title}" เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "ลบข้อมูลไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl animate-pulse space-y-4">
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
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <ClipboardList className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sky-100/90">Administration</p>
                <h1 className="mt-1 text-2xl font-bold text-white">จัดการแบบสอบถาม</h1>
                <div className="mt-4 h-1.5 w-20 rounded-full bg-white/25" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            <span className="whitespace-pre-wrap">{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 text-rose-500 transition hover:bg-rose-100 hover:text-rose-700"
              aria-label="ปิดข้อความแจ้งเตือน"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            icon={ClipboardList}
            title="แบบสอบถามทั้งหมด"
            value={counts.total}
            cardClass={SURVEY_OVERVIEW_THEMES.total.cardClass}
            iconClass={SURVEY_OVERVIEW_THEMES.total.iconClass}
          />
          <KpiCard
            icon={CircleCheck}
            title="เปิดใช้งาน"
            value={counts.active}
            cardClass={SURVEY_OVERVIEW_THEMES.active.cardClass}
            iconClass={SURVEY_OVERVIEW_THEMES.active.iconClass}
          />
          <KpiCard
            icon={CircleX}
            title="ปิดใช้งาน"
            value={counts.inactive}
            cardClass={SURVEY_OVERVIEW_THEMES.inactive.cardClass}
            iconClass={SURVEY_OVERVIEW_THEMES.inactive.iconClass}
          />
        </div>

        <div className="rounded-3xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-end">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ค้นหา (ชื่อแบบสอบถาม, ปีการศึกษา)
              </label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="w-full sm:w-52 lg:justify-self-end">
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
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-sky-500 hover:to-blue-500 disabled:opacity-60"
            disabled={busy}
          >
            + เพิ่มแบบสอบถาม
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-sky-100 bg-white/95 shadow-[0_20px_55px_rgba(37,99,235,0.10)]">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-[13px]">
              <thead className="bg-gradient-to-r from-sky-600 via-blue-600 to-blue-700 text-white">
                <tr className="border-b border-blue-700/30">
                  <th className="w-[80px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                    ลำดับ
                  </th>
                  <th className="min-w-[240px] border-r border-white/20 px-4 py-3.5 text-center text-sm font-bold">
                    ชื่อแบบสอบถาม
                  </th>
                  <th className="w-[120px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                    ปีการศึกษา
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
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      {items.length === 0
                        ? "ไม่พบข้อมูลแบบสอบถาม"
                        : "ไม่พบข้อมูลแบบสอบถามที่ตรงกับเงื่อนไข"}
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((d, idx) => (
                    <tr key={d.id} className="border-b border-sky-100 transition last:border-b-0 hover:bg-sky-50/50">
                      <td className="border-r border-sky-100 px-3 py-3.5 text-center text-slate-500">
                        {startItem + idx}
                      </td>

                      <td className="border-r border-sky-100 px-4 py-3.5 font-normal text-slate-900">
                        {d.title}
                        {d.description && (
                          <div className="mt-1 max-w-sm truncate text-xs font-normal text-slate-500">
                            {d.description}
                          </div>
                        )}
                      </td>

                      <td className="border-r border-sky-100 px-3 py-3.5 text-center text-slate-700">
                        {d.year_be}
                      </td>

                      <td className="border-r border-sky-100 px-3 py-3.5 text-center">
                        <StatusBadge active={d.is_active} />
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <ToggleSwitch
                            checked={d.is_active}
                            onChange={() => toggleActive(d)}
                            disabled={
                              busy ||
                              (!d.is_active && d.year_be < getCurrentYearBe())
                            }
                            title={
                              d.is_active
                                ? "คลิกเพื่อปิดใช้งานแบบสอบถาม"
                                : d.year_be < getCurrentYearBe()
                                  ? `ไม่สามารถเปิดแบบสอบถามย้อนหลังได้ (พ.ศ. ปัจจุบัน ${getCurrentYearBe()})`
                                  : "คลิกเพื่อเปิดใช้งานแบบสอบถาม"
                            }
                          />

                          <div className="mx-1 h-5 w-px bg-slate-200" />

                          <button
                            type="button"
                            onClick={() => openEdit(d)}
                            className="rounded-lg border border-amber-400 bg-gradient-to-b from-amber-400 to-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-amber-500 hover:to-amber-600 disabled:opacity-50"
                            disabled={busy}
                          >
                            แก้ไข
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteSurvey(d)}
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
                  {mode === "create" ? "เพิ่มแบบสอบถาม" : "แก้ไขแบบสอบถาม"}
                </h3>
                <p className="mt-1 text-sm text-sky-100/90">
                  {mode === "create"
                    ? "เลือกปีการศึกษา ระบบจะสร้างชื่อเริ่มต้นให้และสามารถแก้ไขได้"
                    : "แก้ไขชื่อแบบสอบถาม ปีการศึกษา และรายละเอียดเพิ่มเติม"}
                </p>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      ปีการศึกษา (พ.ศ.)
                    </label>
                    <input
                      type="number"
                      value={yearBe}
                      onChange={(e) => {
                        const nextYearBe = parseInt(e.target.value, 10) || 0;
                        setYearBe(nextYearBe);
                        if (mode === "create") {
                          setTitle(
                            nextYearBe >= 2500 ? buildSurveyTitle(nextYearBe) : "",
                          );
                        }
                      }}
                      className={inputClass}
                      placeholder="เช่น 2568"
                      min={2500}
                      step={1}
                      autoFocus
                    />
                    {mode === "create" && (
                      <p className="mt-1.5 text-xs text-slate-500">
                        ค่าเริ่มต้นเป็นปีถัดจากปีการศึกษาล่าสุดในระบบ
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      ชื่อแบบสอบถาม
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      รายละเอียดเพิ่มเติม
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`${inputClass} min-h-[100px]`}
                    />
                  </div>
                </div>

                {error && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={busy}
                    className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {busy ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                  <button
                    type="button"
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
