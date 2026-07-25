// backend/src/config/db.ts
import {Pool} from "pg";
import "./env";

const databaseUrl = process.env.DATABASE_URL?.trim();

// สร้าง connection pool
export const db = new Pool(
    databaseUrl
        ? { connectionString: databaseUrl }
        : {
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        },
);

// ทดสอบการเชื่อมต่อ
db.on("connect", () => {
    console.log("✅ PostgreSQL connected");
})

db.on("error", (err) => {
    console.error("❌ PostgreSQL error", err);
})

export async function ensureUserApprovalColumns() {
    await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    `);

    await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS registration_source text NOT NULL DEFAULT 'admin'
    `);

    await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS approval_reviewed_by bigint
    `);

    await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS approval_reviewed_at timestamp with time zone
    `);

    await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS rejected_reason text
    `);

    await db.query(`
        UPDATE users
        SET approval_status = 'approved'
        WHERE approval_status IS NULL
    `);

    await db.query(`
        UPDATE users
        SET registration_source = 'admin'
        WHERE registration_source IS NULL
    `);

    await db.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'chk_users_approval_status'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT chk_users_approval_status
                CHECK (approval_status IN ('pending', 'approved', 'rejected'));
            END IF;
        END
        $$;
    `);

    await db.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'chk_users_registration_source'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT chk_users_registration_source
                CHECK (registration_source IN ('admin', 'self'));
            END IF;
        END
        $$;
    `);

    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_users_approval_status
        ON users (approval_status)
    `);

    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_users_registration_source
        ON users (registration_source)
    `);
}

export async function ensureDepartmentGroups() {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        await client.query(`
            CREATE TABLE IF NOT EXISTS department_groups (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                name text NOT NULL,
                display_order integer NOT NULL DEFAULT 0,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamp with time zone NOT NULL DEFAULT now(),
                updated_at timestamp with time zone NOT NULL DEFAULT now()
            )
        `);

        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_department_groups_name
            ON department_groups (lower(trim(name)))
        `);

        await client.query(`
            ALTER TABLE departments
            ADD COLUMN IF NOT EXISTS department_group_id bigint
        `);

        await client.query(`
            INSERT INTO department_groups (name, display_order, is_active)
            SELECT 'ยังไม่จัดกลุ่ม', 0, true
            WHERE NOT EXISTS (SELECT 1 FROM department_groups)
        `);

        await client.query(`
            UPDATE departments
            SET department_group_id = (
                SELECT id
                FROM department_groups
                ORDER BY display_order ASC, id ASC
                LIMIT 1
            )
            WHERE department_group_id IS NULL
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_departments_department_group
            ON departments (department_group_id)
        `);

        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'departments_department_group_id_fkey'
                      AND conrelid = 'departments'::regclass
                ) THEN
                    ALTER TABLE departments
                    ADD CONSTRAINT departments_department_group_id_fkey
                    FOREIGN KEY (department_group_id)
                    REFERENCES department_groups(id)
                    ON DELETE RESTRICT;
                END IF;
            END
            $$;
        `);

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function ensureDepartmentCentralQuestionTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS department_central_questions (
            department_id bigint NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
            question_id bigint NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            PRIMARY KEY (department_id, question_id)
        )
    `);

    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_department_central_questions_question
        ON department_central_questions (question_id)
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS department_central_question_settings (
            department_id bigint NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
            survey_id bigint NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
            enabled boolean NOT NULL DEFAULT false,
            created_at timestamp with time zone NOT NULL DEFAULT now(),
            updated_at timestamp with time zone NOT NULL DEFAULT now(),
            PRIMARY KEY (department_id, survey_id)
        )
    `);

    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_department_central_question_settings_survey
        ON department_central_question_settings (survey_id)
    `);

    await db.query(`
        INSERT INTO department_central_question_settings (department_id, survey_id, enabled)
        SELECT DISTINCT dcq.department_id, q.survey_id, true
        FROM department_central_questions dcq
        JOIN questions q ON q.id = dcq.question_id
        WHERE q.scope = 'central'
        ON CONFLICT (department_id, survey_id)
        DO UPDATE SET enabled = true, updated_at = now()
    `);
}
