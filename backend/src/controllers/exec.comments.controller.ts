import { db } from "../config/db";
import { getActiveSurvey } from "../utils/surveys";

export async function getExecComments({ set }: any) {
  const survey = await getActiveSurvey();
  if (!survey) {
    set.status = 409;
    return { message: "No active survey" };
  }

  const surveyId = survey.id;

  const bandsRes = await db.query(`
    SELECT id, min_value, max_value, label_th, sort_order
    FROM rating_bands
    ORDER BY sort_order ASC, min_value ASC
  `);

  const departmentsRes = await db.query(
    `
    WITH response_scope AS (
      SELECT r.id, r.department_id, r.respondent_group, r.submitted_at
      FROM responses r
      WHERE r.survey_id = $1
    ),
    rating_summary AS (
      SELECT
        rs.department_id,
        ROUND(AVG(a.rating)::numeric, 2) AS avg_rating
      FROM response_scope rs
      JOIN answers a ON a.response_id = rs.id
      JOIN questions q ON q.id = a.question_id
      WHERE q.type = 'rating'
      GROUP BY rs.department_id
    ),
    comment_summary AS (
      SELECT
        rs.department_id,
        COUNT(*)::int AS total_comments
      FROM response_scope rs
      JOIN answers a ON a.response_id = rs.id
      JOIN questions q ON q.id = a.question_id
      WHERE q.type = 'text'
        AND a.comment IS NOT NULL
        AND btrim(a.comment) <> ''
      GROUP BY rs.department_id
    ),
    response_summary AS (
      SELECT
        department_id,
        COUNT(*)::int AS total_responses
      FROM response_scope
      GROUP BY department_id
    )
    SELECT
      d.id AS department_id,
      d.name AS department_name,
      dg.id AS department_group_id,
      dg.name AS department_group_name,
      dg.display_order AS department_group_display_order,
      COALESCE(rs.total_responses, 0) AS total_responses,
      COALESCE(cs.total_comments, 0) AS total_comments,
      rate.avg_rating
    FROM departments d
    JOIN department_groups dg ON dg.id = d.department_group_id
    LEFT JOIN response_summary rs ON rs.department_id = d.id
    LEFT JOIN comment_summary cs ON cs.department_id = d.id
    LEFT JOIN rating_summary rate ON rate.department_id = d.id
    WHERE d.is_active = true
    ORDER BY dg.display_order ASC, dg.id ASC, d.name ASC
    `,
    [surveyId],
  );

  const commentsRes = await db.query(
    `
    SELECT
      r.department_id,
      a.id AS answer_id,
      q.id AS question_id,
      q.text AS question_text,
      r.respondent_group,
      a.comment,
      r.submitted_at
    FROM responses r
    JOIN answers a ON a.response_id = r.id
    JOIN questions q ON q.id = a.question_id
    WHERE r.survey_id = $1
      AND q.type = 'text'
      AND a.comment IS NOT NULL
      AND btrim(a.comment) <> ''
    ORDER BY r.department_id ASC, r.submitted_at DESC
    `,
    [surveyId],
  );

  const commentsByDepartment = new Map<number, Array<Record<string, unknown>>>();
  for (const row of commentsRes.rows) {
    const departmentId = Number(row.department_id);
    const items = commentsByDepartment.get(departmentId) ?? [];
    items.push({
      answer_id: Number(row.answer_id),
      question_id: Number(row.question_id),
      question_text: row.question_text,
      respondent_group: row.respondent_group,
      comment: row.comment,
      submitted_at: row.submitted_at,
    });
    commentsByDepartment.set(departmentId, items);
  }

  return {
    survey: {
      id: surveyId,
      title: survey.title,
      year_be: survey.year_be,
    },
    rating_bands: bandsRes.rows.map((row) => ({
      id: Number(row.id),
      min_value: Number(row.min_value),
      max_value: Number(row.max_value),
      label_th: row.label_th,
      sort_order: Number(row.sort_order),
    })),
    departments: departmentsRes.rows.map((row) => ({
      department_id: Number(row.department_id),
      department_name: row.department_name,
      department_group_id: Number(row.department_group_id),
      department_group_name: String(row.department_group_name),
      department_group_display_order: Number(row.department_group_display_order),
      total_responses: Number(row.total_responses ?? 0),
      total_comments: Number(row.total_comments ?? 0),
      avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
      comments: commentsByDepartment.get(Number(row.department_id)) ?? [],
    })),
  };
}
