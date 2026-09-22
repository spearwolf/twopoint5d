import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

const lookbookDir = fileURLToPath(new URL('../../apps/lookbook/', import.meta.url));

// RainbowLine from @spearwolf/astro-rainbow-line emits `<script src="${BASE_URL}/<path>">` at
// runtime and expects that file in the lookbook's `public/`; the package ships a copy but does not
// serve it, and the only reference to the path lives inside node_modules, where no grep of the repo
// sees it
describe('the rainbow-line script the lookbook serves', () => {
  const packageDir = path.dirname(
    createRequire(path.join(lookbookDir, 'package.json')).resolve('@spearwolf/astro-rainbow-line/package.json'),
  );
  const component = fs.readFileSync(path.join(packageDir, 'RainbowLine.astro'), 'utf8');
  const scriptPath = /RAINBOW_LINE_JS\s*\|\|\s*'([^']+)'/.exec(component)?.[1];

  it('is named by RainbowLine.astro as its default script path', () => {
    assert.ok(scriptPath, 'RainbowLine.astro no longer names its default script path the way this spec reads it');
  });

  it('lies in apps/lookbook/public at the path RainbowLine.astro loads it from', () => {
    const served = path.join(lookbookDir, 'public', scriptPath);
    assert.ok(
      fs.existsSync(served),
      `apps/lookbook/public/${scriptPath} is missing; every RainbowLine in the lookbook loads it at runtime`,
    );
  });

  it('is byte-for-byte the copy the package ships', () => {
    const served = fs.readFileSync(path.join(lookbookDir, 'public', scriptPath));
    const shipped = fs.readFileSync(path.join(packageDir, path.basename(scriptPath)));
    assert.ok(served.equals(shipped), `apps/lookbook/public/${scriptPath} differs from the copy in the package`);
  });
});
