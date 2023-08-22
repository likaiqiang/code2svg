export const transformFile = function transformFile(filename, opts, callback) {
  if (typeof opts === "function") {
    callback = opts;
  }
  callback(new Error("Transforming files is not supported in browsers"), null);
};
export function transformFileSync() {
  throw new Error("Transforming files is not supported in browsers");
}
export function transformFileAsync() {
  return Promise.reject(new Error("Transforming files is not supported in browsers"));
}