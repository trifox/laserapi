var HtmlWebpackPlugin = require("html-webpack-plugin");
var HtmlWebpackInlineSourcePlugin = require("html-webpack-inline-source-plugin");
var UglifyJsPlugin = require("uglifyjs-webpack-plugin");
var WebpackCleanupPlugin = require("webpack-cleanup-plugin");
var webpack = require("webpack");
var FileLoader = require("file-loader");
var intlJSON = require("./src/res/en.json");
var path = require("path");
var intlJSONStringified = {};
Object.keys(intlJSON).map(function (key) {
  intlJSONStringified["INTL_" + key] = JSON.stringify(intlJSON[key]);
});
intlJSON = intlJSONStringified;
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const CopyPlugin = require("webpack-copy-plugin");
var isProduction = process.env.NODE_ENV === "production";

console.log(
  "Building with NODE_ENV",
  process.env.NODE_ENV,
  path.join(__dirname, "dist")
);

var config = {
  /*  watch: !isProduction,
     watchOptions: {
     aggregateTimeout: 300,
     poll: 1000,
     ignored: /node_modules/
     },*/
  devServer: {
    contentBase: path.join(__dirname, "dist"),
    compress: false,
    port: 9000,
    watchContentBase: true,
  },
  entry: "./src/js/main.js",
  output: {
    path: __dirname + "/dist/",
    filename: "bundle.js",
  },
  module: {
    rules: [
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        loaders: [
          "file-loader?hash=sha512&digest=hex&name=[hash].[ext]",
          "image-webpack-loader?bypassOnDebug&optimizationLevel=7&interlaced=false",
        ],
      },
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: "css-loader",
        }),
      },
      {
        test: /\.(ogg|mp3|wav|mpe?g)$/i,
        loader: "file-loader",
      },
    ],
    loaders: [
      {
        test: /\.html$/,
        loader: "ejs-loader",
      },
      {
        test: /\.css$/,
        loader: "css-loader",
      },
    ],
  },

  plugins: [new WebpackCleanupPlugin()],
};

if (isProduction) {
  config.plugins.push(
    new UglifyJsPlugin({
      compress: {
        sequences: true,
        properties: true,
        drop_debugger: true,
        dead_code: true,
        unsafe: true,
        conditionals: true,
        comparisons: true,
        evaluate: true,
        booleans: true,
        unused: true,
        loops: true,
        cascade: true,
        keep_fargs: false,
        if_return: true,
        join_vars: true,
        drop_console: true,
      },
      "mangle-props": true,
      mangle: true,
      beautify: false,
    })
  );
}

config.plugins.push(new ExtractTextPlugin("styles.css"));
config.plugins.push(
  new webpack.DefinePlugin(intlJSON),
  new HtmlWebpackPlugin({
    filename: "index.html",
    template: "src/index.html",
    minify: {
      minifyJS: true,
      removeEmptyAttributes: true,
    },
    inlineSource: ".(js|css)$",
    cache: true,
  })
);

if (isProduction) {
  config.plugins.push(new HtmlWebpackInlineSourcePlugin());
}

config.plugins.push(new CopyPlugin({ dirs: [{ from: 'public', 'to': 'dist' }] }))
module.exports = config;
