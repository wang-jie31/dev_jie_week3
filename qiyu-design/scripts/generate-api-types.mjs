/**
 * OpenAPI → api-types 契约生成（G7 契约工程）
 *
 * 流程：
 *   1. Python 侧 import FastAPI app（不启服务）→ 导出 openapi.json 到临时文件
 *   2. openapi-typescript CLI 从 openapi.json 生成 TS 类型 → packages/api-types/src/index.ts
 *
 * 用法：
 *   node scripts/generate-api-types.mjs   （或 pnpm generate:types）
 * 前置：
 *   - API 依赖已安装（python venv 内 fastapi）
 *   - 前端依赖已安装（openapi-typescript，位于 packages/api-types devDeps）
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const API_DIR = path.join(PROJECT_ROOT, "api");
const OUT_DIR = path.join(PROJECT_ROOT, "packages", "api-types", "src");
const OUT_FILE = path.join(OUT_DIR, "index.ts");

// ---------- 1. 定位 Python（venv 优先） ----------
function findPython() {
  const home = os.homedir();
  const candidates = [
    // 托管 venv（WorkBuddy 默认，含 FastAPI）
    path.join(home, ".workbuddy", "binaries", "python", "envs", "default", "Scripts", "python.exe"),
    // 项目内 venv
    path.join(API_DIR, ".venv", "Scripts", "python.exe"),
    path.join(PROJECT_ROOT, ".venv", "Scripts", "python.exe"),
    process.env.PYTHON || "python",
  ];
  const found = candidates.find((p) => {
    try {
      execFileSync(p, ["--version"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });
  if (found) console.log(`[generate-api-types] 使用 Python: ${found}`);
  return found;
}

// ---------- 2. 导出 openapi.json ----------
function exportOpenApi(pythonBin) {
  const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(API_DIR)})
from app.main import app
print(json.dumps(app.openapi()))
`;
  const scriptFile = path.join(os.tmpdir(), `qiyu_openapi_${Date.now()}.py`);
  const jsonFile = path.join(os.tmpdir(), `qiyu_openapi_${Date.now()}.json`);
  fs.writeFileSync(scriptFile, script, "utf-8");
  try {
    const out = execFileSync(pythonBin, [scriptFile], {
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const jsonStr = out.trim().split("\n").pop();
    fs.writeFileSync(jsonFile, jsonStr, "utf-8");
    return jsonFile;
  } finally {
    fs.rmSync(scriptFile, { force: true });
  }
}

// ---------- 3. 定位 openapi-typescript CLI（直接指 JS 入口，不依赖 .bin 链接） ----------
function findOpenApiTypescript() {
  const candidates = [
    path.join(PROJECT_ROOT, "node_modules", "openapi-typescript", "bin", "cli.js"),
    path.join(PROJECT_ROOT, "node_modules", ".bin", "openapi-typescript"),
    path.join(PROJECT_ROOT, "node_modules", ".bin", "openapi-typescript.cmd"),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function main() {
  const pythonBin = findPython();
  if (!pythonBin) {
    console.error("[generate-api-types] 未找到 Python 解释器（需先安装 api/requirements.txt）");
    process.exit(1);
  }
  const cli = findOpenApiTypescript();
  if (!cli) {
    console.error("[generate-api-types] 未找到 openapi-typescript（需先 npm install）");
    process.exit(1);
  }

  const jsonFile = exportOpenApi(pythonBin);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  try {
    // 直接 node 执行 cli.js（跨平台，不依赖 .bin cmd 链接）
    const nodeBin = process.execPath;
    const args = [cli, jsonFile, "-o", OUT_FILE];
    execFileSync(nodeBin, args, { stdio: "inherit" });
  } finally {
    fs.rmSync(jsonFile, { force: true });
  }
  console.log(`[generate-api-types] OK → ${OUT_FILE}`);
}

main();