"use client";

import {
  use,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { apiGet } from "@/lib/api";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
import {
  CalendarDays,
  CircleAlert,
  Download,
  FileSpreadsheet,
  Filter,
  Gauge,
  GraduationCap,
  Printer,
  Trophy,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";

type RatingBand = {
  id: number;
  min_value: number;
  max_value: number;
  label_th: string;
  sort_order: number;
};

type ReportView = "all" | "month" | "week" | "day";
type RespondentGroup = "student" | "staff" | "public";
type RespondentGroupFilter = "all" | RespondentGroup;

type ReportData = {
  survey?: {
    id: number;
    title: string | null;
    year_be: number | null;
  };
  department: {
    id: number;
    name: string;
  };
  summary: {
    total_responses: number;
    avg_rating: number;
    overall_sd: number | null;
    student_count: number;
    staff_count: number;
    public_count: number;
  };
  questions: {
    question_id: number;
    question_text: string;
    avg_rating: number | null;
    sd: number | null;
  }[];
  comments: {
    answer_id: number;
    question_id: number;
    question_text: string;
    question_scope: "central" | "department";
    respondent_group: RespondentGroup;
    comment: string;
    submitted_at: string;
  }[];
  rating_bands: RatingBand[];
  filters: {
    time_slots?: {
      id: number;
      title: string;
      start_date: string;
      end_date: string;
    }[];
    surveys: {
      id: number;
      title: string | null;
      year_be: number | null;
      response_count: number;
    }[];
    years: number[];
    months: number[];
    weeks: {
      week_index?: number;
      week_start: string;
      week_end: string;
    }[];
    days: string[];
    respondent_groups: {
      value: RespondentGroup;
      count: number;
    }[];
    selected: {
      survey_id: number;
      year_be: number | null;
      view: ReportView;
      month: number | null;
      week_start: string | null;
      date: string | null;
      respondent_group: RespondentGroup | null;
    };
  };
};

type ReportFilters = {
  surveyId: string;
  month: string;
  weekStart: string;
  date: string;
  respondentGroup: RespondentGroupFilter;
};

const RESPONDENT_GROUP_OPTIONS: {
  value: RespondentGroupFilter;
  label: string;
}[] = [
  { value: "all", label: "ทุกกลุ่มประเมิน" },
  { value: "student", label: "นักศึกษา" },
  { value: "staff", label: "บุคลากร" },
  { value: "public", label: "บุคคลทั่วไป" },
];

const RESPONDENT_GROUP_SUMMARIES: {
  value: RespondentGroup;
  label: string;
  summaryKey: "student_count" | "staff_count" | "public_count";
  icon: ComponentType<{ className?: string }>;
  tone: string;
}[] = [
  {
    value: "student",
    label: "นักศึกษา",
    summaryKey: "student_count",
    icon: GraduationCap,
    tone: "from-sky-500 to-cyan-500",
  },
  {
    value: "staff",
    label: "บุคลากร",
    summaryKey: "staff_count",
    icon: UserRound,
    tone: "from-emerald-500 to-teal-500",
  },
  {
    value: "public",
    label: "บุคคลทั่วไป",
    summaryKey: "public_count",
    icon: UsersRound,
    tone: "from-slate-500 to-slate-700",
  },
];

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH");
}

function formatScore(value: number | null | undefined) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue.toFixed(2)
    : "-";
}

function formatSurveyTitle(
  survey: ReportData["survey"] | { title: string | null } | null | undefined,
) {
  return survey?.title?.trim() || "ไม่พบชื่อแบบประเมิน";
}

function formatSurveyOption(survey: {
  title: string | null;
  year_be: number | null;
}) {
  const title = formatSurveyTitle(survey);
  const yearLabel = survey.year_be ? `ปี พ.ศ. ${survey.year_be}` : "ไม่ระบุปี";
  return `${title} / ${yearLabel}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
  }).format(date);
}

function formatISOThaiDate(value: string | null | undefined) {
  if (!value) return "-";

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
  }).format(new Date(Date.UTC(year, month - 1, day)));
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

function formatRespondentGroupLabel(
  group: RespondentGroupFilter | null | undefined,
) {
  if (group === "student") return "นักศึกษา";
  if (group === "staff") return "บุคลากร";
  if (group === "public") return "บุคคลทั่วไป";
  return "ทุกกลุ่มประเมิน";
}

function formatWeekOptionLabel(
  week: { week_index?: number; week_start: string; week_end: string },
  index: number,
) {
  const weekNumber = week.week_index ?? index + 1;
  return `สัปดาห์ที่ ${weekNumber}`;
}

function formatQuestionScopeLabel(scope: "central" | "department") {
  return scope === "central"
    ? "คำถามส่วนกลาง"
    : "คำถามหน่วยงาน";
}

function getWeekIndexFromDateText(value: string | null | undefined) {
  const dateParts = parseISODateParts(value);
  if (!dateParts) return null;
  return Math.floor((dateParts.day - 1) / 7) + 1;
}

function formatFallbackWeekLabel(weekStart: string) {
  const weekIndex = getWeekIndexFromDateText(weekStart);
  return weekIndex ? `สัปดาห์ที่ ${weekIndex}` : weekStart;
}

function buildNoDataMessage(
  periodLabel: string,
  respondentGroupLabel: string,
  respondentGroup: RespondentGroupFilter,
) {
  const periodText =
    periodLabel && periodLabel !== "-"
      ? `ในช่วงเวลาที่ท่านเลือก (${periodLabel})`
      : "ในช่วงเวลาที่ท่านเลือก";

  if (respondentGroup !== "all") {
    return `ขณะนี้ไม่มีข้อมูล${periodText} สำหรับกลุ่มผู้ประเมิน ${respondentGroupLabel}`;
  }

  return `ขณะนี้ไม่มีข้อมูล${periodText}`;
}

function findSelectedWeek(data: ReportData | null) {
  const selectedWeekStart = data?.filters?.selected?.week_start;
  if (!data || !selectedWeekStart) return null;
  return (
    data.filters.weeks.find((week) => week.week_start === selectedWeekStart) ??
    null
  );
}

function getSelectedMonthLabel(data: ReportData | null) {
  const month = data?.filters?.selected?.month;
  return month ? formatMonthLabel(month) : "ทุกเดือน";
}

function getSelectedWeekLabel(data: ReportData | null) {
  const selectedWeek = findSelectedWeek(data);
  if (selectedWeek && data) {
    const weekIndex = data.filters.weeks.findIndex(
      (week) => week.week_start === selectedWeek.week_start,
    );
    return weekIndex >= 0
      ? formatWeekOptionLabel(selectedWeek, weekIndex)
      : `สัปดาห์ที่ ${selectedWeek.week_index ?? 1}`;
  }

  const weekStart = data?.filters?.selected?.week_start;
  const weekDateParts = parseISODateParts(weekStart);
  if (weekDateParts) {
    return `สัปดาห์ที่ ${Math.floor((weekDateParts.day - 1) / 7) + 1}`;
  }
  return "ทุกสัปดาห์";
}

function formatReportDateLabel(
  value: string | null | undefined,
  fallbackYearBE: number | null | undefined,
) {
  const dateParts = parseISODateParts(value);
  if (!dateParts) return value ?? "-";

  const yearBE = fallbackYearBE ?? dateParts.yearBE;
  const monthLabel = formatMonthLabel(dateParts.month);
  return `วันที่ ${dateParts.day} เดือน ${monthLabel} พ.ศ. ${yearBE}`;
}

function getReportPeriodLabel(data: ReportData | null) {
  const selected = data?.filters?.selected;
  if (!selected) return "-";

  if (selected.date) {
    return formatReportDateLabel(selected.date, selected.year_be);
  }

  if (selected.week_start && selected.month) {
    const yearSuffix = selected.year_be ? ` พ.ศ. ${selected.year_be}` : "";
    return `${getSelectedWeekLabel(data)} เดือน ${getSelectedMonthLabel(data)}${yearSuffix}`;
  }

  if (selected.month) {
    const yearSuffix = selected.year_be ? ` พ.ศ. ${selected.year_be}` : "";
    return `เดือน ${getSelectedMonthLabel(data)}${yearSuffix}`;
  }

  if (selected.year_be) {
    return `ปี พ.ศ. ${selected.year_be}`;
  }

  return "ไม่ระบุปี";
}

function getPrintReportPeriodLabel(data: ReportData | null) {
  return getReportPeriodLabel(data);
}

function formatThaiFullDate(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getBand(score: number | null | undefined, bands: RatingBand[]) {
  if (!score || bands.length === 0) {
    return {
      label: "ไม่มีข้อมูล",
      tone: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  const sortedBands = [...bands].sort((a, b) => a.sort_order - b.sort_order);
  const band = sortedBands.find(
    (item) => Number(score) >= item.min_value && Number(score) <= item.max_value,
  );

  if (!band) {
    return {
      label: "ไม่ทราบเกณฑ์",
      tone: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  const percent = band.sort_order / (sortedBands.at(-1)?.sort_order || 1);
  if (percent >= 0.75) {
    return {
      label: band.label_th,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (percent >= 0.5) {
    return {
      label: band.label_th,
      tone: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }
  if (percent >= 0.25) {
    return {
      label: band.label_th,
      tone: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  return {
    label: band.label_th,
    tone: "border-rose-200 bg-rose-50 text-rose-700",
  };
}

function Kpi({
  icon: Icon,
  title,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
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
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="text-2xl font-black tracking-tight text-slate-900">
            {value}
          </div>
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

export default function DashboardReportsPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const resolvedParams = use(params);
  const departmentId = resolvedParams.departmentId;

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportFilters, setReportFilters] = useState<ReportFilters>({
    surveyId: "",
    month: "",
    weekStart: "",
    date: "",
    respondentGroup: "all",
  });
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");
        const params = new URLSearchParams();
        if (reportFilters.surveyId) params.set("surveyId", reportFilters.surveyId);
        if (reportFilters.month) params.set("month", reportFilters.month);
        if (reportFilters.weekStart) params.set("weekStart", reportFilters.weekStart);
        if (reportFilters.date) params.set("date", reportFilters.date);
        if (reportFilters.respondentGroup !== "all") {
          params.set("respondentGroup", reportFilters.respondentGroup);
        }

        const queryString = params.toString();
        const response = await apiGet<ReportData>(
          `/api/dashboard/department/${departmentId}/reports${queryString ? `?${queryString}` : ""}`,
        );
        setData(response);
      } catch (unknownError) {
        setError(
          unknownError instanceof Error
            ? unknownError.message
            : "ไม่สามารถโหลดข้อมูลรายงานผลการประเมินได้",
        );
      } finally {
        setLoading(false);
      }
    };

    if (departmentId) {
      void loadData();
    }
  }, [departmentId, reportFilters]);

  const surveyTitle = formatSurveyTitle(data?.survey);
  const scopeLabel = data?.survey?.year_be
    ? `รายงานปี พ.ศ. ${data.survey.year_be}`
    : "รายงานล่าสุด";
  const overallBand = getBand(
    data?.summary.avg_rating ?? 0,
    data?.rating_bands ?? [],
  );
  const departmentDisplayName =
    data?.department?.name ?? `หน่วยงาน #${departmentId}`;

  const selectedSurveyId =
    reportFilters.surveyId ||
    (data?.filters?.selected?.survey_id
      ? String(data.filters.selected.survey_id)
      : "");
  const selectedPeriodLabel = getReportPeriodLabel(data);
  const selectedPrintPeriodLabel = getPrintReportPeriodLabel(data);
  const selectedGroup =
    data?.filters?.selected?.respondent_group ??
    (reportFilters.respondentGroup === "all"
      ? null
      : reportFilters.respondentGroup);
  const selectedRespondentGroupLabel =
    formatRespondentGroupLabel(selectedGroup);
  const summaryRespondentGroupLabel = selectedGroup
    ? selectedRespondentGroupLabel
    : RESPONDENT_GROUP_OPTIONS.filter((option) => option.value !== "all")
        .map((option) => option.label)
        .join(", ");
  const availableSurveyOptions = data?.filters?.surveys ?? [];
  const surveyOptions =
    availableSurveyOptions.length > 0
      ? availableSurveyOptions
      : data?.survey
        ? [
            {
              id: data.survey.id,
              title: data.survey.title,
              year_be: data.survey.year_be,
              response_count: data.summary.total_responses,
            },
          ]
        : [];
  const monthOptions = data?.filters?.months ?? [];
  const weekOptions = reportFilters.month ? data?.filters?.weeks ?? [] : [];
  const dayOptions =
    reportFilters.month && reportFilters.weekStart ? data?.filters?.days ?? [] : [];
  const selectedMonthNumber = reportFilters.month
    ? Number(reportFilters.month)
    : null;
  const monthSelectionMissing =
    selectedMonthNumber !== null &&
    Number.isFinite(selectedMonthNumber) &&
    !monthOptions.includes(selectedMonthNumber);
  const monthSelectOptions = [
    ...(monthSelectionMissing && selectedMonthNumber !== null
      ? [
          {
            value: String(selectedMonthNumber),
            label: `${formatMonthLabel(selectedMonthNumber)} (ไม่มีข้อมูล)`,
          },
        ]
      : []),
    ...monthOptions.map((month) => ({
      value: String(month),
      label: formatMonthLabel(month),
    })),
  ];
  const weekSelectionMissing =
    Boolean(reportFilters.weekStart) &&
    !weekOptions.some((week) => week.week_start === reportFilters.weekStart);
  const weekSelectOptions = [
    ...(weekSelectionMissing && reportFilters.weekStart
      ? [
          {
            value: reportFilters.weekStart,
            label: `${formatFallbackWeekLabel(reportFilters.weekStart)} (ไม่มีข้อมูล)`,
          },
        ]
      : []),
    ...weekOptions.map((week, index) => ({
      value: week.week_start,
      label: formatWeekOptionLabel(week, index),
    })),
  ];
  const daySelectionMissing =
    Boolean(reportFilters.date) && !dayOptions.includes(reportFilters.date);
  const daySelectOptions = [
    ...(daySelectionMissing && reportFilters.date
      ? [
          {
            value: reportFilters.date,
            label: `${formatISOThaiDate(reportFilters.date)} (ไม่มีข้อมูล)`,
          },
        ]
      : []),
    ...dayOptions.map((date) => ({
      value: date,
      label: formatISOThaiDate(date),
    })),
  ];
  const hasNoDataForSelection = Boolean(
    data && data.summary.total_responses === 0,
  );
  const noDataMessage = buildNoDataMessage(
    selectedPeriodLabel,
    selectedRespondentGroupLabel,
    reportFilters.respondentGroup,
  );
  const visibleGroupSummaries = RESPONDENT_GROUP_SUMMARIES.filter((group) =>
    selectedGroup ? group.value === selectedGroup : true,
  ).map((group) => ({
    ...group,
    count: data?.summary[group.summaryKey] ?? 0,
  }));

  const printReport = useReactToPrint({
    contentRef: printRef,
    documentTitle: " ",
    pageStyle: `
      @page {
        size: A4;
        margin: 0;
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
        .report-print-page {
          box-sizing: border-box !important;
          width: 210mm !important;
          min-height: 297mm !important;
          padding: 15mm 12mm !important;
          background: #ffffff !important;
        }
      }
    `,
  });
  const exportExcel = () => {
    if (!data) return;

    const rows = [
      ["รายงานผลการประเมินหน่วยงาน"],
      ["หน่วยงาน", departmentDisplayName],
      ["แบบประเมิน", surveyTitle],
      ["ช่วงรายงาน", selectedPeriodLabel],
      ["กลุ่มผู้ทำแบบประเมิน", selectedRespondentGroupLabel],
      [],
      ["ข้อ", "คำถาม", "คะแนนเฉลี่ย", "ส่วนเบี่ยงเบนมาตรฐาน"],
      ...data.questions.map((item, index) => [
        index + 1,
        item.question_text,
        formatScore(item.avg_rating),
        item.sd === null ? "-" : item.sd.toFixed(2),
      ]),
    ];

    if (data.comments.length > 0) {
      rows.push([]);
      rows.push(["ความคิดเห็นจากผู้ประเมิน", "", "", "", ""]);
      rows.push(["ข้อ", "คำถาม", "ประเภทคำถาม", "ความคิดเห็น", "วันที่"]);
      rows.push(
        ...data.comments.map((item, index) => [
          index + 1,
          item.question_text,
          formatQuestionScopeLabel(item.question_scope),
          item.comment,
          formatDateTime(item.submitted_at),
        ]),
      );
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Department Reports");
    XLSX.writeFile(
      workbook,
      `รายงานผลการประเมิน_${departmentDisplayName}_${data.survey?.year_be ?? "latest"}.xlsx`,
    );
  };

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="mx-auto max-w-7xl rounded-[28px] border border-sky-100/80 bg-white/90 p-20 text-center text-slate-500 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
          กำลังเตรียมรายงาน...
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-md">
                <FileSpreadsheet className="h-7 w-7" />
              </div>
              <div className="min-w-0 max-w-3xl">
                <h1 className="mt-1 text-2xl font-bold text-white sm:text-[2rem]">
                  รายงานผลการประเมินของหน่วยงาน
                </h1>
                <p className="mt-1 text-sm text-sky-100/90">
                  หน่วยงาน: {departmentDisplayName}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-sky-100/90">
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sky-100 backdrop-blur-md">
                    {surveyTitle}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                    {scopeLabel}
                  </span>
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

        {data ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Kpi
                icon={Gauge}
                title="คะแนนเฉลี่ยภาพรวม"
                value={formatScore(data.summary.avg_rating)}
                tone="from-blue-500 to-indigo-500"
              />
              <Kpi
                icon={Trophy}
                title="ผลการประเมิน"
                value={overallBand.label}
                tone="from-emerald-500 to-teal-500"
              />
              <Kpi
                icon={Users}
                title="ผู้ตอบแบบประเมินรวม"
                value={formatCount(data.summary.total_responses)}
                tone="from-sky-500 to-cyan-500"
              />
              {visibleGroupSummaries.map((group) => (
                <Kpi
                  key={group.value}
                  icon={group.icon}
                  title={group.label}
                  value={`${formatCount(group.count)} คน`}
                  tone={group.tone}
                />
              ))}
            </div>

            <section className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500 text-white">
                    <Filter className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      ตัวกรองรายงาน
                    </h2>
                    <p className="text-sm text-slate-500">
                      เลือกข้อมูลจากแบบประเมิน เดือน สัปดาห์ วัน และกลุ่มผู้ทำแบบประเมิน
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setReportFilters({
                      surveyId: "",
                      month: "",
                      weekStart: "",
                      date: "",
                      respondentGroup: "all",
                    })
                  }
                  className="rounded-xl border border-transparent bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
                >
                  ล้างตัวกรอง
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <label className="text-sm font-semibold text-slate-700 xl:col-span-2">
                  เลือกแบบประเมิน / ปีที่มีข้อมูล
                  <select
                    value={selectedSurveyId}
                    onChange={(event) =>
                      setReportFilters((current) => ({
                        ...current,
                        surveyId: event.target.value,
                        month: "",
                        weekStart: "",
                        date: "",
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    {surveyOptions.map((survey) => (
                      <option key={survey.id} value={survey.id}>
                        {formatSurveyOption(survey)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  เลือกเดือน / เดือนที่มีข้อมูล
                  <select
                    value={reportFilters.month}
                    onChange={(event) =>
                      setReportFilters((current) => ({
                        ...current,
                        month: event.target.value,
                        weekStart: "",
                        date: "",
                      }))
                    }
                    disabled={!selectedSurveyId}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">
                      {selectedSurveyId ? "ทุกเดือน" : "เลือกแบบประเมินก่อน"}
                    </option>
                    {monthSelectOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  เลือกสัปดาห์ / สัปดาห์ที่มีข้อมูล
                  <select
                    value={reportFilters.weekStart}
                    onChange={(event) =>
                      setReportFilters((current) => ({
                        ...current,
                        weekStart: event.target.value,
                        date: "",
                      }))
                    }
                    disabled={!reportFilters.month}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">
                      {reportFilters.month ? "ทุกสัปดาห์" : "เลือกเดือนก่อน"}
                    </option>
                    {weekSelectOptions.map((week) => (
                      <option key={week.value} value={week.value}>
                        {week.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  เลือกวัน / วันที่มีข้อมูล
                  <select
                    value={reportFilters.date}
                    onChange={(event) =>
                      setReportFilters((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                    disabled={!reportFilters.month || !reportFilters.weekStart}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">
                      {reportFilters.month && reportFilters.weekStart
                        ? "ทุกวัน"
                        : "เลือกเดือนและสัปดาห์ก่อน"}
                    </option>
                    {daySelectOptions.map((date) => (
                      <option key={date.value} value={date.value}>
                        {date.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-slate-700 xl:col-span-2">
                  กลุ่มผู้ทำแบบประเมิน
                  <select
                    value={reportFilters.respondentGroup}
                    onChange={(event) =>
                      setReportFilters((current) => ({
                        ...current,
                        respondentGroup: event.target.value as RespondentGroupFilter,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    {RESPONDENT_GROUP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <span>ช่วงรายงาน: {selectedPeriodLabel}</span>
                <span className="text-slate-300">/</span>
                <span>กลุ่มผู้ทำแบบประเมิน: {selectedRespondentGroupLabel}</span>
              </div>

              {hasNoDataForSelection ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <div className="font-semibold">{noDataMessage}</div>
                  <div className="mt-1 text-amber-700">
                    โปรดตรวจสอบช่วงเวลาและกลุ่มผู้ประเมินที่เลือกอีกครั้ง
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {data ? (
          <Section
            icon={FileSpreadsheet}
            title="แบบฟอร์มรายงาน"
            right={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void printReport()}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-sky-500 hover:to-blue-500"
                >
                  <Printer className="h-4 w-4" />
                  ส่งออก PDF
                </button>
                <button
                  type="button"
                  onClick={exportExcel}
                  className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,185,129,0.16)] transition hover:bg-emerald-700"
                >
                  <Download className="h-4 w-4" />
                  ส่งออก Excel
                </button>
              </div>
            }
          >
            <div ref={printRef} className="report-print-page bg-white">
              <style>{`
                @media print {
                  @page { margin: 0; size: A4; }
                  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                  .report-tbl {
                    page-break-inside: auto;
                    break-inside: auto;
                  }
                  .report-tbl thead {
                    display: table-header-group;
                  }
                  .report-tbl tfoot {
                    display: table-footer-group;
                  }
                  .report-tbl tbody {
                    display: table-row-group;
                  }
                  .report-tbl tr,
                  .report-tbl td,
                  .report-tbl th {
                    page-break-inside: avoid;
                    break-inside: avoid;
                  }
                  .report-section-title {
                    page-break-after: avoid;
                    break-after: avoid-page;
                  }
                  .report-footer {
                    margin-top: 8px !important;
                    padding-top: 6px !important;
                    page-break-before: avoid !important;
                    break-before: avoid-page !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }
                }
                .report-tbl { border-collapse: collapse; width: 100%; }
                .report-tbl th, .report-tbl td { border: 1px solid #94a3b8; padding: 5px 10px; font-size: 13px; }
                .report-tbl th { background-color: #dbeafe; font-weight: 600; color: #1e3a5f; }
                .report-tbl td { color: #1e293b; }
                .report-section-title {
                  font-size: 13px; font-weight: 700; color: #1e293b;
                  margin-top: 16px; margin-bottom: 4px;
                }
              `}</style>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                  borderBottom: "2px solid #1e3a5f",
                  paddingBottom: "10px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logos/rmu.png"
                  alt="RMU"
                  style={{
                    width: "60px",
                    height: "60px",
                    objectFit: "contain",
                  }}
                />
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#1e3a5f",
                      lineHeight: 1.4,
                    }}
                  >
                    รายงานผลการประเมินความพึงพอใจ มหาวิทยาลัยราชภัฏมหาสารคาม
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#334155",
                      marginTop: "2px",
                    }}
                  >
                    {surveyTitle}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "8px", fontSize: "13px", color: "#1e293b" }}>
                <span style={{ fontWeight: 700 }}>หน่วยงาน :</span>{" "}
                {departmentDisplayName}
              </div>

              <div className="report-section-title" style={{ marginTop: "14px" }}>
                สรุปผลการประเมินความพึงพอใจ
              </div>
              <table className="report-tbl">
                <tbody>
                  <tr>
                    <td style={{ width: "50%" }}>
                      <span style={{ fontWeight: 600 }}>แบบประเมิน :</span>{" "}
                      {surveyTitle}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>ช่วงรายงาน :</span>{" "}
                      {selectedPrintPeriodLabel}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span style={{ fontWeight: 600 }}>คะแนนเฉลี่ย :</span>{" "}
                      <span style={{ fontWeight: 700 }}>
                        {formatScore(data.summary.avg_rating)}
                      </span>{" "}
                      คะแนน
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>ผลการประเมิน :</span>{" "}
                      <span style={{ fontWeight: 700 }}>
                        {overallBand.label}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span style={{ fontWeight: 600 }}>
                        จำนวนผู้ตอบแบบประเมิน :
                      </span>{" "}
                      {formatCount(data.summary.total_responses)} คน
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>
                        กลุ่มผู้ทำแบบประเมิน :
                      </span>{" "}
                      {summaryRespondentGroupLabel}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="report-section-title">
                ผลการประเมินจำแนกรายข้อคำถาม
              </div>
              <table className="report-tbl">
                <thead>
                  <tr>
                    <th style={{ width: "50px", textAlign: "center" }}>ข้อ</th>
                    <th style={{ textAlign: "center" }}>คำถาม</th>
                    <th style={{ width: "90px", textAlign: "center" }}>ค่าเฉลี่ย</th>
                    <th style={{ width: "140px", textAlign: "center" }}>
                      ส่วนเบี่ยงเบนมาตรฐาน
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.questions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          textAlign: "center",
                          padding: "24px 10px",
                          color: "#94a3b8",
                        }}
                      >
                        {hasNoDataForSelection
                          ? noDataMessage
                          : "ยังไม่มีข้อมูลการประเมินในรายงานนี้"}
                      </td>
                    </tr>
                  ) : (
                    data.questions.map((question, index) => (
                      <tr key={question.question_id}>
                        <td style={{ textAlign: "center" }}>{index + 1}</td>
                        <td>{question.question_text}</td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>
                          {formatScore(question.avg_rating)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {question.sd === null ? "-" : question.sd.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {data.comments.length > 0 && (
                <>
                  <div className="report-section-title">
                    ความคิดเห็นจากผู้ประเมิน
                  </div>
                  <table className="report-tbl">
                    <thead>
                      <tr>
                        <th style={{ width: "50px", textAlign: "center" }}>
                          ลำดับ
                        </th>
                        <th style={{ textAlign: "center" }}>คำถาม</th>
                        <th style={{ width: "130px", textAlign: "center" }}>
                          ประเภทคำถาม
                        </th>
                        <th style={{ textAlign: "center" }}>ความคิดเห็น</th>
                        <th style={{ width: "160px", textAlign: "center" }}>
                          วันที่
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comments.map((commentItem, index) => (
                        <tr key={commentItem.answer_id}>
                          <td style={{ textAlign: "center" }}>{index + 1}</td>
                          <td>{commentItem.question_text}</td>
                          <td style={{ textAlign: "center" }}>
                            {formatQuestionScopeLabel(commentItem.question_scope)}
                          </td>
                          <td>{commentItem.comment}</td>
                          <td style={{ textAlign: "center" }}>
                            {formatDateTime(commentItem.submitted_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <div
                className="report-footer"
                style={{
                  marginTop: "20px",
                  paddingTop: "8px",
                  borderTop: "1px solid #cbd5e1",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  fontSize: "11px",
                  color: "#64748b",
                }}
              >
                <span>
                  เอกสารนี้สร้างจากระบบประเมินความพึงพอใจของมหาวิทยาลัยราชภัฏมหาสารคาม
                </span>
                <span>ออกรายงาน ณ วันที่ {formatThaiFullDate(new Date())}</span>
              </div>
            </div>
          </Section>
        ) : null}
      </div>
    </main>
  );
}
