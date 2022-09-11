/* eslint-env node */
const path = require("path");

module.exports = {
  mode: "development",
  entry: {
    crosses: {
      import: "./src/crosses/index.jsx",
      dependOn: "libs",
    },
    "textured-sprites": {
      import: "./src/textured-sprites/index.jsx",
      dependOn: "libs",
    },
    "textured-sprites-from-tileset": {
      import: "./src/textured-sprites-from-tileset/index.jsx",
      dependOn: "libs",
    },
    "map2d-tile-sprites": {
      import: "./src/map2d-tile-sprites/index.jsx",
      dependOn: "libs",
    },
    "map2d-tile-sprites-layer": {
      import: "./src/map2d-tile-sprites-layer/index.jsx",
      dependOn: "libs",
    },
    clouds: {
      import: "./src/clouds/index.jsx",
      dependOn: "libs",
    },
    libs: [
      "regenerator-runtime/runtime",
      "three",
      "@spearwolf/vertex-objects",
      "@spearwolf/textured-sprites",
      "@spearwolf/stage25",
      "@spearwolf/tiled-maps",
      "@spearwolf/picimo",
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
    liveReload: true,
    hot: false,
    allowedHosts: 'all',
    port: 9090,
    static: [
      path.resolve(__dirname, "./public"),
      {
        directory: path.resolve(__dirname, "../../examples/assets"),
        publicPath: "/examples/assets",
      },
    ],
  },
};
