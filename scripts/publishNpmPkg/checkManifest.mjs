import {describeUnpublishable, findUnpublishableSpecifiers} from './findUnpublishableSpecifiers.mjs';

/**
 * Throws unless the manifest names the package and its version, each as a non-empty
 * string — the two fields a publish needs before it asks npm anything — and unless a
 * `publishConfig.registry`, if there is one, is an http or https URL: the version check
 * hands it to npm as the registry to ask, and `npm publish` uploads there. It throws as well
 * for a manifest that still carries a specifier the build refuses: the publish script
 * uploads every directory it is given, and a version on npm is immutable, so it holds the
 * manifest it is about to upload to the same bar as the build. A source package with its
 * `catalog:` entries, or a `dist/` whose manifest still carries such a specifier, does not
 * get through.
 */
export function checkManifest(pkgJson) {
  const missing = ['name', 'version'].filter((field) => typeof pkgJson?.[field] !== 'string' || pkgJson[field].trim() === '');
  if (missing.length > 0) {
    throw new Error(`the manifest has no ${missing.map((field) => `"${field}"`).join(' and no ')}`);
  }

  const publishConfig = pkgJson.publishConfig;
  if (publishConfig !== null && typeof publishConfig === 'object' && 'registry' in publishConfig) {
    const value = publishConfig.registry;
    if (typeof value !== 'string' || !URL.canParse(value) || !['http:', 'https:'].includes(new URL(value).protocol)) {
      throw new Error(`publishConfig.registry is ${JSON.stringify(value)}, which is no http or https URL`);
    }
  }

  const unpublishable = findUnpublishableSpecifiers(pkgJson);
  if (unpublishable.length > 0) {
    throw new Error(`${unpublishable.map(describeUnpublishable).join('; ')} — publish the dist/ that makePackageJson.mjs writes`);
  }
}
