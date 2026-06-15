import { config } from "dotenv";
import fs from "fs";
import path from "path";

const envFile = process.env.ENV_FILE?.trim();
const nodeEnv = process.env.NODE_ENV?.trim();
const cwd = process.cwd();

const candidateFiles = [
  envFile,
  nodeEnv === "production" ? ".env.production" : undefined,
  ".env",
].filter((value): value is string => Boolean(value));

for (const file of candidateFiles) {
  const resolvedPath = path.isAbsolute(file) ? file : path.resolve(cwd, file);
  if (!fs.existsSync(resolvedPath)) continue;

  config({ path: resolvedPath, override: false });
  break;
}
