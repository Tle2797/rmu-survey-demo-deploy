import { Elysia, t } from "elysia";
import { getExecRanking } from "../controllers/exec.ranking.controller";

export const execRankingRoute = new Elysia({ prefix: "/api/exec" }).get(
  "/ranking",
  getExecRanking,
  {
    query: t.Object({
      year: t.Optional(t.String()),
      surveyId: t.Optional(t.String()),
      view: t.Optional(t.String()),
      month: t.Optional(t.String()),
      weekStart: t.Optional(t.String()),
      date: t.Optional(t.String()),
      respondentGroup: t.Optional(t.String()),
      departmentGroupId: t.Optional(t.String()),
    }),
  },
);
