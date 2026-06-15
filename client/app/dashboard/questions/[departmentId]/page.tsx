"use client";

import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type SVGProps } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckSquare, CircleCheck, CircleX, Info, ListChecks, X } from "lucide-react";
import Swal from "sweetalert2";
import {
  apiDeleteWithMeta,
  apiGet,
  apiPost,
  apiPut,
} from "@/lib/api";

type QuestionType = "rating" | "text";
type QuestionStatus = "active" | "inactive";
type QuestionScope = "central" | "department";

type QuestionRow = {
  id: number;
  survey_id: number;
  scope: QuestionScope;
  type: QuestionType;
  text: string;
  display_order: number | null;
  status: QuestionStatus;
  department_id: number | null;
  answer_count: number;
  response_count: number;
  has_answers: boolean;
  is_selected?: boolean;
};

type QuestionsResponse = {
  total: number;
  items: QuestionRow[];
  survey: {
    id: number;
    year_be: number;
    title: string;
  } | null;
};

type QuestionDeleteResponse = {
  message?: string;
  answer_count?: number;
  response_count?: number;
  has_answers?: boolean;
  requires_confirmation?: boolean;
};

type Department = { id: number; name: string };
type DepartmentResponse = { department: Department };
type MeRes = {
  user: {
    id: number;
    username: string;
    role: "admin" | "exec" | "dept_head" | "staff";
    departmentId: number | null;
  };
};

type ModalMode = "create" | "edit";
type StatusFilter = "all" | "active" | "inactive";
type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const PAGE_SIZE = 10;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "ใช้งานอยู่" },
  { value: "inactive", label: "ปิดใช้งาน" },
];

const QUESTION_OVERVIEW_THEMES = {
  total: { cardClass: "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]", iconClass: "from-sky-500 to-cyan-500" },
  active: { cardClass: "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]", iconClass: "from-emerald-500 to-teal-500" },
  inactive: { cardClass: "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]", iconClass: "from-slate-500 to-slate-600" },
} as const;

const QUESTION_TYPE_OPTIONS: Array<{ value: QuestionType; label: string; description: string }> = [
  { value: "rating", label: "ให้คะแนน 1-5", description: "" },
  { value: "text", label: "คำตอบแบบข้อความ", description: "เหมาะกับคำถามปลายเปิดหรือข้อเสนอแนะ" },
];

function getQuestionTypeLabel(type: QuestionType) {
  return type === "rating" ? "ให้คะแนน 1-5" : "คำตอบแบบข้อความ";
}

function getQuestionTypeTone(type: QuestionType) {
  return type === "rating" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-amber-200 bg-amber-50 text-amber-700";
}

function getDefaultDisplayOrder(items: QuestionRow[]) {
  return items.length === 0 ? 1 : Math.max(...items.map((item) => Number(item.display_order ?? 0))) + 1;
}

function normalizeDisplayOrderInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^0+/, "");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function isQuestionDeleteResponse(value: unknown): value is QuestionDeleteResponse {
  return Boolean(value) && typeof value === "object";
}

function getQuestionUsageText(
  answerCount: number,
  type: QuestionType,
) {
  const answerLabel = type === "rating" ? "การให้คะแนน" : "คำตอบ";
  return `คำถามนี้มี${answerLabel}แล้ว ${answerCount.toLocaleString(
    "th-TH",
  )} รายการ จากแบบประเมิน\nหากลบ ระบบจะลบข้อมูลของข้อนี้ออกและคำนวณผลประเมินใหม่ตามข้อมูลที่เหลือ`;
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
      popup: "rounded-3xl border border-emerald-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
  });
}

function getStatusFilterStyle(status: StatusFilter): CSSProperties {
  if (status === "active") return { backgroundColor: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8", boxShadow: "0 8px 20px rgba(37, 99, 235, 0.08)" };
  if (status === "inactive") return { backgroundColor: "#f8fafc", borderColor: "#cbd5e1", color: "#334155", boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)" };
  return { backgroundColor: "#f8fbff", borderColor: "#bfdbfe", color: "#1e3a8a", boxShadow: "0 8px 20px rgba(37, 99, 235, 0.06)" };
}

function ToggleSwitch({ checked, onChange, disabled, title }: { checked: boolean; onChange: () => void; disabled?: boolean; title?: string }) {
  return (
    <label className={`relative inline-flex items-center ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`} title={title}>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} disabled={disabled} />
      <div className="relative h-5 w-10 rounded-full bg-slate-300 transition peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-100 peer-checked:bg-emerald-500 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white" />
    </label>
  );
}

function StatusBadge({ status }: { status: QuestionStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
      {status === "active" ? "ใช้งานอยู่" : "ปิดใช้งาน"}
    </span>
  );
}

function TypeBadge({ type }: { type: QuestionType }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getQuestionTypeTone(type)}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${type === "rating" ? "bg-sky-500" : "bg-amber-500"}`} />
      {getQuestionTypeLabel(type)}
    </span>
  );
}

function KpiCard({ icon: Icon, title, value, sub, cardClass = "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]", iconClass = "from-sky-500 to-blue-600", }: { icon: KpiIcon; title: string; value: number; sub?: string; cardClass?: string; iconClass?: string; }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border p-5 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 ${cardClass}`}>
      <div className="relative flex items-start gap-4">
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconClass} text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/35`} aria-hidden="true">
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="text-2xl font-black leading-tight tracking-tight text-slate-900">{value.toLocaleString("th-TH")}</div>
          {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
      <div className="relative z-10 mx-auto max-w-7xl space-y-4 animate-pulse">
        <div className="h-44 rounded-[28px] border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />)}
        </div>
        <div className="h-28 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
        <div className="h-80 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
      </div>
    </main>
  );
}

export default function DepartmentQuestionsPage() {
  const params = useParams<{ departmentId: string }>();
  const searchParams = useSearchParams();
  const pathDepartmentId = Array.isArray(params.departmentId) ? params.departmentId[0] : params.departmentId;
  const isCentralView = pathDepartmentId === "central";
  const queryDepartmentId = Number(searchParams.get("departmentId") || "0");
  const urlDepartmentId = Number.isFinite(Number(pathDepartmentId)) && Number(pathDepartmentId) > 0 ? Number(pathDepartmentId) : queryDepartmentId;

  const [me, setMe] = useState<MeRes["user"] | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [department, setDepartment] = useState<Department | null>(null);
  const [survey, setSurvey] = useState<QuestionsResponse["survey"] | null>(null);
  const [items, setItems] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [hasActiveSurvey, setHasActiveSurvey] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [centralOpen, setCentralOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>("create");
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [text, setText] = useState("");
  const [qType, setQType] = useState<QuestionType>("rating");
  const [displayOrder, setDisplayOrder] = useState("1");

  const effectiveDepartmentId = useMemo(() => {
    if (me?.role === "dept_head" || me?.role === "staff") return me.departmentId ?? urlDepartmentId;
    return urlDepartmentId;
  }, [me, urlDepartmentId]);
  const canManageQuestions = !isCentralView;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiGet<MeRes>("/api/auth/me");
        if (active) setMe(res.user);
      } catch {
        if (active) setMe(null);
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authReady) return;
      if (!me) {
        setLoading(false);
        return;
      }
      if (!Number.isFinite(effectiveDepartmentId) || effectiveDepartmentId <= 0) {
        setError("รหัสหน่วยงานไม่ถูกต้อง");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError("");
        setInfoMsg("");
        setHasActiveSurvey(true);
        setSurvey(null);
        try {
          const deptRes = await apiGet<DepartmentResponse>(`/api/departments/${effectiveDepartmentId}`);
          if (active) setDepartment(deptRes.department ?? null);
        } catch {}
        const res = await apiGet<QuestionsResponse>(`/api/dashboard/questions/${effectiveDepartmentId}`);
        if (!active) return;
        const nextItems = res.items ?? [];
        setItems(nextItems);
        setSurvey(res.survey ?? null);
        setHasActiveSurvey(true);
      } catch (e: unknown) {
        if (!active) return;
        const message = getErrorMessage(e, "โหลดข้อมูลไม่สำเร็จ");
        if (message.toLowerCase().includes("no active survey")) {
          setInfoMsg(
            isCentralView
              ? "กรุณาเปิดใช้งานแบบสอบถามก่อน ระบบจึงจะดูคำถามส่วนกลางได้"
              : "กรุณาเปิดใช้งานแบบสอบถามก่อน ระบบจึงจะจัดการคำถามหน่วยงานได้",
          );
          setHasActiveSurvey(false);
          setItems([]);
          setSurvey(null);
        } else {
          setError(message);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authReady, me, effectiveDepartmentId, reloadKey, isCentralView]);

  const centralItems = useMemo(
    () => items.filter((item) => item.scope === "central"),
    [items],
  );
  const centralQuestionsEnabled = centralItems.some((item) => item.is_selected);

  const selectedCentralItems = useMemo(
    () => centralItems.filter((item) => item.is_selected),
    [centralItems],
  );

  const departmentItems = useMemo(
    () => items.filter((item) => item.scope === "department"),
    [items],
  );

  const visibleItems = useMemo(
    () => (isCentralView ? centralItems : [...selectedCentralItems, ...departmentItems]),
    [centralItems, departmentItems, isCentralView, selectedCentralItems],
  );

  const counts = useMemo(() => {
    let activeCount = 0;
    let inactiveCount = 0;
    for (const row of visibleItems) {
      if (row.status === "active") activeCount += 1;
      else inactiveCount += 1;
    }
    return { total: visibleItems.length, active: activeCount, inactive: inactiveCount };
  }, [visibleItems]);

  const filteredItems = useMemo(() => {
    let list = [...visibleItems];
    if (statusFilter === "active") list = list.filter((item) => item.status === "active");
    if (statusFilter === "inactive") list = list.filter((item) => item.status === "inactive");
    const keyword = q.trim().toLowerCase();
    if (keyword) {
      list = list.filter((item) => {
        const textValue = (item.text ?? "").toLowerCase();
        const orderValue = String(item.display_order ?? "");
        const typeValue = getQuestionTypeLabel(item.type).toLowerCase();
        return textValue.includes(keyword) || orderValue.includes(keyword) || typeValue.includes(keyword);
      });
    }
    return list;
  }, [visibleItems, q, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [q, statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [filteredItems.length]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, safeCurrentPage]);
  const isQuestionTypeLocked =
    mode === "edit" &&
    Boolean(editing?.has_answers || (editing?.answer_count ?? 0) > 0);

  const openCreate = () => {
    setMode("create");
    setEditing(null);
    setText("");
    setQType("rating");
    setDisplayOrder(String(getDefaultDisplayOrder(visibleItems)));
    setOpen(true);
  };

  const openEdit = (row: QuestionRow) => {
    setMode("edit");
    setEditing(row);
    setText(row.text);
    setQType(row.type);
    setDisplayOrder(String(row.display_order ?? 1));
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setMode("create");
    setText("");
    setQType("rating");
    setDisplayOrder("1");
  };

  const openCentralPicker = () => {
    setCentralOpen(true);
  };

  const closeCentralPicker = () => {
    setCentralOpen(false);
  };

  const saveCentralSelections = async () => {
    try {
      setError("");
      if (!hasActiveSurvey) throw new Error("ไม่พบแบบสอบถามที่กำลังเปิดใช้งาน");
      if (centralQuestionsEnabled) return;

      setBusy(true);
      const centralQuestionIds = centralItems.map((item) => item.id);
      await apiPut(`/api/dashboard/questions/department/${effectiveDepartmentId}/central-selections`, {
        question_ids: centralQuestionIds,
      });

      setCentralOpen(false);
      setReloadKey((prev) => prev + 1);
      await showSuccessAlert(
        "เพิ่มคำถามกลางสำเร็จ",
        `เพิ่มคำถามกลาง ${centralQuestionIds.length.toLocaleString("th-TH")} ข้อสำหรับหน่วยงานนี้เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "เพิ่มคำถามกลางไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    try {
      setError("");
      const payloadText = text.trim();
      if (!payloadText) throw new Error("กรุณากรอกคำถาม");
      if (!hasActiveSurvey) throw new Error("ไม่พบแบบสอบถามที่กำลังเปิดใช้งาน");
      const displayOrderValue = Number(displayOrder);
      if (!displayOrder.trim() || !Number.isInteger(displayOrderValue) || displayOrderValue < 1) throw new Error("กรุณากรอกลำดับการแสดงผลให้มากกว่า 0");

      const payload = {
        text: payloadText,
        type: isQuestionTypeLocked && editing ? editing.type : qType,
        display_order: displayOrderValue,
      };
      setBusy(true);
      if (mode === "create") {
        await apiPost(`/api/dashboard/questions/${effectiveDepartmentId}`, payload);
      } else {
        if (!editing) throw new Error("ไม่พบรายการที่ต้องแก้ไข");
        await apiPut(`/api/dashboard/questions/${editing.id}`, payload);
      }
      setReloadKey((prev) => prev + 1);
      closeModal();
      await showSuccessAlert(mode === "create" ? "เพิ่มคำถามหน่วยงานสำเร็จ" : "แก้ไขคำถามหน่วยงานสำเร็จ", `${mode === "create" ? "เพิ่ม" : "อัปเดต"}คำถาม "${payloadText}" เรียบร้อยแล้ว`);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: QuestionRow) => {
    try {
      setError("");
      const nextActive = row.status !== "active";
      const result = await Swal.fire({
        icon: "question",
        title: nextActive ? "เปิดใช้งานคำถาม" : "ปิดใช้งานคำถาม",
        text: nextActive ? `ต้องการเปิดใช้งานคำถาม "${row.text}" ใช่ไหม?` : `ต้องการปิดใช้งานคำถาม "${row.text}" ใช่ไหม?`,
        showCancelButton: true,
        confirmButtonText: nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน",
        cancelButtonText: "ยกเลิก",
        focusCancel: true,
        confirmButtonColor: nextActive ? "#2563eb" : "#dc2626",
        cancelButtonColor: "#0369a1",
        customClass: { popup: "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]", title: "text-xl font-semibold text-slate-900", htmlContainer: "text-sm leading-6 text-slate-500" },
      });
      if (!result.isConfirmed) return;
      setBusy(true);
      await apiPut(`/api/dashboard/questions/${row.id}`, { status: nextActive ? "active" : "inactive" });
      setReloadKey((prev) => prev + 1);
      await showSuccessAlert(nextActive ? "เปิดใช้งานคำถามสำเร็จ" : "ปิดใช้งานคำถามสำเร็จ", `${nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}คำถาม "${row.text}" เรียบร้อยแล้ว`);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "อัปเดตสถานะไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const deleteQuestion = async (row: QuestionRow) => {
    try {
      setError("");
      const deletePath = `/api/dashboard/questions/${row.id}`;
      const hasRecordedAnswers = row.has_answers || row.answer_count > 0;

      const result = await Swal.fire({
        icon: hasRecordedAnswers ? "warning" : "question",
        title: hasRecordedAnswers ? "คำถามนี้มีการประเมินแล้ว" : "ลบคำถาม",
        text: hasRecordedAnswers
          ? `${getQuestionUsageText(
              row.answer_count,
              row.type,
            )}\n\nต้องการลบคำถาม "${row.text}" ใช่ไหม?`
          : `ต้องการลบคำถาม "${row.text}" ใช่ไหม?\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
        showCancelButton: true,
        confirmButtonText: hasRecordedAnswers ? "ยืนยันการลบข้อมูล" : "ลบ",
        cancelButtonText: "ยกเลิก",
        focusCancel: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#2563eb",
        customClass: { popup: "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]", title: "text-xl font-semibold text-slate-900", htmlContainer: "text-sm leading-6 text-slate-500" },
      });
      if (!result.isConfirmed) return;

      setBusy(true);
      let recalculated = hasRecordedAnswers;
      let response = await apiDeleteWithMeta<QuestionDeleteResponse>(
        hasRecordedAnswers ? `${deletePath}?force=true` : deletePath,
      );

      if (!response.ok) {
        if (
          response.status === 409 &&
          isQuestionDeleteResponse(response.data) &&
          response.data.requires_confirmation
        ) {
          setBusy(false);

          const confirmForce = await Swal.fire({
            icon: "warning",
            title: "คำถามนี้มีการประเมินแล้ว",
            text: `${getQuestionUsageText(
              response.data.answer_count ?? row.answer_count,
              row.type,
            )}\n\nต้องการลบคำถาม "${row.text}" ใช่ไหม?`,
            showCancelButton: true,
            confirmButtonText: "ยืนยันการลบข้อมูล",
            cancelButtonText: "ยกเลิก",
            focusCancel: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#2563eb",
            customClass: {
              popup: "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
              title: "text-xl font-semibold text-slate-900",
              htmlContainer: "text-sm leading-6 text-slate-500",
            },
          });

          if (!confirmForce.isConfirmed) return;

          setBusy(true);
          recalculated = true;
          response = await apiDeleteWithMeta<QuestionDeleteResponse>(
            `${deletePath}?force=true`,
          );
        }

        if (!response.ok) {
          throw new Error(response.error ?? "ลบข้อมูลไม่สำเร็จ");
        }
      }

      setReloadKey((prev) => prev + 1);
      await showSuccessAlert(
        recalculated ? "ลบคำถามและคำนวณผลใหม่สำเร็จ" : "ลบคำถามสำเร็จ",
        recalculated
          ? `ลบคำถาม "${row.text}" และคำนวณผลประเมินใหม่ตามข้อมูลที่เหลือเรียบร้อยแล้ว`
          : `ลบคำถาม "${row.text}" เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "ลบข้อมูลไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  if (!authReady || (loading && !visibleItems.length && !department && !error && !infoMsg)) return <LoadingSkeleton />;
  if (!me) return null;

  const emptyMessage = infoMsg
    ? "กรุณาเปิดใช้งานแบบสอบถามก่อน ระบบจึงจะจัดการคำถามหน่วยงานได้"
    : visibleItems.length === 0
      ? isCentralView
        ? "ยังไม่มีคำถามส่วนกลาง"
        : "ยังไม่มีคำถามหน่วยงาน"
      : isCentralView
        ? "ไม่พบข้อมูลคำถามส่วนกลางที่ตรงกับเงื่อนไข"
        : "ไม่พบข้อมูลคำถามหน่วยงานที่ตรงกับเงื่อนไข";

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
                <ListChecks className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="mt-1 text-2xl font-bold text-white">{isCentralView ? "คำถามส่วนกลาง" : "จัดการคำถามหน่วยงาน"}</h1>
                <p className="mt-1 text-sm text-sky-100/90">หน่วยงาน: {department?.name || `หน่วยงาน #${effectiveDepartmentId}`}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-sky-100/90">
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sky-100 backdrop-blur-md">
                    {survey?.title ?? "แบบประเมินการให้บริการ"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                    ปี พ.ศ. {survey?.year_be ?? "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            <span className="whitespace-pre-wrap">{error}</span>
            <button type="button" onClick={() => setError("")} className="rounded-lg p-1 text-rose-500 transition hover:bg-rose-100 hover:text-rose-700" aria-label="ปิดข้อความแจ้งเตือน"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        )}

        {infoMsg && (
          <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" aria-hidden="true" />
            <span className="whitespace-pre-wrap">{infoMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard icon={ListChecks} title="คำถามทั้งหมด" value={counts.total} cardClass={QUESTION_OVERVIEW_THEMES.total.cardClass} iconClass={QUESTION_OVERVIEW_THEMES.total.iconClass} />
          <KpiCard icon={CircleCheck} title="ใช้งานอยู่" value={counts.active} cardClass={QUESTION_OVERVIEW_THEMES.active.cardClass} iconClass={QUESTION_OVERVIEW_THEMES.active.iconClass} />
          <KpiCard icon={CircleX} title="ปิดใช้งาน" value={counts.inactive} cardClass={QUESTION_OVERVIEW_THEMES.inactive.cardClass} iconClass={QUESTION_OVERVIEW_THEMES.inactive.iconClass} />
        </div>

        <div className="rounded-3xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-end">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">ค้นหา (คำถาม)</label>
              <input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} />
            </div>
            <div className="w-full sm:w-52">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">สถานะ</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={getStatusFilterStyle(statusFilter)} className={selectClass}>
                {STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {canManageQuestions && (
          <div className="flex flex-wrap justify-end gap-2 pr-4 sm:pr-4">
            <button
              type="button"
              onClick={openCentralPicker}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-emerald-500 hover:bg-emerald-500 disabled:opacity-60"
              disabled={busy || !hasActiveSurvey || (!centralQuestionsEnabled && centralItems.length === 0)}
            >
              <CheckSquare className="h-4 w-4" aria-hidden="true" />
              {centralQuestionsEnabled ? "เพิ่มคำถามกลางแล้ว" : "เพิ่มคำถามกลาง"}
            </button>
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-sky-500 hover:to-blue-500 disabled:opacity-60" disabled={busy || !hasActiveSurvey}>
              + เพิ่มคำถามหน่วยงาน
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(37,99,235,0.08)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-blue-700/20 bg-gradient-to-r from-sky-600 to-blue-600 text-white">
                <tr>
                  <th className="w-[90px] px-4 py-3 text-center font-semibold">ข้อ</th>
                  <th className="min-w-[320px] px-4 py-3 text-left font-semibold">คำถาม</th>
                  <th className="w-[180px] px-4 py-3 text-center font-semibold">รูปแบบ</th>
                  <th className="w-[140px] px-4 py-3 text-center font-semibold">สถานะ</th>
                  {canManageQuestions && <th className="w-[260px] px-4 py-3 text-center font-semibold">การทำงาน</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={canManageQuestions ? 5 : 4}>{emptyMessage}</td></tr>
                ) : (
                  paginatedItems.map((row, index) => (
                    <tr key={row.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 text-center text-slate-500">
                        {(safeCurrentPage - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-4 py-3 text-slate-900">
                        <div className="font-medium">{row.text}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                              row.scope === "central"
                                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                : "border-sky-200 bg-sky-50 text-sky-700"
                            }`}
                          >
                            {row.scope === "central"
                              ? "คำถามกลาง"
                              : "คำถามของหน่วยงาน"}
                          </span>
                        </div>
                        {row.has_answers && (
                          <div className="mt-1 text-xs text-amber-700">
                            มีข้อมูลการประเมินแล้ว {row.answer_count.toLocaleString("th-TH")} รายการ จากแบบประเมิน
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center"><TypeBadge type={row.type} /></td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td>
                      {canManageQuestions && (
                        <td className="px-4 py-3 text-center">
                          {row.scope === "department" ? (
                            <div className="flex items-center justify-center gap-2">
                              <ToggleSwitch checked={row.status === "active"} onChange={() => toggleActive(row)} disabled={busy} title={row.status === "active" ? "คลิกเพื่อปิดใช้งานคำถาม" : "คลิกเพื่อเปิดใช้งานคำถาม"} />
                              <div className="mx-1 h-5 w-px bg-slate-200" />
                              <button type="button" onClick={() => openEdit(row)} className="rounded-xl border border-amber-500 bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-amber-600 hover:bg-amber-600 disabled:opacity-50" disabled={busy}>แก้ไข</button>
                              <button type="button" onClick={() => deleteQuestion(row)} className="rounded-xl border border-red-500 bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-red-600 hover:bg-red-600 disabled:opacity-50" disabled={busy}>ลบ</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="cursor-not-allowed rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white opacity-80"
                              disabled
                            >
                              เพิ่มคำถามกลางแล้ว
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 sm:ml-auto">
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safeCurrentPage <= 1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">ย้อนกลับ</button>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">หน้า {safeCurrentPage} / {totalPages}</div>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safeCurrentPage >= totalPages} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">ถัดไป</button>
            </div>
          </div>
        </div>

        {centralOpen && canManageQuestions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-sky-50 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
              <div className="relative rounded-t-3xl border-b border-white/15 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-6 py-4 text-white">
                <button
                  type="button"
                  onClick={closeCentralPicker}
                  disabled={busy}
                  className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-60"
                  aria-label="ปิด"
                  title="ปิด"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
                <h3 className="text-lg font-bold">
                  {centralQuestionsEnabled ? "เพิ่มคำถามกลางแล้ว" : "ยืนยันเพิ่มคำถามกลาง"}
                </h3>
                <p className="mt-1 text-sm text-sky-100/90">
                  {centralQuestionsEnabled
                    ? "หน่วยงานนี้เพิ่มคำถามกลางแล้ว คำถามกลางใหม่จะถูกนำมาใช้โดยอัตโนมัติ"
                    : "ยืนยันการเพิ่มคำถามกลางไปใช้ในแบบประเมินของหน่วยงานนี้"}
                </p>
              </div>

              <div className="p-6">
                <div className="flex justify-end">
                  <div className="rounded-2xl border border-blue-700/20 bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm">
                    คำถามกลางทั้งหมด {centralItems.length.toLocaleString("th-TH")} ข้อ
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="max-h-[50vh] overflow-y-auto">
                    {centralItems.length === 0 ? (
                      <div className="px-4 py-10 text-center text-sm text-slate-500">
                        ยังไม่มีคำถามกลางในแบบสอบถามที่เปิดใช้งาน
                      </div>
                    ) : (
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 border-b border-blue-700/20 bg-gradient-to-r from-sky-600 to-blue-600 text-white">
                          <tr>
                            <th className="w-[90px] px-4 py-3 text-center font-semibold">
                              ข้อ
                            </th>
                            <th className="min-w-[260px] px-4 py-3 text-left font-semibold">
                              คำถาม
                            </th>
                            <th className="w-[170px] px-4 py-3 text-center font-semibold">
                              รูปแบบคำถาม
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {centralItems.map((question) => (
                            <tr key={question.id} className="transition hover:bg-slate-50">
                              <td className="px-4 py-3 text-center font-medium text-slate-500">
                                {question.display_order ?? "-"}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium leading-6 text-slate-900">
                                {question.text}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <TypeBadge type={question.type} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  {!centralQuestionsEnabled && (
                    <button
                      type="button"
                      onClick={saveCentralSelections}
                      disabled={busy || centralItems.length === 0}
                      className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {busy ? "กำลังบันทึก..." : "ยืนยันเพิ่มคำถามกลาง"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeCentralPicker}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 bg-red-500 px-4 py-2 text-white transition hover:bg-red-600 disabled:opacity-60"
                  >
                    {centralQuestionsEnabled ? "ปิด" : "ยกเลิก"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {open && canManageQuestions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-sky-50 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
              <div className="relative rounded-t-3xl border-b border-white/15 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-6 py-4 text-white">
                <button type="button" onClick={closeModal} disabled={busy} className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-60" aria-label="ปิด" title="ปิด"><X className="h-4 w-4" aria-hidden="true" /></button>
                <h3 className="text-lg font-bold">{mode === "create" ? "เพิ่มคำถามหน่วยงาน" : "แก้ไขคำถามหน่วยงาน"}</h3>
                <p className="mt-1 text-sm text-sky-100/90">กรอกคำถาม รูปแบบคำตอบ และลำดับการแสดงผลให้ครบถ้วน</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">คำถาม <span className="text-red-500">*</span></label>
                    <textarea value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} min-h-[120px]`} autoFocus />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">รูปแบบคำตอบ <span className="text-red-500">*</span></label>
                      <select value={qType} onChange={(e) => setQType(e.target.value as QuestionType)} className={selectClass} disabled={busy || isQuestionTypeLocked}>
                        {QUESTION_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                      <p className="mt-1.5 text-xs leading-5 text-slate-500">
                        {isQuestionTypeLocked
                          ? `คำถามนี้มีผู้ประเมินตอบแล้ว ${(
                              editing?.answer_count ?? 0
                            ).toLocaleString(
                              "th-TH",
                            )} รายการ จึงไม่สามารถเปลี่ยนรูปแบบคำตอบได้`
                          : QUESTION_TYPE_OPTIONS.find((item) => item.value === qType)
                              ?.description}
                      </p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">ลำดับการแสดงผล <span className="text-red-500">*</span></label>
                      <input type="text" inputMode="numeric" pattern="[0-9]*" value={displayOrder} onChange={(e) => setDisplayOrder(normalizeDisplayOrderInput(e.target.value))} className={inputClass} />
                    </div>
                  </div>
                </div>
                {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" onClick={save} disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">{busy ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button>
                  <button type="button" onClick={closeModal} disabled={busy} className="rounded-xl border border-slate-200 bg-red-500 px-4 py-2 text-white transition hover:bg-red-600 disabled:opacity-60">ยกเลิก</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
