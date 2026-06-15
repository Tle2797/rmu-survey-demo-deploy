import { db } from "../config/db";

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

type ExecYearlyView = "year" | "month" | "week" | "day";

type AggregateRow = {
  period_key: number | string | Date;
  avg_rating: number | string | null;
  band_label: string | null;
  respondents_total: number | string;
  student: number | string;
  staff: number | string;
  public: number | string;
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

type ComparisonPeriod = {
  key: string;
  label: string;
  detail_label: string | null;
};

function getCurrentBEYear() {
  return new Date().getFullYear() + 543;
}

function parseView(value: unknown): ExecYearlyView {
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

async function getCalendarYearsForSurveyMonth(yearBE: number, month: number) {
  const res = await db.query(
    `
    SELECT DISTINCT EXTRACT(YEAR FROM r.responded_date)::int AS calendar_year
    FROM responses r
    JOIN surveys s ON s.id = r.survey_id
    WHERE s.year_be = $1
      AND EXTRACT(MONTH FROM r.responded_date)::int = $2
    ORDER BY calendar_year ASC
    `,
    [yearBE, month],
  );

  const years = res.rows
    .map((row) => Number(row.calendar_year))
    .filter((year) => Number.isInteger(year) && year > 0);

  return years.length > 0 ? years : [yearBE - 543];
}

function normalizeAggregateRow(row: AggregateRow | undefined) {
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

function mapAggregateByKey(rows: AggregateRow[]) {
  const map = new Map<string, AggregateRow>();
  rows.forEach((row) => {
    const rawKey =
      row.period_key instanceof Date
        ? toLocalISODate(row.period_key)
        : String(row.period_key);
    map.set(rawKey.slice(0, 10), row);
  });
  return map;
}

function calculateLatestDiff(periodKeys: string[], scores: Record<string, number>) {
  const dataKeys = periodKeys.filter((key) => Number(scores[key] ?? 0) > 0);

  if (dataKeys.length === 0) return 0;

  const latestKey = dataKeys[dataKeys.length - 1]!;
  const latestValue = Number(scores[latestKey] ?? 0);

  if (dataKeys.length === 1) {
    return Number(latestValue.toFixed(2));
  }

  const previousKey = dataKeys[dataKeys.length - 2]!;
  const previousValue = Number(scores[previousKey] ?? 0);
  return Number((latestValue - previousValue).toFixed(2));
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
      WHERE 1 = 1
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

  return res.rows as AggregateRow[];
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
      WHERE 1 = 1
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

async function getYearlyDepartmentComparison(yearsBE: number[]) {
  if (yearsBE.length === 0) {
    return {
      years: [],
      items: [],
    };
  }

  const from = yearsBE[0]!;
  const to = yearsBE[yearsBE.length - 1]!;

  const [allActiveDepts, deptRes] = await Promise.all([
    db.query(`SELECT id, name FROM departments WHERE is_active = true ORDER BY name ASC`),
    db.query(
      `
      SELECT
        d.id AS department_id,
        d.name AS department_name,
        s.year_be::int AS year_be,
        ROUND(AVG(a.rating)::numeric, 2) AS avg_rating
      FROM responses r
      JOIN departments d
        ON d.id = r.department_id
       AND d.is_active = true
      JOIN surveys s
        ON s.id = r.survey_id
       AND s.year_be >= $1
       AND s.year_be <= $2
      JOIN answers a ON a.response_id = r.id
      JOIN questions q
        ON q.id = a.question_id
       AND q.type = 'rating'
      GROUP BY d.id, d.name, s.year_be
      ORDER BY d.name ASC, s.year_be ASC
      `,
      [from, to],
    ),
  ]);

  const departmentsMap = new Map<
    number,
    {
      department_id: number;
      department_name: string;
      scores: Record<string, number>;
      latest_diff: number;
    }
  >();

  allActiveDepts.rows.forEach((department) => {
    const initScores: Record<string, number> = {};
    yearsBE.forEach((yearBE) => {
      initScores[String(yearBE)] = 0;
    });

    departmentsMap.set(Number(department.id), {
      department_id: Number(department.id),
      department_name: String(department.name),
      scores: initScores,
      latest_diff: 0,
    });
  });

  deptRes.rows.forEach((row) => {
    const departmentId = Number(row.department_id);
    const yearBE = Number(row.year_be);
    const department = departmentsMap.get(departmentId);

    if (!department || !yearBE) return;
    department.scores[String(yearBE)] = Number(row.avg_rating);
  });

  const periodKeys = yearsBE.map((yearBE) => String(yearBE));
  const items = Array.from(departmentsMap.values()).map((department) => {
    department.latest_diff = calculateLatestDiff(periodKeys, department.scores);
    return department;
  });

  return {
    years: yearsBE,
    items,
  };
}

async function getDepartmentPeriodComparison(
  periods: ComparisonPeriod[],
  periodExpression: string,
  whereClause: string,
  values: unknown[],
) {
  if (periods.length === 0) {
    return {
      years: [],
      periods,
      items: [],
    };
  }

  const periodKeys = periods.map((period) => period.key);
  const periodKeySet = new Set(periodKeys);

  const [allActiveDepts, deptRes] = await Promise.all([
    db.query(`SELECT id, name FROM departments WHERE is_active = true ORDER BY name ASC`),
    db.query(
      `
      SELECT
        d.id AS department_id,
        d.name AS department_name,
        (${periodExpression})::text AS period_key,
        ROUND(AVG(a.rating)::numeric, 2) AS avg_rating
      FROM responses r
      JOIN departments d
        ON d.id = r.department_id
       AND d.is_active = true
      JOIN surveys s ON s.id = r.survey_id
      JOIN answers a ON a.response_id = r.id
      JOIN questions q
        ON q.id = a.question_id
       AND q.type = 'rating'
      WHERE 1 = 1
        ${whereClause}
      GROUP BY d.id, d.name, period_key
      ORDER BY d.name ASC, period_key ASC
      `,
      values,
    ),
  ]);

  const departmentsMap = new Map<
    number,
    {
      department_id: number;
      department_name: string;
      scores: Record<string, number>;
      latest_diff: number;
    }
  >();
  allActiveDepts.rows.forEach((department) => {
    const initScores: Record<string, number> = {};
    periodKeys.forEach((key) => {
      initScores[key] = 0;
    });

    departmentsMap.set(Number(department.id), {
      department_id: Number(department.id),
      department_name: String(department.name),
      scores: initScores,
      latest_diff: 0,
    });
  });

  deptRes.rows.forEach((row) => {
    const departmentId = Number(row.department_id);
    const periodKey = String(row.period_key).slice(0, 10);
    const department = departmentsMap.get(departmentId);

    if (!department || !periodKeySet.has(periodKey)) return;
    department.scores[periodKey] = Number(row.avg_rating);
  });

  const items = Array.from(departmentsMap.values()).map((department) => {
    department.latest_diff = calculateLatestDiff(periodKeys, department.scores);
    return department;
  });

  const years = periods
    .map((period) => Number(period.key))
    .filter((year) => Number.isInteger(year));

  return {
    years,
    periods,
    items,
  };
}

async function queryDepartmentRanking(whereClause: string, values: unknown[]) {
  const res = await db.query(
    `
    WITH filtered_responses AS (
      SELECT
        r.id,
        r.department_id,
        r.respondent_group
      FROM responses r
      JOIN surveys s ON s.id = r.survey_id
      WHERE 1 = 1
        ${whereClause}
    ),
    rating_answers AS (
      SELECT
        fr.department_id,
        fr.id AS response_id,
        a.rating
      FROM filtered_responses fr
      JOIN answers a ON a.response_id = fr.id
      JOIN questions q ON q.id = a.question_id
      WHERE q.type = 'rating'
    ),
    aggregated AS (
      SELECT
        d.id AS department_id,
        d.name AS department_name,
        ROUND(AVG(ra.rating)::numeric, 2) AS avg_rating,
        COUNT(DISTINCT fr.id)::int AS respondents_total,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.respondent_group = 'student')::int AS student,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.respondent_group = 'staff')::int AS staff,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.respondent_group = 'public')::int AS public
      FROM departments d
      LEFT JOIN filtered_responses fr ON fr.department_id = d.id
      LEFT JOIN rating_answers ra
        ON ra.department_id = d.id
       AND ra.response_id = fr.id
      WHERE d.is_active = true
      GROUP BY d.id, d.name
    )
    SELECT
      aggregated.*,
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
    ORDER BY aggregated.avg_rating DESC NULLS LAST,
      aggregated.respondents_total DESC,
      aggregated.department_name ASC
    `,
    values,
  );

  return res.rows.map((row) => ({
    department_id: Number(row.department_id),
    department_name: String(row.department_name),
    avg_rating:
      row.avg_rating === null || row.avg_rating === undefined
        ? null
        : Number(row.avg_rating),
    band_label: row.band_label ?? null,
    respondents_total: Number(row.respondents_total ?? 0),
    student: Number(row.student ?? 0),
    staff: Number(row.staff ?? 0),
    public: Number(row.public ?? 0),
  }));
}

export async function getExecYearly({ query, set }: any) {
  const view = parseView(query?.view);
  const currentBEYear = getCurrentBEYear();
  const requestedFrom = parseIntValue(query?.from);
  const requestedTo = parseIntValue(query?.to);
  const from = requestedFrom ?? currentBEYear - 4;
  const to = requestedTo ?? currentBEYear;
  const yearsBE = Array.from(
    { length: Math.max(0, to - from + 1) },
    (_, index) => from + index,
  );
  const selectedYear = parseIntValue(query?.year);
  const selectedMonth = parseMonthValue(query?.month);
  const selectedWeekStart = parseISODate(query?.weekStart);
  const selectedDate = parseISODate(query?.date);

  let rows: PeriodRow[] = [];
  let title = "สรุปผลการประเมินรายปีของผู้บริหาร";
  let chartTitle = "กราฟคะแนนเฉลี่ย 5 ปีล่าสุด";
  let summaryTitle = "สรุปข้อมูลรายปี";
  let periodLabel = `พ.ศ. ${from} - ${to}`;
  let periodCountLabel = "จำนวนปีที่มีข้อมูล";
  let summaryWhere = "AND s.year_be >= $1 AND s.year_be <= $2";
  let summaryValues: unknown[] = [from, to];
  let comparisonPeriodExpression = "s.year_be::text";
  let comparisonWhere = summaryWhere;
  let comparisonValues = summaryValues;

  if (view === "year") {
    const aggregateRows = await queryPeriodRows(
      "s.year_be::int",
      summaryWhere,
      summaryValues,
    );
    const aggregateMap = mapAggregateByKey(aggregateRows);

    rows = yearsBE.map((year) => {
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

    summaryWhere = "AND s.year_be = $1";
    summaryValues = [selectedYear];
    comparisonPeriodExpression =
      "s.year_be::text || '-' || LPAD(EXTRACT(MONTH FROM r.responded_date)::int::text, 2, '0')";
    comparisonWhere = summaryWhere;
    comparisonValues = summaryValues;
    title = "สรุปผลการประเมินรายเดือนของผู้บริหาร";
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
      "AND s.year_be = $1 AND EXTRACT(MONTH FROM r.responded_date)::int = $2";
    summaryValues = [selectedYear, selectedMonth];
    comparisonPeriodExpression =
      `(date_trunc('month', r.responded_date)::date
        + ((((EXTRACT(DAY FROM r.responded_date)::int - 1) / 7) * 7) * INTERVAL '1 day')
      )::date`;
    comparisonWhere = summaryWhere;
    comparisonValues = summaryValues;
    title = "สรุปผลการประเมินรายสัปดาห์ของผู้บริหาร";
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
    const weekWhere =
      "AND s.year_be = $1 AND EXTRACT(MONTH FROM r.responded_date)::int = $2 AND r.responded_date >= $3::date AND r.responded_date <= $4::date";
    const weekValues: unknown[] = [selectedYear, selectedMonth, weekStart, weekEnd];
    comparisonPeriodExpression = "r.responded_date::date";
    comparisonWhere = weekWhere;
    comparisonValues = weekValues;
    title = "สรุปผลการประเมินรายวันของผู้บริหาร";
    chartTitle = `กราฟคะแนนเฉลี่ยรายวัน ${formatWeekDetail(weekStart, weekEnd)}`;
    summaryTitle = "สรุปข้อมูลรายวัน";
    periodLabel = `${monthLabel} ${selectedYear} / ${formatWeekDetail(weekStart, weekEnd)}`;
    periodCountLabel = "จำนวนวันที่มีข้อมูล";

    const aggregateRows = await queryPeriodRows(
      "r.responded_date::date",
      weekWhere,
      weekValues,
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

    if (selectedDate !== null) {
      const selectedDateISO = toISODate(selectedDate);
      if (selectedDateISO >= weekStart && selectedDateISO <= weekEnd) {
        summaryWhere =
          "AND s.year_be = $1 AND EXTRACT(MONTH FROM r.responded_date)::int = $2 AND r.responded_date::date = $3::date";
        summaryValues = [selectedYear, selectedMonth, selectedDateISO];
        periodLabel = `${monthLabel} ${selectedYear} / ${formatThaiDate(selectedDateISO)}`;
        periodCountLabel = "วันที่เลือก";
      } else {
        summaryWhere = weekWhere;
        summaryValues = weekValues;
      }
    } else {
      summaryWhere = weekWhere;
      summaryValues = weekValues;
    }
  }

  const comparisonPeriods = rows.map((row) => ({
    key: row.key,
    label: view === "year" ? row.detail_label ?? row.label : row.label,
    detail_label: view === "year" ? null : row.detail_label,
  }));

  const [summary, ratingBandsRes, comparison] = await Promise.all([
    queryPeriodSummary(summaryWhere, summaryValues),
    db.query(`
      SELECT id, min_value, max_value, label_th, sort_order
      FROM rating_bands
      ORDER BY sort_order ASC, min_value ASC
    `),
    getDepartmentPeriodComparison(
      comparisonPeriods,
      comparisonPeriodExpression,
      comparisonWhere,
      comparisonValues,
    ),
  ]);

  return {
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
    selected_date: selectedDate === null ? null : toISODate(selectedDate),
    periods_with_data: rows.filter((row) => row.has_data).length,
    respondents_total: summary.respondents_total,
    student: summary.student,
    staff: summary.staff,
    public: summary.public,
    overall_avg: summary.overall_avg,
    overall_band: summary.overall_band,
    rows,
    comparison,
    ranking: [],
    rating_bands: ratingBandsRes.rows.map((row) => ({
      id: Number(row.id),
      min_value: Number(row.min_value),
      max_value: Number(row.max_value),
      label_th: row.label_th,
      sort_order: Number(row.sort_order),
    })),
  };
}
