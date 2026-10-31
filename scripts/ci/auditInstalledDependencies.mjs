// Keeps the high and critical advisories of `pnpm audit --json` that are reached from the
// given projects. pnpm audit reads the whole lockfile and takes no --filter, while the build
// job of the deploy installs the workspace root and the library only, so the report is
// filtered here by the project each path of an advisory starts at.
//
//   pnpm audit --json > report.json || true
//   node scripts/ci/auditInstalledDependencies.mjs --report <file> --importer <dir> [--importer <dir> …]
//
// <dir> is a project directory relative to the workspace root: `.` or `packages/twopoint5d`.
//
// Exit: 0 when no such advisory is reached; 1 when one is, each on a line of stderr; 2 when an
// argument is missing, or <file> cannot be read or is no report of pnpm audit.

import fs from 'node:fs';
import {parseArgs} from 'node:util';
import {importerId, selectAdvisories} from './auditInstalledDependencies/selectAdvisories.mjs';

const USAGE = 'usage: node scripts/ci/auditInstalledDependencies.mjs --report <file> --importer <dir> [--importer <dir> …]';

let values;
try {
  ({values} = parseArgs({options: {report: {type: 'string'}, importer: {type: 'string', multiple: true}}}));
} catch (error) {
  // parseArgs names the option it refuses
  console.error(error instanceof Error ? error.message : String(error));
  console.error(USAGE);
  process.exit(2);
}

const reportPath = values.report;
const importers = values.importer ?? [];
if (!reportPath || importers.length === 0) {
  console.error(USAGE);
  process.exit(2);
}

let advisories;
try {
  advisories = selectAdvisories(JSON.parse(fs.readFileSync(reportPath, 'utf8')), importers.map(importerId));
} catch (error) {
  console.error(`auditInstalledDependencies: ${reportPath} ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const reachedFrom = importers.join(', ');
if (advisories.length === 0) {
  console.log(`auditInstalledDependencies: no high or critical advisory reached from ${reachedFrom}`);
} else {
  for (const {severity, module, vulnerableVersions, title, url, path} of advisories) {
    console.error(`${severity} ${module} ${vulnerableVersions}: ${title} (${url}), reached through ${path}`);
  }
  console.error(`auditInstalledDependencies: ${advisories.length} high or critical advisories reached from ${reachedFrom}`);
  process.exit(1);
}
