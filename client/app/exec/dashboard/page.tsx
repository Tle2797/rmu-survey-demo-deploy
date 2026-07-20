"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import {
  Building2,
  CircleAlert,
  Clock3,
  Gauge,
  LineChart,
  MessageSquareText,
  PieChart,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import OverviewCard from "@/app/components/overview-card";
import { apiGet } from "@/lib/api";

type RatingBand = {
  id: number;
  min_value: number | string;
  max_value: number | string;
  label_th: string;
  sort_order: number;
};

type DepartmentSnapshot = {
  id: number;
  name: string;
  total_responses: number;
  avg_rating: number | null;
};

type NoDataDepartment = DepartmentSnapshot & {
  issue_code: "no_data";
};

type RecentResponse = {
  id: number;
  respondent_group: string;
  submitted_at: string;
  department_name: string;
  survey_title: string;
};

type Stats = {
  active_survey: {
    count: number;
    title: string | null;
    year_be: number | null;
    titles: string[];
  };
  responses: {
    total: number;
    student: number;
    staff: number;
    public: number;
    avg_rating: number | null;
    today: number;
  };
  coverage: {
    active_departments: number;
    departments_with_responses: number;
    departments_without_responses: number;
    low_response_departments: number;
    low_response_threshold: number;
  };
  recent_responses: RecentResponse[];
  no_data_departments: NoDataDepartment[];
  daily_trend: Array<{ day: string; count: number }>;
  rating_bands: RatingBand[];
};

type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

const groupColors = {
  student: "#0ea5e9",
  staff: "#10b981",
  public: "#2563eb",
} as const;

const groupLabel: Record<string, string> = {
  student: "นักศึกษา",
  staff: "บุคลากร",
  public: "บุคคลทั่วไป",
};

const groupDotClass: Record<string, string> = {
  student: "bg-sky-500",
  staff: "bg-emerald-500",
  public: "bg-blue-500",
};

const toNumLoose = (value: unknown): number => {
  if (value === null || value === undefined) return Number.NaN;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

function resolveLabel(avg: number | null, bands: RatingBand[]): string {
  if (!avg || !Number.isFinite(avg) || bands.length === 0) return "ยังไม่มีข้อมูล";
  const value = Number(Math.max(0, Math.min(5, avg)).toFixed(1));
  const ordered = [...bands].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const found = ordered.find((band) => {
    const min = toNumLoose(band.min_value);
    const max = toNumLoose(band.max_value);
    return Number.isFinite(min) && Number.isFinite(max) && value >= min && value <= max;
  });
  if (found) return found.label_th;
  return ordered.find((band) => value <= toNumLoose(band.max_value))?.label_th ?? "ไม่ทราบเกณฑ์";
}

function formatSurveyLabel(activeSurvey: Stats["active_survey"]) {
  if (activeSurvey.count <= 0) return "ยังไม่มีแบบประเมินที่เปิดอยู่";
  if (activeSurvey.count === 1 && activeSurvey.title) {
    return activeSurvey.year_be ? `${activeSurvey.title} (ปี ${activeSurvey.year_be})` : activeSurvey.title;
  }
  return `มีแบบประเมินที่เปิดอยู่ ${activeSurvey.count} ชุด`;
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

function formatTime(iso: string): string {
  try {
    const value = new Date(iso);
    return value.toLocaleString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: KpiIcon;
  label: string;
  value: string;
  sub?: string;
  iconClass: string;
}) {
  return (
    <OverviewCard icon={icon} title={label} value={value} sub={sub} iconClass={iconClass} />
  );
}

export default function ExecDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshed, setRefreshed] = useState<Date | null>(null);
  const [showNoDataDialog, setShowNoDataDialog] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet<Stats>("/api/exec/dashboard/stats");
      setStats(data);
      setRefreshed(new Date());
    } catch (errorValue: unknown) {
      setError(errorValue instanceof Error ? errorValue.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="relative z-10 mx-auto max-w-7xl space-y-4 animate-pulse">
          <div className="h-44 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />)}</div>
          <div className="grid gap-4 md:grid-cols-2"><div className="h-64 rounded-2xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" /><div className="h-64 rounded-2xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" /></div>
        </div>
      </main>
    );
  }

  if (error || !stats) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="relative z-10 mx-auto max-w-7xl rounded-3xl border border-sky-100/80 bg-white/90 p-8 text-center shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
          <CircleAlert className="mx-auto mb-3 h-12 w-12 text-rose-600" />
          <p className="font-medium text-red-600">{error || "ไม่สามารถโหลดข้อมูลได้"}</p>
          <button onClick={load} className="mt-4 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 text-sm text-white">ลองใหม่</button>
        </div>
      </main>
    );
  }

  const {
    active_survey,
    responses,
    coverage,
    recent_responses,
    no_data_departments,
    daily_trend,
    rating_bands,
  } = stats;
  const avgRating = responses.avg_rating ? Number(responses.avg_rating) : null;
  const overallLabel = resolveLabel(avgRating, rating_bands);
  const maxTrend = Math.max(...daily_trend.map((item) => item.count), 1);
  const totalResponses = Math.max(responses.total, 1);
  const noDataPreview = no_data_departments.slice(0, 5);
  const respondentSegments = [
    { label: "นักศึกษา", value: responses.student, color: groupColors.student },
    { label: "บุคลากร", value: responses.staff, color: groupColors.staff },
    { label: "บุคคลทั่วไป", value: responses.public, color: groupColors.public },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-sky-50/90">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                {formatSurveyLabel(active_survey)}
              </div>
              <h1 className="mt-3 text-2xl font-bold">แดชบอร์ดภาพรวมสำหรับผู้บริหาร</h1>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20">
                <RefreshCw className="h-4 w-4" />
                รีเฟรช
              </button>
              {refreshed ? <span className="text-xs text-sky-100/80">อัปเดตล่าสุด: {refreshed.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</span> : null}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center"><div className="text-3xl font-bold">{responses.today.toLocaleString("th-TH")}</div><div className="mt-0.5 text-xs text-sky-100/80">ผู้ตอบวันนี้</div></div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center"><div className="text-3xl font-bold">{responses.total.toLocaleString("th-TH")}</div><div className="mt-0.5 text-xs text-sky-100/80">ผู้ตอบสะสม</div></div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center"><div className="text-3xl font-bold">{avgRating ? avgRating.toFixed(2) : "-"}</div><div className="mt-0.5 text-xs text-sky-100/80">{avgRating ? `ผลการประเมิน: ${overallLabel}` : "ยังไม่มีคะแนนเฉลี่ย"}</div></div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center"><div className="text-3xl font-bold">{coverage.departments_with_responses}</div><div className="mt-0.5 text-xs text-sky-100/80">หน่วยงานที่มีข้อมูล</div></div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Gauge} label="คะแนนเฉลี่ยรวม" value={avgRating ? avgRating.toFixed(2) : "-"} iconClass="from-sky-500 to-cyan-500" />
          <KpiCard icon={MessageSquareText} label="ผลการประเมิน" value={avgRating !== null ? overallLabel : "ยังไม่มีข้อมูล"} iconClass="from-blue-500 to-indigo-500" />
          <KpiCard icon={Building2} label="หน่วยงานที่มีข้อมูล" value={String(coverage.departments_with_responses)} iconClass="from-emerald-500 to-teal-500" />
          <KpiCard icon={ShieldAlert} label="หน่วยงานยังไม่มีข้อมูล" value={String(coverage.departments_without_responses)} iconClass="from-amber-500 to-orange-500" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_10px_22px_rgba(37,99,235,0.18)]">
                <LineChart className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-slate-900">แนวโน้มจำนวนผู้ตอบ 7 วันล่าสุด</h2>
            </div>
            <div className="mt-5 flex h-72 items-end gap-3 rounded-2xl border border-sky-100/80 bg-gradient-to-b from-sky-50/70 to-white px-4 pb-4 pt-6">
              {daily_trend.map((item, index) => (
                <div key={item.day} className="flex flex-1 flex-col items-center">
                  <div className="mb-2 text-xs font-semibold text-slate-700">{item.count.toLocaleString("th-TH")}</div>
                  <div className="flex h-52 w-full items-end justify-center">
                    <div className={`w-full max-w-10 rounded-t-xl bg-gradient-to-t ${index === daily_trend.length - 1 ? "from-sky-600 to-blue-500" : "from-sky-400 to-sky-300"}`} style={{ height: `${Math.max(16, (item.count / maxTrend) * 160)}px` }} />
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
                      <span className="font-semibold text-slate-900">{segment.value.toLocaleString("th-TH")} คน</span>
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
            {recent_responses.length === 0 ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-8 text-center text-sm text-slate-400">
                ยังไม่มีข้อมูล
              </div>
            ) : (
              <div className="space-y-2">
                {recent_responses.map((response) => (
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
                        {response.department_name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                        <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">
                          {groupLabel[response.respondent_group] ?? response.respondent_group}
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-[0_10px_22px_rgba(244,63,94,0.18)]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">หน่วยงานที่ยังไม่มีข้อมูล</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    ทั้งหมด {no_data_departments.length.toLocaleString("th-TH")} หน่วยงาน
                  </p>
                </div>
              </div>
              {no_data_departments.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowNoDataDialog(true)}
                  className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 focus:outline-none focus:ring-4 focus:ring-sky-100"
                >
                  ดูทั้งหมด
                </button>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {noDataPreview.length === 0 ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-8 text-center text-sm text-slate-400">
                  ทุกหน่วยงานมีข้อมูลแล้ว
                </div>
              ) : (
                noDataPreview.map((department) => (
                  <div
                    key={department.id}
                    className="rounded-2xl border border-sky-100 bg-gradient-to-r from-white to-sky-50/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {department.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">ยังไม่มีผู้ตอบ</div>
                      </div>
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                        ยังไม่มีข้อมูล
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

      </div>
      {showNoDataDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-data-dialog-title"
          onClick={() => setShowNoDataDialog(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-sky-100 px-5 py-4">
              <div>
                <h3 id="no-data-dialog-title" className="text-lg font-bold text-slate-900">
                  หน่วยงานที่ยังไม่มีข้อมูล
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  พบทั้งหมด {no_data_departments.length.toLocaleString("th-TH")} หน่วยงาน
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNoDataDialog(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-sky-50 hover:text-slate-900"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                {no_data_departments.map((department, index) => (
                  <div
                    key={department.id}
                    className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2.5"
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-sky-700">
                      {index + 1}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                      {department.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
