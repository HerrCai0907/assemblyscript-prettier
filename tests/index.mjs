import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, relative, resolve } from "path";
import { copyFileSync, mkdirSync } from "fs";
import chalk from "chalk";
import { argv, cwd } from "process";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testFolder = resolve(__dirname, "env");
const as_prettier = resolve(__dirname, "..", "index.mjs");
const as_prettier_copy = resolve(testFolder, "index.mjs");
const targetFile = relative(cwd(), resolve(__dirname, "example.ts"));

const as_version = argv[2] ?? 20;

console.log(chalk.green(`start test prettier for as v0.${as_version}.x`));
mkdirSync(testFolder);
execSync(`cd ${testFolder} && npm init -y && npm i prettier@2.7`);
execSync(`cd ${testFolder} && npm i assemblyscript@0.${as_version}`);
console.log(chalk.green("init node_modules done"));
copyFileSync(as_prettier, as_prettier_copy);
console.log(chalk.green("copy index.mjs done"));
execSync(`node ${as_prettier_copy} -c ${targetFile}`, { stdio: "inherit" });
console.log(chalk.green("test OK"));
