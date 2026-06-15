import { Elysia, t } from "elysia";
import {
  createSurvey,
  deleteSurvey,
  listSurveys,
  toggleSurveyActive,
  updateSurvey,
} from "../controllers/admin.surveys.controller";

export const adminSurveysRoute = new Elysia({
  prefix: "/api/admin/surveys",
})
  .get("/", listSurveys)
  .post("/", createSurvey, {
    body: t.Object({
      title: t.String(),
      description: t.Optional(t.Union([t.String(), t.Null()])),
      year_be: t.Numeric(),
    }),
  })
  .put("/:id", updateSurvey, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      title: t.String(),
      description: t.Optional(t.Union([t.String(), t.Null()])),
      year_be: t.Numeric(),
    }),
  })
  .put("/:id/toggle-active", toggleSurveyActive, {
    params: t.Object({ id: t.String() }),
  })
  .delete("/:id", deleteSurvey, {
    params: t.Object({ id: t.String() }),
    query: t.Object({
      force: t.Optional(t.String()),
    }),
  });
