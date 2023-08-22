import { parse } from "@babel/parser";
import { codeFrameColumns } from "@babel/code-frame";
import generateMissingPluginMessage from "./util/missing-plugin-helper.js";
export default function* parser(pluginPasses, {
  parserOpts,
  highlightCode = true,
  filename = "unknown"
}, code) {
  try {
    const results = [];
    for (const plugins of pluginPasses) {
      for (const plugin of plugins) {
        const {
          parserOverride
        } = plugin;
        if (parserOverride) {
          const ast = parserOverride(code, parserOpts, parse);
          if (ast !== undefined) results.push(ast);
        }
      }
    }
    if (results.length === 0) {
      return parse(code, parserOpts);
    } else if (results.length === 1) {
      yield* [];
      if (typeof results[0].then === "function") {
        throw new Error(`You appear to be using an async parser plugin, ` + `which your current version of Babel does not support. ` + `If you're using a published plugin, you may need to upgrade ` + `your @babel/core version.`);
      }
      return results[0];
    }
    throw new Error("More than one plugin attempted to override parsing.");
  } catch (err) {
    if (err.code === "BABEL_PARSER_SOURCETYPE_MODULE_REQUIRED") {
      err.message += "\nConsider renaming the file to '.mjs', or setting sourceType:module " + "or sourceType:unambiguous in your Babel config for this file.";
    }
    const {
      loc,
      missingPlugin
    } = err;
    if (loc) {
      const codeFrame = codeFrameColumns(code, {
        start: {
          line: loc.line,
          column: loc.column + 1
        }
      }, {
        highlightCode
      });
      if (missingPlugin) {
        err.message = `${filename}: ` + generateMissingPluginMessage(missingPlugin[0], loc, codeFrame);
      } else {
        err.message = `${filename}: ${err.message}\n\n` + codeFrame;
      }
      err.code = "BABEL_PARSE_ERROR";
    }
    throw err;
  }
}