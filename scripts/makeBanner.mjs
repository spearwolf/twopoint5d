import fs from 'node:fs';
import path from 'node:path';
import {banner} from './makeBanner/banner.mjs';
import {makeVersionWithBuild} from './makeBanner/makeVersionWithBuild.mjs';

export function makeBanner(projectDir, build) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json')));
  const version = makeVersionWithBuild(build)(packageJson.version);
  return banner({...packageJson, version});
}
