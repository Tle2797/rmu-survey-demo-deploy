import { db } from "../config/db";

function parseForce(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function normalizeDescription(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseYearBe(value: unknown) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2500) return null;
  return year;
}

function isDuplicateSurveyYearError(error: any) {
  return (
    error?.code === "23505" &&
    (error?.constraint === "uq_surveys_year" ||
      String(error?.detail ?? "").includes("year_be"))
  );
}

async function findDuplicateSurvey(
  title: string,
  yearBe: number,
  excludeId?: number,
) {
  const values: Array<string | number> = [title, yearBe];
  let excludeSql = "";

  if (typeof excludeId === "number" && Number.isFinite(excludeId) && excludeId > 0) {
    values.push(excludeId);
    excludeSql = `AND id != $3`;
  }

  const res = await db.query(
    `
    SELECT id, title, year_be
    FROM surveys
    WHERE (LOWER(TRIM(title)) = LOWER(TRIM($1)) OR year_be = $2)
      ${excludeSql}
    LIMIT 1
    `,
    values,
  );

  return res.rows[0] ?? null;
}

async function getSurveyDependencies(
  client: Pick<typeof db, "query">,
  surveyId: number,
) {
  const res = await client.query(
    `
    SELECT
      (SELECT COUNT(*)::int FROM questions WHERE survey_id = $1) AS question_count,
      (SELECT COUNT(*)::int FROM responses WHERE survey_id = $1) AS response_count,
      (
        SELECT COUNT(*)::int
        FROM answers a
        JOIN responses r ON r.id = a.response_id
        WHERE r.survey_id = $1
      ) AS answer_count,
      (
        SELECT COUNT(*)::int
        FROM survey_time_slots
        WHERE survey_id = $1
      ) AS survey_time_slot_count
    `,
    [surveyId],
  );

  return res.rows[0] ?? null;
}

export async function listSurveys() {
  const res = await db.query(`
    SELECT id, year_be, title, description, is_active, created_at, updated_at
    FROM surveys
    ORDER BY year_be DESC, id DESC
  `);

  return { total: res.rowCount ?? 0, items: res.rows };
}

export async function createSurvey({ body, set }: any) {
  const { title, description, year_be } = body;

  const trimmedTitle = (title ?? "").trim();
  if (!trimmedTitle) {
    set.status = 400;
    return { message: "Title is required" };
  }

  const parsedYearBe = parseYearBe(year_be);
  if (parsedYearBe === null) {
    set.status = 400;
    return { message: "Invalid year_be" };
  }

  const duplicate = await findDuplicateSurvey(trimmedTitle, parsedYearBe);
  if (duplicate) {
    set.status = 409;
    if (Number(duplicate.year_be) === parsedYearBe) {
      return { message: "ปีการศึกษานี้มีแบบสอบถามอยู่แล้ว" };
    }
    return { message: "ชื่อแบบสอบถามนี้มีอยู่แล้ว" };
  }

  let ins;
  try {
    ins = await db.query(
      `
      INSERT INTO surveys(title, description, year_be, is_active)
      VALUES ($1, $2, $3, false)
      RETURNING id, year_be, title, description, is_active, created_at, updated_at
      `,
      [trimmedTitle, normalizeDescription(description), parsedYearBe],
    );
  } catch (error: any) {
    if (isDuplicateSurveyYearError(error)) {
      set.status = 409;
      return { message: "ปีการศึกษานี้มีแบบสอบถามอยู่แล้ว" };
    }

    throw error;
  }

  set.status = 201;
  return ins.rows[0];
}

export async function updateSurvey({ params, body, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const { title, description, year_be } = body;
  const trimmedTitle = (title ?? "").trim();

  if (!trimmedTitle) {
    set.status = 400;
    return { message: "Title is required" };
  }

  const parsedYearBe = parseYearBe(year_be);
  if (parsedYearBe === null) {
    set.status = 400;
    return { message: "Invalid year_be" };
  }

  const duplicate = await findDuplicateSurvey(trimmedTitle, parsedYearBe, id);
  if (duplicate) {
    set.status = 409;
    if (Number(duplicate.year_be) === parsedYearBe) {
      return { message: "ปีการศึกษานี้มีแบบสอบถามอยู่แล้ว" };
    }
    return { message: "ชื่อแบบสอบถามนี้มีอยู่แล้ว" };
  }

  let upd;
  try {
    upd = await db.query(
      `
      UPDATE surveys
      SET title = $2, description = $3, year_be = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING id, year_be, title, description, is_active, created_at, updated_at
      `,
      [id, trimmedTitle, normalizeDescription(description), parsedYearBe],
    );
  } catch (error: any) {
    if (isDuplicateSurveyYearError(error)) {
      set.status = 409;
      return { message: "ปีการศึกษานี้มีแบบสอบถามอยู่แล้ว" };
    }

    throw error;
  }

  if ((upd.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "Survey not found" };
  }

  return upd.rows[0];
}

export async function toggleSurveyActive({ params, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const cur = await client.query(
      `SELECT is_active FROM surveys WHERE id = $1 FOR UPDATE`,
      [id],
    );

    if ((cur.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      set.status = 404;
      return { message: "Survey not found" };
    }

    const next = !Boolean(cur.rows[0].is_active);

    if (next) {
      await client.query(
        `
        UPDATE surveys
        SET is_active = false, updated_at = NOW()
        WHERE id != $1
          AND is_active = true
        `,
        [id],
      );
    }

    const upd = await client.query(
      `
      UPDATE surveys
      SET is_active = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, year_be, title, description, is_active, created_at, updated_at
      `,
      [id, next],
    );

    await client.query("COMMIT");
    return upd.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteSurvey({ params, query, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const forceDelete = parseForce(query.force);
  const client = await db.connect();
  let result: Record<string, unknown> | null = null;

  try {
    await client.query("BEGIN");

    const cur = await client.query(
      `SELECT is_active FROM surveys WHERE id = $1 FOR UPDATE`,
      [id],
    );

    if ((cur.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      set.status = 404;
      return { message: "Survey not found" };
    }

    if (cur.rows[0].is_active === true) {
      await client.query("ROLLBACK");
      set.status = 409;
      return {
        message:
          "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธฅเธเนเธเธเธชเธญเธเธ–เธฒเธกเธ—เธตเนเธเธณเธฅเธฑเธเนเธเนเธเธฒเธเธญเธขเธนเนเนเธ”เน เธเธฃเธธเธ“เธฒเธเธดเธ”เธเธฒเธฃเนเธเนเธเธฒเธเธเนเธญเธเนเธฅเนเธงเธเนเธญเธขเธฅเธ",
      };
    }

    const dependency = await getSurveyDependencies(client, id);
    const questionCount = Number(dependency?.question_count ?? 0);
    const responseCount = Number(dependency?.response_count ?? 0);
    const answerCount = Number(dependency?.answer_count ?? 0);
    const surveyTimeSlotCount = Number(dependency?.survey_time_slot_count ?? 0);

    if (
      (questionCount > 0 ||
        responseCount > 0 ||
        answerCount > 0 ||
        surveyTimeSlotCount > 0) &&
      !forceDelete
    ) {
      await client.query("ROLLBACK");
      set.status = 409;
      return {
        message: "เนเธเธเธชเธญเธเธ–เธฒเธกเธเธตเนเธกเธตเธเนเธญเธกเธนเธฅเธญเนเธฒเธเธญเธดเธเธญเธขเธนเน เธเธฃเธธเธ“เธฒเธขเธทเธเธขเธฑเธเธเนเธญเธเธฅเธ",
        requires_confirmation: true,
        question_count: questionCount,
        response_count: responseCount,
        answer_count: answerCount,
        survey_time_slot_count: surveyTimeSlotCount,
        affects_evaluation: responseCount > 0 || answerCount > 0,
      };
    }

    const responseIdsRes = await client.query(
      `SELECT id FROM responses WHERE survey_id = $1`,
      [id],
    );
    const responseIds = responseIdsRes.rows
      .map((row) => Number(row.id))
      .filter((value) => Number.isFinite(value) && value > 0);

    const questionIdsRes = await client.query(
      `SELECT id FROM questions WHERE survey_id = $1`,
      [id],
    );
    const questionIds = questionIdsRes.rows
      .map((row) => Number(row.id))
      .filter((value) => Number.isFinite(value) && value > 0);

    let deletedAnswersCount = 0;
    if (responseIds.length > 0) {
      const deletedAnswersByResponseRes = await client.query(
        `DELETE FROM answers WHERE response_id = ANY($1::bigint[])`,
        [responseIds],
      );
      deletedAnswersCount += deletedAnswersByResponseRes.rowCount ?? 0;
    }

    if (questionIds.length > 0) {
      const deletedAnswersByQuestionRes = await client.query(
        `DELETE FROM answers WHERE question_id = ANY($1::bigint[])`,
        [questionIds],
      );
      deletedAnswersCount += deletedAnswersByQuestionRes.rowCount ?? 0;
    }

    let deletedResponsesCount = 0;
    if (responseIds.length > 0) {
      const deletedResponsesRes = await client.query(
        `DELETE FROM responses WHERE id = ANY($1::bigint[]) RETURNING id`,
        [responseIds],
      );
      deletedResponsesCount = deletedResponsesRes.rowCount ?? 0;
    }

    let deletedQuestionsCount = 0;
    if (questionIds.length > 0) {
      const deletedQuestionsRes = await client.query(
        `
        DELETE FROM questions
        WHERE id = ANY($1::bigint[])
        RETURNING id
        `,
        [questionIds],
      );
      deletedQuestionsCount = deletedQuestionsRes.rowCount ?? 0;
    }

    const deletedSurveyTimeSlotsRes = await client.query(
      `DELETE FROM survey_time_slots WHERE survey_id = $1`,
      [id],
    );

    const del = await client.query(
      `DELETE FROM surveys WHERE id = $1 RETURNING id`,
      [id],
    );

    if ((del.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      set.status = 404;
      return { message: "Survey not found" };
    }

    await client.query("COMMIT");
    result = {
      message: "Deleted successfully",
      deleted_answers: deletedAnswersCount,
      deleted_responses: deletedResponsesCount,
      deleted_questions: deletedQuestionsCount,
      deleted_survey_time_slots: deletedSurveyTimeSlotsRes.rowCount ?? 0,
      recalculated: deletedAnswersCount > 0 || deletedResponsesCount > 0,
    };
  } catch (err: any) {
    await client.query("ROLLBACK");

    if (err.code === "23503") {
      set.status = 409;
      return {
        message: "เนเธเธเธชเธญเธเธ–เธฒเธกเธเธตเนเธกเธตเธเนเธญเธกเธนเธฅเธญเนเธฒเธเธญเธดเธเธญเธขเธนเน เธเธฃเธธเธ“เธฒเธขเธทเธเธขเธฑเธเธเนเธญเธเธฅเธ",
        requires_confirmation: true,
      };
    }
    throw err;
  } finally {
    client.release();
  }

  return result ?? { message: "Deleted successfully" };
}
