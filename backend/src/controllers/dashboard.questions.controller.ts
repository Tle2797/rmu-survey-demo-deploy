import { db } from "../config/db";
import { authenticateRequest } from "../utils/auth";
import {
  canAccessDepartment,
  canManageDepartmentQuestion,
} from "../utils/authorization";
import {
  compactQuestionDisplayOrders,
  parseQuestionDisplayOrder,
  reorderQuestionDisplayOrders,
} from "../utils/question-ordering";
import { getActiveSurvey } from "../utils/surveys";

function parseForce(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
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

async function getManagedDepartmentQuestion(
  request: Request,
  questionId: number,
  set: { status?: number | string },
) {
  const user = await authenticateRequest(request);
  const qRes = await db.query(
    `
    SELECT
      q.id,
      q.survey_id,
      q.text,
      q.type,
      q.scope,
      q.department_id,
      q.display_order,
      COUNT(a.id) FILTER (
        WHERE (q.type = 'rating' AND a.rating IS NOT NULL)
           OR (q.type = 'text' AND NULLIF(BTRIM(a.comment), '') IS NOT NULL)
      )::int AS answer_count,
      COUNT(DISTINCT a.response_id) FILTER (
        WHERE (q.type = 'rating' AND a.rating IS NOT NULL)
           OR (q.type = 'text' AND NULLIF(BTRIM(a.comment), '') IS NOT NULL)
      )::int AS response_count,
      (
        COUNT(a.id) FILTER (
          WHERE (q.type = 'rating' AND a.rating IS NOT NULL)
             OR (q.type = 'text' AND NULLIF(BTRIM(a.comment), '') IS NOT NULL)
        ) > 0
      ) AS has_answers
    FROM questions q
    LEFT JOIN answers a ON a.question_id = q.id
    WHERE q.id = $1
    GROUP BY q.id, q.survey_id, q.text, q.type, q.scope, q.department_id, q.display_order
    `,
    [questionId],
  );

  if ((qRes.rowCount ?? 0) === 0) {
    set.status = 404;
    return null;
  }

  const question = qRes.rows[0];
  if (question.scope !== "department") {
    set.status = 403;
    return { error: { message: "Central question cannot be edited here" } };
  }

  const departmentId = Number(question.department_id);
  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    set.status = 409;
    return { error: { message: "Question is not bound to a valid department" } };
  }

  if (!canManageDepartmentQuestion(user, departmentId)) {
    set.status = 403;
    return { error: { message: "Forbidden: cannot manage this department question" } };
  }

  return { question, departmentId };
}

export async function listDashboardQuestions({ params, request, set }: any) {
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

  const surveyId = survey.id;
  const centralSettingRes = await db.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM department_central_question_settings
      WHERE department_id = $1
        AND survey_id = $2
        AND enabled = true
    ) AS central_enabled
    `,
    [departmentId, surveyId],
  );
  const centralEnabled = Boolean(centralSettingRes.rows[0]?.central_enabled);

  const result = await db.query(
    `
    SELECT
      q.id,
      q.survey_id,
      q.text,
      q.type,
      q.scope,
      q.status,
      q.display_order,
      q.department_id,
      ($3::boolean AND q.scope = 'central') AS is_selected,
      COUNT(a.id) FILTER (
        WHERE (q.type = 'rating' AND a.rating IS NOT NULL)
           OR (q.type = 'text' AND NULLIF(BTRIM(a.comment), '') IS NOT NULL)
      )::int AS answer_count,
      COUNT(DISTINCT a.response_id) FILTER (
        WHERE (q.type = 'rating' AND a.rating IS NOT NULL)
           OR (q.type = 'text' AND NULLIF(BTRIM(a.comment), '') IS NOT NULL)
      )::int AS response_count,
      (
        COUNT(a.id) FILTER (
          WHERE (q.type = 'rating' AND a.rating IS NOT NULL)
             OR (q.type = 'text' AND NULLIF(BTRIM(a.comment), '') IS NOT NULL)
        ) > 0
      ) AS has_answers
    FROM questions q
    LEFT JOIN responses r
      ON r.survey_id = q.survey_id
     AND r.department_id = $2
    LEFT JOIN answers a
      ON a.response_id = r.id
     AND a.question_id = q.id
    WHERE q.survey_id = $1
      AND (
        q.scope = 'central'
        OR (q.scope = 'department' AND q.department_id = $2)
      )
    GROUP BY
      q.id,
      q.survey_id,
      q.text,
      q.type,
      q.scope,
      q.status,
      q.display_order,
      q.department_id
    ORDER BY
      CASE
        WHEN q.scope = 'central' THEN 0
        WHEN q.scope = 'department' THEN 1
        ELSE 2
      END,
      q.display_order ASC NULLS LAST,
      q.id ASC
    `,
    [surveyId, departmentId, centralEnabled],
  );

  return {
    total: result.rowCount ?? 0,
    items: result.rows,
    survey: {
      id: survey.id,
      year_be: survey.year_be,
      title: survey.title,
    },
    central_enabled: centralEnabled,
  };
}

export async function updateDepartmentCentralQuestions({
  params,
  body,
  request,
  set,
}: any) {
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

  const questionIdsRaw = Array.isArray(body?.question_ids)
    ? body.question_ids
    : [];
  const questionIds = Array.from(
    new Set(
      questionIdsRaw
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isInteger(value) && value > 0),
    ),
  );

  if (questionIdsRaw.length !== questionIds.length) {
    set.status = 400;
    return { message: "Invalid question_ids" };
  }

  if (questionIds.length > 0) {
    const validRes = await db.query(
      `
      SELECT id
      FROM questions
      WHERE survey_id = $1
        AND scope = 'central'
        AND id = ANY($2::bigint[])
      `,
      [survey.id, questionIds],
    );

    if ((validRes.rowCount ?? 0) !== questionIds.length) {
      set.status = 400;
      return { message: "Some central questions are invalid" };
    }
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM department_central_questions dcq
      USING questions q
      WHERE dcq.question_id = q.id
        AND dcq.department_id = $1
        AND q.survey_id = $2
        AND q.scope = 'central'
      `,
      [departmentId, survey.id],
    );

    for (const questionId of questionIds) {
      await client.query(
        `
        INSERT INTO department_central_questions (department_id, question_id)
        VALUES ($1, $2)
        ON CONFLICT (department_id, question_id) DO NOTHING
        `,
        [departmentId, questionId],
      );
    }

    await client.query(
      `
      INSERT INTO department_central_question_settings
        (department_id, survey_id, enabled, updated_at)
      VALUES
        ($1, $2, $3, now())
      ON CONFLICT (department_id, survey_id)
      DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
      `,
      [departmentId, survey.id, questionIds.length > 0],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    message: "Updated central questions",
    selected_question_ids: questionIds,
  };
}

export async function createDashboardQuestion({ params, body, request, set }: any) {
  const departmentId = Number(params.departmentId);
  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    set.status = 400;
    return { message: "Invalid departmentId" };
  }

  if (!(await ensureDepartmentAccess(request, departmentId, set))) {
    return { message: "Forbidden: cannot access this department" };
  }

  const payload = body as Record<string, unknown>;
  const text = String(payload.text ?? "").trim();
  const type = payload.type as "rating" | "text";
  const displayOrder = parseQuestionDisplayOrder(payload.display_order);

  if (!text) {
    set.status = 400;
    return { message: "text is required" };
  }

  if (!["rating", "text"].includes(type)) {
    set.status = 400;
    return { message: "Invalid type" };
  }

  if (
    typeof displayOrder === "number" &&
    Number.isNaN(displayOrder)
  ) {
    set.status = 400;
    return { message: "Invalid display_order" };
  }

  const survey = await getActiveSurvey();
  if (!survey) {
    set.status = 409;
    return { message: "No active survey" };
  }

  const surveyId = survey.id;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const ins = await client.query(
      `
      INSERT INTO questions
        (survey_id, department_id, scope, type, text, status, display_order)
      VALUES
        ($1, $2, 'department', $3, $4, 'active', 0)
      RETURNING id
      `,
      [surveyId, departmentId, type, text],
    );

    const id = Number(ins.rows[0].id);
    await reorderQuestionDisplayOrders(client, {
      questionId: id,
      surveyId,
      scope: "department",
      departmentId,
      requestedOrder: displayOrder ?? null,
    });

    await client.query("COMMIT");

    set.status = 201;
    return { message: "Created", id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateDashboardQuestion({ params, body, request, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const managed = await getManagedDepartmentQuestion(request, id, set);
  if (!managed) {
    return { message: "Question not found" };
  }
  if ("error" in managed) {
    return managed.error;
  }

  const payload = body as Record<string, unknown>;
  const text =
    payload.text !== undefined ? String(payload.text ?? "").trim() : undefined;
  const type = payload.type as "rating" | "text" | undefined;
  const status = payload.status as "active" | "inactive" | undefined;
  const displayOrder =
    parseQuestionDisplayOrder(payload.display_order, true);

  if (type !== undefined && !["rating", "text"].includes(type)) {
    set.status = 400;
    return { message: "Invalid type" };
  }

  if (
    type !== undefined &&
    managed.question.answer_count > 0 &&
    type !== managed.question.type
  ) {
    set.status = 409;
    return {
      message:
        "คำถามนี้มีผู้ประเมินตอบแล้ว จึงไม่สามารถเปลี่ยนรูปแบบคำตอบได้",
      answer_count: managed.question.answer_count,
      response_count: managed.question.response_count,
      has_answers: true,
    };
  }

  if (status !== undefined && !["active", "inactive"].includes(status)) {
    set.status = 400;
    return { message: "Invalid status" };
  }

  if (
    typeof displayOrder === "number" &&
    Number.isNaN(displayOrder)
  ) {
    set.status = 400;
    return { message: "Invalid display_order" };
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (text !== undefined) {
    fields.push(`text = $${idx++}`);
    values.push(text);
  }
  if (type !== undefined) {
    fields.push(`type = $${idx++}`);
    values.push(type);
  }
  if (status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(status);
  }
  if (fields.length === 0 && displayOrder === undefined) {
    set.status = 400;
    return { message: "No fields to update" };
  }

  values.push(id);

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    if (fields.length > 0) {
      await client.query(
        `
        UPDATE questions
        SET ${fields.join(", ")}
        WHERE id = $${idx}
        RETURNING id
        `,
        values,
      );
    }

    if (displayOrder !== undefined) {
      await reorderQuestionDisplayOrders(client, {
        questionId: id,
        surveyId: Number(managed.question.survey_id),
        scope: "department",
        departmentId: managed.departmentId,
        requestedOrder: displayOrder ?? null,
      });
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { message: "Updated" };
}

export async function deleteDashboardQuestion({ params, query, request, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const managed = await getManagedDepartmentQuestion(request, id, set);
  if (!managed) {
    return { message: "Question not found" };
  }
  if ("error" in managed) {
    return managed.error;
  }

  const forceDelete = parseForce(query.force);
  if (managed.question.answer_count > 0 && !forceDelete) {
    set.status = 409;
    return {
      message:
        "Question already has submitted answers. Confirm deletion before removing it.",
      answer_count: managed.question.answer_count,
      response_count: managed.question.response_count,
      has_answers: true,
      requires_confirmation: true,
    };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const affectedResponsesRes = await client.query(
      `SELECT DISTINCT response_id FROM answers WHERE question_id = $1`,
      [id],
    );
    const affectedResponseIds = affectedResponsesRes.rows
      .map((row) => Number(row.response_id))
      .filter((value) => Number.isFinite(value) && value > 0);

    const deletedAnswers = await client.query(
      `DELETE FROM answers WHERE question_id = $1`,
      [id],
    );

    let deletedResponsesCount = 0;
    if (affectedResponseIds.length > 0) {
      const deletedResponses = await client.query(
        `
        DELETE FROM responses r
        WHERE r.id = ANY($1::bigint[])
          AND NOT EXISTS (
            SELECT 1
            FROM answers a
            WHERE a.response_id = r.id
          )
        RETURNING id
        `,
        [affectedResponseIds],
      );
      deletedResponsesCount = deletedResponses.rowCount ?? 0;
    }

    const del = await client.query(
      `DELETE FROM questions WHERE id = $1 AND scope = 'department' RETURNING id`,
      [id],
    );

    if ((del.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      set.status = 404;
      return { message: "Department question not found" };
    }

    await compactQuestionDisplayOrders(client, {
      surveyId: Number(managed.question.survey_id),
      scope: "department",
      departmentId: managed.departmentId,
    });

    await client.query("COMMIT");
    return {
      message: "Deleted successfully",
      deleted_answers: deletedAnswers.rowCount ?? 0,
      affected_responses: affectedResponseIds.length,
      deleted_responses: deletedResponsesCount,
      recalculated: true,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
