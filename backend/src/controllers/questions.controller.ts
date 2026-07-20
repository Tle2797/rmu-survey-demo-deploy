import { db } from "../config/db";
import { getActiveSurvey } from "../utils/surveys";

export async function listSurveyQuestions({ params, set }: any) {
  const departmentId = Number(params.departmentId);

  if (Number.isNaN(departmentId)) {
    set.status = 400;
    return { message: "Invalid department id" };
  }

  const survey = await getActiveSurvey();

  if (!survey) {
    set.status = 404;
    return { message: "Active survey not found" };
  }

  const surveyId = survey.id;

  const sql = `
    SELECT 
      q.id,
      q.text,
      q.type,
      q.scope
    FROM questions q
    WHERE q.survey_id = $1
      AND q.status = 'active'
      AND (
        (
          q.scope = 'central'
          AND EXISTS (
            SELECT 1
            FROM department_central_questions dcq
            WHERE dcq.department_id = $2
              AND dcq.question_id = q.id
          )
        )
        OR (q.scope = 'department' AND q.department_id = $2)
      )
    ORDER BY
    CASE
      WHEN q.scope = 'central' THEN 0
      WHEN q.scope = 'department' THEN 1
      ELSE 2
    END,
    q.display_order ASC,
    q.id ASC
  `;

  const result = await db.query(sql, [surveyId, departmentId]);

  return {
    total: result.rowCount,
    items: result.rows,
    survey: {
      id: survey.id,
      year_be: survey.year_be,
      title: survey.title,
    },
  };
}
