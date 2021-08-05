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
