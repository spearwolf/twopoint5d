/* eslint-env node */
import path from "path";

import rollupConfigShared from "./rollup.config.shared";

export default rollupConfigShared(
  "cjs",
  ({
    outputDir,
    packageJson: {
      // name,
      rollupBuild: {
        outputName,
      },
    },
  }) => ({
    output: {
      file: path.join(outputDir, `${outputName}.cjs.js`),
      sourcemap: true,
      sourcemapFile: path.join(outputDir, `${outputName}.cjs.js.map`),
      format: "cjs",
    },
  })
);
