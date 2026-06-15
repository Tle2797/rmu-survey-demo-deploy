import { Elysia, t } from "elysia";
import {
  getDepartmentComments,
  getDepartmentSummary,
  getDepartmentYearly,
  resetDepartmentQRCode,
} from "../controllers/dashboard.controller";

export const dashboardRoute = new Elysia({ prefix: "/api/dashboard" })
  .get("/department/:departmentId/summary", getDepartmentSummary)
  .get("/department/:departmentId/comments", getDepartmentComments)
  .get("/department/:departmentId/yearly", getDepartmentYearly, {
    params: t.Object({ departmentId: t.String() }),
    query: t.Object({
      view: t.Optional(
        t.Union([
          t.Literal("year"),
          t.Literal("month"),
          t.Literal("week"),
          t.Literal("day"),
        ]),
      ),
      from: t.Optional(t.String()),
      to: t.Optional(t.String()),
      year: t.Optional(t.String()),
      month: t.Optional(t.String()),
      weekStart: t.Optional(t.String()),
    }),
  })
  .post("/qrcode/:departmentId/reset", resetDepartmentQRCode, {
    params: t.Object({ departmentId: t.String() }),
  });
