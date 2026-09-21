/**
 * Throws unless the manifest names the package and its version, each as a non-empty string —
 * the two fields a publish needs before it asks npm anything.
 */
export function checkManifest(pkgJson) {
  const missing = ['name', 'version'].filter((field) => typeof pkgJson?.[field] !== 'string' || pkgJson[field].trim() === '');
  if (missing.length > 0) {
    throw new Error(`the manifest has no ${missing.map((field) => `"${field}"`).join(' and no ')}`);
  }
}
