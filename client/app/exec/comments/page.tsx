"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { apiGet } from "@/lib/api";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileSpreadsheet,
  Gauge,
  MessageSquareText,
  MessagesSquare,
  Quote,
  Search,
  Star,
  Users,
} from "lucide-react";

const PAGE_SIZE = 10;

type RatingBand = {
  id: number;
  min_value: number;
  max_value: number;
  label_th: string;
  sort_order: number;
};

type CommentItem = {
  answer_id: number;
  question_id: number;
  question_text?: string | null;
  respondent_group?: "student" | "staff" | "public";
  comment: string;
  submitted_at: string;
};

type DepartmentItem = {
  department_id: number;
  department_name: string;
  total_responses: number;
  total_comments: number;
  avg_rating: number | null;
  comments: CommentItem[];
};

type ExecCommentsResponse = {
  survey: {
    id: number;
    title: string;
    year_be: number;
  } | null;
  rating_bands: RatingBand[];
  departments: DepartmentItem[];
};

function formatScore(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : "-";
}

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH");
}

function formatThaiDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBand(score: number | null | undefined, bands: RatingBand[]) {
  if (!score || bands.length === 0) {
    return {
      label: "ยังไม่มีข้อมูล",
      badgeClass: "border-slate-200 bg-slate-100 text-slate-500",
      cardClass: "border-slate-200 bg-slate-50/80",
      iconClass: "bg-slate-100 text-slate-500",
    };
  }

  const ordered = [...bands].sort((a, b) => a.sort_order - b.sort_order);
  const band = ordered.find(
    (item) => score >= item.min_value && score <= item.max_value,
  );

  if (!band) {
    return {
      label: "ไม่ทราบเกณฑ์",
      badgeClass: "border-slate-200 bg-slate-100 text-slate-500",
      cardClass: "border-slate-200 bg-slate-50/80",
      iconClass: "bg-slate-100 text-slate-500",
    };
  }

  const pct = band.sort_order / (ordered.at(-1)?.sort_order || 1);
  if (pct >= 0.75) {
    return {
      label: band.label_th,
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      cardClass: "border-emerald-200 bg-emerald-50/70",
      iconClass: "bg-emerald-100 text-emerald-700",
    };
  }
  if (pct >= 0.5) {
    return {
      label: band.label_th,
      badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
      cardClass: "border-blue-200 bg-blue-50/70",
      iconClass: "bg-blue-100 text-blue-700",
    };
  }
  if (pct >= 0.25) {
    return {
      label: band.label_th,
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      cardClass: "border-amber-200 bg-amber-50/70",
      iconClass: "bg-amber-100 text-amber-700",
    };
  }
  return {
    label: band.label_th,
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    cardClass: "border-rose-200 bg-rose-50/70",
    iconClass: "bg-rose-100 text-rose-700",
  };
}

function StatCard({
  icon: Icon,
  title,
  value,
  sub,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="text-2xl font-black tracking-tight text-slate-900">
            {value}
          </div>
          {sub ? (
            <div className="mt-1 text-xs text-slate-500">{sub}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DepartmentMetricCard({
  icon: Icon,
  title,
  value,
  sub,
  cardClass,
  iconClass,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  sub?: string;
  cardClass: string;
  iconClass: string;
}) {
  return (
    <div className={`rounded-[22px] border p-4 shadow-sm ${cardClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-700">{title}</div>
          <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            {value}
          </div>
          {sub ? (
            <div className="mt-1 text-xs text-slate-500">{sub}</div>
          ) : null}
        </div>
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  right,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(37,99,235,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        </div>
        {right}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export default function ExecCommentsPage() {
  const [data, setData] = useState<ExecCommentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [expandedDepartments, setExpandedDepartments] = useState<
    Record<number, boolean>
  >({});

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await apiGet<ExecCommentsResponse>("/api/exec/comments");
        if (!alive) return;
        setData(res);
      } catch (e: unknown) {
        if (!alive) return;
        setError(
          e instanceof Error ? e.message : "ไม่สามารถโหลดข้อมูลความคิดเห็นได้",
        );
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const departments = useMemo(() => data?.departments ?? [], [data?.departments]);
  const filteredDepartments = useMemo(() => {
    const keyword = departmentSearch.trim().toLowerCase();
    if (!keyword) return departments;

    return departments.filter((department) =>
      department.department_name.toLowerCase().includes(keyword),
    );
  }, [departmentSearch, departments]);
  const totalPages = Math.max(1, Math.ceil(filteredDepartments.length / PAGE_SIZE));
  const paginatedDepartments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredDepartments.slice(start, start + PAGE_SIZE);
  }, [filteredDepartments, page]);

  const totalComments = useMemo(
    () => departments.reduce((sum, item) => sum + item.total_comments, 0),
    [departments],
  );
  const departmentsWithComments = useMemo(
    () => departments.filter((item) => item.total_comments > 0).length,
    [departments],
  );

  const toggleComments = (departmentId: number) => {
    setExpandedDepartments((prev) => ({
      ...prev,
      [departmentId]: !prev[departmentId],
    }));
  };

  useEffect(() => {
    setPage(1);
    setExpandedDepartments({});
  }, [departmentSearch, departments.length]);

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="mx-auto max-w-7xl rounded-[28px] border border-sky-100/80 bg-white/90 p-20 text-center text-slate-500 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
          กำลังเตรียมข้อมูลความคิดเห็น...
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-md">
              <MessagesSquare className="h-7 w-7" />
            </div>
            <div>
              <h1 className="mt-1 text-2xl font-bold">ดูความคิดเห็นหน่วยงาน</h1>
              <p className="mt-1 text-sm text-sky-100/90">
                ดูความคิดเห็นทั้งหมดของทุกหน่วยงาน
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-sky-100">
                  {data?.survey?.title ?? "ยังไม่มีแบบประเมินที่มีข้อมูล"}
                </div>
                <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-sky-100">
                  {data?.survey?.year_be
                    ? `ปี พ.ศ. ${data.survey.year_be}`
                    : "ไม่มีข้อมูลปี"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={Building2}
            title="หน่วยงานทั้งหมด"
            value={formatCount(departments.length)}
            tone="from-sky-500 to-cyan-500"
          />
          <StatCard
            icon={MessageSquareText}
            title="ความคิดเห็นทั้งหมด"
            value={formatCount(totalComments)}
            tone="from-blue-500 to-indigo-500"
          />
          <StatCard
            icon={Users}
            title="หน่วยงานที่มีความคิดเห็น"
            value={formatCount(departmentsWithComments)}
            tone="from-emerald-500 to-teal-500"
          />
        </div>

        <Section
          icon={FileSpreadsheet}
          title="ความคิดเห็นหน่วยงาน"
          right={
            <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              แสดง {formatCount(filteredDepartments.length)} จากทั้งหมด {formatCount(departments.length)} หน่วยงาน
            </span>
          }
        >
          <div className="space-y-5">
            <div className="rounded-[22px] border border-sky-100 bg-sky-50/50 p-4">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                ค้นหาตามชื่อหน่วยงาน
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={departmentSearch}
                  onChange={(event) => setDepartmentSearch(event.target.value)}
                  placeholder="พิมพ์ชื่อหน่วยงานที่ต้องการค้นหา"
                  className="w-full rounded-2xl border border-sky-100 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>
            </div>

            {paginatedDepartments.map((department, index) => {
              const band = getBand(
                department.avg_rating,
                data?.rating_bands ?? [],
              );
              const isExpanded =
                expandedDepartments[department.department_id] === true;
              const hasComments = department.comments.length > 0;

              return (
                <article
                  key={department.department_id}
                  className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(37,99,235,0.08)] transition hover:border-sky-200 hover:shadow-[0_20px_48px_rgba(37,99,235,0.12)]"
                >
                  <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-sky-50/50 px-5 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-base font-black text-white shadow-[0_10px_24px_rgba(37,99,235,0.18)]">
                            {(page - 1) * PAGE_SIZE + index + 1}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-xl font-black tracking-tight text-slate-900">
                              {department.department_name}
                            </h3>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${band.badgeClass}`}
                        >
                          {band.label}
                        </span>
                        {hasComments ? (
                          <button
                            type="button"
                            onClick={() =>
                              toggleComments(department.department_id)
                            }
                            className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.18)] transition ${
                              isExpanded
                                ? "bg-gradient-to-r from-slate-700 to-slate-800 hover:brightness-110"
                                : "bg-gradient-to-r from-sky-500 to-blue-600 hover:brightness-110"
                            }`}
                          >
                            {isExpanded ? "ซ่อนความคิดเห็น" : "ดูความคิดเห็น"}
                          </button>
                        ) : (
                          <span className="inline-flex rounded-full border border-dashed border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
                            ยังไม่มีความคิดเห็น
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <DepartmentMetricCard
                        icon={Users}
                        title="ผู้ตอบ"
                        value={formatCount(department.total_responses)}
                        cardClass="border-sky-200 bg-sky-50/80"
                        iconClass="bg-sky-100 text-sky-700"
                      />
                      <DepartmentMetricCard
                        icon={MessageSquareText}
                        title="ความคิดเห็น"
                        value={formatCount(department.total_comments)}
                        cardClass="border-blue-200 bg-blue-50/80"
                        iconClass="bg-blue-100 text-blue-700"
                      />
                      <DepartmentMetricCard
                        icon={Gauge}
                        title="คะแนนเฉลี่ย"
                        value={formatScore(department.avg_rating)}
                        cardClass="border-amber-200 bg-amber-50/80"
                        iconClass="bg-amber-100 text-amber-700"
                      />
                      <DepartmentMetricCard
                        icon={Star}
                        title="ผลการประเมิน"
                        value={band.label}
                        cardClass={band.cardClass}
                        iconClass={band.iconClass}
                      />
                    </div>
                  </div>

                  <div className="px-5 py-5">
                    {!hasComments ? (
                      <div className="rounded-[22px] border border-dashed border-sky-200 bg-gradient-to-r from-sky-50 to-white p-6 text-center text-sm text-slate-500">
                        ยังไม่มีความคิดเห็นสำหรับหน่วยงานนี้
                      </div>
                    ) : !isExpanded ? (
                      <div className="rounded-[22px] border border-dashed border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6 text-center text-sm text-slate-500">
                        กดปุ่มดูความคิดเห็นเพื่อแสดงรายละเอียดของหน่วยงานนี้
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {department.comments.map((item) => (
                          <div
                            key={item.answer_id}
                            className="rounded-[22px] border border-slate-200 bg-gradient-to-r from-white to-slate-50/70 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-blue-100 text-sky-700 shadow-sm">
                                    <Quote className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm leading-7 text-slate-800">
                                      {item.comment}
                                    </p>
                                    {item.question_text ? (
                                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                        <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-sky-700">
                                          {item.question_text}
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs font-medium text-slate-500">
                                {formatThaiDate(item.submitted_at)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}

            {departments.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-sky-200 bg-sky-50/40 p-8 text-center text-slate-500">
                ยังไม่มีข้อมูลความคิดเห็นในระบบ
              </div>
            ) : null}

            {departments.length > 0 && filteredDepartments.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-sky-200 bg-sky-50/40 p-8 text-center text-slate-500">
                ไม่พบหน่วยงานที่ตรงกับคำค้นหา
              </div>
            ) : null}

            {filteredDepartments.length > 0 ? (
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    ย้อนกลับ
                  </button>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                    หน้า {page} / {totalPages}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ถัดไป
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </Section>
      </div>
    </main>
  );
}
