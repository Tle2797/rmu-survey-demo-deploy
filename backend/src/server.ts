// backend/src/server.ts
import "./config/env";
import { app } from "./app";
import {
  ensureDepartmentCentralQuestionTable,
  ensureUserApprovalColumns,
} from "./config/db";

const port = Number(process.env.PORT) || 3080;

await ensureUserApprovalColumns();
await ensureDepartmentCentralQuestionTable();

app.listen(port);

console.log(`🚀 Backend running at http://localhost:${port}`);
