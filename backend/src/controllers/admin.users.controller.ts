import bcrypt from "bcryptjs";
import { db } from "../config/db";
import {
  ProfileImageUploadError,
  saveProfileImage,
} from "../services/profile-image";
import { sendUserApprovalEmail, sendUserRejectionEmail } from "../services/mail";
import { authenticateRequest } from "../utils/auth";
import {
  containsThaiCharacters,
  USERNAME_THAI_VALIDATION_MESSAGE,
} from "../utils/username";

export async function listUsers() {
  const res = await db.query(
    `
    SELECT
      u.id,
      u.username,
      u.email,
      u.role,
      u.department_id,
      u.is_active,
      u.title,
      u.first_name,
      u.last_name,
      u.approval_status,
      u.registration_source,
      u.approval_reviewed_by,
      u.approval_reviewed_at,
      u.rejected_reason,
      u.profile_image_url,
      u.updated_at,
      u.created_at,
      d.name AS department_name
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.approval_status = 'approved'
    ORDER BY u.created_at DESC, u.id DESC
    `,
  );

  return {
    total: res.rowCount,
    items: res.rows,
  };
}

export async function createUser({ body, set }: any) {
  const username = body.username.trim();
  const role = body.role;
  const department_id = body.department_id ?? null;
  const password = body.password;
  const title = body.title ? body.title.trim() : null;
  const first_name = body.first_name ? body.first_name.trim() : null;
  const last_name = body.last_name ? body.last_name.trim() : null;
  const email = body.email ? String(body.email).trim().toLowerCase() : null;

  if (containsThaiCharacters(username)) {
    set.status = 400;
    return { message: USERNAME_THAI_VALIDATION_MESSAGE };
  }

  if (!username) {
    set.status = 400;
    return { message: "กรุณากรอกชื่อผู้ใช้" };
  }
  if (!password || password.length < 8) {
    set.status = 400;
    return { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  }

  if ((role === "dept_head" || role === "staff") && !department_id) {
    set.status = 400;
    return { message: "กรุณาเลือกหน่วยงานสำหรับตำแหน่งนี้" };
  }

  const dup = await db.query(
    `SELECT 1 FROM users WHERE username = $1 LIMIT 1`,
    [username],
  );
  if ((dup.rowCount ?? 0) > 0) {
    set.status = 409;
    return { message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" };
  }

  if (email) {
    const dupEmail = await db.query(
      `SELECT 1 FROM users WHERE lower(email) = $1 LIMIT 1`,
      [email],
    );
    if ((dupEmail.rowCount ?? 0) > 0) {
      set.status = 409;
      return { message: "อีเมลนี้มีอยู่ในระบบแล้ว" };
    }
  }

  const password_hash = await bcrypt.hash(password, 10);

  const ins = await db.query(
    `
    INSERT INTO users (
      username,
      password_hash,
      role,
      department_id,
      is_active,
      title,
      first_name,
      last_name,
      email,
      approval_status,
      registration_source,
      approval_reviewed_at
    )
    VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, 'approved', 'admin', NOW())
    RETURNING id, username, email, role, department_id, is_active, title, first_name, last_name, approval_status, registration_source, profile_image_url, updated_at
    `,
    [username, password_hash, role, department_id, title, first_name, last_name, email],
  );

  set.status = 201;
  return { item: ins.rows[0] };
}

export async function updateUser({ params, body, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "รหัสผู้ใช้ไม่ถูกต้อง" };
  }

  const existed = await db.query(`SELECT * FROM users WHERE id = $1`, [id]);
  if (existed.rowCount === 0) {
    set.status = 404;
    return { message: "ไม่พบข้อมูลผู้ใช้" };
  }

  const current = existed.rows[0] as {
    id: number;
    username: string;
    email: string | null;
    role: "admin" | "exec" | "dept_head" | "staff";
    department_id: number | null;
    is_active: boolean;
  };

  if (typeof body.is_active === "boolean") {
    const up = await db.query(
      `
      UPDATE users
      SET is_active = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, username, email, role, department_id, is_active, title, first_name, last_name, approval_status, registration_source, profile_image_url, updated_at
      `,
      [id, body.is_active],
    );
    return { item: up.rows[0] };
  }

  const username = (body.username ?? current.username).trim();
  const role = (body.role ?? current.role) as typeof current.role;
  const title = body.title !== undefined ? (body.title ? body.title.trim() : null) : (current as any).title;
  const first_name = body.first_name !== undefined ? (body.first_name ? body.first_name.trim() : null) : (current as any).first_name;
  const last_name = body.last_name !== undefined ? (body.last_name ? body.last_name.trim() : null) : (current as any).last_name;
  const email =
    body.email !== undefined
      ? body.email
        ? String(body.email).trim().toLowerCase()
        : null
      : current.email;

  const department_id =
    body.department_id === undefined
      ? current.department_id
      : body.department_id;

  if (containsThaiCharacters(username)) {
    set.status = 400;
    return { message: USERNAME_THAI_VALIDATION_MESSAGE };
  }

  if ((role === "dept_head" || role === "staff") && !department_id) {
    set.status = 400;
    return { message: "กรุณาเลือกหน่วยงานสำหรับตำแหน่งนี้" };
  }

  if (username !== current.username) {
    const dup = await db.query(
      `SELECT 1 FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
      [username, id],
    );
    if ((dup.rowCount ?? 0) > 0) {
      set.status = 409;
      return { message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" };
    }
  }

  if (email) {
    const dupEmail = await db.query(
      `SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2 LIMIT 1`,
      [email, id],
    );
    if ((dupEmail.rowCount ?? 0) > 0) {
      set.status = 409;
      return { message: "อีเมลนี้มีอยู่ในระบบแล้ว" };
    }
  }

  if (body.password !== undefined) {
    const pw = body.password;
    if (!pw || pw.length < 8) {
      set.status = 400;
      return { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
    }
    const password_hash = await bcrypt.hash(pw, 10);

    const up = await db.query(
      `
      UPDATE users
      SET username = $2,
          role = $3,
          department_id = $4,
          password_hash = $5,
          title = $6,
          first_name = $7,
          last_name = $8,
          email = $9,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, username, email, role, department_id, is_active, title, first_name, last_name, approval_status, registration_source, profile_image_url, updated_at
      `,
      [id, username, role, department_id, password_hash, title, first_name, last_name, email],
    );
    return { item: up.rows[0] };
  }

  const up = await db.query(
    `
    UPDATE users
    SET username = $2,
        role = $3,
        department_id = $4,
        title = $5,
        first_name = $6,
        last_name = $7,
        email = $8,
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, username, email, role, department_id, is_active, title, first_name, last_name, approval_status, registration_source, profile_image_url, updated_at
    `,
    [id, username, role, department_id, title, first_name, last_name, email],
  );

  return { item: up.rows[0] };
}

type ApprovalStatus = "pending" | "approved" | "rejected";

const approvalStatuses = new Set(["pending", "approved", "rejected"]);

function parseApprovalUserId(raw: unknown) {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function buildApprovalCounts(rows: Array<{ approval_status: ApprovalStatus; total: number }>) {
  const counts: Record<ApprovalStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
  };

  for (const row of rows) {
    if (approvalStatuses.has(row.approval_status)) {
      counts[row.approval_status] = Number(row.total) || 0;
    }
  }

  return counts;
}

async function fetchApprovalCounts() {
  const countRes = await db.query(
    `
    SELECT approval_status, COUNT(*)::int AS total
    FROM users
    WHERE registration_source = 'self'
    GROUP BY approval_status
    `,
  );

  return buildApprovalCounts(countRes.rows);
}

function formatUserFullName(user: {
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}) {
  const firstPart = `${user.title ?? ""}${user.first_name ?? ""}`.trim();
  const lastPart = (user.last_name ?? "").trim();
  const fullName = [firstPart, lastPart].filter(Boolean).join(" ").trim();
  return fullName || user.username || "ผู้ใช้งาน";
}

export async function listUserApprovals({ query }: any) {
  const requestedStatus = String(query?.status || "pending");
  const status =
    requestedStatus === "all" || approvalStatuses.has(requestedStatus)
      ? requestedStatus
      : "pending";

  const values: unknown[] = [];
  const where = [`u.registration_source = 'self'`];

  if (status !== "all") {
    values.push(status);
    where.push(`u.approval_status = $${values.length}`);
  }

  const res = await db.query(
    `
    SELECT
      u.id,
      u.username,
      u.email,
      u.role,
      u.department_id,
      u.is_active,
      u.title,
      u.first_name,
      u.last_name,
      u.approval_status,
      u.registration_source,
      u.approval_reviewed_by,
      u.approval_reviewed_at,
      u.rejected_reason,
      u.created_at,
      u.updated_at,
      d.name AS department_name,
      reviewer.username AS approval_reviewed_by_username,
      reviewer.title AS reviewer_title,
      reviewer.first_name AS reviewer_first_name,
      reviewer.last_name AS reviewer_last_name
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN users reviewer ON reviewer.id = u.approval_reviewed_by
    WHERE ${where.join(" AND ")}
    ORDER BY
      CASE u.approval_status
        WHEN 'pending' THEN 1
        WHEN 'approved' THEN 2
        WHEN 'rejected' THEN 3
        ELSE 4
      END,
      u.created_at DESC,
      u.id DESC
    `,
    values,
  );

  return {
    total: res.rowCount,
    counts: await fetchApprovalCounts(),
    items: res.rows,
  };
}

export async function getUserApprovalCounts() {
  return {
    counts: await fetchApprovalCounts(),
  };
}

export async function approveUserRegistration({ params, request, set }: any) {
  const id = parseApprovalUserId(params.id);
  if (!id) {
    set.status = 400;
    return { message: "รหัสผู้ใช้ไม่ถูกต้อง" };
  }

  const currentUser = await authenticateRequest(request);
  const existed = await db.query(
    `
    SELECT id, approval_status
    FROM users
    WHERE id = $1
      AND registration_source = 'self'
    LIMIT 1
    `,
    [id],
  );

  if ((existed.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "ไม่พบข้อมูลผู้ลงทะเบียน" };
  }

  const up = await db.query(
    `
    UPDATE users
    SET approval_status = 'approved',
        is_active = true,
        approval_reviewed_by = $2,
        approval_reviewed_at = NOW(),
        rejected_reason = NULL,
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, username, email, role, department_id, is_active, title, first_name, last_name, approval_status, registration_source, approval_reviewed_by, approval_reviewed_at, rejected_reason, created_at, updated_at
    `,
    [id, currentUser.id],
  );

  const approvedUser = up.rows[0];
  let emailSent = false;
  let emailError: string | null = null;

  if (approvedUser.email) {
    try {
      await sendUserApprovalEmail({
        email: approvedUser.email,
        fullName: formatUserFullName(approvedUser),
      });
      emailSent = true;
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Unable to send approval email";
      console.error("Failed to send user approval email", {
        user_id: approvedUser.id,
        email: approvedUser.email,
        error,
      });
    }
  }

  return {
    item: approvedUser,
    email_sent: emailSent,
    email_error: emailError,
  };
}

export async function rejectUserRegistration({ params, body, request, set }: any) {
  const id = parseApprovalUserId(params.id);
  if (!id) {
    set.status = 400;
    return { message: "รหัสผู้ใช้ไม่ถูกต้อง" };
  }

  const currentUser = await authenticateRequest(request);
  const reason = body?.reason ? String(body.reason).trim() : null;
  const existed = await db.query(
    `
    SELECT id, approval_status
    FROM users
    WHERE id = $1
      AND registration_source = 'self'
    LIMIT 1
    `,
    [id],
  );

  if ((existed.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "ไม่พบข้อมูลผู้ลงทะเบียน" };
  }

  const up = await db.query(
    `
    UPDATE users
    SET approval_status = 'rejected',
        is_active = false,
        approval_reviewed_by = $2,
        approval_reviewed_at = NOW(),
        rejected_reason = $3,
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, username, email, role, department_id, is_active, title, first_name, last_name, approval_status, registration_source, approval_reviewed_by, approval_reviewed_at, rejected_reason, created_at, updated_at
    `,
    [id, currentUser.id, reason],
  );

  const rejectedUser = up.rows[0];
  let emailSent = false;
  let emailError: string | null = null;

  if (rejectedUser.email) {
    try {
      await sendUserRejectionEmail({
        email: rejectedUser.email,
        fullName: formatUserFullName(rejectedUser),
        reason,
      });
      emailSent = true;
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Unable to send rejection email";
      console.error("Failed to send user rejection email", {
        user_id: rejectedUser.id,
        email: rejectedUser.email,
        error,
      });
    }
  }

  return {
    item: rejectedUser,
    email_sent: emailSent,
    email_error: emailError,
  };
}

export async function deleteUser({ params, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "รหัสผู้ใช้ไม่ถูกต้อง" };
  }

  try {
    const del = await db.query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [id]
    );

    if ((del.rowCount ?? 0) === 0) {
      set.status = 404;
      return { message: "ไม่พบข้อมูลผู้ใช้" };
    }

    return { message: "ลบผู้ใช้เรียบร้อยแล้ว" };
  } catch (err: any) {
    if (err.code === "23503") {
      set.status = 400;
      return { message: "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธฅเธเธเธนเนเนเธเนเธเธตเนเนเธ”เน เน€เธเธทเนเธญเธเธเธฒเธเธกเธตเธเนเธญเธกเธนเธฅเธเธนเธเธญเธขเธนเน" };
    }
    throw err;
  }
}

export async function updateAdminProfile({ body, set }: any) {
  const b = body as any;
  const userId = Number(b?.user_id);
  if (!Number.isFinite(userId) || userId <= 0) {
    set.status = 400;
    return { message: "กรุณาระบุผู้ใช้" };
  }

  const existed = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if ((existed.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "ไม่พบข้อมูลผู้ใช้" };
  }
  const current = existed.rows[0];

  const username = (b?.username ?? current.username).trim();
  const title = b?.title !== undefined ? (b.title ? b.title.trim() : null) : current.title;
  const first_name = b?.first_name !== undefined ? (b.first_name ? b.first_name.trim() : null) : current.first_name;
  const last_name = b?.last_name !== undefined ? (b.last_name ? b.last_name.trim() : null) : current.last_name;

  if (containsThaiCharacters(username)) {
    set.status = 400;
    return { message: USERNAME_THAI_VALIDATION_MESSAGE };
  }

  if (!username) {
    set.status = 400;
    return { message: "กรุณากรอกชื่อผู้ใช้" };
  }

  const dup = await db.query(
    `SELECT 1 FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
    [username, userId],
  );
  if ((dup.rowCount ?? 0) > 0) {
    set.status = 409;
    return { message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" };
  }

  if (b?.password !== undefined && b?.password !== "") {
    const pw = String(b.password);
    if (pw.length < 8) {
      set.status = 400;
      return { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
    }
    const password_hash = await bcrypt.hash(pw, 10);
    const up = await db.query(
      `UPDATE users
       SET username = $2, password_hash = $3, title = $4, first_name = $5, last_name = $6, updated_at = NOW()
       WHERE id = $1
       RETURNING id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at`,
      [userId, username, password_hash, title, first_name, last_name],
    );
    return { item: up.rows[0] };
  }

  const up = await db.query(
    `UPDATE users
     SET username = $2, title = $3, first_name = $4, last_name = $5, updated_at = NOW()
     WHERE id = $1
     RETURNING id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at`,
    [userId, username, title, first_name, last_name],
  );
  return { item: up.rows[0] };
}

export async function uploadAdminProfileImage({ request, set }: any) {
  const formData = await request.formData();
  const userId = Number(formData.get("user_id"));

  if (!Number.isFinite(userId) || userId <= 0) {
    set.status = 400;
    return { message: "กรุณาระบุผู้ใช้" };
  }

  const userRes = await db.query(`SELECT id FROM users WHERE id = $1`, [userId]);
  if ((userRes.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "ไม่พบข้อมูลผู้ใช้" };
  }

  let profile_image_url: string;
  try {
    const savedImage = await saveProfileImage(userId, formData.get("image"));
    profile_image_url = savedImage.profile_image_url;
  } catch (error) {
    if (error instanceof ProfileImageUploadError) {
      set.status = error.status;
      return error.body;
    }
    throw error;
  }

  const up = await db.query(
    `
    UPDATE users
    SET profile_image_url = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING profile_image_url, updated_at
    `,
    [userId, profile_image_url],
  );

  return {
    profile_image_url: up.rows[0].profile_image_url,
    updated_at: up.rows[0].updated_at,
  };
}
