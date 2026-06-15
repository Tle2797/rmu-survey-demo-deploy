import { db } from "../config/db";
import crypto from "crypto";
import { sendPasswordResetOtp } from "../services/mail";
import {
  ProfileImageUploadError,
  saveProfileImage,
} from "../services/profile-image";
import {
  authenticateRequest,
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
  type JwtUser,
} from "../utils/auth";
import {
  containsThaiCharacters,
  USERNAME_THAI_VALIDATION_MESSAGE,
} from "../utils/username";

const TITLE_OPTIONS = new Set(["นาย", "นาง", "นางสาว"]);
const PUBLIC_REGISTER_ROLES = new Set(["dept_head", "staff"]);

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function registerUser({ body, set }: any) {
  const payload = body as any;
  const role = String(payload?.role || "").trim();
  const departmentId = Number(payload?.department_id);
  const title = String(payload?.title || "").trim();
  const firstName = String(payload?.first_name || "").trim();
  const lastName = String(payload?.last_name || "").trim();
  const username = String(payload?.username || "").trim();
  const password = String(payload?.password || "");
  const confirmPassword = String(payload?.confirmPassword || "");
  const email = String(payload?.email || "").trim().toLowerCase();

  if (containsThaiCharacters(username)) {
    set.status = 400;
    return { message: USERNAME_THAI_VALIDATION_MESSAGE };
  }

  if (!PUBLIC_REGISTER_ROLES.has(role)) {
    set.status = 400;
    return { message: "กรุณาเลือกตำแหน่ง" };
  }

  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    set.status = 400;
    return { message: "กรุณาเลือกหน่วยงาน" };
  }

  if (!TITLE_OPTIONS.has(title)) {
    set.status = 400;
    return { message: "กรุณาเลือกคำนำหน้า" };
  }

  if (!firstName) {
    set.status = 400;
    return { message: "กรุณากรอกชื่อ" };
  }

  if (!lastName) {
    set.status = 400;
    return { message: "กรุณากรอกนามสกุล" };
  }

  if (!username) {
    set.status = 400;
    return { message: "กรุณากรอกชื่อผู้ใช้" };
  }

  if (!password || password.length < 8) {
    set.status = 400;
    return { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  }

  if (password !== confirmPassword) {
    set.status = 400;
    return { message: "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน" };
  }

  if (!email) {
    set.status = 400;
    return { message: "กรุณากรอกอีเมล" };
  }

  if (!isValidEmail(email)) {
    set.status = 400;
    return { message: "รูปแบบอีเมลไม่ถูกต้อง" };
  }

  const departmentRes = await db.query(
    `SELECT id FROM departments WHERE id = $1 AND is_active = true LIMIT 1`,
    [departmentId],
  );
  if ((departmentRes.rowCount ?? 0) === 0) {
    set.status = 400;
    return { message: "ไม่พบหน่วยงานที่เลือก" };
  }

  const existingEmail = await db.query(
    `
    SELECT id, username, approval_status, registration_source
    FROM users
    WHERE lower(email) = $1
    LIMIT 1
    `,
    [email],
  );
  const rejectedSelfRegistration =
    existingEmail.rows[0]?.registration_source === "self" &&
    existingEmail.rows[0]?.approval_status === "rejected"
      ? existingEmail.rows[0]
      : null;

  const dupUsername = await db.query(
    `SELECT id FROM users WHERE username = $1 LIMIT 1`,
    [username],
  );
  const duplicatedUsername = dupUsername.rows[0];
  if (
    duplicatedUsername &&
    (!rejectedSelfRegistration || duplicatedUsername.id !== rejectedSelfRegistration.id)
  ) {
    set.status = 409;
    return { message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" };
  }

  if (existingEmail.rows[0] && !rejectedSelfRegistration) {
    set.status = 409;
    return { message: "อีเมลนี้มีอยู่ในระบบแล้ว" };
  }

  const passwordHash = await hashPassword(password);

  if (rejectedSelfRegistration) {
    const updateRes = await db.query(
      `
      UPDATE users
      SET username = $2,
          password_hash = $3,
          role = $4,
          department_id = $5,
          is_active = false,
          title = $6,
          first_name = $7,
          last_name = $8,
          email = $9,
          approval_status = 'pending',
          registration_source = 'self',
          approval_reviewed_by = NULL,
          approval_reviewed_at = NULL,
          rejected_reason = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, username, email, role, department_id, title, first_name, last_name, approval_status, created_at
      `,
      [
        rejectedSelfRegistration.id,
        username,
        passwordHash,
        role,
        departmentId,
        title,
        firstName,
        lastName,
        email,
      ],
    );

    set.status = 201;
    return {
      message: "ลงทะเบียนสำเร็จ กรุณารอการอนุมัติจากผู้ดูแลระบบ",
      item: updateRes.rows[0],
      resubmitted: true,
    };
  }

  const insertRes = await db.query(
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
      registration_source
    )
    VALUES ($1, $2, $3, $4, false, $5, $6, $7, $8, 'pending', 'self')
    RETURNING id, username, email, role, department_id, title, first_name, last_name, approval_status, created_at
    `,
    [
      username,
      passwordHash,
      role,
      departmentId,
      title,
      firstName,
      lastName,
      email,
    ],
  );

  set.status = 201;
  return {
    message: "ลงทะเบียนสำเร็จ กรุณารอการอนุมัติจากผู้ดูแลระบบ",
    item: insertRes.rows[0],
  };
}

export async function login({ body, set }: any) {
  const payload = body as any;
  const username = String(payload?.username || "").trim();
  const password = String(payload?.password || "");

  if (containsThaiCharacters(username)) {
    set.status = 400;
    return { message: USERNAME_THAI_VALIDATION_MESSAGE };
  }

  if (!username || !password) {
    set.status = 400;
    return { message: "username/password is required" };
  }

  const userRes = await db.query(
    `
    SELECT id, username, password_hash, role, department_id, is_active, approval_status
    FROM users
    WHERE username = $1
    LIMIT 1
    `,
    [username],
  );

  if (userRes.rowCount === 0) {
    set.status = 401;
    return { message: "Invalid credentials" };
  }

  const u = userRes.rows[0];

  if (u.approval_status === "pending") {
    set.status = 403;
    return { message: "User approval pending" };
  }

  if (u.approval_status === "rejected") {
    set.status = 403;
    return { message: "User registration rejected" };
  }

  if (!u.is_active) {
    set.status = 403;
    return { message: "User is inactive" };
  }

  const ok = await verifyPassword(password, u.password_hash);
  if (!ok) {
    set.status = 401;
    return { message: "Invalid credentials" };
  }

  const role = u.role as JwtUser["role"];
  const departmentId = u.department_id === null ? null : Number(u.department_id);

  if ((role === "dept_head" || role === "staff") && !departmentId) {
    set.status = 409;
    return { message: "User role requires department_id but it's missing" };
  }

  await db.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [u.id]);

  const jwtUser: JwtUser = {
    id: Number(u.id),
    username: String(u.username),
    role,
    departmentId,
  };

  const token = await signToken(jwtUser);

  return {
    token,
    user: jwtUser,
  };
}

export async function getMe({ request, set }: any) {
  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);

  if (!match || !match[1]) {
    set.status = 401;
    return { message: "Missing Authorization Bearer token" };
  }

  try {
    const token = match[1];
    const decoded = await verifyToken(token);

    const dbUserRes = await db.query(
      `
      SELECT id, username, role, department_id, is_active, approval_status, title, first_name, last_name, profile_image_url, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [decoded.id],
    );

    if (dbUserRes.rowCount === 0) {
      set.status = 401;
      return { message: "User not found" };
    }

    const u = dbUserRes.rows[0];
    if (u.approval_status === "pending") {
      set.status = 403;
      return { message: "User approval pending" };
    }

    if (u.approval_status === "rejected") {
      set.status = 403;
      return { message: "User registration rejected" };
    }

    if (!u.is_active) {
      set.status = 403;
      return { message: "User is inactive" };
    }

    const user = {
      id: Number(u.id),
      username: String(u.username),
      role: u.role,
      departmentId: u.department_id === null ? null : Number(u.department_id),
      title: u.title,
      first_name: u.first_name,
      last_name: u.last_name,
      profile_image_url: u.profile_image_url,
      created_at: u.created_at,
      updated_at: u.updated_at,
      is_active: u.is_active,
    };

    return { user };
  } catch {
    set.status = 401;
    return { message: "Invalid token" };
  }
}

export async function updateProfile({ request, body, set }: any) {
  const currentUser = await authenticateRequest(request);
  const b = body as any;

  const username = String(b?.username ?? "").trim();
  const title = b?.title !== undefined ? (b.title ? String(b.title).trim() : null) : null;
  const first_name =
    b?.first_name !== undefined ? (b.first_name ? String(b.first_name).trim() : null) : null;
  const last_name =
    b?.last_name !== undefined ? (b.last_name ? String(b.last_name).trim() : null) : null;
  const password = b?.password !== undefined ? String(b.password ?? "") : undefined;

  if (containsThaiCharacters(username)) {
    set.status = 400;
    return { message: USERNAME_THAI_VALIDATION_MESSAGE };
  }

  if (!username) {
    set.status = 400;
    return { message: "username is required" };
  }

  const existed = await db.query(`SELECT * FROM users WHERE id = $1`, [currentUser.id]);
  if ((existed.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "User not found" };
  }

  const dup = await db.query(
    `SELECT 1 FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
    [username, currentUser.id],
  );
  if ((dup.rowCount ?? 0) > 0) {
    set.status = 409;
    return { message: "username already exists" };
  }

  if (password !== undefined && password !== "") {
    if (password.length < 8) {
      set.status = 400;
      return { message: "password must be at least 8 characters" };
    }

    const password_hash = await hashPassword(password);
    const up = await db.query(
      `UPDATE users
       SET username = $2,
           password_hash = $3,
           title = $4,
           first_name = $5,
           last_name = $6,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at`,
      [currentUser.id, username, password_hash, title, first_name, last_name],
    );

    return { item: up.rows[0] };
  }

  const up = await db.query(
    `UPDATE users
     SET username = $2,
         title = $3,
         first_name = $4,
         last_name = $5,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, username, role, department_id, is_active, title, first_name, last_name, profile_image_url, updated_at`,
    [currentUser.id, username, title, first_name, last_name],
  );

  return { item: up.rows[0] };
}

export async function uploadProfileImage({ request, set }: any) {
  const currentUser = await authenticateRequest(request);
  const formData = await request.formData();

  const userRes = await db.query(`SELECT id FROM users WHERE id = $1`, [currentUser.id]);
  if ((userRes.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "User not found" };
  }

  let profile_image_url: string;
  try {
    const savedImage = await saveProfileImage(currentUser.id, formData.get("image"));
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
    [currentUser.id, profile_image_url],
  );

  return {
    profile_image_url: up.rows[0].profile_image_url,
    updated_at: up.rows[0].updated_at,
  };
}

// สำหรับลืมรหัสผ่าน
function createOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function requestPasswordResetOtp({ body, set }: any) {
  const email = String(body?.email || "").trim().toLowerCase();

  if (!email) {
    set.status = 400;
    return { message: "email is required" };
  }

  const userRes = await db.query(
    `
    SELECT id, email, is_active
    FROM users
    WHERE lower(email) = $1
    LIMIT 1
    `,
    [email],
  );

  if ((userRes.rowCount ?? 0) === 0) {
    set.status = 404;
    return { message: "ไม่พบอีเมลนี้ในระบบ" };
  }

  const user = userRes.rows[0];
  if (!user.is_active) {
    set.status = 403;
    return { message: "บัญชีผู้ใช้นี้ถูกปิดใช้งาน" };
  }

  const recentRes = await db.query(
    `
    SELECT 1
    FROM password_reset_otps
    WHERE user_id = $1
      AND used_at IS NULL
      AND created_at > now() - interval '15 seconds'
    LIMIT 1
    `,
    [user.id],
  );

  if ((recentRes.rowCount ?? 0) > 0) {
    set.status = 429;
    return { message: "กรุณารอสักครู่ก่อนขอ OTP ใหม่อีกครั้ง" };
  }

  const otp = createOtp();
  const otpHash = hashValue(otp);

  await db.query(
    `
    UPDATE password_reset_otps
    SET used_at = now()
    WHERE user_id = $1
      AND used_at IS NULL
    `,
    [user.id],
  );

  const otpInsertRes = await db.query(
    `
    INSERT INTO password_reset_otps
      (user_id, email, otp_hash, expires_at)
    VALUES
      ($1, $2, $3, now() + interval '10 minutes')
    RETURNING id
    `,
    [user.id, email, otpHash],
  );

  try {
    await sendPasswordResetOtp(email, otp);
  } catch (error) {
    await db.query(
      `
      UPDATE password_reset_otps
      SET used_at = now()
      WHERE id = $1
      `,
      [otpInsertRes.rows[0].id],
    );

    console.error("Failed to send password reset OTP email", error);
    set.status = 503;
    return { message: "Unable to send OTP email. Please check SMTP settings." };
  }

  return { message: "ส่งรหัส OTP ไปยังอีเมลแล้ว" };
}


// ตรวจสอบ OTP
export async function verifyPasswordResetOtp({ body, set }: any) {
  const email = String(body?.email || "").trim().toLowerCase();
  const otp = String(body?.otp || "").trim();

  if (!email || !otp) {
    set.status = 400;
    return { message: "email/otp is required" };
  }

  const otpHash = hashValue(otp);

  const res = await db.query(
    `
    SELECT
      pro.id,
      pro.user_id,
      pro.otp_hash,
      pro.attempts,
      u.username,
      u.email,
      u.title,
      u.first_name,
      u.last_name
    FROM password_reset_otps pro
    JOIN users u ON u.id = pro.user_id
    WHERE pro.email = $1
      AND pro.used_at IS NULL
      AND pro.expires_at > now()
    ORDER BY pro.created_at DESC
    LIMIT 1
    `,
    [email],
  );

  if ((res.rowCount ?? 0) === 0) {
    set.status = 400;
    return { message: "OTP ไม่ถูกต้องหรือหมดอายุ" };
  }

  const item = res.rows[0];

  if (Number(item.attempts) >= 5) {
    set.status = 429;
    return { message: "กรอก OTP ผิดเกินจำนวนที่กำหนด" };
  }

  if (item.otp_hash !== otpHash) {
    await db.query(
      `
      UPDATE password_reset_otps
      SET attempts = attempts + 1
      WHERE id = $1
      `,
      [item.id],
    );

    set.status = 400;
    return { message: "OTP is invalid or expired" };
  }

  const resetToken = createResetToken();
  const resetTokenHash = hashValue(resetToken);

  await db.query(
    `
    UPDATE password_reset_otps
    SET verified_at = now(),
        reset_token_hash = $2
    WHERE id = $1
    `,
    [item.id, resetTokenHash],
  );

  return {
    resetToken,
    user: {
      username: item.username,
      email: item.email,
      title: item.title,
      firstName: item.first_name,
      lastName: item.last_name,
    },
  };
}

// ตั้งรหัสผ่านใหม่
export async function resetPasswordWithOtp({ body, set }: any) {
  const resetToken = String(body?.resetToken || "").trim();
  const password = String(body?.password || "");

  if (!resetToken || !password) {
    set.status = 400;
    return { message: "resetToken/password is required" };
  }

  if (password.length < 8) {
    set.status = 400;
    return { message: "password must be at least 8 characters" };
  }

  const resetTokenHash = hashValue(resetToken);

  const res = await db.query(
    `
    SELECT id, user_id
    FROM password_reset_otps
    WHERE reset_token_hash = $1
      AND verified_at IS NOT NULL
      AND used_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [resetTokenHash],
  );

  if ((res.rowCount ?? 0) === 0) {
    set.status = 400;
    return { message: "Reset token ไม่ถูกต้องหรือหมดอายุ" };
  }

  const item = res.rows[0];
  const passwordHash = await hashPassword(password);
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      UPDATE users
      SET password_hash = $2,
          updated_at = now()
      WHERE id = $1
      `,
      [item.user_id, passwordHash],
    );

    await client.query(
      `
      UPDATE password_reset_otps
      SET used_at = now()
      WHERE id = $1
      `,
      [item.id],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { message: "reset password success" };
}
