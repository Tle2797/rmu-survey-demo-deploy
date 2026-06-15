import { db } from "../config/db";
import { generateDepartmentQRCodeAsset } from "../services/qrcode";
import { authenticateRequest } from "../utils/auth";
import { canAccessDepartment } from "../utils/authorization";
import { getActiveSurvey } from "../utils/surveys";

const REPORT_TIMEZONE = "Asia/Bangkok";
const THAI_MONTH_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];
const THAI_WEEKDAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

type YearlyDrilldownView = "year" | "month" | "week" | "day";

type DrilldownAggregateRow = {
  period_key: number | string | Date;
  avg_rating: number | string | null;
  band_label: string | null;
  respondents_total: number | string;
  student: number | string;
  staff: number | string;
  public: number | string;
};

type DrilldownPeriodRow = {
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

function getCurrentBEYear() {
  return new Date().getFullYear() + 543;
}

function parseView(value: unknown): YearlyDrilldownView {
  const normalized = String(value ?? "year").trim().toLowerCase();
  if (
    normalized === "month" ||
    normalized === "week" ||
    normalized === "day"
  ) {
    return normalized;
  }

  return "year";
}

function parseIntValue(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseMonthValue(value: unknown) {
  const parsed = parseIntValue(value);
  return parsed !== null && parsed >= 1 && parsed <= 12 ? parsed : null;
}

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toLocalISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatThaiDate(isoDate: string) {
  const date = parseISODate(isoDate);
  if (!date) return isoDate;

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = THAI_MONTH_SHORT[date.getUTCMonth()] ?? "";
  return `${day} ${month}`;
}

function formatWeekDetail(weekStart: string, weekEnd: string) {
  const start = parseISODate(weekStart);
  const end = parseISODate(weekEnd);
  if (!start || !end) return weekStart;

  return `${formatThaiDate(toISODate(start))} - ${formatThaiDate(toISODate(end))}`;
}

function listWeeksForCalendarMonth(gregorianYear: number, month: number) {
  const monthStart = utcDate(gregorianYear, month, 1);
  const monthEnd = utcDate(gregorianYear, month + 1, 0);
  const weeks: Array<{
    weekStart: string;
    weekEnd: string;
    label: string;
    detail: string;
  }> = [];

  let cursor = monthStart;
  let index = 1;

  while (cursor <= monthEnd) {
    const weekStart = toISODate(cursor);
    const unclippedWeekEnd = addDays(cursor, 6);
    const weekEndDate = unclippedWeekEnd > monthEnd ? monthEnd : unclippedWeekEnd;
    const weekEnd = toISODate(weekEndDate);

    weeks.push({
      weekStart,
      weekEnd,
      label: `สัปดาห์ ${index}`,
      detail: formatWeekDetail(weekStart, weekEnd),
    });

    cursor = addDays(weekEndDate, 1);
    index += 1;
  }

  return weeks;
}

function getClippedWeekEnd(weekStart: string, month: number) {
  const start = parseISODate(weekStart);
  if (!start) return null;

  const monthEnd = utcDate(start.getUTCFullYear(), month + 1, 0);
  const unclippedWeekEnd = addDays(start, 6);
  return toISODate(unclippedWeekEnd > monthEnd ? monthEnd : unclippedWeekEnd);
}

async function getCalendarYearsForSurveyMonth(
  departmentId: number,
  yearBE: number,
  month: number,
) {
  const res = await db.query(
    `
    SELECT DISTINCT EXTRACT(YEAR FROM r.responded_date)::int AS calendar_year
    FROM responses r
    JOIN surveys s ON s.id = r.survey_id
    WHERE r.department_id = $1
      AND s.year_be = $2
      AND EXTRACT(MONTH FROM r.responded_date)::int = $3
    ORDER BY calendar_year ASC
    `,
    [departmentId, yearBE, month],
  );

  const years = res.rows
    .map((row) => Number(row.calendar_year))
    .filter((year) => Number.isInteger(year) && year > 0);

  return years.length > 0 ? years : [yearBE - 543];
}

function listDaysForRange(weekStart: string, weekEnd: string) {
  const start = parseISODate(weekStart);
  const end = parseISODate(weekEnd);
  if (!start || !end || start > end) return [];

  const dayCount =
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  return Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(start, index);
    const isoDate = toISODate(date);
    return {
      date: isoDate,
      label: THAI_WEEKDAY_SHORT[date.getUTCDay()] ?? isoDate,
      detail: formatThaiDate(isoDate),
    };
  });
}

function normalizeAggregateRow(row: DrilldownAggregateRow | undefined) {
  if (!row) {
    return {
      avg_rating: null,
      band_label: null,
      respondents_total: 0,
      student: 0,
      staff: 0,
      public: 0,
      has_data: false,
    };
  }

  const avg =
    row.avg_rating === null || row.avg_rating === undefined
      ? null
      : Number(row.avg_rating);

  return {
    avg_rating: avg !== null && Number.isFinite(avg) ? avg : null,
    band_label: row.band_label ?? null,
    respondents_total: Number(row.respondents_total ?? 0),
    student: Number(row.student ?? 0),
    staff: Number(row.staff ?? 0),
    public: Number(row.public ?? 0),
    has_data: Number(row.respondents_total ?? 0) > 0,
  };
}

function mapAggregateByKey(rows: DrilldownAggregateRow[]) {
  const map = new Map<string, DrilldownAggregateRow>();
  rows.forEach((row) => {
    const rawKey =
      row.period_key instanceof Date
        ? toLocalISODate(row.period_key)
        : String(row.period_key);
    map.set(rawKey.slice(0, 10), row);
  });
  return map;
}

async function queryPeriodRows(
  periodExpression: string,
  whereClause: string,
  values: unknown[],
) {
  const res = await db.query(
    `
    WITH filtered_responses AS (
      SELECT
        r.id,
        r.respondent_group,
        r.responded_date,
        s.year_be,
        ${periodExpression} AS period_key
      FROM responses r
      JOIN surveys s ON s.id = r.survey_id
      WHERE r.department_id = $1
        ${whereClause}
    ),
    rating_answers AS (
      SELECT
        fr.id AS response_id,
        a.rating
      FROM filtered_responses fr
      JOIN answers a ON a.response_id = fr.id
      JOIN questions q ON q.id = a.question_id
      WHERE q.type = 'rating'
    ),
    aggregated AS (
      SELECT
        fr.period_key,
        ROUND(AVG(ra.rating)::numeric, 2) AS avg_rating,
        COUNT(DISTINCT fr.id)::int AS respondents_total,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.respondent_group = 'student')::int AS student,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.respondent_group = 'staff')::int AS staff,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.respondent_group = 'public')::int AS public
      FROM filtered_responses fr
      LEFT JOIN rating_answers ra ON ra.response_id = fr.id
      GROUP BY fr.period_key
    )
    SELECT
      aggregated.period_key::text AS period_key,
      aggregated.avg_rating,
      aggregated.respondents_total,
      aggregated.student,
      aggregated.staff,
      aggregated.public,
      rb.label_th AS band_label
    FROM aggregated
    LEFT JOIN LATERAL (
      SELECT label_th
      FROM rating_bands
      WHERE aggregated.avg_rating IS NOT NULL
        AND aggregated.avg_rating >= min_value
        AND aggregated.avg_rating <= max_value
      ORDER BY sort_order DESC
      LIMIT 1
    ) rb ON true
    ORDER BY aggregated.period_key ASC
    `,
    values,
  );

  return res.rows as DrilldownAggregateRow[];
}

async function queryPeriodSummary(whereClause: string, values: unknown[]) {
  const res = await db.query(
    `
    WITH filtered_responses AS (
      SELECT
        r.id,
        r.respondent_group
      FROM responses r
      JOIN surveys s ON s.id = r.survey_id
      WHERE r.department_id = $1
        ${whereClause}
    ),
    rating_answers AS (
      SELECT a.rating
      FROM filtered_responses fr
      JOIN answers a ON a.response_id = fr.id
      JOIN questions q ON q.id = a.question_id
      WHERE q.type = 'rating'
    ),
    summary AS (
      SELECT
        (SELECT COUNT(*)::int FROM filtered_responses) AS respondents_total,
        (SELECT COUNT(*)::int FROM filtered_responses WHERE respondent_group = 'student') AS student,
        (SELECT COUNT(*)::int FROM filtered_responses WHERE respondent_group = 'staff') AS staff,
        (SELECT COUNT(*)::int FROM filtered_responses WHERE respondent_group = 'public') AS public,
        ROUND((SELECT AVG(rating)::numeric FROM rating_answers), 2) AS overall_avg
    )
    SELECT
      summary.*,
      rb.label_th AS overall_band
    FROM summary
    LEFT JOIN LATERAL (
      SELECT label_th
      FROM rating_bands
      WHERE summary.overall_avg IS NOT NULL
        AND summary.overall_avg >= min_value
        AND summary.overall_avg <= max_value
      ORDER BY sort_order DESC
      LIMIT 1
    ) rb ON true
    `,
    values,
  );

  const row = res.rows[0] ?? {};
  const avg =
    row.overall_avg === null || row.overall_avg === undefined
      ? null
      : Number(row.overall_avg);

  return {
    respondents_total: Number(row.respondents_total ?? 0),
    student: Number(row.student ?? 0),
    staff: Number(row.staff ?? 0),
    public: Number(row.public ?? 0),
    overall_avg: avg !== null && Number.isFinite(avg) ? avg : null,
    overall_band: row.overall_band ?? null,
  };
}

async function ensureDepartmentAccess(
  request: Request,
  departmentId: number,
  set: { status?: number | string },
) {
  const user = await authenticateRequest(request);
  if (!canAccessDepartment(user, departmentId)) {
    set.status = 403;
    return false;
  }

  return true;
}

export async function getDepartmentSummary({ params, request, set }: any) {
  const departmentId = Number(params.departmentId);

  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    set.status = 400;
    return { message: "Invalid departmentId" };
  }

  if (!(await ensureDepartmentAccess(request, departmentId, set))) {
    return { message: "Forbidden: cannot access this department" };
  }

  const survey = await getActiveSurvey();

  if (!survey) {
    set.status = 409;
    return { message: "No active survey" };
  }

  const [kpiRes, ratingRes, recentRes, dailyTrendRes, bandsRes] = await Promise.all([
    db.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE respondent_group = 'student')::int AS student,
        COUNT(*) FILTER (WHERE respondent_group = 'staff')::int AS staff,
        COUNT(*) FILTER (WHERE respondent_group = 'public')::int AS public
      FROM responses
      WHERE survey_id = $1
        AND department_id = $2
      `,
      [survey.id, departmentId],
    ),
    db.query(
      `
      SELECT
        q.id AS question_id,
        q.text AS question_text,
        q.type AS question_type,
        COUNT(a.rating)::int AS n,
        CASE
          WHEN q.type = 'rating' THEN ROUND(AVG(a.rating)::numeric, 2)
          ELSE NULL
        END AS avg,
        CASE
          WHEN q.type = 'rating' THEN ROUND(stddev_samp(a.rating)::numeric, 2)
          ELSE NULL
        END AS sd,
        COUNT(*) FILTER (WHERE a.rating = 1)::int AS r1,
        COUNT(*) FILTER (WHERE a.rating = 2)::int AS r2,
        COUNT(*) FILTER (WHERE a.rating = 3)::int AS r3,
        COUNT(*) FILTER (WHERE a.rating = 4)::int AS r4,
        COUNT(*) FILTER (WHERE a.rating = 5)::int AS r5
      FROM questions q
      LEFT JOIN responses r
        ON r.survey_id = q.survey_id
       AND r.department_id = $2
      LEFT JOIN answers a
        ON a.response_id = r.id
       AND a.question_id = q.id
      WHERE q.survey_id = $1
        AND q.status = 'active'
        AND (
          (
            q.scope = 'central'
            AND EXISTS (
              SELECT 1
              FROM department_central_question_settings dcqs
              WHERE dcqs.department_id = $2
                AND dcqs.survey_id = $1
                AND dcqs.enabled = true
            )
          )
          OR (q.scope = 'department' AND q.department_id = $2)
        )
      GROUP BY q.id, q.text, q.type
      ORDER BY q.display_order ASC, q.id ASC
      `,
      [survey.id, departmentId],
    ),
    db.query(
      `
      SELECT
        r.id,
        r.respondent_group,
        r.submitted_at
      FROM responses r
      WHERE r.survey_id = $1
        AND r.department_id = $2
      ORDER BY r.submitted_at DESC
      LIMIT 5
      `,
      [survey.id, departmentId],
    ),
    db.query(
      `
      WITH department_responses AS (
        SELECT
          r.id,
          (timezone('${REPORT_TIMEZONE}', r.submitted_at))::date AS submitted_date_local
        FROM responses r
        WHERE r.survey_id = $1
          AND r.department_id = $2
      ),
      date_series AS (
        SELECT generate_series(
          (timezone('${REPORT_TIMEZONE}', now()))::date - 6,
          (timezone('${REPORT_TIMEZONE}', now()))::date,
          '1 day'::interval
        )::date AS day
      )
      SELECT
        ds.day,
        COUNT(dr.id)::int AS count
      FROM date_series ds
      LEFT JOIN department_responses dr
        ON dr.submitted_date_local = ds.day
      GROUP BY ds.day
      ORDER BY ds.day ASC
      `,
      [survey.id, departmentId],
    ),
    db.query(`
      SELECT id, min_value, max_value, label_th, sort_order
      FROM rating_bands
      ORDER BY sort_order ASC, min_value ASC
    `),
  ]);

  return {
    survey: { id: survey.id, year_be: survey.year_be, title: survey.title },
    rating_bands: bandsRes.rows,
    kpi: kpiRes.rows[0],
    ratings: ratingRes.rows,
    recent_responses: recentRes.rows,
    daily_trend: dailyTrendRes.rows,
  };
}

export async function getDepartmentComments({ params, query, request, set }: any) {
  const departmentId = Number(params.departmentId);
  const limit = Math.min(Number(query.limit) || 20, 100);
  const offset = Number(query.offset) || 0;

  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    set.status = 400;
    return { message: "Invalid departmentId" };
  }

  if (!(await ensureDepartmentAccess(request, departmentId, set))) {
    return { message: "Forbidden: cannot access this department" };
  }

  const survey = await getActiveSurvey();

  if (!survey) {
    set.status = 409;
    return { message: "No active survey" };
  }

  const surveyId = survey.id;

  const countRes = await db.query(
    `
    SELECT COUNT(*)::int AS total
    FROM answers a
    JOIN questions q ON q.id = a.question_id
    JOIN responses r ON r.id = a.response_id
    WHERE q.survey_id = $1
      AND r.department_id = $2
      AND q.type = 'text'
      AND a.comment IS NOT NULL
      AND btrim(a.comment) <> ''
    `,
    [surveyId, departmentId],
  );

  const commentsRes = await db.query(
    `
    SELECT
      a.id AS answer_id,
      q.id AS question_id,
      q.text AS question_text,
      r.respondent_group,
      a.comment,
      r.submitted_at
    FROM answers a
    JOIN questions q ON q.id = a.question_id
    JOIN responses r ON r.id = a.response_id
    WHERE q.survey_id = $1
      AND r.department_id = $2
      AND q.type = 'text'
      AND a.comment IS NOT NULL
      AND btrim(a.comment) <> ''
    ORDER BY r.submitted_at DESC
    LIMIT $3 OFFSET $4
    `,
    [surveyId, departmentId, limit, offset],
  );

  return {
    total: countRes.rows[0].total,
    limit,
    offset,
    items: commentsRes.rows,
  };
}

export async function getDepartmentYearly({ params, query, request, set }: any) {
  const departmentId = Number(params.departmentId);
  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    set.status = 400;
    return { message: "Invalid departmentId" };
  }

  if (!(await ensureDepartmentAccess(request, departmentId, set))) {
    return { message: "Forbidden: cannot access this department" };
  }

  const view = parseView(query.view);
  const currentBE = getCurrentBEYear();
  const requestedFrom = parseIntValue(query.from);
  const requestedTo = parseIntValue(query.to);
  const from = requestedFrom ?? currentBE - 4;
  const to = requestedTo ?? currentBE;
  const selectedYear = parseIntValue(query.year);
  const selectedMonth = parseMonthValue(query.month);
  const selectedWeekStart = parseISODate(query.weekStart);

  const deptRes = await db.query(
    `SELECT id, name FROM departments WHERE id = $1 AND is_active = true`,
    [departmentId],
  );
  if (deptRes.rowCount === 0) {
    set.status = 404;
    return { message: "Department not found" };
  }
  const department = deptRes.rows[0];

  let rows: DrilldownPeriodRow[] = [];
  let title = "สรุปผลการประเมินรายปี";
  let chartTitle = "กราฟคะแนนเฉลี่ย 5 ปีล่าสุด";
  let summaryTitle = "สรุปข้อมูลรายปี";
  let periodLabel = `พ.ศ. ${from} - ${to}`;
  let periodCountLabel = "จำนวนปีที่มีข้อมูล";
  let summaryWhere = "AND s.year_be >= $2 AND s.year_be <= $3";
  let summaryValues: unknown[] = [departmentId, from, to];

  if (view === "year") {
    const aggregateRows = await queryPeriodRows(
      "s.year_be::int",
      summaryWhere,
      summaryValues,
    );
    const aggregateMap = mapAggregateByKey(aggregateRows);

    rows = Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => {
      const year = from + index;
      const metrics = normalizeAggregateRow(aggregateMap.get(String(year)));

      return {
        key: String(year),
        label: String(year),
        detail_label: `พ.ศ. ${year}`,
        year_be: year,
        month: null,
        week_start: null,
        week_end: null,
        date: null,
        ...metrics,
      };
    });
  } else if (view === "month") {
    if (selectedYear === null) {
      set.status = 400;
      return { message: "year is required for monthly view" };
    }

    summaryWhere = "AND s.year_be = $2";
    summaryValues = [departmentId, selectedYear];
    title = "สรุปผลการประเมินรายเดือน";
    chartTitle = `กราฟคะแนนเฉลี่ยรายเดือน พ.ศ. ${selectedYear}`;
    summaryTitle = "สรุปข้อมูลรายเดือน";
    periodLabel = `พ.ศ. ${selectedYear}`;
    periodCountLabel = "จำนวนเดือนที่มีข้อมูล";

    const aggregateRows = await queryPeriodRows(
      "EXTRACT(MONTH FROM r.responded_date)::int",
      summaryWhere,
      summaryValues,
    );
    const aggregateMap = mapAggregateByKey(aggregateRows);

    rows = THAI_MONTH_SHORT.map((monthLabel, index) => {
      const month = index + 1;
      const metrics = normalizeAggregateRow(aggregateMap.get(String(month)));

      return {
        key: `${selectedYear}-${String(month).padStart(2, "0")}`,
        label: monthLabel,
        detail_label: `${monthLabel} ${selectedYear}`,
        year_be: selectedYear,
        month,
        week_start: null,
        week_end: null,
        date: null,
        ...metrics,
      };
    });
  } else if (view === "week") {
    if (selectedYear === null || selectedMonth === null) {
      set.status = 400;
      return { message: "year and month are required for weekly view" };
    }

    const monthLabel = THAI_MONTH_SHORT[selectedMonth - 1] ?? String(selectedMonth);
    summaryWhere =
      "AND s.year_be = $2 AND EXTRACT(MONTH FROM r.responded_date)::int = $3";
    summaryValues = [departmentId, selectedYear, selectedMonth];
    title = "สรุปผลการประเมินรายสัปดาห์";
    chartTitle = `กราฟคะแนนเฉลี่ยรายสัปดาห์ ${monthLabel} ${selectedYear}`;
    summaryTitle = "สรุปข้อมูลรายสัปดาห์";
    periodLabel = `${monthLabel} ${selectedYear}`;
    periodCountLabel = "จำนวนสัปดาห์ที่มีข้อมูล";

    const aggregateRows = await queryPeriodRows(
      `(date_trunc('month', r.responded_date)::date
        + ((((EXTRACT(DAY FROM r.responded_date)::int - 1) / 7) * 7) * INTERVAL '1 day')
      )::date`,
      summaryWhere,
      summaryValues,
    );
    const aggregateMap = mapAggregateByKey(aggregateRows);

    const calendarYears = await getCalendarYearsForSurveyMonth(
      departmentId,
      selectedYear,
      selectedMonth,
    );
    const weeks = calendarYears.flatMap((calendarYear) =>
      listWeeksForCalendarMonth(calendarYear, selectedMonth),
    );

    rows = weeks.map((week) => {
      const metrics = normalizeAggregateRow(aggregateMap.get(week.weekStart));

      return {
        key: week.weekStart,
        label: week.label,
        detail_label: week.detail,
        year_be: selectedYear,
        month: selectedMonth,
        week_start: week.weekStart,
        week_end: week.weekEnd,
        date: null,
        ...metrics,
      };
    });
  } else {
    if (
      selectedYear === null ||
      selectedMonth === null ||
      selectedWeekStart === null
    ) {
      set.status = 400;
      return { message: "year, month and weekStart are required for daily view" };
    }

    const weekStart = toISODate(selectedWeekStart);
    const weekEnd = getClippedWeekEnd(weekStart, selectedMonth);
    if (!weekEnd) {
      set.status = 400;
      return { message: "Invalid weekStart" };
    }
    const monthLabel = THAI_MONTH_SHORT[selectedMonth - 1] ?? String(selectedMonth);
    summaryWhere =
      "AND s.year_be = $2 AND EXTRACT(MONTH FROM r.responded_date)::int = $3 AND r.responded_date >= $4::date AND r.responded_date <= $5::date";
    summaryValues = [departmentId, selectedYear, selectedMonth, weekStart, weekEnd];
    title = "สรุปผลการประเมินรายวัน";
    chartTitle = `กราฟคะแนนเฉลี่ยรายวัน ${formatWeekDetail(weekStart, weekEnd)}`;
    summaryTitle = "สรุปข้อมูลรายวัน";
    periodLabel = `${monthLabel} ${selectedYear} / ${formatWeekDetail(weekStart, weekEnd)}`;
    periodCountLabel = "จำนวนวันที่มีข้อมูล";

    const aggregateRows = await queryPeriodRows(
      "r.responded_date::date",
      summaryWhere,
      summaryValues,
    );
    const aggregateMap = mapAggregateByKey(aggregateRows);

    rows = listDaysForRange(weekStart, weekEnd).map((day) => {
      const metrics = normalizeAggregateRow(aggregateMap.get(day.date));

      return {
        key: day.date,
        label: day.label,
        detail_label: day.detail,
        year_be: selectedYear,
        month: selectedMonth,
        week_start: weekStart,
        week_end: weekEnd,
        date: day.date,
        ...metrics,
      };
    });
  }

  const summary = await queryPeriodSummary(summaryWhere, summaryValues);

  return {
    department,
    view,
    title,
    chart_title: chartTitle,
    summary_title: summaryTitle,
    period_label: periodLabel,
    period_count_label: periodCountLabel,
    from,
    to,
    selected_year: selectedYear,
    selected_month: selectedMonth,
    selected_week_start:
      selectedWeekStart === null ? null : toISODate(selectedWeekStart),
    periods_with_data: rows.filter((row) => row.has_data).length,
    respondents_total: summary.respondents_total,
    student: summary.student,
    staff: summary.staff,
    public: summary.public,
    overall_avg: summary.overall_avg,
    overall_band: summary.overall_band,
    rows,
  };
}

export async function resetDepartmentQRCode({ params, request, set }: any) {
  const departmentId = Number(params.departmentId);

  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    set.status = 400;
    return { message: "Invalid departmentId" };
  }

  if (!(await ensureDepartmentAccess(request, departmentId, set))) {
    return { message: "Forbidden: cannot access this department" };
  }

  const deptRes = await db.query(
    `SELECT id, name, is_active
     FROM departments
     WHERE id = $1
       AND is_active = true`,
    [departmentId],
  );

  if (deptRes.rowCount === 0) {
    set.status = 404;
    return { message: "Department not found" };
  }

  const department = deptRes.rows[0];
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const qrAsset = await generateDepartmentQRCodeAsset(departmentId);

    await client.query(
      `DELETE FROM qrcodes WHERE type = 'department' AND department_id = $1`,
      [departmentId],
    );

    await client.query(
      `INSERT INTO qrcodes (type, department_id, image_path, link_target, is_active)
       VALUES ('department', $1, $2, $3, true)`,
      [departmentId, qrAsset.imagePath, qrAsset.link],
    );

    const qrRes = await client.query(
      `SELECT id, image_path, link_target, created_at
       FROM qrcodes
       WHERE type = 'department' AND department_id = $1
       LIMIT 1`,
      [departmentId],
    );

    await client.query("COMMIT");

    const qrcode = qrRes.rows[0];

    return {
      message: "QR Code เธซเธเนเธงเธขเธเธฒเธเธฃเธตเน€เธเธ•เธชเธณเน€เธฃเนเธ",
      department: {
        id: department.id,
        name: department.name,
        is_active: department.is_active,
        qrcode_id: qrcode.id,
        image_path: qrcode.image_path,
        link_target: qrcode.link_target,
        qr_created_at: qrcode.created_at,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
