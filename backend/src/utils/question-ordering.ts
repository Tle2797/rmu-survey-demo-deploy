import type { PoolClient } from "pg";

type QuestionScope = "central" | "department";

type ReorderQuestionDisplayOrdersOptions = {
  questionId: number;
  surveyId: number;
  scope: QuestionScope;
  departmentId?: number | null;
  requestedOrder: number | null;
};

type CompactQuestionDisplayOrdersOptions = {
  surveyId: number;
  scope: QuestionScope;
  departmentId?: number | null;
};

export function parseQuestionDisplayOrder(
  value: unknown,
  optional = false,
): number | null | undefined {
  if (value === undefined) {
    return optional ? undefined : null;
  }

  if (value === null || value === "") {
    return null;
  }

  const displayOrder = Number(value);
  if (!Number.isInteger(displayOrder) || displayOrder < 1) {
    return Number.NaN;
  }

  return displayOrder;
}

export async function reorderQuestionDisplayOrders(
  client: PoolClient,
  {
    questionId,
    surveyId,
    scope,
    departmentId = null,
    requestedOrder,
  }: ReorderQuestionDisplayOrdersOptions,
) {
  const lockKey = `question-order:${surveyId}:${scope}:${departmentId ?? "central"}`;
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [
    lockKey,
  ]);

  const params: unknown[] = [surveyId, scope, questionId];
  let departmentClause = "AND department_id IS NULL";

  if (scope === "department") {
    const normalizedDepartmentId = Number(departmentId);
    if (!Number.isFinite(normalizedDepartmentId) || normalizedDepartmentId <= 0) {
      throw new Error("Invalid departmentId");
    }
    params.push(normalizedDepartmentId);
    departmentClause = `AND department_id = $${params.length}`;
  }

  const existing = await client.query(
    `
    SELECT id
    FROM questions
    WHERE survey_id = $1
      AND scope = $2::question_scope
      AND id <> $3
      ${departmentClause}
    ORDER BY display_order ASC NULLS LAST, id ASC
    FOR UPDATE
    `,
    params,
  );

  const existingIds = existing.rows
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  const maxOrder = existingIds.length + 1;
  const nextOrder =
    requestedOrder === null
      ? maxOrder
      : Math.min(Math.max(requestedOrder, 1), maxOrder);
  const orderedIds = [...existingIds];

  orderedIds.splice(nextOrder - 1, 0, questionId);

  const displayOrders = orderedIds.map((_, index) => index + 1);

  await client.query(
    `
    WITH ordered AS (
      SELECT *
      FROM unnest($1::bigint[], $2::integer[]) AS item(id, display_order)
    )
    UPDATE questions AS q
    SET
      display_order = ordered.display_order,
      updated_at = CASE
        WHEN q.display_order IS DISTINCT FROM ordered.display_order THEN NOW()
        ELSE q.updated_at
      END
    FROM ordered
    WHERE q.id = ordered.id
    `,
    [orderedIds, displayOrders],
  );

  return nextOrder;
}

export async function compactQuestionDisplayOrders(
  client: PoolClient,
  { surveyId, scope, departmentId = null }: CompactQuestionDisplayOrdersOptions,
) {
  const lockKey = `question-order:${surveyId}:${scope}:${departmentId ?? "central"}`;
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [
    lockKey,
  ]);

  const params: unknown[] = [surveyId, scope];
  let departmentClause = "AND department_id IS NULL";

  if (scope === "department") {
    const normalizedDepartmentId = Number(departmentId);
    if (!Number.isFinite(normalizedDepartmentId) || normalizedDepartmentId <= 0) {
      throw new Error("Invalid departmentId");
    }
    params.push(normalizedDepartmentId);
    departmentClause = `AND department_id = $${params.length}`;
  }

  const existing = await client.query(
    `
    SELECT id
    FROM questions
    WHERE survey_id = $1
      AND scope = $2::question_scope
      ${departmentClause}
    ORDER BY display_order ASC NULLS LAST, id ASC
    FOR UPDATE
    `,
    params,
  );

  const orderedIds = existing.rows
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (orderedIds.length === 0) {
    return;
  }

  const displayOrders = orderedIds.map((_, index) => index + 1);

  await client.query(
    `
    WITH ordered AS (
      SELECT *
      FROM unnest($1::bigint[], $2::integer[]) AS item(id, display_order)
    )
    UPDATE questions AS q
    SET
      display_order = ordered.display_order,
      updated_at = CASE
        WHEN q.display_order IS DISTINCT FROM ordered.display_order THEN NOW()
        ELSE q.updated_at
      END
    FROM ordered
    WHERE q.id = ordered.id
    `,
    [orderedIds, displayOrders],
  );
}
