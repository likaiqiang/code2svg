import buildDebug from "debug";
import path from "path";
import { isAsync } from "../../gensync-utils/async.js";
import loadCodeDefault, { supportsESM } from "./module-types.js";
import { fileURLToPath, pathToFileURL } from "url";
import importMetaResolve from "./import-meta-resolve.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const debug = buildDebug("babel:config:loading:files:plugins");
const EXACT_RE = /^module:/;
const BABEL_PLUGIN_PREFIX_RE = /^(?!@|module:|[^/]+\/|babel-plugin-)/;
const BABEL_PRESET_PREFIX_RE = /^(?!@|module:|[^/]+\/|babel-preset-)/;
const BABEL_PLUGIN_ORG_RE = /^(@babel\/)(?!plugin-|[^/]+\/)/;
const BABEL_PRESET_ORG_RE = /^(@babel\/)(?!preset-|[^/]+\/)/;
const OTHER_PLUGIN_ORG_RE = /^(@(?!babel\/)[^/]+\/)(?![^/]*babel-plugin(?:-|\/|$)|[^/]+\/)/;
const OTHER_PRESET_ORG_RE = /^(@(?!babel\/)[^/]+\/)(?![^/]*babel-preset(?:-|\/|$)|[^/]+\/)/;
const OTHER_ORG_DEFAULT_RE = /^(@(?!babel$)[^/]+)$/;
export const resolvePlugin = resolveStandardizedName.bind(null, "plugin");
export const resolvePreset = resolveStandardizedName.bind(null, "preset");
export function* loadPlugin(name, dirname) {
  const filepath = resolvePlugin(name, dirname, yield* isAsync());
  const value = yield* requireModule("plugin", filepath);
  debug("Loaded plugin %o from %o.", name, dirname);
  return {
    filepath,
    value
  };
}
export function* loadPreset(name, dirname) {
  const filepath = resolvePreset(name, dirname, yield* isAsync());
  const value = yield* requireModule("preset", filepath);
  debug("Loaded preset %o from %o.", name, dirname);
  return {
    filepath,
    value
  };
}
function standardizeName(type, name) {
  if (path.isAbsolute(name)) return name;
  const isPreset = type === "preset";
  return name.replace(isPreset ? BABEL_PRESET_PREFIX_RE : BABEL_PLUGIN_PREFIX_RE, `babel-${type}-`).replace(isPreset ? BABEL_PRESET_ORG_RE : BABEL_PLUGIN_ORG_RE, `$1${type}-`).replace(isPreset ? OTHER_PRESET_ORG_RE : OTHER_PLUGIN_ORG_RE, `$1babel-${type}-`).replace(OTHER_ORG_DEFAULT_RE, `$1/babel-${type}`).replace(EXACT_RE, "");
}
function* resolveAlternativesHelper(type, name) {
  const standardizedName = standardizeName(type, name);
  const {
    error,
    value
  } = yield standardizedName;
  if (!error) return value;
  if (error.code !== "MODULE_NOT_FOUND") throw error;
  if (standardizedName !== name && !(yield name).error) {
    error.message += `\n- If you want to resolve "${name}", use "module:${name}"`;
  }
  if (!(yield standardizeName(type, "@babel/" + name)).error) {
    error.message += `\n- Did you mean "@babel/${name}"?`;
  }
  const oppositeType = type === "preset" ? "plugin" : "preset";
  if (!(yield standardizeName(oppositeType, name)).error) {
    error.message += `\n- Did you accidentally pass a ${oppositeType} as a ${type}?`;
  }
  if (type === "plugin") {
    const transformName = standardizedName.replace("-proposal-", "-transform-");
    if (transformName !== standardizedName && !(yield transformName).error) {
      error.message += `\n- Did you mean "${transformName}"?`;
    }
  }
  error.message += `\n
Make sure that all the Babel plugins and presets you are using
are defined as dependencies or devDependencies in your package.json
file. It's possible that the missing plugin is loaded by a preset
you are using that forgot to add the plugin to its dependencies: you
can workaround this problem by explicitly adding the missing package
to your top-level package.json.
`;
  throw error;
}
function tryRequireResolve(id, dirname) {
  try {
    if (dirname) {
      return {
        error: null,
        value: require.resolve(id, {
          paths: [dirname]
        })
      };
    } else {
      return {
        error: null,
        value: require.resolve(id)
      };
    }
  } catch (error) {
    return {
      error,
      value: null
    };
  }
}
function tryImportMetaResolve(id, options) {
  try {
    return {
      error: null,
      value: importMetaResolve(id, options)
    };
  } catch (error) {
    return {
      error,
      value: null
    };
  }
}
function resolveStandardizedNameForRequire(type, name, dirname) {
  const it = resolveAlternativesHelper(type, name);
  let res = it.next();
  while (!res.done) {
    res = it.next(tryRequireResolve(res.value, dirname));
  }
  return res.value;
}
function resolveStandardizedNameForImport(type, name, dirname) {
  const parentUrl = pathToFileURL(path.join(dirname, "./babel-virtual-resolve-base.js")).href;
  const it = resolveAlternativesHelper(type, name);
  let res = it.next();
  while (!res.done) {
    res = it.next(tryImportMetaResolve(res.value, parentUrl));
  }
  return fileURLToPath(res.value);
}
function resolveStandardizedName(type, name, dirname, resolveESM) {
  if (!supportsESM || !resolveESM) {
    return resolveStandardizedNameForRequire(type, name, dirname);
  }
  try {
    return resolveStandardizedNameForImport(type, name, dirname);
  } catch (e) {
    try {
      return resolveStandardizedNameForRequire(type, name, dirname);
    } catch (e2) {
      if (e.type === "MODULE_NOT_FOUND") throw e;
      if (e2.type === "MODULE_NOT_FOUND") throw e2;
      throw e;
    }
  }
}
if (!process.env.BABEL_8_BREAKING) {
  var LOADING_MODULES = new Set();
}
function* requireModule(type, name) {
  if (!process.env.BABEL_8_BREAKING) {
    if (!(yield* isAsync()) && LOADING_MODULES.has(name)) {
      throw new Error(`Reentrant ${type} detected trying to load "${name}". This module is not ignored ` + "and is trying to load itself while compiling itself, leading to a dependency cycle. " + 'We recommend adding it to your "ignore" list in your babelrc, or to a .babelignore.');
    }
  }
  try {
    if (!process.env.BABEL_8_BREAKING) {
      LOADING_MODULES.add(name);
    }
    if (process.env.BABEL_8_BREAKING) {
      return yield* loadCodeDefault(name, `You appear to be using a native ECMAScript module ${type}, ` + "which is only supported when running Babel asynchronously.");
    } else {
      return yield* loadCodeDefault(name, `You appear to be using a native ECMAScript module ${type}, ` + "which is only supported when running Babel asynchronously.", true);
    }
  } catch (err) {
    err.message = `[BABEL]: ${err.message} (While processing: ${name})`;
    throw err;
  } finally {
    if (!process.env.BABEL_8_BREAKING) {
      LOADING_MODULES.delete(name);
    }
  }
}