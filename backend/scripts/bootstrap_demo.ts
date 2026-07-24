import bcrypt from "bcryptjs";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const envFile = process.env.ENV_FILE || ".env.bootstrap.local";
config({ path: path.resolve(process.cwd(), envFile) });

const databaseUrl = process.env.DATABASE_URL?.trim();
const adminUsername = process.env.ADMIN_USERNAME?.trim();
const adminPassword = process.env.ADMIN_PASSWORD;

if (!databaseUrl) {
  throw new Error(`DATABASE_URL is required in ${envFile}`);
}

if (!adminUsername || !adminPassword) {
  throw new Error(`ADMIN_USERNAME and ADMIN_PASSWORD are required in ${envFile}`);
}

if (adminPassword.length < 12) {
  throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
}

const requiredAdminUsername = adminUsername;
const requiredAdminPassword = adminPassword;

const databaseHost = new URL(databaseUrl).hostname;
const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(databaseHost);

const client = new Client({
  connectionString: databaseUrl,
  ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
});

function readSchema() {
  const schemaPath = path.resolve(
    process.cwd(),
    process.env.SCHEMA_FILE || "../db_survey.sql",
  );

  return fs
    .readFileSync(schemaPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("\\"))
    .join("\n");
}

async function ensureSchema() {
  const result = await client.query<{ users_table: string | null }>(
    "SELECT to_regclass('public.users') AS users_table",
  );

  if (result.rows[0]?.users_table) {
    console.log("Database schema already exists; skipping schema import.");
    return;
  }

  console.log("Importing database schema...");
  await client.query("BEGIN");

  try {
    await client.query(readSchema());
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  console.log("Database schema imported.");
}

async function ensureAdmin() {
  const passwordHash = await bcrypt.hash(requiredAdminPassword, 12);

  await client.query(
    `
      INSERT INTO users (
        username,
        password_hash,
        role,
        is_active,
        title,
        first_name,
        last_name,
        email,
        approval_status,
        registration_source
      )
      VALUES ($1, $2, 'admin', true, $3, $4, $5, $6, 'approved', 'admin')
      ON CONFLICT (username)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = 'admin',
        is_active = true,
        title = EXCLUDED.title,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        approval_status = 'approved',
        registration_source = 'admin',
        updated_at = now()
    `,
    [
      requiredAdminUsername,
      passwordHash,
      process.env.ADMIN_TITLE?.trim() || null,
      process.env.ADMIN_FIRST_NAME?.trim() || null,
      process.env.ADMIN_LAST_NAME?.trim() || null,
      process.env.ADMIN_EMAIL?.trim() || null,
    ],
  );

  console.log(`Admin account "${requiredAdminUsername}" is ready.`);
}

try {
  await client.connect();
  await ensureSchema();
  await ensureAdmin();
} finally {
  await client.end();
}
