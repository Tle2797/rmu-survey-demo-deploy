import { db } from "../config/db";
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

async function getCentralQuestionUsage(questionId: number) {
  const res = await db.query(
    `
    SELECT
      q.id,
      q.survey_id,
      q.text,
      q.type,
      q.display_order,
      COUNT(a.id) FILTER (
        WHERE (q.type = 'rating' AND a.rating IS NOT NULL)
           OR (q.type = 'text' AND NULLIF(BTRIM(a.comment), '') IS NOT NULL)
      )::int AS answer_count,
      COUNT(DISTINCT a.response_id) FILTER (
        WHERE (q.type = 'rating' AND a.rating IS NOT NULL)
           OR (q.type = 'text' AND NULLIF(BTRIM(a.comment), '') IS NOT NULL)
      )::int AS response_count
    FROM questions q
    LEFT JOIN answers a ON a.question_id = q.id
    WHERE q.id = $1
      AND q.scope = 'central'
    GROUP BY q.id, q.survey_id, q.text, q.type, q.display_order
    `,
    [questionId],
  );

  return res.rows[0] ?? null;
}

export async function listCentralQuestions({ query }: any) {
  let surveyId: number | null = null;

  if (query.survey_id) {
    surveyId = Number(query.survey_id);
  } else {
    const activeSurvey = await getActiveSurvey();
    if (activeSurvey) {
      surveyId = activeSurvey.id;
    }
  }

  if (!surveyId) {
    return { total: 0, items: [], message: "No active survey found" };
  }

  const res = await db.query(
    `
    SELECT
      q.id,
      q.survey_id,
      q.scope,
      q.type,
      q.text,
      q.display_order,
      q.status,
      q.created_at,
      q.updated_at,
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
    WHERE q.scope = 'central'
      AND q.survey_id = $1
      AND q.department_id IS NULL
    GROUP BY
      q.id,
      q.survey_id,
      q.scope,
      q.type,
      q.text,
      q.display_order,
      q.status,
      q.created_at,
      q.updated_at
    ORDER BY q.display_order ASC, q.id ASC
    `,
    [surveyId],
  );

  return { total: res.rowCount ?? 0, items: res.rows, survey_id: surveyId };
}

export async function createCentralQuestion({ body, set }: any) {
  const { survey_id, text, type, display_order } = body;
  const surveyId = Number(survey_id);
  const requestedDisplayOrder = parseQuestionDisplayOrder(display_order);

  const trimmedText = (text ?? "").trim();
  if (!trimmedText) {
    set.status = 400;
    return { message: "Question text is required" };
  }
  if (!Number.isFinite(surveyId) || surveyId <= 0) {
    set.status = 400;
    return { message: "survey_id is required" };
  }
  if (!["rating", "text"].includes(type)) {
    set.status = 400;
    return { message: "Invalid type" };
  }
  if (
    typeof requestedDisplayOrder === "number" &&
    Number.isNaN(requestedDisplayOrder)
  ) {
    set.status = 400;
    return { message: "Invalid display_order" };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const ins = await client.query(
      `
      INSERT INTO questions (survey_id, scope, department_id, type, text, display_order, status)
      VALUES ($1, 'central', NULL, $2, $3, 0, 'active')
      RETURNING id
      `,
      [surveyId, type, trimmedText],
    );

    const id = Number(ins.rows[0].id);
    await reorderQuestionDisplayOrders(client, {
      questionId: id,
      surveyId,
      scope: "central",
      requestedOrder: requestedDisplayOrder ?? null,
    });

    const created = await client.query(
      `
      SELECT id, survey_id, scope, type, text, display_order, status, created_at, updated_at
      FROM questions
      WHERE id = $1
      `,
      [id],
    );

    await client.query("COMMIT");
    set.status = 201;
    return created.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createCentralQuestions({ body, set }: any) {
  const surveyId = Number(body.survey_id);
  const questions = Array.isArray(body.questions) ? body.questions : [];

  if (!Number.isFinite(surveyId) || surveyId <= 0) {
    set.status = 400;
    return { message: "survey_id is required" };
  }
  if (questions.length === 0 || questions.length > 50) {
    set.status = 400;
    return { message: "Questions must contain between 1 and 50 items" };
  }

  const normalizedQuestions: Array<{
    text: string;
    type: string;
    displayOrder: number | null | undefined;
  }> = questions.map((question: any) => ({
    text: String(question.text ?? "").trim(),
    type: String(question.type ?? ""),
    displayOrder: parseQuestionDisplayOrder(question.display_order),
  }));

  const invalidQuestionIndex = normalizedQuestions.findIndex(
    (question) =>
      !question.text ||
      !["rating", "text"].includes(question.type) ||
      (typeof question.displayOrder === "number" &&
        Number.isNaN(question.displayOrder)),
  );

  if (invalidQuestionIndex >= 0) {
    set.status = 400;
    return {
      message: `Invalid question at item ${invalidQuestionIndex + 1}`,
    };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const createdIds: number[] = [];
    for (const question of normalizedQuestions) {
      const inserted = await client.query(
        `
        INSERT INTO questions (survey_id, scope, department_id, type, text, display_order, status)
        VALUES ($1, 'central', NULL, $2, $3, 0, 'active')
        RETURNING id
        `,
        [surveyId, question.type, question.text],
      );

      const id = Number(inserted.rows[0].id);
      createdIds.push(id);
      await reorderQuestionDisplayOrders(client, {
        questionId: id,
        surveyId,
        scope: "central",
        requestedOrder: question.displayOrder ?? null,
      });
    }

    const created = await client.query(
      `
      SELECT id, survey_id, scope, type, text, display_order, status, created_at, updated_at
      FROM questions
      WHERE id = ANY($1::bigint[])
      ORDER BY display_order ASC, id ASC
      `,
      [createdIds],
    );

    await client.query("COMMIT");
    set.status = 201;
    return { total: created.rowCount ?? 0, items: created.rows };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCentralQuestion({ params, body, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const { text, type, display_order } = body;
  const trimmedText = (text ?? "").trim();
  const requestedDisplayOrder = parseQuestionDisplayOrder(display_order, true);

  if (!trimmedText) {
    set.status = 400;
    return { message: "Question text is required" };
  }
  if (!["rating", "text"].includes(type)) {
    set.status = 400;
    return { message: "Invalid type" };
  }
  if (
    typeof requestedDisplayOrder === "number" &&
    Number.isNaN(requestedDisplayOrder)
  ) {
    set.status = 400;
    return { message: "Invalid display_order" };
  }

  const usage = await getCentralQuestionUsage(id);
  if (!usage) {
    set.status = 404;
    return { message: "Central question not found" };
  }

  if (usage.answer_count > 0 && type !== usage.type) {
    set.status = 409;
    return {
      message:
        "คำถามนี้มีผู้ประเมินตอบแล้ว จึงไม่สามารถเปลี่ยนรูปแบบคำตอบได้",
      answer_count: usage.answer_count,
      response_count: usage.response_count,
      has_answers: true,
    };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const upd = await client.query(
      `
      UPDATE questions
      SET text = $2, type = $3, updated_at = NOW()
      WHERE id = $1 AND scope = 'central'
      RETURNING id
      `,
      [id, trimmedText, type],
    );

    if ((upd.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      set.status = 404;
      return { message: "Central question not found" };
    }

    if (requestedDisplayOrder !== undefined) {
      await reorderQuestionDisplayOrders(client, {
        questionId: id,
        surveyId: Number(usage.survey_id),
        scope: "central",
        requestedOrder: requestedDisplayOrder ?? null,
      });
    }

    const updated = await client.query(
      `
      SELECT id, survey_id, scope, type, text, display_order, status, created_at, updated_at
      FROM questions
      WHERE id = $1
      `,
      [id],
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function toggleCentralQuestionActive({ params, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const cur = await db.query(
    `SELECT status FROM questions WHERE id = $1 AND scope = 'central'`,
    [id],
  );

  if (!cur.rowCount || cur.rowCount === 0) {
    set.status = 404;
    return { message: "Central question not found" };
  }

  const currentStatus = cur.rows[0].status;
  const nextStatus = currentStatus === "active" ? "inactive" : "active";

  const upd = await db.query(
    `
    UPDATE questions
    SET status = $2, updated_at = NOW()
    WHERE id = $1 AND scope = 'central'
    RETURNING id, survey_id, scope, type, text, display_order, status, created_at, updated_at
    `,
    [id, nextStatus],
  );

  return upd.rows[0];
}

export async function deleteCentralQuestion({ params, query, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const usage = await getCentralQuestionUsage(id);
  if (!usage) {
    set.status = 404;
    return { message: "Central question not found" };
  }

  const forceDelete = parseForce(query.force);
  if (usage.answer_count > 0 && !forceDelete) {
    set.status = 409;
    return {
      message:
        "Question already has submitted answers. Confirm deletion before removing it.",
      answer_count: usage.answer_count,
      response_count: usage.response_count,
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
      `DELETE FROM questions WHERE id = $1 AND scope = 'central' RETURNING id`,
      [id],
    );

    if ((del.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      set.status = 404;
      return { message: "Central question not found" };
    }

    await compactQuestionDisplayOrders(client, {
      surveyId: Number(usage.survey_id),
      scope: "central",
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
