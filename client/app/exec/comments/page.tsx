"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import OverviewCard from "@/app/components/overview-card";
import { apiGet } from "@/lib/api";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileSpreadsheet,
  MessageSquareText,
  MessagesSquare,
  Quote,
  Search,
  Users,
  X,
} from "lucide-react";

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
  department_group_id: number;
  department_group_name: string;
  department_group_display_order: number;
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
  icon,
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
    <OverviewCard icon={icon} title={title} value={value} sub={sub} iconClass={tone} />
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
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(
    null,
  );

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
  const selectedDepartment = useMemo(
    () =>
      departments.find(
        (department) => department.department_id === selectedDepartmentId,
      ) ?? null,
    [departments, selectedDepartmentId],
  );
  const filteredDepartments = useMemo(() => {
    const keyword = departmentSearch.trim().toLowerCase();
    if (!keyword) return departments;

    return departments.filter(
      (department) =>
        department.department_name.toLowerCase().includes(keyword) ||
        department.department_group_name.toLowerCase().includes(keyword),
    );
  }, [departmentSearch, departments]);
  const departmentGroups = useMemo(() => {
    const groupsById = new Map<
      number,
      {
        id: number;
        name: string;
        displayOrder: number;
        departments: DepartmentItem[];
      }
    >();

    for (const department of filteredDepartments) {
      const group = groupsById.get(department.department_group_id);
      if (group) {
        group.departments.push(department);
      } else {
        groupsById.set(department.department_group_id, {
          id: department.department_group_id,
          name: department.department_group_name,
          displayOrder: department.department_group_display_order,
          departments: [department],
        });
      }
    }

    return Array.from(groupsById.values()).sort(
      (a, b) => a.displayOrder - b.displayOrder || a.id - b.id,
    );
  }, [filteredDepartments]);
  const totalPages = Math.max(1, departmentGroups.length);
  const safePage = Math.min(page, totalPages);
  const currentDepartmentGroup = departmentGroups[safePage - 1] ?? null;
  const paginatedDepartments = currentDepartmentGroup?.departments ?? [];

  const totalComments = useMemo(
    () => departments.reduce((sum, item) => sum + item.total_comments, 0),
    [departments],
  );
  const departmentsWithComments = useMemo(
    () => departments.filter((item) => item.total_comments > 0).length,
    [departments],
  );

  useEffect(() => {
    setPage(1);
    setSelectedDepartmentId(null);
  }, [departmentSearch, departments.length]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!selectedDepartment) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedDepartmentId(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedDepartment]);

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
                  placeholder="พิมพ์ชื่อหน่วยงานหรือกลุ่มหน่วยงานที่ต้องการค้นหา"
                  className="w-full rounded-2xl border border-sky-100 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white">
              {currentDepartmentGroup ? (
                <div className="flex items-center gap-3 border-b border-sky-100 px-4 py-3 text-sm text-slate-800">
                  <span className="font-semibold">{currentDepartmentGroup.name}</span>
                  <span className="ml-auto rounded-full border border-sky-200 px-2.5 py-1 text-xs font-medium text-sky-700">
                    {formatCount(paginatedDepartments.length)} หน่วยงาน
                  </span>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full border-collapse text-[13px]">
                  <thead className="bg-gradient-to-r from-sky-600 via-blue-600 to-blue-700 text-white">
                    <tr className="border-b border-blue-700/30">
                      <th className="w-[70px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                        ลำดับ
                      </th>
                      <th className="min-w-[260px] border-r border-white/20 px-4 py-3.5 text-center text-sm font-bold">
                        ชื่อหน่วยงาน
                      </th>
                      <th className="w-[100px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                        ผู้ตอบ
                      </th>
                      <th className="w-[110px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                        จำนวนความคิดเห็น
                      </th>
                      <th className="w-[120px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                        คะแนนเฉลี่ย
                      </th>
                      <th className="w-[150px] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">
                        ผลการประเมิน
                      </th>
                      <th className="w-[170px] px-3 py-3.5 text-center text-sm font-bold">
                        ความคิดเห็น
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDepartments.length === 0 ? (
                      <tr>
                        <td className="px-4 py-12 text-center text-slate-500" colSpan={7}>
                          {departments.length === 0
                            ? "ยังไม่มีข้อมูลความคิดเห็นในระบบ"
                            : "ไม่พบหน่วยงานที่ตรงกับคำค้นหา"}
                        </td>
                      </tr>
                    ) : (
                      paginatedDepartments.map((department, index) => {
                        const band = getBand(
                          department.avg_rating,
                          data?.rating_bands ?? [],
                        );
                        const hasComments = department.comments.length > 0;

                        return (
                            <tr
                              key={department.department_id}
                              className="border-b border-sky-100 transition last:border-b-0 hover:bg-sky-50/50"
                            >
                              <td className="border-r border-sky-100 px-3 py-3.5 text-center text-slate-500">
                                {index + 1}
                              </td>
                              <td className="border-r border-sky-100 px-4 py-3.5 font-normal text-slate-900">
                                {department.department_name}
                              </td>
                              <td className="border-r border-sky-100 px-3 py-3.5 text-center text-slate-700">
                                {formatCount(department.total_responses)}
                              </td>
                              <td className="border-r border-sky-100 px-3 py-3.5 text-center text-slate-700">
                                {formatCount(department.total_comments)}
                              </td>
                              <td className="border-r border-sky-100 px-3 py-3.5 text-center text-slate-700">
                                {formatScore(department.avg_rating)}
                              </td>
                              <td className="border-r border-sky-100 px-3 py-3.5 text-center">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${band.badgeClass}`}
                                >
                                  {band.label}
                                </span>
                              </td>
                              <td className="px-3 py-3.5 text-center">
                                {hasComments ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedDepartmentId(
                                        department.department_id,
                                      )
                                    }
                                    className="rounded-lg border border-blue-500 bg-gradient-to-b from-blue-500 to-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-blue-600 hover:to-blue-700"
                                  >
                                    ดูความคิดเห็น
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400">
                                    ยังไม่มีความคิดเห็น
                                  </span>
                                )}
                              </td>
                            </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t border-sky-100 bg-sky-50/30 px-4 py-3">
                <div className="flex items-center gap-2 sm:ml-auto">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={safePage <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    ย้อนกลับ
                  </button>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm">
                    กลุ่ม {departmentGroups.length === 0 ? 0 : safePage} / {departmentGroups.length}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={safePage >= totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
                  >
                    ถัดไป
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {selectedDepartment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="comments-dialog-title"
          onMouseDown={() => setSelectedDepartmentId(null)}
        >
          <div
            className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="relative flex-shrink-0 bg-gradient-to-r from-sky-600 via-blue-600 to-blue-700 px-5 py-4 text-white">
              <button
                type="button"
                onClick={() => setSelectedDepartmentId(null)}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                aria-label="ปิดหน้าต่างความคิดเห็น"
                title="ปิด"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="flex items-center gap-3 pr-12">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 id="comments-dialog-title" className="text-lg font-bold">
                    ความคิดเห็นของ {selectedDepartment.department_name}
                  </h3>
                  <p className="mt-0.5 text-xs text-sky-100">
                    ทั้งหมด {formatCount(selectedDepartment.total_comments)} ความคิดเห็น
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-sky-50/40 p-4 sm:p-5">
              <div className="grid gap-3 md:grid-cols-2">
                {selectedDepartment.comments.map((item) => (
                  <div
                    key={item.answer_id}
                    className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                        <Quote className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-normal leading-6 text-slate-800">
                          {item.comment}
                        </p>
                        {item.question_text && (
                          <div className="mt-2 rounded-lg bg-sky-50 px-2.5 py-2 text-xs leading-5 text-sky-700">
                            คำถาม: {item.question_text}
                          </div>
                        )}
                        <div className="mt-2 text-[11px] text-slate-500">
                          {formatThaiDate(item.submitted_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-shrink-0 justify-end border-t border-sky-100 bg-white px-4 py-3.5 sm:px-5">
              <button
                type="button"
                onClick={() => setSelectedDepartmentId(null)}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
