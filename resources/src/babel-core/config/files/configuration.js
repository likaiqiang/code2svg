import buildDebug from "debug";
import nodeFs from "fs";
import path from "path";
import json5 from "json5";
import gensync from "gensync";
import { makeStrongCache, makeWeakCacheSync } from "../caching.js";
import { makeConfigAPI } from "../helpers/config-api.js";
import { makeStaticFileCache } from "./utils.js";
import loadCodeDefault from "./module-types.js";
import pathPatternToRegex from "../pattern-to-regex.js";
import ConfigError from "../../errors/config-error.js";
import * as fs from "../../gensync-utils/fs.js";
import { createRequire } from "module";
import { endHiddenCallStack } from "../../errors/rewrite-stack-trace.js";
const require = createRequire(import.meta.url);
const debug = buildDebug("babel:config:loading:files:configuration");
export const ROOT_CONFIG_FILENAMES = ["babel.config.js", "babel.config.cjs", "babel.config.mjs", "babel.config.json", "babel.config.cts"];
const RELATIVE_CONFIG_FILENAMES = [".babelrc", ".babelrc.js", ".babelrc.cjs", ".babelrc.mjs", ".babelrc.json", ".babelrc.cts"];
const BABELIGNORE_FILENAME = ".babelignore";
const LOADING_CONFIGS = new Set();
const readConfigCode = makeStrongCache(function* readConfigCode(filepath, cache) {
  if (!nodeFs.existsSync(filepath)) {
    cache.never();
    return null;
  }
  if (LOADING_CONFIGS.has(filepath)) {
    cache.never();
    debug("Auto-ignoring usage of config %o.", filepath);
    return {
      filepath,
      dirname: path.dirname(filepath),
      options: {}
    };
  }
  let options;
  try {
    LOADING_CONFIGS.add(filepath);
    options = yield* loadCodeDefault(filepath, "You appear to be using a native ECMAScript module configuration " + "file, which is only supported when running Babel asynchronously.");
  } finally {
    LOADING_CONFIGS.delete(filepath);
  }
  let assertCache = false;
  if (typeof options === "function") {
    yield* [];
    options = endHiddenCallStack(options)(makeConfigAPI(cache));
    assertCache = true;
  }
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new ConfigError(`Configuration should be an exported JavaScript object.`, filepath);
  }
  if (typeof options.then === "function") {
    throw new ConfigError(`You appear to be using an async configuration, ` + `which your current version of Babel does not support. ` + `We may add support for this in the future, ` + `but if you're on the most recent version of @babel/core and still ` + `seeing this error, then you'll need to synchronously return your config.`, filepath);
  }
  if (assertCache && !cache.configured()) throwConfigError(filepath);
  return {
    filepath,
    dirname: path.dirname(filepath),
    options
  };
});
const packageToBabelConfig = makeWeakCacheSync(file => {
  const babel = file.options["babel"];
  if (typeof babel === "undefined") return null;
  if (typeof babel !== "object" || Array.isArray(babel) || babel === null) {
    throw new ConfigError(`.babel property must be an object`, file.filepath);
  }
  return {
    filepath: file.filepath,
    dirname: file.dirname,
    options: babel
  };
});
const readConfigJSON5 = makeStaticFileCache((filepath, content) => {
  let options;
  try {
    options = json5.parse(content);
  } catch (err) {
    throw new ConfigError(`Error while parsing config - ${err.message}`, filepath);
  }
  if (!options) throw new ConfigError(`No config detected`, filepath);
  if (typeof options !== "object") {
    throw new ConfigError(`Config returned typeof ${typeof options}`, filepath);
  }
  if (Array.isArray(options)) {
    throw new ConfigError(`Expected config object but found array`, filepath);
  }
  delete options["$schema"];
  return {
    filepath,
    dirname: path.dirname(filepath),
    options
  };
});
const readIgnoreConfig = makeStaticFileCache((filepath, content) => {
  const ignoreDir = path.dirname(filepath);
  const ignorePatterns = content.split("\n").map(line => line.replace(/#(.*?)$/, "").trim()).filter(line => !!line);
  for (const pattern of ignorePatterns) {
    if (pattern[0] === "!") {
      throw new ConfigError(`Negation of file paths is not supported.`, filepath);
    }
  }
  return {
    filepath,
    dirname: path.dirname(filepath),
    ignore: ignorePatterns.map(pattern => pathPatternToRegex(pattern, ignoreDir))
  };
});
export function findConfigUpwards(rootDir) {
  let dirname = rootDir;
  for (;;) {
    for (const filename of ROOT_CONFIG_FILENAMES) {
      if (nodeFs.existsSync(path.join(dirname, filename))) {
        return dirname;
      }
    }
    const nextDir = path.dirname(dirname);
    if (dirname === nextDir) break;
    dirname = nextDir;
  }
  return null;
}
export function* findRelativeConfig(packageData, envName, caller) {
  let config = null;
  let ignore = null;
  const dirname = path.dirname(packageData.filepath);
  for (const loc of packageData.directories) {
    if (!config) {
      config = yield* loadOneConfig(RELATIVE_CONFIG_FILENAMES, loc, envName, caller, packageData.pkg?.dirname === loc ? packageToBabelConfig(packageData.pkg) : null);
    }
    if (!ignore) {
      const ignoreLoc = path.join(loc, BABELIGNORE_FILENAME);
      ignore = yield* readIgnoreConfig(ignoreLoc);
      if (ignore) {
        debug("Found ignore %o from %o.", ignore.filepath, dirname);
      }
    }
  }
  return {
    config,
    ignore
  };
}
export function findRootConfig(dirname, envName, caller) {
  return loadOneConfig(ROOT_CONFIG_FILENAMES, dirname, envName, caller);
}
function* loadOneConfig(names, dirname, envName, caller, previousConfig = null) {
  const configs = yield* gensync.all(names.map(filename => readConfig(path.join(dirname, filename), envName, caller)));
  const config = configs.reduce((previousConfig, config) => {
    if (config && previousConfig) {
      throw new ConfigError(`Multiple configuration files found. Please remove one:\n` + ` - ${path.basename(previousConfig.filepath)}\n` + ` - ${config.filepath}\n` + `from ${dirname}`);
    }
    return config || previousConfig;
  }, previousConfig);
  if (config) {
    debug("Found configuration %o from %o.", config.filepath, dirname);
  }
  return config;
}
export function* loadConfig(name, dirname, envName, caller) {
  const filepath = require.resolve(name, {
    paths: [dirname]
  });
  const conf = yield* readConfig(filepath, envName, caller);
  if (!conf) {
    throw new ConfigError(`Config file contains no configuration data`, filepath);
  }
  debug("Loaded config %o from %o.", name, dirname);
  return conf;
}
function readConfig(filepath, envName, caller) {
  const ext = path.extname(filepath);
  switch (ext) {
    case ".js":
    case ".cjs":
    case ".mjs":
    case ".cts":
      return readConfigCode(filepath, {
        envName,
        caller
      });
    default:
      return readConfigJSON5(filepath);
  }
}
export function* resolveShowConfigPath(dirname) {
  const targetPath = process.env.BABEL_SHOW_CONFIG_FOR;
  if (targetPath != null) {
    const absolutePath = path.resolve(dirname, targetPath);
    const stats = yield* fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error(`${absolutePath}: BABEL_SHOW_CONFIG_FOR must refer to a regular file, directories are not supported.`);
    }
    return absolutePath;
  }
  return null;
}
function throwConfigError(filepath) {
  throw new ConfigError(`\
Caching was left unconfigured. Babel's plugins, presets, and .babelrc.js files can be configured
for various types of caching, using the first param of their handler functions:

module.exports = function(api) {
  // The API exposes the following:

  // Cache the returned value forever and don't call this function again.
  api.cache(true);

  // Don't cache at all. Not recommended because it will be very slow.
  api.cache(false);

  // Cached based on the value of some function. If this function returns a value different from
  // a previously-encountered value, the plugins will re-evaluate.
  var env = api.cache(() => process.env.NODE_ENV);

  // If testing for a specific env, we recommend specifics to avoid instantiating a plugin for
  // any possible NODE_ENV value that might come up during plugin execution.
  var isProd = api.cache(() => process.env.NODE_ENV === "production");

  // .cache(fn) will perform a linear search though instances to find the matching plugin based
  // based on previous instantiated plugins. If you want to recreate the plugin and discard the
  // previous instance whenever something changes, you may use:
  var isProd = api.cache.invalidate(() => process.env.NODE_ENV === "production");

  // Note, we also expose the following more-verbose versions of the above examples:
  api.cache.forever(); // api.cache(true)
  api.cache.never();   // api.cache(false)
  api.cache.using(fn); // api.cache(fn)

  // Return the value that will be cached.
  return { };
};`, filepath);
}