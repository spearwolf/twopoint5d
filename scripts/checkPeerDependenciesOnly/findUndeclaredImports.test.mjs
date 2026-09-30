import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {findUndeclaredImports, packageNameOf} from './findUndeclaredImports.mjs';

const peers = {three: '~0.185.1', '@spearwolf/eventize': '^1.0.0'};

const find = (text, peerDependencies = peers) => findUndeclaredImports([{file: 'a.js', text}], peerDependencies);

describe('packageNameOf', () => {
  it('names the package a specifier reaches', () => {
    assert.equal(packageNameOf('three'), 'three');
    assert.equal(packageNameOf('three/webgpu'), 'three');
    assert.equal(packageNameOf('@spearwolf/eventize'), '@spearwolf/eventize');
    assert.equal(packageNameOf('@scope/name/sub/path.js'), '@scope/name');
    assert.equal(packageNameOf('node:fs'), 'node:fs');
    assert.equal(packageNameOf('fs'), 'fs');
  });
});

describe('findUndeclaredImports', () => {
  it('reports a bare import of a package that is no peer, with its file', () => {
    assert.deepEqual(find("import {x} from 'lodash';"), [{file: 'a.js', specifier: 'lodash'}]);
  });

  it('stays quiet for relative paths and peer subpaths', () => {
    const text = [
      "import {a} from './a.js';",
      "import {b} from '../b.js';",
      "import {c} from 'three/tsl';",
      "import {d} from 'three/webgpu';",
      "import {e} from '@spearwolf/eventize';",
    ].join('\n');
    assert.deepEqual(find(text), []);
  });

  it('stays quiet for a subpath import of the package itself', () => {
    assert.deepEqual(find("import {x} from '#internal';\nimport('#other/path.js');"), []);
  });

  it('stays quiet for an import inside a comment', () => {
    assert.deepEqual(find("/**\n * @example\n * import {x} from 'lodash';\n */\nexport const a = 1;"), []);
  });

  it('reports re-exports, dynamic imports, side-effect imports and import types', () => {
    const text = ["export * from 'a';", "const m = import('b');", "import 'c';", "export type T = import('d').T;"].join('\n');
    assert.deepEqual(
      find(text).map(({specifier}) => specifier),
      ['a', 'b', 'c', 'd'],
    );
  });

  it('reports a type reference unless it or its @types package is a peer', () => {
    assert.deepEqual(find('/// <reference types="node" />'), [{file: 'a.js', specifier: 'node'}]);
    assert.deepEqual(find('/// <reference types="three" />', {'@types/three': '~0.185.4'}), []);
  });

  it('treats a missing peerDependencies like an empty one', () => {
    const files = [{file: 'a.js', text: "import 'three';"}];
    assert.deepEqual(findUndeclaredImports(files, undefined), [{file: 'a.js', specifier: 'three'}]);
  });

  it('keeps the order of the files, imports before type references within a file', () => {
    const files = [
      {file: 'a.d.ts', text: '/// <reference types="node" />\nimport "x";'},
      {file: 'b.js', text: 'import "y";'},
    ];
    assert.deepEqual(findUndeclaredImports(files, {}), [
      {file: 'a.d.ts', specifier: 'x'},
      {file: 'a.d.ts', specifier: 'node'},
      {file: 'b.js', specifier: 'y'},
    ]);
  });
});
