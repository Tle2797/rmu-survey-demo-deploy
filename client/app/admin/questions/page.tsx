"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import {
  CircleCheck,
  CircleX,
  Info,
  ListChecks,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import {
  apiDeleteWithMeta,
  apiGet,
  apiPost,
  apiPut,
} from "@/lib/api";

type QuestionType = "rating" | "text";
type QuestionStatus = "active" | "inactive";

type QuestionRow = {
  id: number;
  survey_id: number;
  scope: string;
  type: QuestionType;
  text: string;
  display_order: number;
  status: QuestionStatus;
  answer_count: number;
  response_count: number;
  has_answers: boolean;
  created_at?: string;
  updated_at?: string;
};

type CentralQuestionsRes = {
  total: number;
  items: QuestionRow[];
  survey_id: number | null;
  message?: string;
};

type QuestionDeleteResponse = {
  message?: string;
  answer_count?: number;
  response_count?: number;
  has_answers?: boolean;
  requires_confirmation?: boolean;
  deleted_answers?: number;
  affected_responses?: number;
  deleted_responses?: number;
  recalculated?: boolean;
};

type QuestionDraft = {
  id: number;
  text: string;
  type: QuestionType;
};

type ModalMode = "create" | "edit";
type StatusFilter = "all" | "active" | "inactive";
type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "ใช้งานอยู่" },
  { value: "inactive", label: "ปิดใช้งาน" },
];

const PAGE_SIZE = 10;

const QUESTION_OVERVIEW_THEMES = {
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

const QUESTION_TYPE_OPTIONS: Array<{
  value: QuestionType;
  label: string;
  description: string;
}> = [
  {
    value: "rating",
    label: "ให้คะแนน 1-5 ดาว",
    description: "",
  },
  {
    value: "text",
    label: "คำตอบแบบข้อความ",
    description: "เหมาะกับคำถามปลายเปิดหรือข้อเสนอแนะ",
  },
];

function getQuestionTypeLabel(type: QuestionType) {
  return type === "rating" ? "ให้คะแนน 1-5" : "คำตอบแบบข้อความ";
}

function getQuestionTypeTone(type: QuestionType) {
  return type === "rating"
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function getDefaultDisplayOrder(items: QuestionRow[]) {
  if (items.length === 0) return 1;
  return Math.max(...items.map((item) => item.display_order)) + 1;
}

function normalizeDisplayOrderInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^0+/, "");
}

function createQuestionDraft(id: number): QuestionDraft {
  return {
    id,
    text: "",
    type: "rating",
  };
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
  responseCount: number,
  type: QuestionType,
) {
  const answerLabel = type === "rating" ? "การให้คะแนน" : "คำตอบ";
  return `คำถามนี้มี${answerLabel}แล้ว ${answerCount.toLocaleString(
    "th-TH",
  )} รายการ จาก ${responseCount.toLocaleString(
    "th-TH",
  )} แบบประเมิน\nหากลบ ระบบจะลบข้อมูลของข้อนี้ออกและคำนวณผลประเมินใหม่ตามข้อมูลที่เหลือ`;
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

function TypeBadge({ type }: { type: QuestionType }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getQuestionTypeTone(
        type,
      )}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          type === "rating" ? "bg-sky-500" : "bg-amber-500"
        }`}
      />
      {getQuestionTypeLabel(type)}
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

export default function AdminCentralQuestionsPage() {
  const [items, setItems] = useState<QuestionRow[]>([]);
  const [currentSurveyId, setCurrentSurveyId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>("create");
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [text, setText] = useState("");
  const [qType, setQType] = useState<QuestionType>("rating");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [questionDrafts, setQuestionDrafts] = useState<QuestionDraft[]>([
    createQuestionDraft(1),
  ]);
  const nextDraftId = useRef(2);

  const load = async () => {
    const res = await apiGet<CentralQuestionsRes>("/api/admin/questions/central");
    const nextItems = res.items ?? [];

    if (res.message && nextItems.length === 0 && !res.survey_id) {
      setInfoMsg(
        "กรุณาเปิดใช้งานแบบสอบถามก่อน ระบบจึงจะจัดการคำถามส่วนกลางได้",
      );
    } else {
      setInfoMsg("");
    }

    setItems(nextItems);
    setCurrentSurveyId(res.survey_id);
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

  const counts = useMemo(() => {
    const total = items.length;
    let active = 0;
    let inactive = 0;

    for (const row of items) {
      if (row.status === "active") active += 1;
      else inactive += 1;
    }

    return { total, active, inactive };
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = [...items];

    if (statusFilter === "active") list = list.filter((item) => item.status === "active");
    if (statusFilter === "inactive") list = list.filter((item) => item.status === "inactive");

    const keyword = q.trim().toLowerCase();
    if (keyword) {
      list = list.filter((item) => {
        const text = (item.text ?? "").toLowerCase();
        const order = String(item.display_order);
        const type = getQuestionTypeLabel(item.type).toLowerCase();

        return text.includes(keyword) || order.includes(keyword) || type.includes(keyword);
      });
    }

    return list;
  }, [items, q, statusFilter]);

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
  const firstNewQuestionNumber = getDefaultDisplayOrder(items);

  const openCreate = () => {
    const defaultDisplayOrder = getDefaultDisplayOrder(items);
    setMode("create");
    setEditing(null);
    setText("");
    setQType("rating");
    setDisplayOrder(String(defaultDisplayOrder));
    setQuestionDrafts([createQuestionDraft(nextDraftId.current++)]);
    setOpen(true);
  };

  const openEdit = (row: QuestionRow) => {
    setMode("edit");
    setEditing(row);
    setText(row.text);
    setQType(row.type);
    setDisplayOrder(String(row.display_order));
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setMode("create");
    setText("");
    setQType("rating");
    setDisplayOrder("1");
    setQuestionDrafts([createQuestionDraft(nextDraftId.current++)]);
  };

  const updateQuestionDraft = (
    id: number,
    field: "text" | "type",
    value: string,
  ) => {
    setQuestionDrafts((drafts) =>
      drafts.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              [field]: value,
            }
          : draft,
      ),
    );
  };

  const addQuestionDraft = () => {
    setQuestionDrafts((drafts) => [
      ...drafts,
      createQuestionDraft(nextDraftId.current++),
    ]);
  };

  const removeQuestionDraft = (id: number) => {
    setQuestionDrafts((drafts) => drafts.filter((draft) => draft.id !== id));
  };

  const save = async () => {
    try {
      setError("");
      if (!currentSurveyId) {
        throw new Error("ไม่พบแบบสอบถามที่กำลังเปิดใช้งาน");
      }

      setBusy(true);
      const isCreate = mode === "create";

      if (isCreate) {
        if (questionDrafts.length === 0) {
          throw new Error("กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อ");
        }

        const questions = questionDrafts.map((draft, index) => {
          const payloadText = draft.text.trim();
          const questionNumber = firstNewQuestionNumber + index;

          if (!payloadText) {
            throw new Error(`กรุณากรอกข้อความคำถามข้อที่ ${questionNumber}`);
          }

          return {
            text: payloadText,
            type: draft.type,
          };
        });

        await apiPost("/api/admin/questions/central/bulk", {
          survey_id: currentSurveyId,
          questions,
        });
      } else {
        if (!editing) throw new Error("ไม่พบรายการที่ต้องแก้ไข");

        const payloadText = text.trim();
        if (!payloadText) throw new Error("กรุณากรอกข้อความคำถาม");

        const displayOrderValue = Number(displayOrder);
        if (
          !displayOrder.trim() ||
          !Number.isInteger(displayOrderValue) ||
          displayOrderValue < 1
        ) {
          throw new Error("กรุณากรอกลำดับการแสดงผลให้มากกว่า 0");
        }

        const payload = {
          survey_id: currentSurveyId,
          text: payloadText,
          type: isQuestionTypeLocked ? editing.type : qType,
          display_order: displayOrderValue,
        };

        await apiPut(`/api/admin/questions/central/${editing.id}`, payload);
      }

      await load();
      closeModal();
      await showSuccessAlert(
        isCreate ? "เพิ่มคำถามส่วนกลางสำเร็จ" : "แก้ไขคำถามส่วนกลางสำเร็จ",
        isCreate
          ? `เพิ่มคำถามพร้อมกัน ${questionDrafts.length.toLocaleString("th-TH")} ข้อเรียบร้อยแล้ว`
          : `อัปเดตคำถาม "${text.trim()}" เรียบร้อยแล้ว`,
      );
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
        text: nextActive
          ? `ต้องการเปิดใช้งานคำถาม "${row.text}" ใช่ไหม?`
          : `ต้องการปิดใช้งานคำถาม "${row.text}" ใช่ไหม?`,
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
      await apiPut(`/api/admin/questions/central/${row.id}/toggle-active`);
      await load();
      await showSuccessAlert(
        nextActive ? "เปิดใช้งานคำถามสำเร็จ" : "ปิดใช้งานคำถามสำเร็จ",
        `${nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}คำถาม "${row.text}" เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "อัปเดตสถานะไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const deleteQuestion = async (row: QuestionRow) => {
    try {
      setError("");
      const deletePath = `/api/admin/questions/central/${row.id}`;
      const hasRecordedAnswers = row.has_answers || row.answer_count > 0;

      const result = await Swal.fire({
        icon: "question",
        title: "ลบคำถาม",
        text: hasRecordedAnswers
          ? `ต้องการลบคำถาม "${row.text}" ใช่ไหม?\nระบบจะตรวจสอบข้อมูลคำตอบก่อนลบ`
          : `ต้องการลบคำถาม "${row.text}" ใช่ไหม?\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
        showCancelButton: true,
        confirmButtonText: "ลบ",
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
      let recalculated = false;
      let response = await apiDeleteWithMeta<QuestionDeleteResponse>(deletePath);

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
              response.data.response_count ?? row.response_count,
              row.type,
            )}\n\nต้องการลบคำถาม "${row.text}" ใช่ไหม?`,
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
          recalculated = true;
          response = await apiDeleteWithMeta<QuestionDeleteResponse>(
            `${deletePath}?force=true`,
          );
        }

        if (!response.ok) {
          throw new Error(response.error ?? "ลบข้อมูลไม่สำเร็จ");
        }
      }

      if (isQuestionDeleteResponse(response.data)) {
        recalculated =
          recalculated ||
          Boolean(response.data.recalculated) ||
          Boolean((response.data.deleted_answers ?? 0) > 0);
      }

      await load();
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

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
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

  const emptyMessage = infoMsg
    ? "กรุณาเปิดใช้งานแบบสอบถามก่อนจึงจะจัดการคำถามส่วนกลางได้"
    : items.length === 0
      ? "ยังไม่มีคำถามส่วนกลาง"
      : "ไม่พบข้อมูลคำถามส่วนกลางที่ตรงกับเงื่อนไข";

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
                <p className="text-sm font-medium text-sky-100/90">Administration</p>
                <h1 className="mt-1 text-2xl font-bold text-white">จัดการคำถามส่วนกลาง</h1>
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

        {infoMsg && (
          <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" aria-hidden="true" />
            <span className="whitespace-pre-wrap">{infoMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            icon={ListChecks}
            title="คำถามทั้งหมด"
            value={counts.total}
            cardClass={QUESTION_OVERVIEW_THEMES.total.cardClass}
            iconClass={QUESTION_OVERVIEW_THEMES.total.iconClass}
          />
          <KpiCard
            icon={CircleCheck}
            title="ใช้งานอยู่"
            value={counts.active}
            cardClass={QUESTION_OVERVIEW_THEMES.active.cardClass}
            iconClass={QUESTION_OVERVIEW_THEMES.active.iconClass}
          />
          <KpiCard
            icon={CircleX}
            title="ปิดใช้งาน"
            value={counts.inactive}
            cardClass={QUESTION_OVERVIEW_THEMES.inactive.cardClass}
            iconClass={QUESTION_OVERVIEW_THEMES.inactive.iconClass}
          />
        </div>

        <div className="rounded-3xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-end">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ค้นหา (ข้อความคำถาม)
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
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-sky-500 hover:to-blue-500 disabled:opacity-60"
            disabled={busy || !currentSurveyId}
          >
            + เพิ่มคำถามกลาง
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-sky-100 bg-white/95 shadow-[0_20px_55px_rgba(37,99,235,0.10)]">
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full border-collapse text-[13px]">
              <thead className="bg-gradient-to-r from-sky-600 via-blue-600 to-blue-700 text-white">
                <tr className="border-b border-blue-700/30">
                  <th className="w-[70px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                    ข้อ
                  </th>
                  <th className="min-w-[300px] border-r border-white/20 px-4 py-3.5 text-center text-sm font-bold">
                    ข้อความคำถาม
                  </th>
                  <th className="w-[170px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                    รูปแบบ
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
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((row) => (
                    <tr key={row.id} className="border-b border-sky-100 transition last:border-b-0 hover:bg-sky-50/50">
                      <td className="border-r border-sky-100 px-3 py-3.5 text-center text-slate-500">
                        {row.display_order}
                      </td>

                      <td className="border-r border-sky-100 px-4 py-3.5 text-slate-900">
                        <div className="font-normal leading-5">{row.text}</div>
                        {row.has_answers && (
                          <div className="mt-1 text-[11px] font-medium leading-4 text-amber-700">
                            มีข้อมูลการประเมินแล้ว {row.answer_count.toLocaleString("th-TH")} รายการ จากแบบประเมิน
                          </div>
                        )}
                      </td>

                      <td className="border-r border-sky-100 px-3 py-3.5 text-center">
                        <TypeBadge type={row.type} />
                      </td>

                      <td className="border-r border-sky-100 px-3 py-3.5 text-center">
                        <StatusBadge active={row.status === "active"} />
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <ToggleSwitch
                            checked={row.status === "active"}
                            onChange={() => toggleActive(row)}
                            disabled={busy}
                            title={
                              row.status === "active"
                                ? "คลิกเพื่อปิดใช้งานคำถาม"
                                : "คลิกเพื่อเปิดใช้งานคำถาม"
                            }
                          />

                          <div className="mx-1 h-5 w-px bg-slate-200" />

                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="rounded-lg border border-amber-400 bg-gradient-to-b from-amber-400 to-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-amber-500 hover:to-amber-600 disabled:opacity-50"
                            disabled={busy}
                          >
                            แก้ไข
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteQuestion(row)}
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
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-sky-50 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
              <div className="relative rounded-t-2xl border-b border-white/15 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-5 py-3.5 text-white">
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
                  {mode === "create" ? "เพิ่มคำถามส่วนกลาง" : "แก้ไขคำถามส่วนกลาง"}
                </h3>
                <p className="mt-1 text-sm text-sky-100/90">
                  {mode === "create"
                    ? `คำถามใหม่จะเริ่มต่อจากรายการเดิมที่ข้อ ${firstNewQuestionNumber} โดยอัตโนมัติ`
                    : "แก้ไขข้อความคำถามและรูปแบบคำตอบ"}
                </p>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="overflow-y-auto p-4 sm:p-5">
                  {mode === "create" ? (
                  <div className="space-y-4">
                    {questionDrafts.map((draft, index) => (
                      <div
                        key={draft.id}
                        className="rounded-xl border border-sky-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                          <div className="inline-flex h-9 items-center justify-center rounded-xl bg-blue-50 px-3 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
                            ข้อ {firstNewQuestionNumber + index}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeQuestionDraft(draft.id)}
                            disabled={busy || questionDrafts.length === 1}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`ลบคำถามข้อที่ ${firstNewQuestionNumber + index}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            ลบข้อนี้
                          </button>
                        </div>

                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          ข้อความคำถาม <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={draft.text}
                          onChange={(e) =>
                            updateQuestionDraft(draft.id, "text", e.target.value)
                          }
                          className={`${inputClass} min-h-[90px] resize-y`}
                          placeholder="กรอกข้อความคำถาม"
                          autoFocus={index === 0}
                        />

                        <div className="mt-3">
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            รูปแบบคำตอบ <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={draft.type}
                            onChange={(e) =>
                              updateQuestionDraft(draft.id, "type", e.target.value)
                            }
                            className={selectClass}
                            disabled={busy}
                          >
                            {QUESTION_TYPE_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            {draft.type === "rating"
                              ? "ผู้ประเมินเลือกคะแนนตั้งแต่ 1 ถึง 5 ดาว"
                              : QUESTION_TYPE_OPTIONS.find(
                                  (item) => item.value === draft.type,
                                )?.description}
                          </p>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addQuestionDraft}
                      disabled={busy || questionDrafts.length >= 50}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/70 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      เพิ่มคำถามข้อ {firstNewQuestionNumber + questionDrafts.length}
                    </button>
                  </div>
                  ) : (
                  <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                      <label className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
                        <span>ข้อ</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={displayOrder}
                          onChange={(e) =>
                            setDisplayOrder(
                              normalizeDisplayOrderInput(e.target.value),
                            )
                          }
                          disabled={busy}
                          aria-label="เลขข้อ"
                          className="h-8 w-16 rounded-lg border border-blue-200 bg-white px-2 text-center text-sm font-bold text-blue-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                        />
                      </label>
                      <span className="text-xs text-slate-500">
                        แก้เลขข้อเพื่อจัดลำดับคำถามใหม่
                      </span>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        ข้อความคำถาม <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className={`${inputClass} min-h-[90px] resize-y`}
                        placeholder="กรอกข้อความคำถาม"
                        autoFocus
                      />
                    </div>

                    <div className="mt-3">
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        รูปแบบคำตอบ <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={qType}
                        onChange={(e) => setQType(e.target.value as QuestionType)}
                        className={selectClass}
                        disabled={busy || isQuestionTypeLocked}
                      >
                        {QUESTION_TYPE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-xs leading-5 text-slate-500">
                        {isQuestionTypeLocked
                          ? `คำถามนี้มีผู้ประเมินตอบแล้ว ${(
                              editing?.answer_count ?? 0
                            ).toLocaleString(
                              "th-TH",
                            )} รายการ จึงไม่สามารถเปลี่ยนรูปแบบคำตอบได้`
                          : qType === "rating"
                            ? "ผู้ประเมินเลือกคะแนนตั้งแต่ 1 ถึง 5 ดาว"
                            : QUESTION_TYPE_OPTIONS.find(
                                (item) => item.value === qType,
                              )?.description}
                      </p>
                    </div>
                  </div>
                  )}

                  {error && (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                </div>

                <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3.5 sm:px-5">
                  <button
                    type="button"
                    onClick={save}
                    disabled={busy}
                    className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {busy
                      ? "กำลังบันทึก..."
                      : mode === "create"
                        ? `บันทึก ${questionDrafts.length.toLocaleString("th-TH")} ข้อ`
                        : "บันทึกข้อมูล"}
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
