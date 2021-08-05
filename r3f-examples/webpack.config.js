const path = require("path");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = {
  entry: {
    crosses: {
      import: "./src/crosses/index.jsx",
      dependOn: "libs",
    },
    ["tiled-maps-basic-layer-tiles-renderer"]: {
      import: "./src/tiled-maps-basic-layer-tiles-renderer/index.jsx",
      dependOn: "libs",
    },
    libs: [
      "three",
      "three-vertex-objects",
      "three-tiled-maps",
      "r3f-vertex-objects",
      "r3f-tiled-maps",
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
    filename: "bundle-[name].js",
  },
  devServer: {
    contentBase: path.resolve(__dirname, "./public"),
  },
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: "static",
      reportFilename: "bundle-report.html",
      openAnalyzer: false,
    }),
  ],
};
