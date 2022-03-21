const path = require("path");

module.exports = {
  entry: {
    crosses: {
      import: "./src/crosses/index.jsx",
      dependOn: "libs",
    },
    // ["tiled-maps-basic-layer-tiles-renderer"]: {
    //   import: "./src/tiled-maps-basic-layer-tiles-renderer/index.jsx",
    //   dependOn: "libs",
    // },
    libs: [
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
    filename: "bundle-[name].js",
  },
  devServer: {
    static: path.resolve(__dirname, "./public"),
  },
};
