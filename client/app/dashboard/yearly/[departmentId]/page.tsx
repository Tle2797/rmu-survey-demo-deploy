"use client";

import {
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { apiGet } from "@/lib/api";
import { useReactToPrint } from "react-to-print";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CircleAlert,
  GraduationCap,
  Printer,
  RefreshCw,
  TrendingUp,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";

type DrilldownView = "year" | "month" | "week" | "day";

type DrilldownSelection = {
  view: DrilldownView;
  year?: number;
  month?: number;
  weekStart?: string;
};

type PeriodRow = {
  key: string;
  label: string;
  detail_label: string | null;
  year_be: number | null;
  month: number | null;
  week_start: string | null;
  week_end: string | null;
  date: string | null;
  avg_rating: number | null;
  band_label: string | null;
  respondents_total: number;
  student: number;
  staff: number;
  public: number;
  has_data: boolean;
};

type YearlyDrilldownResponse = {
  department: { id: number; name: string };
  view: DrilldownView;
  title: string;
  chart_title: string;
  summary_title: string;
  period_label: string;
  period_count_label: string;
  from: number;
  to: number;
  selected_year: number | null;
  selected_month: number | null;
  selected_week_start: string | null;
  periods_with_data: number;
  respondents_total: number;
  student: number;
  staff: number;
  public: number;
  overall_avg: number | null;
  overall_band: string | null;
  rows: PeriodRow[];
};

type IconType = ComponentType<{ className?: string }>;

type TooltipPayload = {
  payload?: PeriodRow;
};

const VIEW_UNIT: Record<DrilldownView, string> = {
  year: "ปี",
  month: "เดือน",
  week: "สัปดาห์",
  day: "วัน",
};

const BACK_LABEL: Partial<Record<DrilldownView, string>> = {
  month: "ย้อนกลับไปรายปี",
  week: "ย้อนกลับไปรายเดือน",
  day: "ย้อนกลับไปรายสัปดาห์",
};

const THEME = {
  primary: "from-sky-500 to-cyan-500",
  success: "from-emerald-500 to-teal-500",
  neutral: "from-slate-500 to-slate-600",
  accent: "from-blue-600 to-indigo-600",
} as const;

function getCurrentBEYear() {
  return new Date().getFullYear() + 543;
}

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

function parseScore(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatScore(value: number | null | undefined) {
  const parsed = parseScore(value);
  return parsed === null ? "-" : parsed.toFixed(2);
}

function formatScoreLabel(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "";
}

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH");
}

function parseISODateParts(value: string | null | undefined) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return {
    yearCE: year,
    yearBE: year + 543,
    month,
    day,
  };
}

function formatMonthLabel(month: number | null | undefined) {
  if (!month || month < 1 || month > 12) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
  }).format(new Date(Date.UTC(2026, month - 1, 1)));
}

function formatReportDateLabel(
  value: string | null | undefined,
  fallbackYearBE: number | null | undefined,
) {
  const dateParts = parseISODateParts(value);
  if (!dateParts) return value ?? "-";

  const yearBE = fallbackYearBE ?? dateParts.yearBE;
  return `วันที่ ${dateParts.day} เดือน ${formatMonthLabel(dateParts.month)} พ.ศ. ${yearBE}`;
}

function formatWeekLabel(
  weekStart: string | null | undefined,
  month: number | null | undefined,
  yearBE: number | null | undefined,
) {
  const dateParts = parseISODateParts(weekStart);
  if (!dateParts || !month) return "-";

  const weekNumber = Math.floor((dateParts.day - 1) / 7) + 1;
  const resolvedYearBE = yearBE ?? dateParts.yearBE;
  return `สัปดาห์ที่ ${weekNumber} เดือน ${formatMonthLabel(month)} พ.ศ. ${resolvedYearBE}`;
}

function formatPeriodChipLabel(
  data: YearlyDrilldownResponse | null,
  summarySource: PeriodRow | null,
  fromYear: number,
  toYear: number,
) {
  if (summarySource?.date) {
    return formatReportDateLabel(summarySource.date, summarySource.year_be);
  }

  if (summarySource?.week_start && summarySource.month) {
    return formatWeekLabel(
      summarySource.week_start,
      summarySource.month,
      summarySource.year_be,
    );
  }

  if (summarySource?.month && summarySource.year_be) {
    return `เดือน ${formatMonthLabel(summarySource.month)} พ.ศ. ${summarySource.year_be}`;
  }

  if (data?.view === "day" && data.selected_week_start && data.selected_month) {
    return formatWeekLabel(
      data.selected_week_start,
      data.selected_month,
      data.selected_year,
    );
  }

  if (data?.view === "week" && data.selected_month && data.selected_year) {
    return `เดือน ${formatMonthLabel(data.selected_month)} พ.ศ. ${data.selected_year}`;
  }

  if (data?.view === "month" && data.selected_year) {
    return `พ.ศ. ${data.selected_year}`;
  }

  return data?.period_label ?? `พ.ศ. ${fromYear} - ${toYear}`;
}

function buildYearlyUrl(departmentId: number, selection: DrilldownSelection, from: number, to: number) {
  const params = new URLSearchParams({ view: selection.view });

  if (selection.view === "year") {
    params.set("from", String(from));
    params.set("to", String(to));
  }

  if (selection.year !== undefined) params.set("year", String(selection.year));
  if (selection.month !== undefined) params.set("month", String(selection.month));
  if (selection.weekStart) params.set("weekStart", selection.weekStart);

  return `/api/dashboard/department/${departmentId}/yearly?${params.toString()}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  cardClass = "border-slate-200/80 bg-white/95",
  iconClass = THEME.primary,
  valueClass = "text-3xl tabular-nums",
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
    <div className={`rounded-[24px] border p-4 shadow-[0_14px_30px_rgba(37,99,235,0.07)] ${cardClass}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconClass} text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)] ring-1 ring-white/30`}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase text-slate-500">
            {label}
          </div>
          <div className={`mt-1 break-words font-black text-slate-900 ${valueClass}`}>
            {value}
          </div>
          {sub ? <div className="mt-1 text-xs leading-5 text-slate-500">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  right,
  className = "",
}: {
  title: string;
  icon: IconType;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)] backdrop-blur-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.18)]">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="min-w-0 text-lg font-black text-slate-900">{title}</h2>
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 sm:p-6 lg:p-8">
      <div className="relative z-10 mx-auto flex max-w-6xl animate-pulse flex-col gap-5">
        <div className="h-36 rounded-[30px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)]" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div
              key={`top-skeleton-${index}`}
              className="h-[108px] rounded-[24px] border border-white/70 bg-white/90 shadow-[0_14px_30px_rgba(37,99,235,0.07)]"
            />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <div
              key={`bottom-skeleton-${index}`}
              className="h-[108px] rounded-[24px] border border-white/70 bg-white/90 shadow-[0_14px_30px_rgba(37,99,235,0.07)]"
            />
          ))}
        </div>
        <div className="h-[500px] rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(37,99,235,0.08)]" />
      </div>
    </main>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 sm:p-6 lg:p-8">
      <div className="relative z-10 mx-auto flex max-w-3xl items-center justify-center">
        <section className="w-full rounded-[28px] border border-white/70 bg-white/90 p-8 text-center shadow-[0_18px_45px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <CircleAlert className="mx-auto h-12 w-12 text-rose-500" />
          <h1 className="mt-4 text-2xl font-black text-slate-900">สรุปผลการประเมินรายปี</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            ไม่สามารถโหลดข้อมูลได้: {message}
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

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
      <div className="text-sm font-bold text-slate-900">
        {row.detail_label ?? row.label}
      </div>
      {row.has_data ? (
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between gap-4">
            <span>คะแนนเฉลี่ย</span>
            <span className="font-bold text-slate-900">{formatScore(row.avg_rating)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>ผู้ตอบทั้งหมด</span>
            <span className="font-bold text-slate-900">{formatCount(row.respondents_total)} คน</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>นักศึกษา</span>
            <span className="font-bold text-slate-900">{formatCount(row.student)} คน</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>บุคลากร</span>
            <span className="font-bold text-slate-900">{formatCount(row.staff)} คน</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>บุคคลทั่วไป</span>
            <span className="font-bold text-slate-900">{formatCount(row.public)} คน</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>ผลการประเมิน</span>
            <span className="font-bold text-sky-700">{row.band_label ?? "-"}</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูลการประเมินในช่วงนี้</div>
      )}
    </div>
  );
}

function PrintBarChart({ rows }: { rows: PeriodRow[] }) {
  const width = 760;
  const height = 310;
  const margin = { top: 28, right: 18, bottom: 46, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const rowCount = Math.max(rows.length, 1);
  const bandWidth = plotWidth / rowCount;
  const barWidth = Math.min(46, Math.max(16, bandWidth * 0.42));
  const ticks = [1, 2, 3, 4, 5];

  const getY = (score: number) =>
    margin.top + plotHeight - (Math.max(0, Math.min(5, score)) / 5) * plotHeight;

  return (
    <div className="yearly-print-chart-svg hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="กราฟคะแนนเฉลี่ย"
        className="h-auto w-full"
      >
        <defs>
          <linearGradient id="departmentYearlyPrintBarFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
          <linearGradient id="departmentYearlyPrintActiveBarFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={y}
                y2={y}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text
                x={margin.left - 12}
                y={y + 4}
                fill="#64748b"
                fontSize="12"
                fontWeight="600"
                textAnchor="end"
              >
                {tick}
              </text>
            </g>
          );
        })}

        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={margin.top + plotHeight}
          y2={margin.top + plotHeight}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        <line
          x1={margin.left}
          x2={margin.left}
          y1={margin.top}
          y2={margin.top + plotHeight}
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {rows.map((row, index) => {
          const score = parseScore(row.avg_rating);
          const x = margin.left + bandWidth * index + bandWidth / 2;
          const barX = x - barWidth / 2;

          return (
            <g key={row.key}>
              {score !== null ? (
                <>
                  <rect
                    x={barX}
                    y={getY(score)}
                    width={barWidth}
                    height={margin.top + plotHeight - getY(score)}
                    rx="10"
                    ry="10"
                    fill="url(#departmentYearlyPrintBarFill)"
                  />
                  <text
                    x={x}
                    y={getY(score) - 8}
                    fill="#0f172a"
                    fontSize="12"
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {formatScore(score)}
                  </text>
                </>
              ) : null}
              <text
                x={x}
                y={height - 15}
                fill="#475569"
                fontSize="12"
                fontWeight="600"
                textAnchor="middle"
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function YearlyDashboardPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = use(params);
  const deptId = Number(departmentId);
  const currentBE = getCurrentBEYear();
  const fromYear = currentBE - 4;
  const toYear = currentBE;

  const [selection, setSelection] = useState<DrilldownSelection>({ view: "year" });
  const [history, setHistory] = useState<DrilldownSelection[]>([]);
  const [data, setData] = useState<YearlyDrilldownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [focusedRowKey, setFocusedRowKey] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!Number.isFinite(deptId) || deptId <= 0) {
        setError("รหัสหน่วยงานไม่ถูกต้อง");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const res = await apiGet<YearlyDrilldownResponse>(
          buildYearlyUrl(deptId, selection, fromYear, toYear),
        );

        if (!alive) return;
        setData(res);
      } catch (err: unknown) {
        if (!alive) return;
        setError(getErrorMessage(err, "โหลดข้อมูลไม่สำเร็จ"));
      } finally {
        if (alive) setLoading(false);
      }
    };

    void run();

    return () => {
      alive = false;
    };
  }, [
    deptId,
    fromYear,
    reloadKey,
    selection,
    toYear,
  ]);

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const focusedRow = useMemo(
    () => rows.find((row) => row.key === focusedRowKey) ?? null,
    [focusedRowKey, rows],
  );
  const summarySource = focusedRow ?? null;
  const hasChartRows = rows.length > 0;
  const hasChartData = rows.some((row) => row.avg_rating !== null);
  const periodUnit = data ? VIEW_UNIT[data.view] : "ปี";
  const selectedPeriodLabel = formatPeriodChipLabel(
    data,
    summarySource,
    fromYear,
    toYear,
  );

  const topStats = {
    avg: summarySource ? summarySource.avg_rating : data?.overall_avg ?? null,
    band: summarySource
      ? summarySource.band_label ?? "ยังไม่มีข้อมูล"
      : data?.overall_band ?? "ยังไม่มีข้อมูล",
    periodsWithData: summarySource
      ? summarySource.has_data
        ? 1
        : 0
      : data?.periods_with_data ?? 0,
    respondents: summarySource
      ? summarySource.respondents_total
      : data?.respondents_total ?? 0,
    student: summarySource ? summarySource.student : data?.student ?? 0,
    staff: summarySource ? summarySource.staff : data?.staff ?? 0,
    public: summarySource ? summarySource.public : data?.public ?? 0,
  };

  const printReport = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${data?.title ?? "สรุปผลการประเมินรายปี"}_${data?.department?.name ?? `department-${deptId}`}_${selectedPeriodLabel}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 6mm;
      }
      @media print {
        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        body {
          color-adjust: exact;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .yearly-print-page {
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: none !important;
          gap: 8px !important;
          background: #ffffff !important;
        }
        .yearly-print-hidden {
          display: none !important;
        }
        .yearly-print-page section {
          break-inside: avoid;
          page-break-inside: avoid;
          box-shadow: none !important;
        }
        .yearly-print-header {
          border-radius: 22px !important;
          padding: 14px 18px !important;
        }
        .yearly-print-header h1 {
          font-size: 22px !important;
          line-height: 1.2 !important;
        }
        .yearly-print-header .yearly-print-icon {
          width: 48px !important;
          height: 48px !important;
          border-radius: 14px !important;
        }
        .yearly-print-stat-grid {
          display: grid !important;
          gap: 8px !important;
        }
        .yearly-print-main-stats {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }
        .yearly-print-group-stats {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }
        .yearly-print-stat-grid > div {
          border-radius: 14px !important;
          padding: 10px !important;
          box-shadow: none !important;
        }
        .yearly-print-stat-grid > div > div {
          gap: 8px !important;
        }
        .yearly-print-stat-grid > div > div > div:first-child {
          width: 34px !important;
          height: 34px !important;
          border-radius: 11px !important;
        }
        .yearly-print-stat-grid svg {
          width: 16px !important;
          height: 16px !important;
        }
        .yearly-print-stat-grid [class*="text-3xl"],
        .yearly-print-stat-grid [class*="text-2xl"] {
          font-size: 20px !important;
          line-height: 1.2 !important;
        }
        .yearly-print-chart {
          margin-top: 2px !important;
        }
        .yearly-print-chart > div:first-child,
        .yearly-print-summary > div:first-child {
          padding: 10px 14px !important;
        }
        .yearly-print-chart > div:first-child h2,
        .yearly-print-summary > div:first-child h2 {
          font-size: 14px !important;
        }
        .yearly-chart-shell {
          border-radius: 16px !important;
          padding: 10px !important;
        }
        .yearly-chart-box {
          height: 250px !important;
        }
        .yearly-web-chart {
          display: none !important;
        }
        .yearly-print-chart-svg {
          display: block !important;
        }
        .yearly-print-chart-svg svg {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
        }
        .yearly-print-page .recharts-responsive-container {
          min-height: 250px !important;
        }
        .yearly-print-summary {
          break-before: page;
          page-break-before: always;
        }
        .yearly-print-summary-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 10px !important;
        }
        .yearly-print-summary-grid button {
          break-inside: avoid;
          page-break-inside: avoid;
          box-shadow: none !important;
        }
      }
    `,
  });

  const goToSelection = (nextSelection: DrilldownSelection) => {
    setHistory((prev) => [...prev, selection]);
    setFocusedRowKey(null);
    setSelection(nextSelection);
  };

  const goBack = () => {
    const previous = history[history.length - 1];
    if (!previous) return;

    setHistory((prev) => prev.slice(0, -1));
    setFocusedRowKey(null);
    setSelection(previous);
  };

  const handlePeriodClick = (row: PeriodRow) => {
    if (data?.view === "year" && row.year_be) {
      goToSelection({ view: "month", year: row.year_be });
      return;
    }

    if (data?.view === "month" && row.year_be && row.month) {
      goToSelection({ view: "week", year: row.year_be, month: row.month });
      return;
    }

    if (data?.view === "week" && row.year_be && row.month && row.week_start) {
      goToSelection({
        view: "day",
        year: row.year_be,
        month: row.month,
        weekStart: row.week_start,
      });
      return;
    }

    if (data?.view === "day") {
      setFocusedRowKey((current) => (current === row.key ? null : row.key));
    }
  };

  if (!Number.isFinite(deptId) || deptId <= 0) {
    return (
      <ErrorState
        message="รหัสหน่วยงานไม่ถูกต้อง"
        onRetry={() => setReloadKey((prev) => prev + 1)}
      />
    );
  }

  if (loading && !data) {
    return <LoadingSkeleton />;
  }

  if (error && !data) {
    return (
      <ErrorState
        message={error}
        onRetry={() => setReloadKey((prev) => prev + 1)}
      />
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div
        ref={printRef}
        className="yearly-print-page relative z-10 mx-auto flex max-w-6xl flex-col gap-5"
      >
        <section className="yearly-print-header relative overflow-hidden rounded-[32px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-6 py-7 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)] sm:px-8">
          <div className="relative z-10 flex items-start gap-4 sm:gap-5">
            <div className="yearly-print-icon flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
              <BarChart3 className="h-8 w-8" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="mt-1 text-2xl font-bold text-white sm:text-[2rem]">
                {data?.title ?? "สรุปผลการประเมินรายปี"}
              </h1>
              <p className="mt-1 text-sm text-sky-100/90">
                หน่วยงาน: {data?.department?.name || `หน่วยงาน #${deptId}`}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-sky-100 backdrop-blur-md sm:text-sm">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {selectedPeriodLabel}
                </span>
                {focusedRow ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-200/50 bg-emerald-300/20 px-3 py-1.5 text-xs font-semibold text-white sm:text-sm">
                    กำลังดูเฉพาะช่วงที่เลือก
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <section className="yearly-print-stat-grid yearly-print-main-stats grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={BarChart3}
            label="คะแนนเฉลี่ยรวม"
            value={formatScore(topStats.avg)}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={THEME.primary}
          />
          <StatCard
            icon={BadgeCheck}
            label="ผลการประเมิน"
            value={topStats.band}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={THEME.success}
            valueClass="text-lg"
          />
          <StatCard
            icon={CalendarDays}
            label={focusedRow ? "ช่วงที่เลือกมีข้อมูล" : data?.period_count_label ?? "จำนวนปีที่มีข้อมูล"}
            value={`${formatCount(topStats.periodsWithData)} ${periodUnit}`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={THEME.accent}
            valueClass="text-2xl"
          />
          <StatCard
            icon={Users}
            label="ผู้ตอบทั้งหมด"
            value={`${formatCount(topStats.respondents)} คน`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={THEME.primary}
            valueClass="text-2xl"
          />
        </section>

        <section className="yearly-print-stat-grid yearly-print-group-stats grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={GraduationCap}
            label="นักศึกษา"
            value={`${formatCount(topStats.student)} คน`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={THEME.primary}
            valueClass="text-2xl"
          />
          <StatCard
            icon={UserRound}
            label="บุคลากร"
            value={`${formatCount(topStats.staff)} คน`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={THEME.success}
            valueClass="text-2xl"
          />
          <StatCard
            icon={UsersRound}
            label="บุคคลทั่วไป"
            value={`${formatCount(topStats.public)} คน`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={THEME.neutral}
            valueClass="text-2xl"
          />
        </section>

        <div className="yearly-print-hidden flex justify-end">
          <button
            type="button"
            onClick={() => void printReport()}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-sky-500 hover:to-blue-500"
          >
            <Printer className="h-4 w-4" />
            ส่งออก PDF
          </button>
        </div>

        <SectionCard
          title={data?.chart_title ?? "กราฟคะแนนเฉลี่ย 5 ปีล่าสุด"}
          icon={TrendingUp}
          className="yearly-print-chart"
          right={
            history.length > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="yearly-print-hidden inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
              >
                <ArrowLeft className="h-4 w-4" />
                {BACK_LABEL[data?.view ?? "year"] ?? "ย้อนกลับ"}
              </button>
            ) : null
          }
        >
          <div className="yearly-chart-shell rounded-[26px] border border-sky-100/80 bg-gradient-to-b from-[#f5f9ff] via-white to-white p-4 shadow-[0_16px_35px_rgba(37,99,235,0.06)] sm:p-5">
            <div className="yearly-print-hidden mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">
                คลิกแท่งกราฟเพื่อดูข้อมูลระดับถัดไป
              </span>
              {data?.view === "day" ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                  คลิกวันเพื่อกรอง KPI เฉพาะวันนั้น
                </span>
              ) : null}
            </div>

            {hasChartRows ? (
              <>
                <PrintBarChart rows={rows} />
                <div className="yearly-web-chart yearly-chart-box h-[360px] sm:h-[410px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rows}
                    margin={{ top: 34, right: 10, bottom: 10, left: 12 }}
                    barCategoryGap={data?.view === "month" ? "16%" : "28%"}
                  >
                    <defs>
                      <linearGradient id="departmentYearlyBarFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.98} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.92} />
                      </linearGradient>
                      <linearGradient id="departmentYearlyBarActiveFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.98} />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity={0.92} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      stroke="#cbd5e1"
                      strokeOpacity={0.9}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine
                      stroke="#cbd5e1"
                      tickMargin={12}
                      interval={0}
                      tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                    />
                    <YAxis
                      width={28}
                      axisLine
                      tickLine={false}
                      stroke="#cbd5e1"
                      domain={[0, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "#e0f2fe", fillOpacity: 0.5 }}
                    />
                    <Bar
                      dataKey="avg_rating"
                      radius={[14, 14, 0, 0]}
                      barSize={data?.view === "month" ? 34 : 44}
                      activeBar={false}
                      onClick={(entry) => {
                        const row = (entry as { payload?: PeriodRow }).payload;
                        if (row) handlePeriodClick(row);
                      }}
                    >
                      {rows.map((row) => (
                        <Cell
                          key={row.key}
                          fill={
                            focusedRowKey === row.key
                              ? "url(#departmentYearlyBarActiveFill)"
                              : row.has_data
                                ? "url(#departmentYearlyBarFill)"
                                : "#cbd5e1"
                          }
                          stroke="none"
                          cursor="pointer"
                        />
                      ))}
                      <LabelList
                        dataKey="avg_rating"
                        position="top"
                        formatter={formatScoreLabel}
                        fill="#0f172a"
                        fontSize={12}
                        fontWeight={800}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="flex h-[340px] items-center justify-center rounded-[22px] border border-dashed border-sky-200 bg-sky-50/40 text-center text-sm text-slate-500">
                ยังไม่มีช่วงข้อมูลสำหรับแสดงกราฟ
              </div>
            )}

            {!hasChartData && hasChartRows ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-500">
                ยังไม่มีข้อมูลคะแนนเฉลี่ยในช่วงนี้
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title={data?.summary_title ?? "สรุปข้อมูลรายปี"}
          icon={BadgeCheck}
          className="yearly-print-summary"
          right={
            focusedRow ? (
              <button
                type="button"
                onClick={() => setFocusedRowKey(null)}
                className="yearly-print-hidden rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                แสดงภาพรวมทั้งหมด
              </button>
            ) : null
          }
        >
          <div className="yearly-print-summary-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {rows.map((item) => {
              const isFocused = focusedRowKey === item.key;
              const cardTone = item.has_data
                ? "border-sky-100/80 bg-gradient-to-b from-white to-sky-50/60"
                : "border-slate-200/80 bg-white/90";

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handlePeriodClick(item)}
                  className={`rounded-[24px] border p-4 text-left shadow-[0_12px_28px_rgba(37,99,235,0.06)] transition hover:-translate-y-0.5 hover:border-sky-300 ${cardTone} ${
                    isFocused ? "ring-4 ring-emerald-100" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold uppercase text-slate-500">
                        {item.detail_label ?? item.label}
                      </div>
                      <div className="mt-2 text-3xl font-black text-slate-900 tabular-nums">
                        {formatScore(item.avg_rating)}
                      </div>
                    </div>
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)] ring-1 ring-white/30 ${
                        item.has_data
                          ? "bg-gradient-to-br from-sky-500 to-blue-600"
                          : "bg-gradient-to-br from-slate-400 to-slate-500"
                      }`}
                      aria-hidden="true"
                    >
                      <BarChart3 className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        item.has_data
                          ? "bg-sky-100 text-sky-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.has_data ? item.band_label ?? "-" : "ไม่มีข้อมูล"}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200/80">
                      ผู้ตอบ {formatCount(item.respondents_total)} คน
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
