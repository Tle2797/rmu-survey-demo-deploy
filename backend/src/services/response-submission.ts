import { db } from "../config/db";

type AnswerType = "rating" | "text";

export class ResponseSubmissionError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.message ?? "Response submission failed"));
    this.status = status;
    this.body = body;
  }
}

function fail(status: number, body: Record<string, unknown>): never {
  throw new ResponseSubmissionError(status, body);
}

function getDateKey(value: unknown) {
  return String(value ?? "").slice(0, 10);
}

export async function submitSurveyResponse(payload: Record<string, unknown>) {
  const departmentId = Number(payload.department_id);
  const group = payload.respondent_group as "student" | "staff" | "public";
  const token = String(payload.token || "");
  const answers = Array.isArray(payload.answers) ? payload.answers : [];

  if (Number.isNaN(departmentId) || departmentId <= 0) {
    fail(400, { message: "Invalid department_id" });
  }

  if (!["student", "staff", "public"].includes(group)) {
    fail(400, { message: "Invalid respondent_group" });
  }

  if (!token || token.length < 10) {
    fail(400, { message: "Invalid token" });
  }

  if (answers.length === 0) {
    fail(400, { message: "answers is required" });
  }

  const activeSurveyRes = await db.query(
    `
    SELECT
      id,
      to_char((timezone('Asia/Bangkok', now()))::date, 'YYYY-MM-DD') AS today_bkk,
      ((timezone('Asia/Bangkok', now()))::date >= COALESCE(starts_at, (timezone('Asia/Bangkok', now()))::date)) AS after_start,
      ((timezone('Asia/Bangkok', now()))::date <= COALESCE(ends_at, (timezone('Asia/Bangkok', now()))::date)) AS before_end
    FROM surveys
    WHERE is_active = true
    ORDER BY updated_at DESC NULLS LAST, year_be DESC, id DESC
    LIMIT 1
    `,
  );

  if (activeSurveyRes.rowCount === 0) {
    fail(404, { message: "Active survey not found" });
  }

  const activeSurvey = activeSurveyRes.rows[0];
  const surveyId = Number(activeSurvey.id);
  const todayBkk = getDateKey(activeSurvey.today_bkk);

  if (!activeSurvey.after_start) {
    fail(403, { message: "Survey is not open yet" });
  }

  if (!activeSurvey.before_end) {
    fail(403, { message: "Survey is closed" });
  }

  const mappedSlotRes = await db.query(
    `
    SELECT
      ts.id,
      COALESCE(ts.max_attempts, 1) AS max_attempts
    FROM survey_time_slots sts
    JOIN time_slots ts ON ts.id = sts.slot_id
    WHERE sts.survey_id = $1
      AND ts.is_active = true
      AND (timezone('Asia/Bangkok', now()))::time >= ts.start_time
      AND (timezone('Asia/Bangkok', now()))::time < ts.end_time
    ORDER BY ts.start_time ASC
    LIMIT 1
    `,
    [surveyId],
  );

  let activeSlot = mappedSlotRes.rows[0] ?? null;

  if (!activeSlot) {
    const surveySlotMappingRes = await db.query(
      `SELECT 1 FROM survey_time_slots WHERE survey_id = $1 LIMIT 1`,
      [surveyId],
    );

    if ((surveySlotMappingRes.rowCount ?? 0) > 0) {
      fail(403, {
        message: "Out of allowed time slot",
        hint: "Please try again during configured time slots.",
      });
    }

    const fallbackSlotRes = await db.query(`
      SELECT id, COALESCE(max_attempts, 1) AS max_attempts
      FROM time_slots
      WHERE is_active = true
        AND (timezone('Asia/Bangkok', now()))::time >= start_time
        AND (timezone('Asia/Bangkok', now()))::time < end_time
      ORDER BY start_time ASC
      LIMIT 1
    `);

    if (fallbackSlotRes.rowCount === 0) {
      fail(403, {
        message: "Out of allowed time slot",
        hint: "Please try again during configured time slots.",
      });
    }

    activeSlot = fallbackSlotRes.rows[0];
  }

  const slotId = Number(activeSlot.id);
  const slotMaxAttempts = Number(activeSlot.max_attempts || 1);

  const deptRes = await db.query(
    `SELECT id FROM departments WHERE id = $1 AND is_active = true`,
    [departmentId],
  );

  if (deptRes.rowCount === 0) {
    fail(404, { message: "Department not found" });
  }

  const allowedQRes = await db.query(
    `
    SELECT q.id, q.type
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
    `,
    [surveyId, departmentId],
  );

  if (allowedQRes.rowCount === 0) {
    fail(404, { message: "No questions configured for this department" });
  }

  const allowedMap = new Map<number, AnswerType>();
  for (const row of allowedQRes.rows) {
    allowedMap.set(Number(row.id), row.type as AnswerType);
  }

  const seenQuestionIds = new Set<number>();
  for (const item of answers as Array<Record<string, unknown>>) {
    const qid = Number(item.question_id);

    if (!Number.isFinite(qid) || qid <= 0) {
      fail(400, { message: "Invalid question_id" });
    }

    if (seenQuestionIds.has(qid)) {
      fail(400, { message: `Duplicate question_id: ${qid}` });
    }
    seenQuestionIds.add(qid);

    if (!allowedMap.has(qid)) {
      fail(400, { message: `Invalid question_id: ${qid}` });
    }

    const qType = allowedMap.get(qid);

    if (qType === "rating") {
      const rating = Number(item.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        fail(400, { message: `Invalid rating for question_id ${qid}` });
      }
    }

    if (qType === "text" && item.comment !== undefined && item.comment !== null) {
      if (typeof item.comment !== "string") {
        fail(400, { message: `Invalid comment for question_id ${qid}` });
      }
    }
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('department-central-questions'), hashtext($1))`,
      [`${surveyId}:${departmentId}`],
    );

    const submittedQuestionIds = Array.from(seenQuestionIds);
    const currentAllowedQRes = await client.query(
      `
      SELECT q.id
      FROM questions q
      WHERE q.survey_id = $1
        AND q.status = 'active'
        AND q.id = ANY($3::bigint[])
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
      `,
      [surveyId, departmentId, submittedQuestionIds],
    );

    if ((currentAllowedQRes.rowCount ?? 0) !== submittedQuestionIds.length) {
      fail(409, {
        message: "รายการคำถามถูกปรับปรุงแล้ว กรุณาโหลดแบบประเมินใหม่ก่อนส่งคำตอบ",
      });
    }

    const tokenRes = await client.query(
      `
      INSERT INTO respondent_tokens (token, last_seen_at)
      VALUES ($1, now())
      ON CONFLICT (token)
      DO UPDATE SET last_seen_at = now()
      RETURNING id
      `,
      [token],
    );
    const respondentTokenId = Number(tokenRes.rows[0].id);

    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
      [String(surveyId), `${respondentTokenId}:${departmentId}:${slotId}:${todayBkk}`],
    );

    const attemptsRes = await client.query(
      `
      SELECT COUNT(*)::int AS attempt_count
      FROM responses
      WHERE survey_id = $1
        AND respondent_token_id = $2
        AND department_id = $3
        AND slot_id = $4
        AND responded_date = $5::date
      `,
      [surveyId, respondentTokenId, departmentId, slotId, todayBkk],
    );

    if (Number(attemptsRes.rows[0].attempt_count) >= slotMaxAttempts) {
      fail(409, {
        message: "Already submitted the maximum number of times in this time slot",
        hint: "You can submit again in the next slot or another day.",
      });
    }

    const respRes = await client.query(
      `
      INSERT INTO responses
        (survey_id, department_id, slot_id, respondent_token_id, respondent_group, responded_date)
      VALUES
        ($1, $2, $3, $4, $5, $6::date)
      RETURNING id
      `,
      [surveyId, departmentId, slotId, respondentTokenId, group, todayBkk],
    );

    const responseId = Number(respRes.rows[0].id);

    for (const item of answers as Array<Record<string, unknown>>) {
      const qid = Number(item.question_id);
      const qType = allowedMap.get(qid);
      const rating = qType === "rating" ? Number(item.rating) : null;
      const comment =
        qType === "text"
          ? item.comment === undefined || item.comment === null
            ? ""
            : String(item.comment).trim()
          : null;

      if (qType === "text" && !comment) {
        continue;
      }

      await client.query(
        `
        INSERT INTO answers (response_id, question_id, rating, comment)
        VALUES ($1, $2, $3, $4)
        `,
        [responseId, qid, rating, comment],
      );
    }

    await client.query("COMMIT");

    return {
      message: "Submitted successfully",
      response_id: responseId,
      slot_id: slotId,
      survey_id: surveyId,
    };
  } catch (err: any) {
    await client.query("ROLLBACK");

    if (err instanceof ResponseSubmissionError) {
      throw err;
    }

    if (err?.code === "23505") {
      throw new ResponseSubmissionError(409, {
        message: "Already submitted in this time slot",
        hint: "You can submit again in the next slot or another day.",
      });
    }

    console.error("Submit error:", err);
    throw new ResponseSubmissionError(500, {
      message: "Internal server error",
    });
  } finally {
    client.release();
  }
}
