"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  BadgeCheck,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  LineChart,
  MessageSquare,
  PieChart,
  RefreshCw,
  Users,
} from "lucide-react";
import OverviewCard from "@/app/components/overview-card";
import { apiGet } from "@/lib/api";

type KPI = {
  total: number;
  student: number;
  staff: number;
  public: number;
};

type RatingRow = {
  question_id: number;
  question_text: string;
  question_type: "rating" | "text";
  n: number;
  avg: number | string | null;
  sd: number | string | null;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  r5: number;
};

type RatingBand = {
  id: number;
  min_value: number | string;
  max_value: number | string;
  label_th: string;
  sort_order: number;
};

type RecentResponse = {
  id: number;
  respondent_group: "student" | "staff" | "public";
  submitted_at: string;
};

type SummaryResponse = {
  survey: { id: number; year_be: number; title: string };
  rating_bands: RatingBand[];
  kpi: KPI;
  ratings: RatingRow[];
  recent_responses: RecentResponse[];
  daily_trend: Array<{ day: string; count: number }>;
};

type DepartmentResponse = {
  id: number;
  name: string;
};

type CommentItem = {
  answer_id: number;
  question_id: number;
  question_text: string;
  respondent_group: "student" | "staff" | "public";
  comment: string;
  submitted_at: string;
};

type CommentsResponse = {
  total: number;
  limit: number;
  offset: number;
  items: CommentItem[];
};

type IconType = ComponentType<{ className?: string }>;

const COMMENTS_PAGE_SIZE = 10;

const groupLabel: Record<"student" | "staff" | "public", string> = {
  student: "นักศึกษา",
  staff: "บุคลากร",
  public: "บุคคลทั่วไป",
};

const groupColors = {
  student: "#0ea5e9",
  staff: "#10b981",
  public: "#2563eb",
} as const;

const groupDotClass: Record<"student" | "staff" | "public", string> = {
  student: "bg-sky-500",
  staff: "bg-emerald-500",
  public: "bg-blue-500",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

const toNum = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNumLoose = (value: unknown): number => {
  if (value === null || value === undefined) return Number.NaN;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

function formatThaiDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayLabel(iso: string) {
  try {
    const value =
      /^\d{4}-\d{2}-\d{2}$/.test(iso)
        ? new Date(`${iso}T12:00:00+07:00`)
        : new Date(iso);

    return value.toLocaleDateString("th-TH", {
      weekday: "short",
      timeZone: "Asia/Bangkok",
    });
  } catch {
    return iso;
  }
}

function resolveOverallLabel(avg: number | null, bands: RatingBand[]) {
  if (!avg || !Number.isFinite(avg) || bands.length === 0) return "ยังไม่มีข้อมูล";
  const clamped = Math.max(0, Math.min(5, avg));
  const value = Number(clamped.toFixed(1));

  const ordered = [...bands].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const found = ordered.find((band) => {
    const min = toNumLoose(band.min_value);
    const max = toNumLoose(band.max_value);
    return Number.isFinite(min) && Number.isFinite(max) && value >= min && value <= max;
  });

  if (found) return found.label_th;

  const byMax = [...ordered].sort((a, b) => toNumLoose(a.max_value) - toNumLoose(b.max_value));
  return byMax.find((band) => value <= toNumLoose(band.max_value))?.label_th ?? "ไม่ทราบเกณฑ์";
}

function StatCard({
  icon,
  label,
  value,
  sub,
  cardClass = "border-slate-200/80 bg-white/95",
  iconClass = "from-sky-500 to-blue-600",
}: {
  icon: IconType;
  label: string;
  value: string | number;
  sub?: string;
  cardClass?: string;
  iconClass?: string;
  valueClass?: string;
}) {
  return (
    <OverviewCard
      icon={icon}
      title={label}
      value={value}
      sub={sub}
      cardClass={cardClass}
      iconClass={iconClass}
    />
  );
}

const DEPT_THEME_ICONS = {
  primary: "from-sky-500 to-cyan-500",
  success: "from-emerald-500 to-teal-500",
} as const;

function LoadingSkeleton() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -left-24 top-[-5rem] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-5 animate-pulse">
        <div className="h-36 rounded-[30px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)]" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <div
              key={`top-skeleton-${index}`}
              className="h-[108px] rounded-[24px] border border-white/70 bg-white/90 shadow-[0_14px_30px_rgba(37,99,235,0.07)]"
            />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, index) => (
            <div
              key={`mid-skeleton-${index}`}
              className="h-[320px] rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)]"
            />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, index) => (
            <div
              key={`bottom-skeleton-${index}`}
              className="h-[320px] rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)]"
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function ErrorState({
  message,
  onRetry,
  title = "แดชบอร์ดหน่วยงาน",
}: {
  message: string;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -left-24 top-[-5rem] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-3xl items-center justify-center">
        <section className="w-full rounded-[28px] border border-white/70 bg-white/90 p-8 text-center shadow-[0_18px_45px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <CircleAlert className="mx-auto h-12 w-12 text-rose-500" />
          <h1 className="mt-4 text-2xl font-black text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">ไม่สามารถโหลดข้อมูลได้: {message}</p>
          <p className="mt-2 text-sm text-slate-500">
            โปรดตรวจสอบว่า backend ทำงานอยู่ และมีแบบสอบถามที่เปิดใช้งาน
          </p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-3 font-semibold text-white shadow-[0_16px_35px_rgba(37,99,235,0.22)] transition hover:from-sky-500 hover:to-blue-500"
          >
            <RefreshCw className="h-4 w-4" />
            ลองใหม่
          </button>
        </section>
      </div>
    </main>
  );
}

export default function DepartmentDashboardPage() {
  const title = "แดชบอร์ดหน่วยงาน";
  const HeaderIcon = BarChart3;
  const commentsBasePath = "/dashboard/department";
  const errorTitle = title;
  const params = useParams<{ departmentId: string }>();
  const searchParams = useSearchParams();

  const departmentParam = Array.isArray(params.departmentId)
    ? params.departmentId[0]
    : params.departmentId;
  const deptId = Number(departmentParam);

  const rawOffset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const limit = COMMENTS_PAGE_SIZE;
  const offset = Math.floor(rawOffset / COMMENTS_PAGE_SIZE) * COMMENTS_PAGE_SIZE;

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [comments, setComments] = useState<CommentsResponse | null>(null);
  const [dept, setDept] = useState<DepartmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;

    const loadData = async () => {
      if (!Number.isFinite(deptId)) {
        setErrorMsg("รหัสหน่วยงานไม่ถูกต้อง");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMsg("");
        setSummary(null);
        setComments(null);
        setDept(null);

        const [summaryRes, commentsRes] = await Promise.all([
          apiGet<SummaryResponse>(`/api/dashboard/department/${deptId}/summary`),
          apiGet<CommentsResponse>(
            `/api/dashboard/department/${deptId}/comments?limit=${limit}&offset=${offset}`,
          ),
        ]);

        if (!alive) return;

        setSummary(summaryRes);
        setComments(commentsRes);

        try {
          const rawDept = await apiGet<{ department: DepartmentResponse } | DepartmentResponse>(
            `/api/departments/${deptId}`,
          );

          if (!alive) return;

          if (rawDept && "department" in rawDept && rawDept.department?.name) {
            setDept(rawDept.department);
          } else if (rawDept && "name" in rawDept && rawDept.name) {
            setDept(rawDept as DepartmentResponse);
          }
        } catch {
          // ชื่อหน่วยงานเป็นข้อมูลเสริม ถ้าโหลดไม่ได้ยังแสดงแดชบอร์ดได้
        }
      } catch (error: unknown) {
        if (!alive) return;
        setErrorMsg(getErrorMessage(error, "ไม่สามารถโหลดข้อมูลได้"));
      } finally {
        if (alive) setLoading(false);
      }
    };

    void loadData();

    return () => {
      alive = false;
    };
  }, [deptId, limit, offset, reloadKey]);

  if (!Number.isFinite(deptId)) {
    return (
      <ErrorState
        message="รหัสหน่วยงานไม่ถูกต้อง"
        onRetry={() => setReloadKey((prev) => prev + 1)}
        title={errorTitle}
      />
    );
  }

  if (loading && !summary && !comments) {
    return <LoadingSkeleton />;
  }

  if (errorMsg) {
    return (
      <ErrorState
        message={errorMsg}
        onRetry={() => setReloadKey((prev) => prev + 1)}
        title={errorTitle}
      />
    );
  }

  const kpi = summary?.kpi ?? { total: 0, student: 0, staff: 0, public: 0 };
  const ratings = summary?.ratings ?? [];
  const recentResponses = summary?.recent_responses ?? [];
  const dailyTrend = summary?.daily_trend ?? [];
  const cm = comments ?? { total: 0, limit, offset, items: [] };

  const scoreRows = ratings.filter((row) => row.question_type === "rating");
  const totalN = scoreRows.reduce((acc, row) => acc + toNum(row.n), 0);
  const overallAvg =
    totalN > 0
      ? scoreRows.reduce((acc, row) => acc + toNum(row.avg) * toNum(row.n), 0) / totalN
      : null;
  const bands = summary?.rating_bands ?? [];
  const overallLabel = resolveOverallLabel(overallAvg, bands);
  const totalResponses = Math.max(kpi.total, 1);
  const maxTrend = Math.max(...dailyTrend.map((item) => item.count), 1);
  const respondentSegments = [
    { label: "นักศึกษา", value: kpi.student, color: groupColors.student },
    { label: "บุคลากร", value: kpi.staff, color: groupColors.staff },
    { label: "บุคคลทั่วไป", value: kpi.public, color: groupColors.public },
  ];

  const prevOffset = Math.max(offset - limit, 0);
  const nextOffset = offset + limit;
  const hasPrev = offset > 0;
  const hasNext = nextOffset < cm.total;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -left-24 top-[-5rem] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-5">
        <section className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <HeaderIcon className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="mt-1 text-2xl font-bold text-white">{title}</h1>
                <p className="mt-1 text-sm text-sky-100/90">
                  หน่วยงาน: {dept?.name || `หน่วยงาน #${deptId}`}
                </p>
                <h1 className="hidden">
                  {title} : {dept?.name || `หน่วยงาน #${deptId}`}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-sky-100/90">
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sky-100 backdrop-blur-md">
                    {summary?.survey.title ?? "แบบสอบถามที่เปิดใช้งาน"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                    ปี พ.ศ. {summary?.survey.year_be ?? "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={BarChart3}
            label="คะแนนเฉลี่ยรวม"
            value={overallAvg !== null ? overallAvg.toFixed(2) : "-"}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={DEPT_THEME_ICONS.primary}
            valueClass="text-3xl tabular-nums"
          />
          <StatCard
            icon={BadgeCheck}
            label="ผลการประเมิน"
            value={overallLabel}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={DEPT_THEME_ICONS.success}
            valueClass="text-lg"
          />
          <StatCard
            icon={Users}
            label="จำนวนผู้ประเมิน"
            value={kpi.total.toLocaleString("th-TH")}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={DEPT_THEME_ICONS.primary}
            valueClass="text-3xl tabular-nums"
          />
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_10px_22px_rgba(37,99,235,0.18)]">
                <LineChart className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-slate-900">แนวโน้มจำนวนผู้ตอบ 7 วันล่าสุด</h2>
            </div>
            <div className="mt-5 flex h-72 items-end gap-3 rounded-2xl border border-sky-100/80 bg-gradient-to-b from-sky-50/70 to-white px-4 pb-4 pt-6">
              {dailyTrend.map((item, index) => (
                <div key={item.day} className="flex flex-1 flex-col items-center">
                  <div className="mb-2 text-xs font-semibold text-slate-700">
                    {item.count.toLocaleString("th-TH")}
                  </div>
                  <div className="flex h-52 w-full items-end justify-center">
                    <div
                      className={`w-full max-w-10 rounded-t-xl bg-gradient-to-t ${
                        index === dailyTrend.length - 1 ? "from-sky-600 to-blue-500" : "from-sky-400 to-sky-300"
                      }`}
                      style={{ height: `${Math.max(16, (item.count / maxTrend) * 160)}px` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{formatDayLabel(item.day)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-500 text-white shadow-[0_10px_22px_rgba(14,165,233,0.18)]">
                <PieChart className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-slate-900">สัดส่วนผู้ตอบตามกลุ่ม</h2>
            </div>
            <div className="mt-5 space-y-3">
              {respondentSegments.map((segment) => {
                const pct = (segment.value / totalResponses) * 100;
                return (
                  <div key={segment.label} className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                        <span className="text-slate-700">{segment.label}</span>
                      </div>
                      <span className="font-semibold text-slate-900">
                        {segment.value.toLocaleString("th-TH")} คน
                      </span>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                      <div className="h-3 rounded-full" style={{ width: `${pct}%`, backgroundColor: segment.color }} />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{pct.toFixed(1)}% ของผู้ตอบทั้งหมด</div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-[0_10px_22px_rgba(37,99,235,0.18)]">
                <Clock3 className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-slate-900">การตอบแบบสอบถามล่าสุด</h2>
            </div>
            {recentResponses.length === 0 ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-8 text-center text-sm text-slate-400">
                ยังไม่มีข้อมูล
              </div>
            ) : (
              <div className="space-y-2">
                {recentResponses.map((response) => (
                  <div
                    key={response.id}
                    className="flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-sky-50/80"
                  >
                    <div
                      className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                        groupDotClass[response.respondent_group] ?? "bg-slate-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">
                        ผู้ตอบจาก{groupLabel[response.respondent_group]}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                        <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">
                          {groupLabel[response.respondent_group]}
                        </span>
                        <span>•</span>
                        <span>{formatTime(response.submitted_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 text-white shadow-[0_10px_22px_rgba(37,99,235,0.18)]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h2 className="font-bold text-slate-900">ความคิดเห็นล่าสุด</h2>
              </div>
              <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                ทั้งหมด {cm.total.toLocaleString("th-TH")} รายการ
              </span>
            </div>
            {cm.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 p-8 text-center text-slate-500">
                ยังไม่มีความคิดเห็นสำหรับหน่วยงานนี้
              </div>
            ) : (
              <div className="space-y-3">
                {cm.items.map((item) => (
                  <article
                    key={item.answer_id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_20px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(15,23,42,0.06)]"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium leading-6 text-slate-900">
                          {item.comment}
                        </div>
                        {item.question_text && item.question_text !== item.comment ? (
                          <div className="mt-1 text-xs leading-5 text-slate-500">
                            คำถาม: {item.question_text}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-sm font-medium text-slate-500">
                        {formatThaiDate(item.submitted_at)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {cm.total > cm.items.length ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="text-xs text-slate-500">
                  แสดง {cm.items.length.toLocaleString("th-TH")} จากทั้งหมด {cm.total.toLocaleString("th-TH")} รายการ
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    aria-disabled={!hasPrev}
                    href={`${commentsBasePath}/${deptId}?limit=${limit}&offset=${prevOffset}`}
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      hasPrev
                        ? "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                        : "pointer-events-none border-slate-100 bg-slate-100 text-slate-400"
                    }`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    ก่อนหน้า
                  </Link>
                  <Link
                    aria-disabled={!hasNext}
                    href={`${commentsBasePath}/${deptId}?limit=${limit}&offset=${nextOffset}`}
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      hasNext
                        ? "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                        : "pointer-events-none border-slate-100 bg-slate-100 text-slate-400"
                    }`}
                  >
                    ถัดไป
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
