import { Elysia, t } from "elysia";
import {
  approveUserRegistration,
  createUser,
  deleteUser,
  getUserApprovalCounts,
  listUserApprovals,
  listUsers,
  rejectUserRegistration,
  updateAdminProfile,
  updateUser,
  uploadAdminProfileImage,
} from "../controllers/admin.users.controller";

export const adminUsersRoute = new Elysia({ prefix: "/api/admin" })
  .get("/users", listUsers)
  .get("/user-approvals/counts", getUserApprovalCounts)
  .get("/user-approvals", listUserApprovals)
  .put("/user-approvals/:id/approve", approveUserRegistration, {
    params: t.Object({ id: t.String() }),
  })
  .put("/user-approvals/:id/reject", rejectUserRegistration, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      reason: t.Optional(t.String()),
    }),
  })
  .post("/users", createUser, {
    body: t.Object({
      username: t.String(),
      role: t.Union([
        t.Literal("admin"),
        t.Literal("exec"),
        t.Literal("dept_head"),
        t.Literal("staff"),
      ]),
      department_id: t.Optional(t.Union([t.Number(), t.Null()])),
      password: t.String(),
      title: t.Optional(t.Union([t.String(), t.Null()])),
      first_name: t.Optional(t.Union([t.String(), t.Null()])),
      last_name: t.Optional(t.Union([t.String(), t.Null()])),
      email: t.Optional(t.Union([t.String(), t.Null()])),
    }),
  })
  .put("/users/:id", updateUser, {
    params: t.Object({ id: t.String() }),
    body: t.Partial(
      t.Object({
        username: t.String(),
        role: t.Union([
          t.Literal("admin"),
          t.Literal("exec"),
          t.Literal("dept_head"),
          t.Literal("staff"),
        ]),
        department_id: t.Union([t.Number(), t.Null()]),
        password: t.String(),
        is_active: t.Boolean(),
        title: t.Union([t.String(), t.Null()]),
        first_name: t.Union([t.String(), t.Null()]),
        last_name: t.Union([t.String(), t.Null()]),
        email: t.Union([t.String(), t.Null()]),
      }),
    ),
  })
  .delete("/users/:id", deleteUser, { params: t.Object({ id: t.String() }) })
  .put("/profile", updateAdminProfile, {
    body: t.Object(
      {
        user_id: t.Number(),
        username: t.String(),
        password: t.Optional(t.String()),
        title: t.Optional(t.Union([t.String(), t.Null()])),
        first_name: t.Optional(t.Union([t.String(), t.Null()])),
        last_name: t.Optional(t.Union([t.String(), t.Null()])),
      },
      { additionalProperties: true },
    ),
  })
  .post("/profile/image", uploadAdminProfileImage);
