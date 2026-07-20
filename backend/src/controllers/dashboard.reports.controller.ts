import { db } from "../config/db";
import { authenticateRequest } from "../utils/auth";
import { canAccessDepartment } from "../utils/authorization";
import { getActiveSurvey } from "../utils/surveys";

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

type ReportView = "all" | "month" | "week" | "day";
type RespondentGroup = "student" | "staff" | "public";

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseMonth(value: unknown) {
  const parsed = parsePositiveInt(value);
  return parsed !== null && parsed >= 1 && parsed <= 12 ? parsed : null;
}

function parseReportView(value: unknown): ReportView {
  const normalized = String(value ?? "all").trim().toLowerCase();
  if (normalized === "month" || normalized === "week" || normalized === "day") {
    return normalized;
  }
  return "all";
}

function parseRespondentGroup(value: unknown): RespondentGroup | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "student" || normalized === "staff" || normalized === "public") {
    return normalized;
  }
  return null;
}

function parseISODateText(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function parseISODate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getClippedWeekEnd(weekStartText: string, month: number | null) {
  const weekStart = parseISODate(weekStartText);
  if (!weekStart) return null;

  const weekEnd = addDays(weekStart, 6);
  if (month === null) return toISODate(weekEnd);

  const monthEnd = new Date(Date.UTC(weekStart.getUTCFullYear(), month, 0));
  return toISODate(weekEnd > monthEnd ? monthEnd : weekEnd);
}

export async function getDashboardReports({ params, query, request, set }: any) {
  const departmentId = Number(params.departmentId);
  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    set.status = 400;
    return { message: "Invalid departmentId" };
  }

  if (!(await ensureDepartmentAccess(request, departmentId, set))) {
    return { message: "Forbidden: cannot access this department" };
  }

  const activeSurvey = await getActiveSurvey();

  const availableSurveysRes = await db.query(
    `
    SELECT
      s.id,
      s.title,
      s.year_be,
      COUNT(r.id)::int AS response_count
    FROM surveys s
    JOIN responses r ON r.survey_id = s.id
    WHERE r.department_id = $1
    GROUP BY s.id, s.title, s.year_be
    ORDER BY s.year_be DESC NULLS LAST, s.id DESC
    `,
    [departmentId],
  );

  let timeSlotId: number | undefined;
  if (query.timeSlotId !== undefined) {
    const parsedTimeSlotId = Number(query.timeSlotId);
    if (!Number.isFinite(parsedTimeSlotId) || parsedTimeSlotId <= 0) {
      set.status = 400;
      return { message: "Invalid timeSlotId" };
    }
    timeSlotId = parsedTimeSlotId;
  }

  const requestedSurveyId = parsePositiveInt(query.surveyId);
  if (query.surveyId !== undefined && requestedSurveyId === null) {
    set.status = 400;
    return { message: "Invalid surveyId" };
  }

  let requestedYear: number | undefined;
  if (query.year !== undefined) {
    const parsedYear = Number(query.year);
    if (!Number.isInteger(parsedYear)) {
      set.status = 400;
      return { message: "Invalid year" };
    }
    requestedYear = parsedYear;
  }

  const surveyRes = requestedSurveyId
    ? await db.query(
        `SELECT id, title, year_be FROM surveys WHERE id = $1 LIMIT 1`,
        [requestedSurveyId],
      )
    : requestedYear !== undefined
      ? await db.query(
          `
          SELECT s.id, s.title, s.year_be
          FROM surveys s
          JOIN responses r ON r.survey_id = s.id
          WHERE s.year_be = $1
            AND r.department_id = $2
          GROUP BY s.id, s.title, s.year_be, s.is_active, s.updated_at
          ORDER BY s.year_be DESC NULLS LAST, s.id DESC
          LIMIT 1
          `,
          [requestedYear, departmentId],
        )
      : { rows: [] };

  const selectedSurvey =
    surveyRes.rows[0] ??
    availableSurveysRes.rows[0] ??
    activeSurvey ??
    null;

  if (!selectedSurvey) {
    set.status = 409;
    return { message: "No survey data" };
  }

  const respondentGroup = parseRespondentGroup(query.respondentGroup);
  if (
    query.respondentGroup !== undefined &&
    String(query.respondentGroup) !== "all" &&
    respondentGroup === null
  ) {
    set.status = 400;
    return { message: "Invalid respondentGroup" };
  }

  const selectedMonth = parseMonth(query.month);
  if (query.month !== undefined && selectedMonth === null) {
    set.status = 400;
    return { message: "Invalid month" };
  }
  const selectedWeekStart = parseISODateText(query.weekStart);
  if (query.weekStart !== undefined && selectedWeekStart === null) {
    set.status = 400;
    return { message: "Invalid weekStart" };
  }
  const selectedDate = parseISODateText(query.date);
  if (query.date !== undefined && selectedDate === null) {
    set.status = 400;
    return { message: "Invalid date" };
  }

  if (selectedWeekStart && !selectedMonth) {
    set.status = 400;
    return { message: "month is required before weekStart" };
  }

  if (selectedDate && (!selectedMonth || !selectedWeekStart)) {
    set.status = 400;
    return { message: "month and weekStart are required before date" };
  }

  const requestedView = parseReportView(query.view);
  const reportView: ReportView = selectedDate
    ? "day"
    : selectedWeekStart
      ? "week"
      : selectedMonth
        ? "month"
        : requestedView;

  let filterClause = " AND r.department_id = $1 AND r.survey_id = $2";
  const paramsList: Array<number | string> = [departmentId, Number(selectedSurvey.id)];

  if (timeSlotId) {
    filterClause += ` AND r.slot_id = $${paramsList.length + 1}`;
    paramsList.push(timeSlotId!);
  }

  if (respondentGroup) {
    filterClause += ` AND r.respondent_group = $${paramsList.length + 1}`;
    paramsList.push(respondentGroup);
  }

  if (selectedMonth) {
    filterClause += ` AND EXTRACT(MONTH FROM r.responded_date)::int = $${paramsList.length + 1}`;
    paramsList.push(selectedMonth);
  }

  if (selectedWeekStart && !selectedDate) {
    const weekEnd = getClippedWeekEnd(selectedWeekStart, selectedMonth);
    if (!weekEnd) {
      set.status = 400;
      return { message: "Invalid weekStart" };
    }
    filterClause += ` AND r.responded_date::date >= $${paramsList.length + 1}::date AND r.responded_date::date <= $${paramsList.length + 2}::date`;
    paramsList.push(selectedWeekStart);
    paramsList.push(weekEnd);
  }

  if (selectedDate) {
    filterClause += ` AND r.responded_date::date = $${paramsList.length + 1}::date`;
    paramsList.push(selectedDate);
  }

  const summaryRes = await db.query(
    `
    WITH filtered_responses AS (
      SELECT r.id, r.respondent_group
      FROM responses r
      WHERE 1 = 1
      ${filterClause}
    ),
    rating_answers AS (
      SELECT a.rating
      FROM filtered_responses fr
      JOIN answers a ON a.response_id = fr.id
      JOIN questions q ON q.id = a.question_id
      WHERE q.type = 'rating'
    )
    SELECT
      (SELECT COUNT(*)::int FROM filtered_responses) AS total_responses,
      ROUND((SELECT AVG(rating)::numeric FROM rating_answers), 2) AS avg_rating,
      ROUND((SELECT stddev_samp(rating)::numeric FROM rating_answers), 2) AS overall_sd,
      (SELECT COUNT(*)::int FROM filtered_responses WHERE respondent_group = 'student') AS student_count,
      (SELECT COUNT(*)::int FROM filtered_responses WHERE respondent_group = 'staff') AS staff_count,
      (SELECT COUNT(*)::int FROM filtered_responses WHERE respondent_group = 'public') AS public_count
    `,
    paramsList,
  );

  const questionsRes = await db.query(
    `
    WITH filtered_responses AS (
      SELECT r.id
      FROM responses r
      WHERE 1 = 1
      ${filterClause}
    )
    SELECT
      q.id AS question_id,
      q.text AS question_text,
      q.scope AS question_scope,
      COUNT(a.id)::int AS total_responses,
      ROUND(AVG(a.rating)::numeric, 2) AS avg_rating,
      ROUND(stddev_samp(a.rating)::numeric, 2) AS sd
    FROM filtered_responses fr
    JOIN answers a ON a.response_id = fr.id
    JOIN questions q ON q.id = a.question_id
    GROUP BY q.id, q.text, q.scope, q.display_order
    ORDER BY
      CASE
        WHEN q.scope = 'central' THEN 0
        WHEN q.scope = 'department' THEN 1
        ELSE 2
      END,
      q.display_order ASC NULLS LAST,
      q.id ASC
    `,
    paramsList,
  );

  const commentsRes = await db.query(
    `
    WITH filtered_responses AS (
      SELECT r.id, r.respondent_group, r.submitted_at
      FROM responses r
      WHERE 1 = 1
      ${filterClause}
    )
    SELECT
      a.id AS answer_id,
      q.id AS question_id,
      q.text AS question_text,
      q.scope AS question_scope,
      fr.respondent_group,
      a.comment,
      fr.submitted_at
    FROM filtered_responses fr
    JOIN answers a ON a.response_id = fr.id
    JOIN questions q ON q.id = a.question_id
    WHERE q.type = 'text'
      AND a.comment IS NOT NULL
      AND btrim(a.comment) <> ''
    ORDER BY fr.submitted_at DESC, a.id DESC
    `,
    paramsList,
  );

  let monthsOptionClause = "WHERE r.department_id = $1 AND r.survey_id = $2";
  const monthsOptionParams: Array<number | string> = [
    departmentId,
    Number(selectedSurvey.id),
  ];

  if (respondentGroup) {
    monthsOptionClause += ` AND r.respondent_group = $${monthsOptionParams.length + 1}`;
    monthsOptionParams.push(respondentGroup);
  }

  const monthsRes = await db.query(
    `
    SELECT DISTINCT EXTRACT(MONTH FROM r.responded_date)::int AS month
    FROM responses r
    ${monthsOptionClause}
    ORDER BY month ASC
    `,
    monthsOptionParams,
  );

  let periodOptionClause = "WHERE r.department_id = $1 AND r.survey_id = $2";
  const periodOptionParams: Array<number | string> = [
    departmentId,
    Number(selectedSurvey.id),
  ];

  if (respondentGroup) {
    periodOptionClause += ` AND r.respondent_group = $${periodOptionParams.length + 1}`;
    periodOptionParams.push(respondentGroup);
  }

  if (selectedMonth) {
    periodOptionClause += ` AND EXTRACT(MONTH FROM r.responded_date)::int = $${periodOptionParams.length + 1}`;
    periodOptionParams.push(selectedMonth);
  }

  const weeksRes = await db.query(
    `
    SELECT
      MIN(week_index)::int AS week_index,
      to_char(week_start, 'YYYY-MM-DD') AS week_start,
      to_char(
        LEAST(
          (week_start + INTERVAL '6 days')::date,
          (date_trunc('month', week_start)::date + INTERVAL '1 month - 1 day')::date
        ),
        'YYYY-MM-DD'
      ) AS week_end
    FROM (
      SELECT
        (FLOOR((EXTRACT(DAY FROM r.responded_date)::int - 1) / 7.0)::int + 1) AS week_index,
        (
          date_trunc('month', r.responded_date)::date
          + ((((EXTRACT(DAY FROM r.responded_date)::int - 1) / 7) * 7) * INTERVAL '1 day')
        )::date AS week_start
      FROM responses r
      ${periodOptionClause}
    ) week_rows
    GROUP BY week_start
    ORDER BY week_start ASC
    `,
    periodOptionParams,
  );

  let dayOptionClause = periodOptionClause;
  const dayOptionParams = [...periodOptionParams];
  if (selectedWeekStart) {
    const weekEnd = getClippedWeekEnd(selectedWeekStart, selectedMonth);
    if (weekEnd) {
      dayOptionClause += ` AND r.responded_date::date >= $${dayOptionParams.length + 1}::date AND r.responded_date::date <= $${dayOptionParams.length + 2}::date`;
      dayOptionParams.push(selectedWeekStart, weekEnd);
    }
  }

  const daysRes = await db.query(
    `
    SELECT DISTINCT to_char(r.responded_date::date, 'YYYY-MM-DD') AS date
    FROM responses r
    ${dayOptionClause}
    ORDER BY date ASC
    `,
    dayOptionParams,
  );

  const respondentGroupsRes = await db.query(
    `
    SELECT respondent_group AS value, COUNT(*)::int AS count
    FROM responses r
    WHERE r.department_id = $1
      AND r.survey_id = $2
    GROUP BY respondent_group
    ORDER BY respondent_group ASC
    `,
    [departmentId, Number(selectedSurvey.id)],
  );

  const timeSlotsRes = await db.query(
    `
    SELECT
      ts.id,
      ts.name AS title,
      ts.start_time AS start_date,
      ts.end_time AS end_date
    FROM time_slots ts
    WHERE ts.is_active = true
      AND (
        EXISTS (
          SELECT 1
          FROM survey_time_slots sts
            WHERE sts.survey_id = $1
            AND sts.slot_id = ts.id
        )
        OR NOT EXISTS (
          SELECT 1
          FROM survey_time_slots sts
            WHERE sts.survey_id = $1
        )
      )
    ORDER BY ts.start_time ASC, ts.id ASC
    `,
    [Number(selectedSurvey.id)],
  );
  const bandsRes = await db.query(`
    SELECT id, min_value, max_value, label_th, sort_order
    FROM rating_bands
    ORDER BY sort_order ASC, min_value ASC
  `);
  const deptRes = await db.query(`SELECT id, name FROM departments WHERE id = $1`, [
    departmentId,
  ]);

  return {
    survey: {
      id: Number(selectedSurvey.id),
      title: selectedSurvey.title,
      year_be: selectedSurvey.year_be,
    },
    department: deptRes.rows[0] || { id: departmentId, name: "Department not found" },
    summary: {
      ...(summaryRes.rows[0] || {
        total_responses: 0,
        avg_rating: 0,
        overall_sd: null,
        student_count: 0,
        staff_count: 0,
        public_count: 0,
      }),
      avg_rating: Number(summaryRes.rows[0]?.avg_rating || 0),
      overall_sd: summaryRes.rows[0]?.overall_sd === null ? null : Number(summaryRes.rows[0]?.overall_sd || 0),
    },
    questions: questionsRes.rows.map((question) => ({
      ...question,
      avg_rating:
        question.avg_rating === null ? null : Number(question.avg_rating || 0),
      sd: question.sd === null ? null : Number(question.sd || 0),
    })),
    comments: commentsRes.rows,
    rating_bands: bandsRes.rows,
    filters: {
      time_slots: timeSlotsRes.rows,
      surveys: availableSurveysRes.rows.map((survey) => ({
        id: Number(survey.id),
        title: survey.title,
        year_be: survey.year_be === null ? null : Number(survey.year_be),
        response_count: Number(survey.response_count || 0),
      })),
      years: availableSurveysRes.rows
        .map((survey) => survey.year_be)
        .filter((year) => year !== null)
        .map((year) => Number(year)),
      months: monthsRes.rows.map((row) => Number(row.month)),
      weeks: weeksRes.rows,
      days: daysRes.rows.map((row) => row.date),
      respondent_groups: respondentGroupsRes.rows.map((row) => ({
        value: row.value,
        count: Number(row.count || 0),
      })),
      selected: {
        survey_id: Number(selectedSurvey.id),
        year_be:
          selectedSurvey.year_be === null ? null : Number(selectedSurvey.year_be),
        view: reportView,
        month: selectedMonth,
        week_start: selectedWeekStart,
        date: selectedDate,
        respondent_group: respondentGroup,
      },
    },
  };
}
