import { Elysia, t } from "elysia";
import {
  createCentralQuestions,
  createCentralQuestion,
  deleteCentralQuestion,
  listCentralQuestions,
  toggleCentralQuestionActive,
  updateCentralQuestion,
} from "../controllers/admin.questions.controller";

export const adminCentralQuestionsRoute = new Elysia({
  prefix: "/api/admin/questions/central",
})
  .get("/", listCentralQuestions, {
    query: t.Object({
      survey_id: t.Optional(t.String()),
    }),
  })
  .post("/", createCentralQuestion, {
    body: t.Object({
      survey_id: t.Numeric(),
      text: t.String(),
      type: t.Union([t.Literal("rating"), t.Literal("text")]),
      display_order: t.Optional(t.Numeric()),
    }),
  })
  .post("/bulk", createCentralQuestions, {
    body: t.Object({
      survey_id: t.Numeric(),
      questions: t.Array(
        t.Object({
          text: t.String(),
          type: t.Union([t.Literal("rating"), t.Literal("text")]),
          display_order: t.Optional(t.Numeric()),
        }),
        { minItems: 1, maxItems: 50 },
      ),
    }),
  })
  .put("/:id", updateCentralQuestion, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      text: t.String(),
      type: t.Union([t.Literal("rating"), t.Literal("text")]),
      display_order: t.Optional(t.Numeric()),
    }),
  })
  .put("/:id/toggle-active", toggleCentralQuestionActive, {
    params: t.Object({ id: t.String() }),
  })
  .delete("/:id", deleteCentralQuestion, {
    params: t.Object({ id: t.String() }),
    query: t.Object({
      force: t.Optional(t.String()),
    }),
  });
