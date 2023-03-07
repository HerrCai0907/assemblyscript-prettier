import pluginTypescript from "prettier/plugins/typescript";
import { magic, preProcess } from "./replace.js";
import { builders } from "prettier/doc";

let as_estree = {};

function initPrinter(jsPlugin) {
  Object.assign(as_estree, {
    ...jsPlugin.printers.estree,
    printComment(commentPath, options) {
      let comment = commentPath.getValue().value;
      if (comment.startsWith(magic) && comment.endsWith(magic)) {
        let doc = [];
        if (commentPath.stack[commentPath.stack.length - 2] == 0) {
          doc.push(builders.hardline);
        }
        doc.push(comment.slice(magic.length, -magic.length));
        return doc;
      } else {
        return jsPlugin.printers.estree.printComment(commentPath, options);
      }
    },
  });
}

function parse(text, options) {
  initPrinter(options.plugins.find((plugin) => plugin.printers && plugin.printers.estree));

  let processedText = preProcess(text);
  let ast = pluginTypescript.parsers.typescript.parse(processedText, options);

  for (let comment of ast.comments) {
    let value = comment.value;
    if (value.startsWith(magic) && value.endsWith(magic)) {
      comment.range[0] += magic.length + 2;
      comment.range[1] -= magic.length + 2;
    }
  }

  return ast;
}

export default {
  parsers: {
    typescript: {
      ...pluginTypescript.parsers.typescript,
      parse,
      astFormat: "as-estree",
    },
  },
  printers: { "as-estree": as_estree },
};
