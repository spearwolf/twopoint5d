const path = require('path');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  entry: {
    crosses: './src/crosses/index.jsx',
    ['tiled-maps-basic-layer-tiles-renderer']: './src/tiled-maps-basic-layer-tiles-renderer/index.jsx',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['*', '.js', '.jsx'],
    alias: {
      'three-vertex-objects': path.join(__dirname, '../three-vertex-objects/build/three-vertex-objects.js'),
      'three-tiled-maps': path.join(__dirname, '../three-tiled-maps/build/three-tiled-maps.js'),
      'r3f-vertex-objects': path.join(__dirname, '../r3f-vertex-objects/build/r3f-vertex-objects.js'),
      'r3f-tiled-maps': path.join(__dirname, '../r3f-tiled-maps/build/r3f-tiled-maps.js'),
    },
  },
  output: {
    path: path.resolve(__dirname, './public'),
    filename: 'bundle-[name].js',
  },
  devServer: {
    contentBase: path.resolve(__dirname, './public'),
  },
  plugins: [
    new BundleAnalyzerPlugin()
  ]
};
