"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import OverviewCard from "@/app/components/overview-card";
import { apiGet } from "@/lib/api";
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
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  CircleAlert,
  Download,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  Printer,
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
  survey: {
    id: number;
    title: string | null;
    year_be: number | null;
  };
  summary: {
    total_responses: number;
    avg_rating: number;
    overall_sd: number | null;
    student_count: number;
    staff_count: number;
    public_count: number;
    total_departments: number;
    departments_with_responses: number;
    departments_without_responses: number;
  };
  departments: {
    department_id: number;
    department_name: string;
    department_group_id: number;
    department_group_name: string;
    department_group_display_order: number;
    total_responses: number;
    student_count: number;
    staff_count: number;
    public_count: number;
    avg_rating: number;
  }[];
  questions: {
    question_id: number;
    question_text: string;
    question_scope: "central" | "department";
    department_name: string | null;
    total_responses: number;
    avg_rating: number | null;
    sd: number | null;
  }[];
  comments: {
    department_name: string;
    department_group_id: number;
    department_group_name: string;
    department_group_display_order: number;
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
      view: ReportView;
      month: number | null;
      week_start: string | null;
      date: string | null;
      respondent_group: RespondentGroup | null;
      department_group_id: number | null;
    };
  };
};

type ReportFilters = {
  surveyId: string;
  departmentGroupId: string;
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

const THEME = {
  primary: "from-sky-500 to-cyan-500",
  success: "from-emerald-500 to-teal-500",
  neutral: "from-slate-500 to-slate-600",
  accent: "from-blue-600 to-indigo-600",
} as const;

const RESPONDENT_GROUP_SUMMARIES: {
  value: RespondentGroup;
  label: string;
  summaryKey: "student_count" | "staff_count" | "public_count";
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
}[] = [
  {
    value: "student",
    label: "นักศึกษา",
    summaryKey: "student_count",
    icon: GraduationCap,
    iconClass: THEME.primary,
  },
  {
    value: "staff",
    label: "บุคลากร",
    summaryKey: "staff_count",
    icon: UserRound,
    iconClass: THEME.success,
  },
  {
    value: "public",
    label: "บุคคลทั่วไป",
    summaryKey: "public_count",
    icon: UsersRound,
    iconClass: THEME.neutral,
  },
];

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("th-TH");
}

function formatScore(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : "-";
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
  }).format(date);
}

function formatThaiFullDate(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatRespondentGroupLabel(
  group: RespondentGroupFilter | null | undefined,
) {
  if (group === "student") return "นักศึกษา";
  if (group === "staff") return "บุคลากร";
  if (group === "public") return "บุคคลทั่วไป";
  return "ทุกกลุ่มประเมิน";
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
  return `วันที่ ${dateParts.day} เดือน ${formatMonthLabel(dateParts.month)} พ.ศ. ${yearBE}`;
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

function getBand(score: number | null | undefined, bands: RatingBand[]) {
  if (!score || bands.length === 0) {
    return {
      label: "ไม่มีข้อมูล",
      tone: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  const sorted = [...bands].sort((a, b) => a.sort_order - b.sort_order);
  const band = sorted.find((item) => score >= item.min_value && score <= item.max_value);

  if (!band) {
    return {
      label: "ไม่ทราบเกณฑ์",
      tone: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  const pct = band.sort_order / (sorted.at(-1)?.sort_order || 1);
  if (pct >= 0.75) {
    return {
      label: band.label_th,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (pct >= 0.5) {
    return {
      label: band.label_th,
      tone: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }
  if (pct >= 0.25) {
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

function groupReportDepartments(departments: ReportData["departments"]) {
  const groupsById = new Map<
    number,
    {
      id: number;
      name: string;
      displayOrder: number;
      departments: ReportData["departments"];
    }
  >();

  for (const department of departments) {
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
}

function groupReportComments(comments: ReportData["comments"]) {
  const groupsById = new Map<
    number,
    {
      id: number;
      name: string;
      displayOrder: number;
      comments: ReportData["comments"];
    }
  >();

  for (const comment of comments) {
    const groupId = Number(comment.department_group_id);
    const group = groupsById.get(groupId);

    if (group) {
      group.comments.push(comment);
    } else {
      groupsById.set(groupId, {
        id: groupId,
        name: comment.department_group_name,
        displayOrder: Number(comment.department_group_display_order),
        comments: [comment],
      });
    }
  }

  return Array.from(groupsById.values()).sort(
    (a, b) => a.displayOrder - b.displayOrder || a.id - b.id,
  );
}

function buildExecutiveReportExcelXml({
  data,
  reportDepartments,
  surveyTitle,
  selectedPrintPeriodLabel,
  overallBandLabel,
  summaryRespondentGroupLabel,
  selectedDepartmentGroupLabel,
}: {
  data: ReportData;
  reportDepartments: ReportData["departments"];
  surveyTitle: string;
  selectedPrintPeriodLabel: string;
  overallBandLabel: string;
  summaryRespondentGroupLabel: string;
  selectedDepartmentGroupLabel: string;
}) {
  const reportDepartmentGroups = groupReportDepartments(reportDepartments);
  const reportCommentGroups = groupReportComments(data.comments);
  const summaryRows: ExcelXmlRow[] = [
    {
      height: 28,
      cells: [
        excelCell("รายงานผลการประเมินของผู้บริหาร", "Title", {
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
        excelCell(selectedPrintPeriodLabel, "MetaValue", { mergeAcross: 2 }),
      ],
    },
    {
      cells: [
        excelCell("กลุ่มหน่วยงาน", "MetaLabel"),
        excelCell(selectedDepartmentGroupLabel, "MetaValue", {
          mergeAcross: 2,
        }),
      ],
    },
    {
      cells: [
        excelCell("คะแนนเฉลี่ยรวม", "MetaLabel"),
        excelCell(formatScore(data.summary.avg_rating), "MetaValue", {
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
        excelCell(data.summary.total_departments, "MetaValueLeft", {
          type: "Number",
          mergeAcross: 2,
        }),
      ],
    },
    {
      cells: [
        excelCell("กลุ่มผู้ทำแบบประเมิน", "MetaLabel"),
        excelCell(summaryRespondentGroupLabel, "MetaValue", { mergeAcross: 2 }),
      ],
    },
    {
      cells: [
        excelCell("จำนวนผู้ตอบแบบประเมิน", "MetaLabel"),
        excelCell(data.summary.total_responses, "MetaValueLeft", {
          type: "Number",
          mergeAcross: 2,
        }),
      ],
    },
    {
      cells: [
        excelCell("ออกรายงาน", "MetaLabel"),
        excelCell(formatThaiFullDate(new Date()), "MetaValue", {
          mergeAcross: 2,
        }),
      ],
    },
  ];

  const departmentRows: ExcelXmlRow[] = [
    {
      height: 28,
      cells: [
        excelCell("รายงานหน่วยงาน", "Title", {
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
        excelCell(selectedPrintPeriodLabel, "MetaValue", { mergeAcross: 2 }),
      ],
    },
    {
      cells: [
        excelCell("กลุ่มหน่วยงาน", "MetaLabel"),
        excelCell(selectedDepartmentGroupLabel, "MetaValue", {
          mergeAcross: 2,
        }),
      ],
    },
    spacerRow(4),
    ...reportDepartmentGroups.flatMap((group, groupIndex) => [
      {
        height: 22,
        autoFitHeight: true,
        cells: [excelCell(group.name, "Default", { mergeAcross: 3 })],
      },
      {
        autoFitHeight: true,
        cells: [
          excelCell("ลำดับ", "Header"),
          excelCell("หน่วยงาน", "Header"),
          excelCell("คะแนนเฉลี่ย", "Header"),
          excelCell("ผลการประเมิน", "Header"),
        ],
      },
      ...group.departments.map((item, index) => ({
        autoFitHeight: true,
        cells: [
          excelCell(index + 1, "CenterCell", { type: "Number" }),
          excelCell(item.department_name, "Cell"),
          excelCell(formatScore(item.avg_rating), "CenterCell"),
          excelCell(
            getBand(item.avg_rating, data.rating_bands).label,
            "CenterCell",
          ),
        ],
      })),
      ...(groupIndex < reportDepartmentGroups.length - 1
        ? [spacerRow(4, 8)]
        : []),
    ]),
  ];

  const commentRows: ExcelXmlRow[] = [
    {
      height: 28,
      cells: [
        excelCell("รายงานความคิดเห็น", "Title", {
          mergeAcross: 5,
        }),
      ],
    },
    {
      cells: [
        excelCell("แบบประเมิน", "MetaLabel"),
        excelCell(surveyTitle, "MetaValue", { mergeAcross: 4 }),
      ],
    },
    {
      cells: [
        excelCell("ช่วงรายงาน", "MetaLabel"),
        excelCell(selectedPrintPeriodLabel, "MetaValue", { mergeAcross: 4 }),
      ],
    },
    {
      cells: [
        excelCell("กลุ่มหน่วยงาน", "MetaLabel"),
        excelCell(selectedDepartmentGroupLabel, "MetaValue", {
          mergeAcross: 4,
        }),
      ],
    },
    {
      cells: [
        excelCell("กลุ่มผู้ทำแบบประเมิน", "MetaLabel"),
        excelCell(summaryRespondentGroupLabel, "MetaValue", {
          mergeAcross: 4,
        }),
      ],
    },
    spacerRow(6),
    {
      cells: [
        excelCell("ความคิดเห็นจากผู้ประเมิน", "SectionTitle", {
          mergeAcross: 5,
        }),
      ],
    },
    ...reportCommentGroups.flatMap((group, groupIndex) => [
      {
        height: 22,
        autoFitHeight: true,
        cells: [excelCell(group.name, "Default", { mergeAcross: 5 })],
      },
      {
        autoFitHeight: true,
        cells: [
          excelCell("ลำดับ", "Header"),
          excelCell("หน่วยงาน", "Header"),
          excelCell("กลุ่มผู้ประเมิน", "Header"),
          excelCell("คำถาม", "Header"),
          excelCell("ความคิดเห็น", "Header"),
          excelCell("วันที่", "Header"),
        ],
      },
      ...group.comments.map((commentItem, index) => ({
        autoFitHeight: true,
        cells: [
          excelCell(index + 1, "CenterCell", { type: "Number" }),
          excelCell(commentItem.department_name, "Cell"),
          excelCell(
            formatRespondentGroupLabel(commentItem.respondent_group),
            "CenterCell",
          ),
          excelCell(commentItem.question_text, "Cell"),
          excelCell(commentItem.comment, "Cell"),
          excelCell(formatDateTime(commentItem.submitted_at), "CenterCell"),
        ],
      })),
      ...(groupIndex < reportCommentGroups.length - 1
        ? [spacerRow(6, 8)]
        : []),
    ]),
  ];

  return buildExcelXmlWorkbook({
    documentTitle: "รายงานผลการประเมินของผู้บริหาร",
    sheets: [
      {
        name: "สรุป",
        columns: [150, 420, 150, 180],
        rows: summaryRows,
      },
      {
        name: "หน่วยงาน",
        columns: [70, 390, 120, 180],
        rows: departmentRows,
      },
      {
        name: "ความคิดเห็น",
        columns: [70, 220, 140, 360, 430, 140],
        rows: commentRows,
      },
    ],
  });
}

function buildNoDataMessage(
  periodLabel: string,
  departmentGroupLabel: string,
  respondentGroupLabel: string,
) {
  return `ขณะนี้ไม่มีข้อมูลในช่วงรายงาน (${periodLabel}) สำหรับกลุ่มหน่วยงาน ${departmentGroupLabel} และกลุ่มผู้ประเมิน ${respondentGroupLabel}`;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  cardClass = "border-slate-200/80 bg-white/95",
  iconClass = THEME.primary,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
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
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="min-w-0 text-lg font-bold text-slate-900">{title}</h2>
        </div>
        {right}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export default function ExecReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportFilters, setReportFilters] = useState<ReportFilters>({
    surveyId: "",
    departmentGroupId: "",
    month: "",
    weekStart: "",
    date: "",
    respondentGroup: "all",
  });
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        if (reportFilters.surveyId) params.set("surveyId", reportFilters.surveyId);
        if (reportFilters.departmentGroupId) {
          params.set("departmentGroupId", reportFilters.departmentGroupId);
        }
        if (reportFilters.month) params.set("month", reportFilters.month);
        if (reportFilters.weekStart) params.set("weekStart", reportFilters.weekStart);
        if (reportFilters.date) params.set("date", reportFilters.date);
        if (reportFilters.respondentGroup !== "all") {
          params.set("respondentGroup", reportFilters.respondentGroup);
        }

        const queryString = params.toString();
        const response = await apiGet<ReportData>(
          `/api/exec/reports${queryString ? `?${queryString}` : ""}`,
        );
        if (!cancelled) {
          setData(response);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "ไม่สามารถโหลดข้อมูลรายงานผลการประเมินของผู้บริหารได้",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [reportFilters]);

  const surveyTitle = formatSurveyTitle(data?.survey);
  const scopeLabel = data?.survey?.year_be
    ? `รายงานปี พ.ศ. ${data.survey.year_be}`
    : "รายงานล่าสุด";
  const overallBand = getBand(data?.summary.avg_rating ?? 0, data?.rating_bands ?? []);
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
  const selectedRespondentGroupLabel = formatRespondentGroupLabel(selectedGroup);
  const departmentGroupOptions = data?.filters?.department_groups ?? [];
  const selectedDepartmentGroupId =
    reportFilters.departmentGroupId ||
    (data?.filters?.selected?.department_group_id
      ? String(data.filters.selected.department_group_id)
      : "");
  const selectedDepartmentGroupLabel = selectedDepartmentGroupId
    ? departmentGroupOptions.find(
        (group) => String(group.id) === selectedDepartmentGroupId,
      )?.name ?? `กลุ่ม #${selectedDepartmentGroupId}`
    : "ทุกกลุ่มหน่วยงาน";
  const summaryRespondentGroupLabel = selectedGroup
    ? selectedRespondentGroupLabel
    : RESPONDENT_GROUP_OPTIONS.filter((option) => option.value !== "all")
        .map((option) => option.label)
        .join(", ");
  const hasNoDataForSelection = Boolean(data && data.summary.total_responses === 0);
  const noDataMessage = buildNoDataMessage(
    selectedPeriodLabel,
    selectedDepartmentGroupLabel,
    selectedRespondentGroupLabel,
  );
  const visibleGroupSummaries = RESPONDENT_GROUP_SUMMARIES.filter((group) =>
    selectedGroup ? group.value === selectedGroup : true,
  ).map((group) => ({
    ...group,
    count: data?.summary[group.summaryKey] ?? 0,
  }));

  const surveyOptions =
    (data?.filters?.surveys?.length ?? 0) > 0
      ? data?.filters.surveys ?? []
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
  const reportDepartments = data?.departments ?? [];
  const reportDepartmentGroups = groupReportDepartments(reportDepartments);
  const reportCommentGroups = groupReportComments(data?.comments ?? []);

  const printReport = useReactToPrint({
    contentRef: printRef,
    documentTitle: `รายงานผลการประเมินของผู้บริหาร_${data?.survey?.year_be ?? "latest"}_${selectedPeriodLabel}`,
  });

  const exportExcel = () => {
    if (!data) return;

    const excelContent = buildExecutiveReportExcelXml({
      data,
      reportDepartments,
      surveyTitle,
      selectedPrintPeriodLabel,
      overallBandLabel: overallBand.label,
      summaryRespondentGroupLabel,
      selectedDepartmentGroupLabel,
    });
    const fileName = sanitizeExcelFileName(
      `รายงานผลการประเมินของผู้บริหาร_${data.survey?.year_be ?? "latest"}.xls`,
    );

    downloadExcelFile(fileName, excelContent);
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
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 text-slate-900 sm:p-6">
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-md">
                <FileSpreadsheet className="h-7 w-7" />
              </div>
              <div>
                <h1 className="mt-1 text-2xl font-bold">
                  รายงานผลการประเมินของผู้บริหาร
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-100/90">
                  ออกรายงานผลการประเมินหน่วยงานสำหรับผู้บริหารมหาวิทยาลัย
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-sky-100">
                    {surveyTitle}
                  </div>
                  <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-sky-100">
                    {scopeLabel}
                  </div>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={BarChart3}
            label="คะแนนเฉลี่ยรวม"
            value={formatScore(data?.summary.avg_rating)}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={THEME.primary}
          />
          <StatCard
            icon={BadgeCheck}
            label="ผลการประเมิน"
            value={overallBand.label}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={THEME.success}
            valueClass="text-lg"
          />
          <StatCard
            icon={CalendarDays}
            label="จำนวนปีที่มีข้อมูล"
            value={`${formatCount(data?.filters.years.length)} ปี`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={THEME.accent}
            valueClass="text-2xl"
          />
          <StatCard
            icon={Building2}
            label="หน่วยงานทั้งหมด"
            value={`${formatCount(data?.summary.total_departments)} หน่วยงาน`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={THEME.neutral}
            valueClass="text-2xl"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            label="ผู้ตอบทั้งหมด"
            value={`${formatCount(data?.summary.total_responses)} คน`}
            cardClass="border-slate-200/80 bg-white/95"
            iconClass={THEME.primary}
            valueClass="text-2xl"
          />
          {visibleGroupSummaries.map((group) => (
            <StatCard
              key={group.value}
              icon={group.icon}
              label={group.label}
              value={`${formatCount(group.count)} คน`}
              cardClass="border-slate-200/80 bg-white/95"
              iconClass={group.iconClass}
              valueClass="text-2xl"
            />
          ))}
        </div>

        {data ? (
          <>
            <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(37,99,235,0.08)]">
              <div className="px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_10px_22px_rgba(37,99,235,0.18)]">
                    <Filter className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-900">ตัวกรองรายงาน</div>
                    <div className="mt-1 text-sm text-slate-500">
                      เลือกข้อมูลจากแบบประเมิน กลุ่มหน่วยงาน เดือน สัปดาห์ วัน และกลุ่มผู้ทำแบบประเมิน
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setReportFilters({
                      surveyId: "",
                      departmentGroupId: "",
                      month: "",
                      weekStart: "",
                      date: "",
                      respondentGroup: "all",
                    })
                  }
                  className="inline-flex items-center justify-center rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(244,63,94,0.18)] transition hover:bg-rose-600"
                >
                  ล้างตัวกรอง
                </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <label className="text-sm font-semibold text-slate-700 xl:col-span-2">
                  แบบประเมิน / ปีที่มีข้อมูล
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
                    className="mt-1 w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    {surveyOptions.map((survey) => (
                      <option key={survey.id} value={String(survey.id)}>
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
                    className="mt-1 w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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
                    className="mt-1 w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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
                    className="mt-1 w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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

                <label className="text-sm font-semibold text-slate-700">
                  เลือกกลุ่มหน่วยงาน
                  <select
                    value={selectedDepartmentGroupId}
                    onChange={(event) =>
                      setReportFilters((current) => ({
                        ...current,
                        departmentGroupId: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="">ทุกกลุ่มหน่วยงาน</option>
                    {departmentGroupOptions.map((group) => (
                      <option key={group.id} value={String(group.id)}>
                        {group.name}
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
                    className="mt-1 w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
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
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span>กลุ่มหน่วยงาน: {selectedDepartmentGroupLabel}</span>
                  <span className="text-slate-300">/</span>
                  <span>กลุ่มผู้ทำแบบประเมิน: {selectedRespondentGroupLabel}</span>
                </div>

                {hasNoDataForSelection ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <div className="font-semibold">{noDataMessage}</div>
                    <div className="mt-1 text-amber-700">
                      โปรดตรวจสอบกลุ่มหน่วยงาน ช่วงเวลา และกลุ่มผู้ประเมินที่เลือกอีกครั้ง
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

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
                    @page { margin: 12mm 10mm 10mm; size: A4; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .report-print-page {
                      padding: 0 !important;
                    }
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
                    .report-group-title {
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
                  .report-tbl td { color: #1e293b; vertical-align: top; }
                  .report-section-title {
                    font-size: 13px; font-weight: 700; color: #1e293b;
                    margin-top: 16px; margin-bottom: 4px;
                  }
                  .report-group-title {
                    font-size: 13px; font-weight: 400; color: #000000;
                    margin-top: 10px; margin-bottom: 4px;
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
                  <span style={{ fontWeight: 700 }}>ขอบเขตรายงาน :</span>{" "}
                  ออกรายงานผลการประเมินหน่วยงานสำหรับผู้บริหารมหาวิทยาลัยราชภัฏมหาสารคาม
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
                        <span style={{ fontWeight: 600 }}>คะแนนเฉลี่ยรวม :</span>{" "}
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
                        <span style={{ fontWeight: 600 }}>หน่วยงานทั้งหมด :</span>{" "}
                        {formatCount(data.summary.total_departments)} หน่วยงาน
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>กลุ่มผู้ทำแบบประเมิน :</span>{" "}
                        {summaryRespondentGroupLabel}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span style={{ fontWeight: 600 }}>กลุ่มหน่วยงาน :</span>{" "}
                        {selectedDepartmentGroupLabel}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>จำนวนผู้ตอบแบบประเมิน :</span>{" "}
                        {formatCount(data.summary.total_responses)} คน
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="report-section-title">
                  ผลการประเมินจำแนกรายหน่วยงาน
                </div>
                {reportDepartments.length === 0 ? (
                  <table className="report-tbl">
                    <thead>
                      <tr>
                        <th style={{ width: "50px", textAlign: "center" }}>ลำดับ</th>
                        <th style={{ textAlign: "center" }}>หน่วยงาน</th>
                        <th style={{ width: "90px", textAlign: "center" }}>ค่าเฉลี่ย</th>
                        <th style={{ width: "120px", textAlign: "center" }}>ผลการประเมิน</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          colSpan={4}
                          style={{
                            textAlign: "center",
                            padding: "24px 10px",
                            color: "#94a3b8",
                          }}
                        >
                          ยังไม่มีข้อมูลหน่วยงานในรายงานนี้
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  reportDepartmentGroups.map((group) => (
                    <div
                      key={`report-group-${group.id}`}
                      className="report-department-group"
                    >
                      <div className="report-group-title">{group.name}</div>
                      <table className="report-tbl">
                        <thead>
                          <tr>
                            <th style={{ width: "50px", textAlign: "center" }}>ลำดับ</th>
                            <th style={{ textAlign: "center" }}>หน่วยงาน</th>
                            <th style={{ width: "90px", textAlign: "center" }}>ค่าเฉลี่ย</th>
                            <th style={{ width: "120px", textAlign: "center" }}>ผลการประเมิน</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.departments.map((department, index) => (
                            <tr key={department.department_id}>
                              <td style={{ textAlign: "center" }}>{index + 1}</td>
                              <td>{department.department_name}</td>
                              <td style={{ textAlign: "center", fontWeight: 600 }}>
                                {formatScore(department.avg_rating)}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                {getBand(department.avg_rating, data.rating_bands).label}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                )}

                <div className="report-section-title">
                  ความคิดเห็นจากผู้ประเมิน
                </div>
                {data.comments.length === 0 ? (
                  <table className="report-tbl">
                    <thead>
                      <tr>
                        <th style={{ width: "50px", textAlign: "center" }}>ลำดับ</th>
                        <th style={{ width: "150px", textAlign: "center" }}>หน่วยงาน</th>
                        <th style={{ width: "110px", textAlign: "center" }}>กลุ่มผู้ประเมิน</th>
                        <th style={{ textAlign: "center" }}>คำถาม</th>
                        <th style={{ textAlign: "center" }}>ความคิดเห็น</th>
                        <th style={{ width: "130px", textAlign: "center" }}>วันที่</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: "center",
                            padding: "24px 10px",
                            color: "#94a3b8",
                          }}
                        >
                          {hasNoDataForSelection
                            ? noDataMessage
                            : "ยังไม่มีความคิดเห็นจากผู้ประเมินในช่วงรายงานนี้"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  reportCommentGroups.map((group) => (
                    <div
                      key={`comment-group-${group.id}`}
                      className="report-comment-group"
                    >
                      <div className="report-group-title">{group.name}</div>
                      <table className="report-tbl">
                        <thead>
                          <tr>
                            <th style={{ width: "50px", textAlign: "center" }}>ลำดับ</th>
                            <th style={{ width: "150px", textAlign: "center" }}>หน่วยงาน</th>
                            <th style={{ width: "110px", textAlign: "center" }}>กลุ่มผู้ประเมิน</th>
                            <th style={{ textAlign: "center" }}>คำถาม</th>
                            <th style={{ textAlign: "center" }}>ความคิดเห็น</th>
                            <th style={{ width: "130px", textAlign: "center" }}>วันที่</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.comments.map((commentItem, index) => (
                            <tr key={commentItem.answer_id}>
                              <td style={{ textAlign: "center" }}>{index + 1}</td>
                              <td>{commentItem.department_name}</td>
                              <td style={{ textAlign: "center" }}>
                                {formatRespondentGroupLabel(
                                  commentItem.respondent_group,
                                )}
                              </td>
                              <td>{commentItem.question_text}</td>
                              <td>{commentItem.comment}</td>
                              <td style={{ textAlign: "center" }}>
                                {formatDateTime(commentItem.submitted_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
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
          </>
        ) : null}
      </div>
    </main>
  );
}
