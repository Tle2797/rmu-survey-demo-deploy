import { db } from "../config/db";
import { getActiveSurvey } from "../utils/surveys";

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

export async function getExecReports({ query, set }: any) {
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
    GROUP BY s.id, s.title, s.year_be, s.is_active, s.updated_at
    ORDER BY s.is_active DESC, s.year_be DESC NULLS LAST, s.updated_at DESC NULLS LAST, s.id DESC
    `,
  );

  const requestedSurveyId = parsePositiveInt(query?.surveyId);
  if (query?.surveyId !== undefined && requestedSurveyId === null) {
    set.status = 400;
    return { message: "Invalid surveyId" };
  }

  let requestedYear: number | undefined;
  if (query?.year !== undefined) {
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
          GROUP BY s.id, s.title, s.year_be, s.is_active, s.updated_at
          ORDER BY s.is_active DESC, s.year_be DESC NULLS LAST, s.updated_at DESC NULLS LAST, s.id DESC
          LIMIT 1
          `,
          [requestedYear],
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

  const respondentGroup = parseRespondentGroup(query?.respondentGroup);
  if (
    query?.respondentGroup !== undefined &&
    String(query.respondentGroup) !== "all" &&
    respondentGroup === null
  ) {
    set.status = 400;
    return { message: "Invalid respondentGroup" };
  }

  const selectedMonth = parseMonth(query?.month);
  if (query?.month !== undefined && selectedMonth === null) {
    set.status = 400;
    return { message: "Invalid month" };
  }

  const selectedWeekStart = parseISODateText(query?.weekStart);
  if (query?.weekStart !== undefined && selectedWeekStart === null) {
    set.status = 400;
    return { message: "Invalid weekStart" };
  }

  const selectedDate = parseISODateText(query?.date);
  if (query?.date !== undefined && selectedDate === null) {
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

  const requestedView = parseReportView(query?.view);
  const reportView: ReportView = selectedDate
    ? "day"
    : selectedWeekStart
      ? "week"
      : selectedMonth
        ? "month"
        : requestedView;

  let filterClause = " AND r.survey_id = $1";
  const filterParams: Array<number | string> = [Number(selectedSurvey.id)];

  if (respondentGroup) {
    filterClause += ` AND r.respondent_group = $${filterParams.length + 1}`;
    filterParams.push(respondentGroup);
  }

  if (selectedMonth) {
    filterClause += ` AND EXTRACT(MONTH FROM r.responded_date)::int = $${filterParams.length + 1}`;
    filterParams.push(selectedMonth);
  }

  if (selectedWeekStart && !selectedDate) {
    const weekEnd = getClippedWeekEnd(selectedWeekStart, selectedMonth);
    if (!weekEnd) {
      set.status = 400;
      return { message: "Invalid weekStart" };
    }
    filterClause += ` AND r.responded_date::date >= $${filterParams.length + 1}::date AND r.responded_date::date <= $${filterParams.length + 2}::date`;
    filterParams.push(selectedWeekStart, weekEnd);
  }

  if (selectedDate) {
    filterClause += ` AND r.responded_date::date = $${filterParams.length + 1}::date`;
    filterParams.push(selectedDate);
  }

  const summaryRes = await db.query(
    `
    WITH filtered_responses AS (
      SELECT r.id, r.department_id, r.respondent_group
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
    filterParams,
  );

  const departmentsRes = await db.query(
    `
    WITH filtered_responses AS (
      SELECT r.id, r.department_id, r.respondent_group
      FROM responses r
      WHERE 1 = 1
      ${filterClause}
    ),
    response_counts AS (
      SELECT
        department_id,
        COUNT(*)::int AS total_responses,
        COUNT(*) FILTER (WHERE respondent_group = 'student')::int AS student_count,
        COUNT(*) FILTER (WHERE respondent_group = 'staff')::int AS staff_count,
        COUNT(*) FILTER (WHERE respondent_group = 'public')::int AS public_count
      FROM filtered_responses
      GROUP BY department_id
    ),
    rating_avgs AS (
      SELECT
        fr.department_id,
        ROUND(AVG(a.rating)::numeric, 2) AS avg_rating
      FROM filtered_responses fr
      JOIN answers a ON a.response_id = fr.id
      JOIN questions q ON q.id = a.question_id
      WHERE q.type = 'rating'
      GROUP BY fr.department_id
    )
    SELECT
      d.id AS department_id,
      d.name AS department_name,
      COALESCE(rc.total_responses, 0)::int AS total_responses,
      COALESCE(rc.student_count, 0)::int AS student_count,
      COALESCE(rc.staff_count, 0)::int AS staff_count,
      COALESCE(rc.public_count, 0)::int AS public_count,
      ra.avg_rating
    FROM departments d
    LEFT JOIN response_counts rc ON rc.department_id = d.id
    LEFT JOIN rating_avgs ra ON ra.department_id = d.id
    WHERE d.is_active = true
    ORDER BY ra.avg_rating DESC NULLS LAST, COALESCE(rc.total_responses, 0) DESC, d.name ASC
    `,
    filterParams,
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
      qd.name AS department_name,
      COUNT(a.id)::int AS total_responses,
      ROUND(AVG(a.rating)::numeric, 2) AS avg_rating,
      ROUND(stddev_samp(a.rating)::numeric, 2) AS sd
    FROM filtered_responses fr
    JOIN answers a ON a.response_id = fr.id
    JOIN questions q ON q.id = a.question_id
    LEFT JOIN departments qd ON qd.id = q.department_id
    WHERE q.type = 'rating'
    GROUP BY q.id, q.text, q.scope, q.department_id, qd.name, q.display_order
    ORDER BY
      CASE
        WHEN q.scope = 'central' THEN 0
        WHEN q.scope = 'department' THEN 1
        ELSE 2
      END,
      q.display_order ASC NULLS LAST,
      q.id ASC
    `,
    filterParams,
  );

  const commentsRes = await db.query(
    `
    WITH filtered_responses AS (
      SELECT r.id, r.department_id, r.respondent_group, r.submitted_at
      FROM responses r
      WHERE 1 = 1
      ${filterClause}
    )
    SELECT
      d.name AS department_name,
      a.id AS answer_id,
      q.id AS question_id,
      q.text AS question_text,
      q.scope AS question_scope,
      fr.respondent_group,
      a.comment,
      fr.submitted_at
    FROM filtered_responses fr
    JOIN departments d ON d.id = fr.department_id
    JOIN answers a ON a.response_id = fr.id
    JOIN questions q ON q.id = a.question_id
    WHERE q.type = 'text'
      AND a.comment IS NOT NULL
      AND btrim(a.comment) <> ''
    ORDER BY fr.submitted_at DESC, a.id DESC
    `,
    filterParams,
  );

  let monthsOptionClause = "WHERE r.survey_id = $1";
  const monthsOptionParams: Array<number | string> = [Number(selectedSurvey.id)];
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

  let periodOptionClause = "WHERE r.survey_id = $1";
  const periodOptionParams: Array<number | string> = [Number(selectedSurvey.id)];
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
    WHERE r.survey_id = $1
    GROUP BY respondent_group
    ORDER BY respondent_group ASC
    `,
    [Number(selectedSurvey.id)],
  );

  const bandsRes = await db.query(`
    SELECT id, min_value, max_value, label_th, sort_order
    FROM rating_bands
    ORDER BY sort_order ASC, min_value ASC
  `);

  const departments = departmentsRes.rows.map((row) => ({
    department_id: Number(row.department_id),
    department_name: String(row.department_name),
    total_responses: Number(row.total_responses || 0),
    student_count: Number(row.student_count || 0),
    staff_count: Number(row.staff_count || 0),
    public_count: Number(row.public_count || 0),
    avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : 0,
  }));

  const departmentsWithResponses = departments.filter(
    (department) => department.total_responses > 0,
  ).length;

  return {
    survey: {
      id: Number(selectedSurvey.id),
      title: selectedSurvey.title,
      year_be:
        selectedSurvey.year_be === null ? null : Number(selectedSurvey.year_be),
    },
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
      overall_sd:
        summaryRes.rows[0]?.overall_sd === null
          ? null
          : Number(summaryRes.rows[0]?.overall_sd || 0),
      total_departments: departments.length,
      departments_with_responses: departmentsWithResponses,
      departments_without_responses: departments.length - departmentsWithResponses,
    },
    departments,
    questions: questionsRes.rows.map((question) => ({
      question_id: Number(question.question_id),
      question_text: question.question_text,
      question_scope: question.question_scope,
      department_name: question.department_name,
      total_responses: Number(question.total_responses || 0),
      avg_rating:
        question.avg_rating === null ? null : Number(question.avg_rating || 0),
      sd: question.sd === null ? null : Number(question.sd || 0),
    })),
    comments: commentsRes.rows.map((comment) => ({
      department_name: comment.department_name,
      answer_id: Number(comment.answer_id),
      question_id: Number(comment.question_id),
      question_text: comment.question_text,
      question_scope: comment.question_scope,
      respondent_group: comment.respondent_group,
      comment: comment.comment,
      submitted_at: comment.submitted_at,
    })),
    rating_bands: bandsRes.rows,
    filters: {
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
