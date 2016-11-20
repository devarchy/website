const assert = require('assert');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const IS_DEV = process.env['NODE_ENV'] !== 'production';
console.log('+++ Building Frontend for: '+(IS_DEV?'Development':'Production')+'+++');

const query_arg = '((\\?[a-f0-9]+)|(\\?v=\\d+\\.\\d+\\.\\d+))?$';

module.exports = {
    entry: {
        app: [
            "./src/css/index.css",
            "./src/js/index.js",
        ],
     // vendor: ['request-promise', ],
    },
    plugins:
        []
        .concat(
            IS_DEV ? [] :
                new webpack.DefinePlugin({
                    'process.env': {
                        'NODE_ENV': JSON.stringify('production')
                    }
                })
        )
        .concat(
            [
             // new webpack.optimize.CommonsChunkPlugin(/* chunkName= */"vendor", /* filename= */"vendor.bundle.js"),
                new ExtractTextPlugin("style.css"),
                new HtmlWebpackPlugin({
                    template: 'src/index.ejs',
                    minify: {
                        collapseWhitespace: true,
                        removeComments: true,
                        removeRedundantAttributes: true,
                        removeScriptTypeAttributes: true,
                        removeStyleLinkTypeAttributes: true,
                    },
                }),
            ]
        ),
    resolve: {
        extensions: ['', '.js', '.jsx'],
    },
    output: {
        path: path.join(__dirname, 'dist'),
        publicPath: "/",
        filename: "script.js",
    },
    module: {
        loaders: [
            {
                test: new RegExp('\\.woff'+query_arg),
                loader: "file",
            },
            {
                test: new RegExp('\\.woff2'+query_arg),
                loader: "file",
                include: [
                    path.resolve(__dirname, "node_modules/"),
                ],
            },
            {
                test: new RegExp('\\.woff2'+query_arg),
                loader: "url",
                include: [
                    path.resolve(__dirname, "src/"),
                ],
            },
            {
                test: new RegExp('\\.ttf'+query_arg),
                loader: "file",
            },
            {
                test: new RegExp('\\.eot'+query_arg),
                loader: "file",
            },
            {
                test: new RegExp('\\.svg'+query_arg),
                loader: "url?limit=10000&mimetype=image/svg+xml",
            },
            {
                test: /\.jsx?$/,
                loader: "babel-loader",
                include: [
                    path.resolve(__dirname, "src/js/"),
                ],
            },
            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract("style-loader", "css-loader!postcss-loader"),
                include: [
                    path.resolve(__dirname, "src/css/"),
                    path.resolve(__dirname, "src/js/"),
                ],
            },
            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract("style-loader", "css-loader"),
                include: [
                    path.resolve(__dirname, "node_modules/"),
                ],
            },
        ],
    },
    postcss: function (webpack) {
        const postcss_import = require("postcss-import")({
            addDependencyTo: webpack,
        });
        const postcss_reporter = require("postcss-reporter")({
            plugins: ['!postcss-discard-empty'],
        });
        const postcss_cssnext = require("postcss-cssnext")({
            features: {autoprefixer: false}, // already included in `cssnano`
        });
        return [
            postcss_import,
            "postcss-url",
            postcss_cssnext,
            "cssnano",
            postcss_reporter,
        ].map(pkg => pkg.constructor===String?require(pkg):pkg);
    },
};
