"use client";

import Link from "next/link";
import {
  use,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import {
  ArrowLeft,
  CircleAlert,
  CheckCircle2,
  ClipboardList,
  CircleX,
  RefreshCw,
  Search,
} from "lucide-react";
import OverviewCard from "@/app/components/overview-card";
import { apiGet } from "@/lib/api";

type DepartmentRow = {
  id: number;
  name: string;
  is_active: boolean;
  qrcode_id: number | null;
  qr_image_path: string | null;
  qr_link_target: string | null;
  qr_created_at: string | null;
  created_at?: string;
  updated_at?: string;
};

type DepartmentResponse = {
  department: DepartmentRow;
};

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

type QuestionStatusFilter = "all" | "active" | "inactive";
type SummaryIcon = ComponentType<SVGProps<SVGSVGElement>>;

const PAGE_SIZE = 10;

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const STATUS_FILTERS: Array<{ value: QuestionStatusFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "ใช้งานอยู่" },
  { value: "inactive", label: "ปิดใช้งาน" },
];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function isNoActiveSurveyMessage(message: string) {
  return message.toLowerCase().includes("no active survey");
}

function getQuestionTypeLabel(type: QuestionType) {
  return type === "rating" ? "ให้คะแนน 1-5" : "คำตอบแบบข้อความ";
}

function getQuestionTypeTone(type: QuestionType) {
  return type === "rating"
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function QuestionTypeBadge({ type }: { type: QuestionType }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getQuestionTypeTone(
        type,
      )}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${type === "rating" ? "bg-sky-500" : "bg-amber-500"}`}
      />
      {getQuestionTypeLabel(type)}
    </span>
  );
}

function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  return status === "active" ? (
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
  icon,
  title,
  value,
  sub,
  cardClass = "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
  iconClass = "from-sky-500 to-blue-600",
}: {
  icon: SummaryIcon;
  title: string;
  value: number | string;
  sub?: string;
  cardClass?: string;
  iconClass?: string;
}) {
  return (
    <OverviewCard
      icon={icon}
      title={title}
      value={value}
      sub={sub}
      cardClass={cardClass}
      iconClass={iconClass}
    />
  );
}

function LoadingSkeleton() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-4 animate-pulse">
        <div className="h-24 rounded-[24px] border border-white/70 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
        <div className="h-44 rounded-[28px] border border-white/70 bg-white/90 shadow-[0_24px_60px_rgba(37,99,235,0.08)]" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <div
              key={`summary-skeleton-${index}`}
              className="h-[112px] rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)]"
            />
          ))}
        </div>
        <div className="h-24 rounded-[28px] border border-white/70 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
        <div className="h-[520px] rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)]" />
      </div>
    </main>
  );
}

export default function AdminDepartmentQuestionDetailPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = use(params);
  const numericDepartmentId = Number(departmentId);

  const [department, setDepartment] = useState<DepartmentRow | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuestionStatusFilter>("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;

    if (!Number.isFinite(numericDepartmentId) || numericDepartmentId <= 0) {
      setLoading(false);
      setError("รหัสหน่วยงานไม่ถูกต้อง");
      return undefined;
    }

    (async () => {
      try {
        setLoading(true);
        setError("");
        setInfoMsg("");

        const deptRes = await apiGet<DepartmentResponse>(`/api/departments/${numericDepartmentId}`);
        if (!active) return;
        setDepartment(deptRes.department ?? null);

        const qRes = await apiGet<QuestionsResponse>(`/api/dashboard/questions/${numericDepartmentId}`);
        if (!active) return;

        const departmentQuestions = (qRes.items ?? []).filter(
          (question) =>
            question.scope === "department" ||
            (question.scope === "central" && question.is_selected),
        );
        setQuestions(departmentQuestions);
      } catch (fetchError: unknown) {
        if (!active) return;
        setDepartment(null);
        setQuestions([]);

        const message = getErrorMessage(fetchError, "โหลดข้อมูลหน่วยงานไม่สำเร็จ");
        if (isNoActiveSurveyMessage(message)) {
          setInfoMsg("ตอนนี้ยังไม่มีแบบสอบถามที่เปิดใช้งาน จึงยังไม่มีคำถามให้แสดง");
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
  }, [numericDepartmentId, reloadKey]);

  const orderedQuestions = useMemo(
    () => [
      ...questions.filter((question) => question.scope === "central"),
      ...questions.filter((question) => question.scope === "department"),
    ],
    [questions],
  );

  const questionNumberById = useMemo(() => {
    const counters: Record<QuestionScope, number> = {
      central: 0,
      department: 0,
    };
    const numbers = new Map<number, number>();

    for (const question of orderedQuestions) {
      counters[question.scope] += 1;
      numbers.set(question.id, counters[question.scope]);
    }

    return numbers;
  }, [orderedQuestions]);

  const visibleQuestions = useMemo(() => {
    let list = [...orderedQuestions];

    if (statusFilter === "active") {
      list = list.filter((question) => question.status === "active");
    } else if (statusFilter === "inactive") {
      list = list.filter((question) => question.status === "inactive");
    }

    const keyword = query.trim().toLowerCase();
    if (keyword) {
      list = list.filter((question) => {
        const text = question.text.toLowerCase();
        const order = String(question.display_order ?? "");
        const type = getQuestionTypeLabel(question.type).toLowerCase();
        return text.includes(keyword) || order.includes(keyword) || type.includes(keyword);
      });
    }

    return list;
  }, [orderedQuestions, query, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter]);

  const questionPages = useMemo(() => {
    const pages: Array<{ scope: QuestionScope; items: QuestionRow[] }> = [];

    for (const scope of ["central", "department"] as const) {
      const scopeQuestions = visibleQuestions.filter(
        (question) => question.scope === scope,
      );
      for (let index = 0; index < scopeQuestions.length; index += PAGE_SIZE) {
        pages.push({
          scope,
          items: scopeQuestions.slice(index, index + PAGE_SIZE),
        });
      }
    }

    return pages;
  }, [visibleQuestions]);

  const totalPages = Math.max(1, questionPages.length);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const currentQuestionPage = questionPages[safeCurrentPage - 1] ?? null;
  const paginatedQuestions = currentQuestionPage?.items ?? [];
  const currentQuestionTitle =
    currentQuestionPage?.scope === "central"
      ? "คำถามกลาง"
      : currentQuestionPage?.scope === "department"
        ? "คำถามหน่วยงาน"
        : null;

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const questionSummary = useMemo(() => {
    const total = questions.length;
    const active = questions.filter((question) => question.status === "active").length;

    return {
      total,
      active,
      inactive: total - active,
    };
  }, [questions]);

  if (loading && !department && !error) {
    return <LoadingSkeleton />;
  }

  const emptyMessage = query.trim()
    ? "ไม่พบคำถามที่ค้นหา"
    : infoMsg || "หน่วยงานนี้ยังไม่มีคำถามที่เลือกใช้ในแบบสอบถามที่ใช้งานอยู่";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-4">
        <Link
          href="/admin/questions/departments"
          className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-50"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปหน้ารายชื่อหน่วยงาน
        </Link>

        <section className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="relative z-10 flex items-start gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <ClipboardList className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sky-100/90">Administration</p>
                <h1 className="mt-1 text-2xl font-bold text-white">คำถามของหน่วยงาน</h1>
                <div className="mt-1 text-sm font-medium text-sky-100/90">
                  หน่วยงาน: {department?.name ?? "-"}
                </div>
                <div className="mt-4 h-1.5 w-20 rounded-full bg-white/25" />
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" />
              <span className="whitespace-pre-wrap">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              โหลดใหม่
            </button>
          </div>
        )}

        {infoMsg && !error && (
          <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            <span className="whitespace-pre-wrap">{infoMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiCard
            icon={ClipboardList}
            title="คำถามทั้งหมด"
            value={questionSummary.total}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass="from-sky-500 to-cyan-500"
          />
          <KpiCard
            icon={CheckCircle2}
            title="เปิดใช้งาน"
            value={questionSummary.active}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass="from-emerald-500 to-teal-500"
          />
          <KpiCard
            icon={CircleX}
            title="ปิดใช้งาน"
            value={questionSummary.inactive}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass="from-slate-500 to-slate-600"
          />
        </div>

        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                รายการคำถามที่ใช้ในหน่วยงาน {department?.name ?? "-"}
              </h2>
            </div>
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
              {visibleQuestions.length.toLocaleString("th-TH")} รายการ
            </div>
          </div>

          <div className="grid gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-end">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ค้นหาคำถาม
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={`${inputClass} pl-9`}
                  placeholder="พิมพ์ข้อความคำถาม"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                สถานะ
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as QuestionStatusFilter)}
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

          {currentQuestionTitle ? (
            <div className="px-5 py-3 text-sm font-normal text-slate-900 sm:px-6">
              {currentQuestionTitle}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-[13px]">
              <thead className="bg-gradient-to-r from-sky-600 via-blue-600 to-blue-700 text-white">
                <tr className="border-b border-blue-700/30">
                  <th className="w-[70px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                    ข้อ
                  </th>
                  <th className="min-w-[300px] border-r border-white/20 px-4 py-3.5 text-center text-sm font-bold">
                    คำถาม
                  </th>
                  <th className="w-[170px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                    รูปแบบ
                  </th>
                  <th className="w-[130px] px-3 py-3.5 text-center text-sm font-bold">
                    สถานะ
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedQuestions.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-slate-500" colSpan={4}>
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  paginatedQuestions.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-sky-100 transition last:border-b-0 hover:bg-sky-50/50"
                        >
                          <td className="border-r border-sky-100 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                            {questionNumberById.get(row.id) ?? row.display_order ?? 1}
                          </td>
                          <td className="border-r border-sky-100 px-4 py-3.5 text-slate-900">
                            <div className="text-sm font-normal leading-5">{row.text}</div>
                            {row.has_answers && (
                              <div className="mt-1 text-[11px] font-medium leading-4 text-amber-700">
                                มีข้อมูลการประเมินแล้ว{" "}
                                {row.answer_count.toLocaleString("th-TH")}
                                {" รายการ จากแบบประเมิน"}
                              </div>
                            )}
                          </td>
                          <td className="border-r border-sky-100 px-3 py-3.5 text-center">
                            <QuestionTypeBadge type={row.type} />
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <QuestionStatusBadge status={row.status} />
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
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
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
