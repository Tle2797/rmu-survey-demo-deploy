import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import path from "path";
import fs from "fs";
import "./config/env";
import { db } from "./config/db";
import { authenticateRequest } from "./utils/jwt";
import { hasAnyRole } from "./utils/authorization";
import { ensureQRCodeAsset } from "./services/qrcode";

import { healthRoute } from "./routes/health.route";
import { departmentsRoute } from "./routes/departments.route";
import { questionsRoute } from "./routes/questions.route";
import { responsesRoute } from "./routes/responses.route";
import { dashboardRoute } from "./routes/dashboard.route";
import { dashboardQuestionsRoute } from "./routes/dashboard.questions.route";
import { authRoute } from "./routes/auth.route";
import { adminUsersRoute } from "./routes/admin.users.route";
import { adminDepartmentsRoute } from "./routes/admin.departments.route";
import { adminQRCodesRoute } from "./routes/admin.qrcodes.route";
import { adminSurveysRoute } from "./routes/admin.surveys.route";
import { adminCentralQuestionsRoute } from "./routes/admin.questions.route";
import { adminTimeSlotsRoute } from "./routes/admin.time-slots.route";
import { adminDashboardRoute } from "./routes/admin.dashboard.route";
import { execYearlyRoute } from "./routes/exec.yearly.route";
import { execRankingRoute } from "./routes/exec.ranking.route";
import { execReportsRoute } from "./routes/exec.reports.route";
import { execDashboardRoute } from "./routes/exec.dashboard.route";
import { execCommentsRoute } from "./routes/exec.comments.route";
import { dashboardReportsRoute } from "./routes/dashboard.reports.route";

const defaultCorsOrigins = [
  "http://localhost:3000",
  "http://localhost:3481",
];

const corsOrigins = (process.env.CORS_ORIGINS || defaultCorsOrigins.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const app = new Elysia()
  .use(
    cors({
      origin: corsOrigins,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  )
  .onBeforeHandle(async ({ request, set }) => {
    const pathname = new URL(request.url).pathname;

    if (request.method === "OPTIONS") return;

    const publicExactPaths = new Set([
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/forgot-password/request-otp",
      "/api/auth/forgot-password/verify-otp",
      "/api/auth/forgot-password/reset",
    ]);
    const publicPrefixes = [
      "/health",
      "/api/departments",
      "/api/questions",
      "/api/responses",
      "/qrcodes",
      "/uploads",
    ];

    const isPublic =
      publicExactPaths.has(pathname) ||
      publicPrefixes.some(
        (prefix) =>
          pathname === prefix ||
          pathname.startsWith(prefix + "/") ||
          pathname.startsWith(prefix + "?"),
      );

    if (isPublic) return;

    try {
      const user = await authenticateRequest(request);

      if (pathname.startsWith("/api/admin")) {
        if (!hasAnyRole(user, ["admin"])) {
          set.status = 403;
          return { message: "Forbidden: admin access required" };
        }
        return;
      }

      if (pathname.startsWith("/api/exec")) {
        if (!hasAnyRole(user, ["admin", "exec"])) {
          set.status = 403;
          return { message: "Forbidden: executive access required" };
        }
        return;
      }

      if (pathname.startsWith("/api/dashboard")) {
        if (!hasAnyRole(user, ["admin", "dept_head", "staff"])) {
          set.status = 403;
          return { message: "Forbidden: department dashboard access required" };
        }
      }
    } catch {
      set.status = 401;
      return { message: "Unauthorized: invalid or expired token" };
    }
  })
  .use(healthRoute)
  .use(departmentsRoute)
  .use(questionsRoute)
  .use(responsesRoute)
  .use(dashboardRoute)
  .use(dashboardQuestionsRoute)
  .use(authRoute)
  .use(adminUsersRoute)
  .use(adminDepartmentsRoute)
  .use(adminQRCodesRoute)
  .use(adminSurveysRoute)
  .use(adminCentralQuestionsRoute)
  .use(adminTimeSlotsRoute)
  .use(adminDashboardRoute)
  .use(execYearlyRoute)
  .use(execRankingRoute)
  .use(execReportsRoute)
  .use(execDashboardRoute)
  .use(execCommentsRoute)
  .use(dashboardReportsRoute)
  .get("/qrcodes/:filename", async ({ params, set }) => {
    const filename = params.filename;
    if (filename.includes("..") || filename.includes("/")) {
      set.status = 400;
      return "Invalid filename";
    }

    const filePath = path.resolve(process.cwd(), "public", "qrcodes", filename);
    if (!fs.existsSync(filePath)) {
      const qrRes = await db.query(
        `SELECT image_path, link_target
         FROM qrcodes
         WHERE image_path = $1
         LIMIT 1`,
        [`/qrcodes/${filename}`],
      );

      const qrcode = qrRes.rows[0];
      if (qrcode) {
        await ensureQRCodeAsset(qrcode.image_path, qrcode.link_target);
      }

      if (!fs.existsSync(filePath)) {
        set.status = 404;
        return "Not found";
      }
    }

    const buffer = fs.readFileSync(filePath);
    set.headers["Content-Type"] = "image/png";
    set.headers["Cache-Control"] = "no-cache";
    return new Response(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache",
      },
    });
  })
  .get("/uploads/profiles/:filename", ({ params, set }) => {
    const filename = params.filename;
    if (filename.includes("..") || filename.includes("/")) {
      set.status = 400;
      return "Invalid filename";
    }

    const filePath = path.resolve(
      process.cwd(),
      "public",
      "uploads",
      "profiles",
      filename,
    );
    if (!fs.existsSync(filePath)) {
      set.status = 404;
      return "Not found";
    }

    let contentType = "image/jpeg";
    if (filename.endsWith(".png")) contentType = "image/png";
    if (filename.endsWith(".webp")) contentType = "image/webp";
    if (filename.endsWith(".gif")) contentType = "image/gif";

    const buffer = fs.readFileSync(filePath);
    set.headers["Content-Type"] = contentType;
    set.headers["Cache-Control"] = "public, max-age=3600";
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  });
