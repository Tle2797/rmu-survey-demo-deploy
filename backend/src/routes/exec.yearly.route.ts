import { Elysia, t } from "elysia";
import { getExecYearly } from "../controllers/exec.yearly.controller";

export const execYearlyRoute = new Elysia({ prefix: "/api/exec" }).get(
  "/yearly",
  getExecYearly,
  {
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
      date: t.Optional(t.String()),
    }),
  },
);
