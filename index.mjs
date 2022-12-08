#!/usr/bin/env node

import assemblyscript from "assemblyscript";
import asc from "assemblyscript/asc";
import prettier from "prettier";
import * as fs from "fs";
import { Command } from "commander";
import FastGlob from "fast-glob";
import { exit } from "process";
import chalk from "chalk";
import ignore from "ignore";
import { SingleBar } from "cli-progress";

const ascMajorVersion = parseInt(asc.version.split(".")[1]);

const readFile = fs.promises.readFile;
const writeFile = fs.promises.writeFile;

const prefix = "/*MAGIC_CODE_ASSEMBLYSCRIPT_PRETTIER";
const postfix = "MAGIC_CODE_ASSEMBLYSCRIPT_PRETTIER*/";

function preProcess(code) {
  let program = assemblyscript.newProgram(assemblyscript.newOptions());
  try {
    assemblyscript.parse(program, code, "test.ts");
  } catch (e) {
    //not assemblyscript ts file
    return;
  }
  let source = program.sources[0];

  let NodeKind = assemblyscript.NodeKind;
  function visitDecorators(node) {
    let list = [];
    let _visit = (_node) => {
      if (ascMajorVersion < 22) {
        switch (_node.kind) {
          case NodeKind.SOURCE: {
            _node.statements.forEach((statement) => {
              _visit(statement);
            });
            break;
          }
          case NodeKind.CLASSDECLARATION:
          case NodeKind.INTERFACEDECLARATION:
          case NodeKind.NAMESPACEDECLARATION: {
            _node.members.forEach((statement) => {
              _visit(statement);
            });
            break;
          }
          case NodeKind.ENUMDECLARATION:
          case NodeKind.METHODDECLARATION:
          case NodeKind.FUNCTIONDECLARATION: {
            if (_node.decorators) {
              list.push(
                ..._node.decorators.map((decorator) => {
                  return {
                    start: decorator.range.start,
                    end: decorator.range.end,
                  };
                })
              );
            }
            break;
          }
        }
      } else {
        switch (_node.kind) {
          case NodeKind.Source: {
            _node.statements.forEach((statement) => {
              _visit(statement);
            });
            break;
          }
          case NodeKind.ClassDeclaration:
          case NodeKind.InterfaceDeclaration:
          case NodeKind.NamespaceDeclaration: {
            _node.members.forEach((statement) => {
              _visit(statement);
            });
            break;
          }
          case NodeKind.EnumDeclaration:
          case NodeKind.MethodDeclaration:
          case NodeKind.FunctionDeclaration: {
            if (_node.decorators) {
              list.push(
                ..._node.decorators.map((decorator) => {
                  return {
                    start: decorator.range.start,
                    end: decorator.range.end,
                  };
                })
              );
            }
            break;
          }
        }
      }
    };
    _visit(node);
    return list;
  }

  const decorators = visitDecorators(source);
  decorators.sort((a, b) => a.start - b.start);
  let cursor = 0;
  const removeDecoratorCodes = decorators.map((decorator) => {
    let s1 = code.slice(cursor, decorator.start);
    let s2 = code.slice(decorator.start, decorator.end);
    cursor = decorator.end;
    return `${s1}${prefix}${s2}`;
  });
  removeDecoratorCodes.push(code.slice(cursor));
  return removeDecoratorCodes.join(postfix);
}
/**
 *
 * @param {string} code
 * @returns {string}
 */
function postProcess(code) {
  return code.split(prefix).join("").split(postfix).join("");
}
async function resolveConfig(path) {
  let config = (await prettier.resolveConfig(path)) || {};
  config.parser = "typescript";
  return config;
}

/**
 *
 * @param {string} path
 * @returns {Promise<string>}
 */
async function format(path) {
  const code = await readFile(path, { encoding: "utf8" });
  const tsCode = preProcess(code);
  let config = await resolveConfig(path);
  const formatTsCode = prettier.format(tsCode, config);
  const formatCode = postProcess(formatTsCode);
  return formatCode;
}
async function check(path) {
  const code = await readFile(path, { encoding: "utf8" });
  const tsCode = preProcess(code);
  let config = await resolveConfig(path);
  return prettier.check(tsCode, config);
}

const log = (...args) => {
  console.log(...args);
};
const success = (...args) => {
  console.log(chalk.bold.greenBright(...args));
};
const error = (...args) => {
  console.log(chalk.bold.redBright(...args));
  exit(-1);
};
const warning = (...args) => {
  console.log(chalk.bold.yellowBright(...args));
};

const program = new Command();
program
  .argument("<input-file>", "format file")
  .option("-c, --check", "Check if the given files are formatted")
  .option("-w, --write", "Edit files in-place. (Beware!)")
  .action(async (input, opts) => {
    if (fs.existsSync(input) && fs.statSync(input).isDirectory()) {
      input += "/**/*.ts";
    }
    const files = FastGlob.sync(input, { dot: true });
    const ig = ignore().add("node_modules");
    if (fs.existsSync(".asprettierignore")) {
      ig.add(fs.readFileSync(".asprettierignore", { encoding: "utf8" }));
    }
    const filterFiles = ig.filter(files).filter((v) => v.endsWith(".ts"));
    const b1 = new SingleBar({
      format: chalk.cyan("{bar}") + "| {percentage}% || {value}/{total} Files || formatting '{file}'",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });

    if (opts.check) {
      let failedFiles = [];
      b1.start(filterFiles.length, 0, { file: "N/A" });
      await Promise.all(
        filterFiles.map(async (file) => {
          let checkResult;
          checkResult = await check(file);
          if (!checkResult) {
            failedFiles.push(file);
          }
          b1.increment({ file });
        })
      );
      b1.stop();
      if (failedFiles.length > 0) {
        warning("Code style issues found in following files. Forgot to run Prettier?");
        log(`${failedFiles.map((v) => `- '${v}'`).join("\n")}`);
        exit(-1);
      } else {
        success("Perfect code style!");
      }
    } else if (opts.write) {
      b1.start(filterFiles.length, 0, { file: "N/A" });
      await Promise.all(
        filterFiles.map(async (file) => {
          let code = await format(file);
          await writeFile(file, code);
          b1.increment({ file });
        })
      );
      b1.stop();
    } else {
      filterFiles.forEach(async (file) => {
        let code = await format(file);
        log(code);
      });
    }
  });

try {
  program.parse(process.argv);
} catch (e) {
  error(`${e}`);
}
