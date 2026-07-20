import { db } from "../config/db";

export async function listDepartments() {
  const sql = `
    SELECT
      d.id,
      d.name,
      dg.id AS department_group_id,
      dg.name AS department_group_name,
      dg.display_order AS department_group_display_order
    FROM departments d
    JOIN department_groups dg
      ON dg.id = d.department_group_id
     AND dg.is_active = true
    WHERE d.is_active = true
    ORDER BY
      dg.display_order ASC,
      dg.id ASC,
      d.created_at ASC,
      d.id ASC
  `;

  const result = await db.query(sql);

  return {
    total: result.rowCount,
    items: result.rows,
  };
}

export async function getDepartmentById({ params, set }: any) {
  const departmentId = Number(params.id);

  if (Number.isNaN(departmentId)) {
    set.status = 400;
    return { message: "Invalid department id" };
  }

  const sql = `
    SELECT 
      d.id,
      d.name,
      d.is_active,
      q.id as qrcode_id,
      q.image_path,
      q.link_target
    FROM departments d
    LEFT JOIN qrcodes q ON q.department_id = d.id AND q.type = 'department'
    WHERE d.id = $1
    AND d.is_active = true
  `;

  const result = await db.query(sql, [departmentId]);

  if (result.rowCount === 0) {
    set.status = 404;
    return { message: "Department not found" };
  }

  return { department: result.rows[0] };
}
