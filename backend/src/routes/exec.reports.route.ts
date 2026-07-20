import { Elysia, t } from "elysia";
import { getExecReports } from "../controllers/exec.reports.controller";

export const execReportsRoute = new Elysia({ prefix: "/api/exec" }).get(
  "/reports",
  getExecReports,
  {
    query: t.Object({
      surveyId: t.Optional(t.String()),
      year: t.Optional(t.String()),
      view: t.Optional(t.String()),
      month: t.Optional(t.String()),
      weekStart: t.Optional(t.String()),
      date: t.Optional(t.String()),
      respondentGroup: t.Optional(t.String()),
      departmentGroupId: t.Optional(t.String()),
    }),
  },
);
