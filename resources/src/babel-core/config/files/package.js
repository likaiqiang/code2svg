import path from "path";
import { makeStaticFileCache } from "./utils.js";
import ConfigError from "../../errors/config-error.js";
const PACKAGE_FILENAME = "package.json";
const readConfigPackage = makeStaticFileCache((filepath, content) => {
  let options;
  try {
    options = JSON.parse(content);
  } catch (err) {
    throw new ConfigError(`Error while parsing JSON - ${err.message}`, filepath);
  }
  if (!options) throw new Error(`${filepath}: No config detected`);
  if (typeof options !== "object") {
    throw new ConfigError(`Config returned typeof ${typeof options}`, filepath);
  }
  if (Array.isArray(options)) {
    throw new ConfigError(`Expected config object but found array`, filepath);
  }
  return {
    filepath,
    dirname: path.dirname(filepath),
    options
  };
});
export function* findPackageData(filepath) {
  let pkg = null;
  const directories = [];
  let isPackage = true;
  let dirname = path.dirname(filepath);
  while (!pkg && path.basename(dirname) !== "node_modules") {
    directories.push(dirname);
    pkg = yield* readConfigPackage(path.join(dirname, PACKAGE_FILENAME));
    const nextLoc = path.dirname(dirname);
    if (dirname === nextLoc) {
      isPackage = false;
      break;
    }
    dirname = nextLoc;
  }
  return {
    filepath,
    directories,
    pkg,
    isPackage
  };
}