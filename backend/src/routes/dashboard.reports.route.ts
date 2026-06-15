import { Elysia, t } from "elysia";
import { getDashboardReports } from "../controllers/dashboard.reports.controller";

export const dashboardReportsRoute = new Elysia({ prefix: "/api/dashboard" }).get(
  "/department/:departmentId/reports",
  getDashboardReports,
  {
    params: t.Object({
      departmentId: t.String(),
    }),
    query: t.Object({
      timeSlotId: t.Optional(t.String()),
      year: t.Optional(t.String()),
      surveyId: t.Optional(t.String()),
      view: t.Optional(t.String()),
      month: t.Optional(t.String()),
      weekStart: t.Optional(t.String()),
      date: t.Optional(t.String()),
      respondentGroup: t.Optional(t.String()),
    }),
  },
);
