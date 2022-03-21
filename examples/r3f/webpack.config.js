/* eslint-env node */
const path = require("path");

module.exports = {
  entry: {
    crosses: {
      import: "./src/crosses/index.jsx",
      dependOn: "libs",
    },
    "textured-sprites": {
      import: "./src/textured-sprites/index.jsx",
      dependOn: "libs",
    },
    libs: [
      "regenerator-runtime/runtime",
      "three",
      "@spearwolf/vertex-objects",
      "@spearwolf/textured-sprites",
      "@spearwolf/stage25",
      "@spearwolf/tiled-maps",
      "@spearwolf/kobolde",
      "@react-three/fiber",
      "react-dom",
      "react",
    ],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ["babel-loader"],
      },
    ],
  },
  resolve: {
    extensions: ["*", ".js", ".jsx"],
  },
  output: {
    path: path.resolve(__dirname, "./public"),
    filename: "[name].js",
  },
  devServer: {
    static: [
      path.resolve(__dirname, "./public"),
      path.resolve(__dirname, "../.."),
    ],
  },
};
