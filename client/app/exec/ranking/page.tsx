"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import { apiGet } from "@/lib/api";
import { usePathname } from "next/navigation";
import {
  buildExcelXmlWorkbook,
  downloadExcelFile,
  excelCell,
  sanitizeExcelFileName,
  spacerRow,
  type ExcelXmlRow,
} from "@/lib/excel-xml";
import { useReactToPrint } from "react-to-print";
import {
  Award,
  Building2,
  CalendarDays,
  CircleAlert,
  Download,
  Filter,
  ListOrdered,
  Printer,
  RefreshCw,
} from "lucide-react";

type RatingBand = {
  id: number;
  min_value: number;
  max_value: number;
  label_th: string;
  sort_order: number;
};

type RespondentGroup = "student" | "staff" | "public";

type DepartmentRank = {
  department_id: number;
  department_name: string;
  department_group_id: number;
  department_group_name: string;
  department_group_display_order: number;
  total_responses: number;
  avg_rating: number;
};

type RankingData = {
  survey: {
    id: number;
    title: string | null;
    year_be: number | null;
  };
  rankings: DepartmentRank[];
  university_avg: number;
  total_responses: number;
  rating_bands: RatingBand[];
  filters: {
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
    department_groups: {
      id: number;
      name: string;
      display_order: number;
    }[];
    selected: {
      survey_id: number;
      year_be: number | null;
      view: "all" | "month" | "week" | "day";
      month: number | null;
      week_start: string | null;
      date: string | null;
      respondent_group: RespondentGroup | null;
      department_group_id: number | null;
    };
  };
};

type RankingFilters = {
  surveyId: string;
  departmentGroupId: string;
  month: string;
  weekStart: string;
  date: string;
};

type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

const RANKING_THEMES = {
  total: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-sky-500 to-cyan-500",
  },
  scored: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-emerald-500 to-teal-500",
  },
  topScore: {
    cardClass:
      "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-amber-500 to-orange-500",
  },
} as const;

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
  survey: RankingData["survey"] | { title: string | null } | null | undefined,
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

function formatISOThaiDate(value: string | null | undefined) {
  if (!value) return "-";

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
  }).format(new Date(Date.UTC(year, month - 1, day)));
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

function getWeekIndexFromDateText(value: string | null | undefined) {
  const dateParts = parseISODateParts(value);
  if (!dateParts) return null;
  return Math.floor((dateParts.day - 1) / 7) + 1;
}

function formatWeekOptionLabel(
  week: { week_index?: number; week_start: string; week_end: string },
  index: number,
) {
  const weekNumber = week.week_index ?? index + 1;
  return `สัปดาห์ที่ ${weekNumber}`;
}

function formatFallbackWeekLabel(weekStart: string) {
  const weekIndex = getWeekIndexFromDateText(weekStart);
  return weekIndex ? `สัปดาห์ที่ ${weekIndex}` : weekStart;
}

function findSelectedWeek(data: RankingData | null) {
  const selectedWeekStart = data?.filters?.selected?.week_start;
  if (!data || !selectedWeekStart) return null;
  return (
    data.filters.weeks.find((week) => week.week_start === selectedWeekStart) ??
    null
  );
}

function getSelectedMonthLabel(data: RankingData | null) {
  const month = data?.filters?.selected?.month;
  return month ? formatMonthLabel(month) : "ทุกเดือน";
}

function getSelectedWeekLabel(data: RankingData | null) {
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

function getReportPeriodLabel(data: RankingData | null) {
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

function formatThaiFullDate(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getBand(score: number, bands: RatingBand[]) {
  if (!score || bands.length === 0) {
    return {
      label: "ไม่มีข้อมูล",
      colorClass: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  const sorted = [...bands].sort((a, b) => a.sort_order - b.sort_order);
  const maxOrder = sorted[sorted.length - 1]?.sort_order || 1;
  const band = sorted.find(
    (item) => score >= item.min_value && score <= item.max_value,
  );

  if (!band) {
    return {
      label: "ไม่ทราบเกณฑ์",
      colorClass: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  const pct = band.sort_order / maxOrder;
  if (pct >= 0.75) {
    return {
      label: band.label_th,
      colorClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (pct >= 0.5) {
    return {
      label: band.label_th,
      colorClass: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }
  if (pct >= 0.25) {
    return {
      label: band.label_th,
      colorClass: "border-yellow-200 bg-yellow-50 text-yellow-700",
    };
  }
  return {
    label: band.label_th,
    colorClass: "border-red-200 bg-red-50 text-red-700",
  };
}

function buildRankingExcelXml({
  data,
  rankings,
  ratingBands,
  surveyTitle,
  selectedPeriodLabel,
  selectedDepartmentGroupLabel,
  overallBandLabel,
  tableTitle,
}: {
  data: RankingData;
  rankings: DepartmentRank[];
  ratingBands: RatingBand[];
  surveyTitle: string;
  selectedPeriodLabel: string;
  selectedDepartmentGroupLabel: string;
  overallBandLabel: string;
  tableTitle: string;
}) {
  const groupsById = new Map<
    number,
    {
      id: number;
      name: string;
      displayOrder: number;
      departments: DepartmentRank[];
    }
  >();

  for (const department of rankings) {
    const groupId = Number(department.department_group_id);
    const group = groupsById.get(groupId);

    if (group) {
      group.departments.push(department);
    } else {
      groupsById.set(groupId, {
        id: groupId,
        name: department.department_group_name,
        displayOrder: Number(department.department_group_display_order),
        departments: [department],
      });
    }
  }

  const rankingGroups = Array.from(groupsById.values()).sort(
    (a, b) => a.displayOrder - b.displayOrder || a.id - b.id,
  );
  const rankingHeaderRow: ExcelXmlRow = {
    autoFitHeight: true,
    cells: [
      excelCell("อันดับ", "Header"),
      excelCell("หน่วยงาน", "Header"),
      excelCell("คะแนนเฉลี่ย", "Header"),
      excelCell("ผลประเมิน", "Header"),
    ],
  };

  const rows: ExcelXmlRow[] = [
    {
      height: 28,
      cells: [
        excelCell(`รายงาน${tableTitle}`, "Title", {
          mergeAcross: 3,
        }),
      ],
    },
    {
      cells: [
        excelCell("แบบประเมิน", "MetaLabel"),
        excelCell(surveyTitle, "MetaValue", { mergeAcross: 2 }),
      ],
    },
    {
      cells: [
        excelCell("ช่วงรายงาน", "MetaLabel"),
        excelCell(selectedPeriodLabel, "MetaValue", { mergeAcross: 2 }),
      ],
    },
    {
      cells: [
        excelCell("กลุ่มหน่วยงาน", "MetaLabel"),
        excelCell(selectedDepartmentGroupLabel, "MetaValue", { mergeAcross: 2 }),
      ],
    },
    {
      cells: [
        excelCell("คะแนนเฉลี่ยรวม", "MetaLabel"),
        excelCell(formatScore(data.university_avg), "MetaValue", {
          mergeAcross: 2,
        }),
      ],
    },
    {
      cells: [
        excelCell("ผลการประเมิน", "MetaLabel"),
        excelCell(overallBandLabel, "MetaValue", { mergeAcross: 2 }),
      ],
    },
    {
      cells: [
        excelCell("หน่วยงานทั้งหมด", "MetaLabel"),
        excelCell(rankings.length, "MetaValueLeft", {
          type: "Number",
          mergeAcross: 2,
        }),
      ],
    },
    spacerRow(4),
    ...(rankingGroups.length === 0
      ? [rankingHeaderRow]
      : rankingGroups.flatMap((group, groupIndex) => [
          {
            height: 22,
            autoFitHeight: true,
            cells: [excelCell(group.name, "Default", { mergeAcross: 3 })],
          },
          rankingHeaderRow,
          ...group.departments.map((department, index) => ({
            autoFitHeight: true,
            cells: [
              excelCell(index + 1, "CenterCell", { type: "Number" }),
              excelCell(department.department_name, "Cell"),
              excelCell(formatScore(department.avg_rating), "CenterCell"),
              excelCell(
                getBand(department.avg_rating, ratingBands).label,
                "CenterCell",
              ),
            ],
          })),
          ...(groupIndex < rankingGroups.length - 1
            ? [spacerRow(4, 8)]
            : []),
        ])),
  ];

  return buildExcelXmlWorkbook({
    documentTitle: tableTitle,
    sheets: [
      {
        name: tableTitle,
        columns: [150, 390, 120, 180],
        rows,
      },
    ],
  });
}

function KpiCard({
  icon: Icon,
  title,
  value,
  sub,
  cardClass,
  iconClass,
}: {
  icon: KpiIcon;
  title: string;
  value: string;
  sub?: string;
  cardClass: string;
  iconClass: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-5 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 ${cardClass}`}
    >
      <div className="relative flex items-start gap-4">
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconClass} text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/35`}
        >
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="text-2xl font-black leading-tight tracking-tight text-slate-900">
            {value}
          </div>
          {sub ? <div className="mt-0.5 text-xs text-slate-500">{sub}</div> : null}
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
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(37,99,235,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_10px_22px_rgba(245,158,11,0.22)]">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="font-bold text-slate-800">{title}</h2>
        </div>
        {right}
      </div>
      <div>{children}</div>
    </section>
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
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            />
          ))}
        </div>
        <div className="h-80 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
      </div>
    </main>
  );
}

export default function ExecRankingPage() {
  const pathname = usePathname();
  const isAdminView = pathname.startsWith("/admin/");
  const tableTitle = isAdminView
    ? "ตารางผลการประเมินหน่วยงาน"
    : "ตารางจัดอันดับหน่วยงาน";
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rankingFilters, setRankingFilters] = useState<RankingFilters>({
    surveyId: "",
    departmentGroupId: "",
    month: "",
    weekStart: "",
    date: "",
  });
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        if (rankingFilters.surveyId) params.set("surveyId", rankingFilters.surveyId);
        if (rankingFilters.month) params.set("month", rankingFilters.month);
        if (rankingFilters.weekStart) {
          params.set("weekStart", rankingFilters.weekStart);
        }
        if (rankingFilters.date) params.set("date", rankingFilters.date);
        if (rankingFilters.departmentGroupId) {
          params.set("departmentGroupId", rankingFilters.departmentGroupId);
        }

        const queryString = params.toString();
        const result = await apiGet<RankingData>(
          `/api/exec/ranking${queryString ? `?${queryString}` : ""}`,
        );
        setData(result);
        setCurrentPage(1);
      } catch (errorValue: unknown) {
        setError(
          errorValue instanceof Error
            ? errorValue.message
            : "ไม่สามารถโหลดข้อมูลจัดอันดับได้",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [rankingFilters]);

  const rankings = useMemo(() => data?.rankings ?? [], [data?.rankings]);
  const ratingBands = useMemo(
    () => data?.rating_bands ?? [],
    [data?.rating_bands],
  );
  const surveyTitle = formatSurveyTitle(data?.survey);
  const selectedSurveyId =
    rankingFilters.surveyId ||
    (data?.filters?.selected?.survey_id
      ? String(data.filters.selected.survey_id)
      : "");
  const selectedPeriodLabel = getReportPeriodLabel(data);
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
              response_count: data.total_responses,
            },
          ]
        : [];
  const monthOptions = data?.filters?.months ?? [];
  const departmentGroupOptions = data?.filters?.department_groups ?? [];
  const selectedDepartmentGroupId =
    rankingFilters.departmentGroupId ||
    (data?.filters?.selected?.department_group_id
      ? String(data.filters.selected.department_group_id)
      : "");
  const selectedDepartmentGroupLabel = selectedDepartmentGroupId
    ? departmentGroupOptions.find(
        (group) => String(group.id) === selectedDepartmentGroupId,
      )?.name ?? `กลุ่ม #${selectedDepartmentGroupId}`
    : "ทุกกลุ่มหน่วยงาน";
  const selectedGroupHasNoEvaluationData =
    Boolean(selectedDepartmentGroupId) &&
    Boolean(data) &&
    data?.total_responses === 0;
  const rankingEmptyMessage = selectedGroupHasNoEvaluationData
    ? `ไม่พบข้อมูลการประเมินของกลุ่ม “${selectedDepartmentGroupLabel}” ในช่วงเวลาที่เลือก`
    : "ยังไม่มีข้อมูลการประเมิน";
  const weekOptions = rankingFilters.month ? data?.filters?.weeks ?? [] : [];
  const dayOptions =
    rankingFilters.month && rankingFilters.weekStart
      ? data?.filters?.days ?? []
      : [];
  const selectedMonthNumber = rankingFilters.month
    ? Number(rankingFilters.month)
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
    Boolean(rankingFilters.weekStart) &&
    !weekOptions.some((week) => week.week_start === rankingFilters.weekStart);
  const weekSelectOptions = [
    ...(weekSelectionMissing && rankingFilters.weekStart
      ? [
          {
            value: rankingFilters.weekStart,
            label: `${formatFallbackWeekLabel(rankingFilters.weekStart)} (ไม่มีข้อมูล)`,
          },
        ]
      : []),
    ...weekOptions.map((week, index) => ({
      value: week.week_start,
      label: formatWeekOptionLabel(week, index),
    })),
  ];
  const daySelectionMissing =
    Boolean(rankingFilters.date) && !dayOptions.includes(rankingFilters.date);
  const daySelectOptions = [
    ...(daySelectionMissing && rankingFilters.date
      ? [
          {
            value: rankingFilters.date,
            label: `${formatISOThaiDate(rankingFilters.date)} (ไม่มีข้อมูล)`,
          },
        ]
      : []),
    ...dayOptions.map((date) => ({
      value: date,
      label: formatISOThaiDate(date),
    })),
  ];
  const overallBand = getBand(data?.university_avg ?? 0, ratingBands);

  const rankingGroups = useMemo(() => {
    const groupsById = new Map<
      number,
      {
        id: number;
        name: string;
        displayOrder: number;
        departments: DepartmentRank[];
      }
    >();

    for (const department of rankings) {
      const groupId = Number(department.department_group_id);
      const group = groupsById.get(groupId);

      if (group) {
        group.departments.push(department);
      } else {
        groupsById.set(groupId, {
          id: groupId,
          name: department.department_group_name,
          displayOrder: Number(department.department_group_display_order),
          departments: [department],
        });
      }
    }

    return Array.from(groupsById.values()).sort(
      (a, b) => a.displayOrder - b.displayOrder || a.id - b.id,
    );
  }, [rankings]);

  const totalPages = Math.max(1, rankingGroups.length);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const currentRankingGroup = rankingGroups[safeCurrentPage - 1] ?? null;
  const paginatedRankings = currentRankingGroup?.departments ?? [];

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const printReport = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${tableTitle}_${data?.survey?.year_be ?? "latest"}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 12mm 10mm 10mm;
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
        .ranking-print-source {
          display: block !important;
          width: 100% !important;
          background: #ffffff !important;
        }
        .ranking-print-page {
          width: 100% !important;
          color: #0f172a !important;
          font-family: "Sarabun", "Noto Sans Thai", Arial, sans-serif !important;
        }
        .ranking-print-table {
          border-collapse: collapse !important;
          width: 100% !important;
        }
        .ranking-print-table thead {
          display: table-header-group !important;
        }
        .ranking-print-table tr,
        .ranking-print-table td,
        .ranking-print-table th {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }
    `,
  });

  const exportExcel = () => {
    if (!data) return;

    const excelContent = buildRankingExcelXml({
      data,
      rankings,
      ratingBands,
      surveyTitle,
      selectedPeriodLabel,
      selectedDepartmentGroupLabel,
      overallBandLabel: overallBand.label,
      tableTitle,
    });
    const fileName = sanitizeExcelFileName(
      `${tableTitle}_${data.survey?.year_be ?? "latest"}.xls`,
    );

    downloadExcelFile(fileName, excelContent);
  };

  const retry = () => {
    setRankingFilters((current) => ({ ...current }));
  };

  if (loading && !data) return <LoadingSkeleton />;

  if (error && !data) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-7xl rounded-3xl border border-sky-100/80 bg-white/90 p-8 text-center shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
          <CircleAlert className="mx-auto mb-3 h-12 w-12 text-rose-600" />
          <p className="font-medium text-red-600">{error || "ไม่พบข้อมูล"}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" />
            ลองใหม่
          </button>
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
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <ListOrdered className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="mt-1 text-2xl font-bold text-white">
                  {isAdminView ? "ดูผลการประเมิน" : "จัดอันดับหน่วยงาน"}
                </h1>
                <p className="mt-1 text-sm text-sky-100/90">
                  {isAdminView
                    ? "ดูคะแนนเฉลี่ยและผลการประเมินของทุกหน่วยงาน"
                    : "สรุปคะแนนเฉลี่ยและผลประเมินของแต่ละหน่วยงาน"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-sky-100/90">
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                    {surveyTitle}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                    {selectedPeriodLabel}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            icon={ListOrdered}
            title="คะแนนเฉลี่ยรวม"
            value={formatScore(data?.university_avg)}
            cardClass={RANKING_THEMES.scored.cardClass}
            iconClass={RANKING_THEMES.scored.iconClass}
          />
          <KpiCard
            icon={Award}
            title="ผลการประเมิน"
            value={overallBand.label}
            cardClass={RANKING_THEMES.topScore.cardClass}
            iconClass={RANKING_THEMES.topScore.iconClass}
          />
          <KpiCard
            icon={Building2}
            title="หน่วยงานทั้งหมด"
            value={formatCount(rankings.length)}
            cardClass={RANKING_THEMES.total.cardClass}
            iconClass={RANKING_THEMES.total.iconClass}
          />
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
                  เลือกข้อมูลจากแบบประเมิน เดือน สัปดาห์ และวัน
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setRankingFilters({
                  surveyId: "",
                  departmentGroupId: "",
                  month: "",
                  weekStart: "",
                  date: "",
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
                  setRankingFilters((current) => ({
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

            <label className="text-sm font-semibold text-slate-700 xl:col-start-1 xl:row-start-2">
              เลือกกลุ่มหน่วยงาน
              <select
                value={selectedDepartmentGroupId}
                onChange={(event) =>
                  setRankingFilters((current) => ({
                    ...current,
                    departmentGroupId: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="">ทุกกลุ่มหน่วยงาน</option>
                {departmentGroupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700 xl:col-start-3 xl:row-start-1">
              เลือกเดือน / เดือนที่มีข้อมูล
              <select
                value={rankingFilters.month}
                onChange={(event) =>
                  setRankingFilters((current) => ({
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

            <label className="text-sm font-semibold text-slate-700 xl:col-start-4 xl:row-start-1">
              เลือกสัปดาห์ / สัปดาห์ที่มีข้อมูล
              <select
                value={rankingFilters.weekStart}
                onChange={(event) =>
                  setRankingFilters((current) => ({
                    ...current,
                    weekStart: event.target.value,
                    date: "",
                  }))
                }
                disabled={!rankingFilters.month}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {rankingFilters.month ? "ทุกสัปดาห์" : "เลือกเดือนก่อน"}
                </option>
                {weekSelectOptions.map((week) => (
                  <option key={week.value} value={week.value}>
                    {week.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700 xl:col-start-5 xl:row-start-1">
              เลือกวัน / วันที่มีข้อมูล
              <select
                value={rankingFilters.date}
                onChange={(event) =>
                  setRankingFilters((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
                disabled={!rankingFilters.month || !rankingFilters.weekStart}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {rankingFilters.month && rankingFilters.weekStart
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

          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <span>ช่วงรายงาน: {selectedPeriodLabel}</span>
            <span className="text-slate-300">•</span>
            <Building2 className="h-4 w-4 text-slate-400" />
            <span>กลุ่มหน่วยงาน: {selectedDepartmentGroupLabel}</span>
          </div>
        </section>

        <div ref={printRef} className="ranking-print-source hidden">
          <div className="ranking-print-page bg-white">
            <style>{`
              .ranking-print-meta,
              .ranking-print-table {
                border-collapse: collapse;
                width: 100%;
              }
              .ranking-print-meta td {
                border: 1px solid #94a3b8;
                padding: 5px 8px;
                font-size: 11px;
                color: #1e293b;
              }
              .ranking-print-table th,
              .ranking-print-table td {
                border: 1px solid #94a3b8;
                padding: 5px 7px;
                font-size: 11px;
                line-height: 1.35;
                color: #1e293b;
                vertical-align: top;
                word-break: break-word;
              }
              .ranking-print-table th {
                background-color: #dbeafe;
                color: #1e3a5f;
                font-weight: 700;
                text-align: center;
              }
              .ranking-print-section-title {
                margin: 12px 0 4px;
                font-size: 12px;
                font-weight: 800;
                color: #1e293b;
              }
              .ranking-print-group-title {
                margin: 8px 0 4px;
                font-size: 11px;
                font-weight: 400;
                color: #000000;
                break-after: avoid-page;
                page-break-after: avoid;
              }
              .ranking-print-footer {
                margin-top: 10px;
                padding-top: 6px;
                border-top: 1px solid #cbd5e1;
                display: flex;
                justify-content: space-between;
                gap: 12px;
                font-size: 10px;
                color: #64748b;
              }
            `}</style>

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                borderBottom: "2px solid #1e3a5f",
                paddingBottom: "8px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/rmu.png"
                alt="RMU"
                style={{ width: "52px", height: "52px", objectFit: "contain" }}
              />
              <div style={{ flex: 1, textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 800,
                    color: "#1e3a5f",
                    lineHeight: 1.35,
                  }}
                >
                  รายงาน{tableTitle}
                </div>
                <div style={{ marginTop: "2px", fontSize: "13px", color: "#334155" }}>
                  {surveyTitle}
                </div>
              </div>
            </div>

            <div className="ranking-print-section-title">ข้อมูลรายงาน</div>
            <table className="ranking-print-meta">
              <tbody>
                <tr>
                  <td style={{ width: "50%" }}>
                    <span style={{ fontWeight: 700 }}>แบบประเมิน :</span>{" "}
                    {surveyTitle}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700 }}>ช่วงรายงาน :</span>{" "}
                    {selectedPeriodLabel}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="ranking-print-section-title">สรุปข้อมูล</div>
            <table className="ranking-print-meta">
              <tbody>
                <tr>
                  <td style={{ width: "33.33%" }}>
                    <span style={{ fontWeight: 700 }}>คะแนนเฉลี่ยรวม :</span>{" "}
                    {formatScore(data?.university_avg)}
                  </td>
                  <td style={{ width: "33.33%" }}>
                    <span style={{ fontWeight: 700 }}>ผลการประเมิน :</span>{" "}
                    {overallBand.label}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700 }}>หน่วยงานทั้งหมด :</span>{" "}
                    {formatCount(rankings.length)}
                  </td>
                </tr>
                <tr>
                  <td>
                    <span style={{ fontWeight: 700 }}>กลุ่มหน่วยงาน :</span>{" "}
                    {selectedDepartmentGroupLabel}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="ranking-print-section-title">
              {tableTitle}
            </div>
            {rankings.length === 0 ? (
              <table className="ranking-print-table">
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>อันดับ</th>
                    <th>หน่วยงาน</th>
                    <th style={{ width: "90px" }}>คะแนนเฉลี่ย</th>
                    <th style={{ width: "120px" }}>ผลประเมิน</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: "18px 8px",
                        textAlign: "center",
                        color: "#94a3b8",
                      }}
                    >
                      ยังไม่มีข้อมูลการประเมิน
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              rankingGroups.map((group) => (
                <div key={`print-group-${group.id}`}>
                  <div className="ranking-print-group-title">{group.name}</div>
                  <table className="ranking-print-table">
                    <thead>
                      <tr>
                        <th style={{ width: "50px" }}>อันดับ</th>
                        <th>หน่วยงาน</th>
                        <th style={{ width: "90px" }}>คะแนนเฉลี่ย</th>
                        <th style={{ width: "120px" }}>ผลประเมิน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.departments.map((department, index) => {
                        const band = getBand(department.avg_rating, ratingBands);

                        return (
                          <tr key={`print-${department.department_id}`}>
                            <td style={{ textAlign: "center" }}>{index + 1}</td>
                            <td style={{ fontWeight: 600 }}>
                              {department.department_name}
                            </td>
                            <td style={{ textAlign: "center", fontWeight: 700 }}>
                              {formatScore(department.avg_rating)}
                            </td>
                            <td style={{ textAlign: "center" }}>{band.label}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))
            )}

            <div className="ranking-print-footer">
              <span>
                เอกสารนี้สร้างจากระบบประเมินความพึงพอใจของมหาวิทยาลัยราชภัฏมหาสารคาม
              </span>
              <span>ออกรายงาน ณ วันที่ {formatThaiFullDate(new Date())}</span>
            </div>
          </div>
        </div>

        <Section
          icon={ListOrdered}
          title={tableTitle}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void printReport()}
                disabled={!data || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-sky-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Printer className="h-4 w-4" />
                ส่งออก PDF
              </button>
              <button
                type="button"
                onClick={exportExcel}
                disabled={!data || loading}
                className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,185,129,0.16)] transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                ส่งออก Excel
              </button>
            </div>
          }
        >
          {!selectedGroupHasNoEvaluationData && currentRankingGroup ? (
            <div className="flex items-center gap-2.5 border-b border-sky-200 px-5 py-3 text-sm text-slate-800 sm:px-6">
              <span className="font-semibold">{currentRankingGroup.name}</span>
              <span className="ml-auto rounded-full border border-sky-200 bg-white/90 px-2.5 py-1 text-xs font-medium text-sky-700">
                {formatCount(paginatedRankings.length)} หน่วยงาน
              </span>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-blue-700/20 bg-gradient-to-r from-sky-600 to-blue-600 text-white">
                <tr>
                  <th className="w-[90px] px-4 py-3 text-center font-semibold">อันดับ</th>
                  <th className="min-w-[320px] px-4 py-3 text-left font-semibold">หน่วยงาน</th>
                  <th className="w-[160px] px-4 py-3 text-center font-semibold">คะแนนเฉลี่ย</th>
                  <th className="w-[190px] px-4 py-3 text-center font-semibold">ผลประเมิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedGroupHasNoEvaluationData || rankings.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center" colSpan={4}>
                      <div className="flex flex-col items-center gap-2 text-amber-700">
                        <CircleAlert className="h-8 w-8" aria-hidden="true" />
                        <span className="font-medium">{rankingEmptyMessage}</span>
                        {selectedGroupHasNoEvaluationData ? (
                          <span className="text-xs font-normal text-slate-500">
                            กรุณาเลือกกลุ่มหน่วยงานหรือช่วงรายงานอื่น
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRankings.map((department, index) => {
                    const band = getBand(department.avg_rating, ratingBands);
                    const rank = index + 1;

                    return (
                      <tr key={department.department_id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                            {rank}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-900">
                          <div className="font-medium">{department.department_name}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-800">
                          {formatScore(department.avg_rating)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {department.avg_rating > 0 ? (
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${band.colorClass}`}
                            >
                              {band.label}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {rankings.length > 0 && !selectedGroupHasNoEvaluationData ? (
            <div className="flex flex-col gap-3 border-t border-slate-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">
                ทั้งหมด {formatCount(rankings.length)} หน่วยงาน
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ย้อนกลับ
                </button>
                <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700">
                  กลุ่ม {rankingGroups.length === 0 ? 0 : safeCurrentPage} / {rankingGroups.length}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          ) : null}
        </Section>
      </div>
    </main>
  );
}

