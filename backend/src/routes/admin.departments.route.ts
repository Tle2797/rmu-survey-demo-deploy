import { Elysia, t } from "elysia";
import {
  createAdminDepartment,
  deleteAdminDepartment,
  listAdminDepartments,
  patchAdminDepartmentActive,
  toggleAdminDepartmentActive,
  updateAdminDepartment,
} from "../controllers/admin.departments.controller";

export const adminDepartmentsRoute = new Elysia({
  prefix: "/api/admin/departments",
})
  .get("/", listAdminDepartments, {
    query: t.Object({
      include_qr: t.Optional(t.String()),
    }),
  })
  .post("/", createAdminDepartment, {
    body: t.Object({
      name: t.String(),
      department_group_id: t.Number(),
    }),
  })
  .put("/:id", updateAdminDepartment, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.String(),
      department_group_id: t.Number(),
    }),
  })
  .put("/:id/toggle-active", toggleAdminDepartmentActive, {
    params: t.Object({ id: t.String() }),
  })
  .patch("/:id/toggle-active", patchAdminDepartmentActive, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ is_active: t.Boolean() }),
  })
  .delete("/:id", deleteAdminDepartment, {
    params: t.Object({ id: t.String() }),
    query: t.Object({
      force: t.Optional(t.String()),
    }),
  });
