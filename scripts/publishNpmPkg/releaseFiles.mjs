import fs from 'node:fs';
import path from 'node:path';

/**
 * Lists the files a release copies into the package directory before `npm publish`, each as
 * `{src, dst}`: the license from the workspace root, the changelog and the readme from the
 * project directory — `README-pkg.md` if there is one, `README.md` otherwise — and a workspace
 * `.npmrc` if there is one, first. Throws with every missing source path when the license,
 * the changelog or the readme is absent: a published version is immutable on npm, so a release
 * without them cannot be repaired by anything but a new version.
 */
export function releaseFiles({workspaceRoot, projectRoot, packageRoot}) {
  const readmePkg = path.resolve(projectRoot, 'README-pkg.md');
  const readme = fs.existsSync(readmePkg) ? readmePkg : path.resolve(projectRoot, 'README.md');

  const required = [
    {src: path.resolve(workspaceRoot, 'LICENSE'), dst: path.resolve(packageRoot, 'LICENSE')},
    {src: path.resolve(projectRoot, 'CHANGELOG.md'), dst: path.resolve(packageRoot, 'CHANGELOG.md')},
    {src: readme, dst: path.resolve(packageRoot, 'README.md')},
  ];

  const missing = required.filter(({src}) => !fs.existsSync(src)).map(({src}) => src);
  if (missing.length > 0) {
    throw new Error(`${missing.join(', ')} ${missing.length === 1 ? 'does' : 'do'} not exist`);
  }

  // the repository tracks no `.npmrc`; a workspace one carries registry settings to
  // `npm publish` in the package directory, and npm never packs it
  const npmrc = path.resolve(workspaceRoot, '.npmrc');
  const optional = fs.existsSync(npmrc) ? [{src: npmrc, dst: path.resolve(packageRoot, '.npmrc')}] : [];

  return [...optional, ...required];
}
