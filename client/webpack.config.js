const webpack = require('webpack');
const assert = require('assert');
const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');

module.exports = (() => {
    const IS_ANALYZE = false; // use custom cli argument once migrate to webpack2: https://github.com/webpack/webpack/issues/2254
    const IS_PRODUCTION = process.env['NODE_ENV'] === 'production' || IS_ANALYZE;

    console.log([
        '****',
        'Building Frontend',
        '`IS_PRODUCTION==='+IS_PRODUCTION+'`',
        '`IS_ANALYZE==='+IS_ANALYZE+'`',
        '****',
    ].join(' '));


    const entry = {
        app: [
            "./src/css/index.css",
            "./src/js/index.js",
        ],
    };

    const loaders = (() => { 
        const query_arg = '((\\?[a-f0-9]+)|(\\?v=\\d+\\.\\d+\\.\\d+))?$';

        const file_loader = {
            loader: "file-loader",
            options: {
                name: 'static/[hash].[ext]',
            },
        };

        return [
            {
                test: new RegExp('\\.woff'+query_arg),
                use: [file_loader],
            },
            {
                test: new RegExp('\\.woff2'+query_arg),
                include: [
                    path.resolve(__dirname, "node_modules/"),
                ],
                use: [file_loader],
            },
            {
                test: new RegExp('\\.woff2'+query_arg),
                loader: "url-loader",
                include: [
                    path.resolve(__dirname, "src/"),
                ],
            },
            {
                test: new RegExp('\\.ttf'+query_arg),
                use: [file_loader],
            },
            {
                test: new RegExp('\\.eot'+query_arg),
                use: [file_loader],
            },
            {
                test: new RegExp('\\.svg'+query_arg),
                use: [
                    {
                        loader: "url-loader",
                        options: {
                            limit: 10000,
                            mimetype: "image/svg+xml",
                            name: 'static/[hash].[ext]',
                        },
                    }
                ],
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
                loader: ExtractTextPlugin.extract({
                    fallback: "style-loader",
                    use: [
                        {
                            loader: "css-loader",
                        },
                        {
                            loader: "postcss-loader",
                            options: {plugins: postcss},
                        }
                    ],
                }),
                include: [
                    path.resolve(__dirname, "src/css/"),
                    path.resolve(__dirname, "src/js/"),
                ],
            },
            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract({
                    fallback: "style-loader",
                    use: [
                        {
                            loader: "css-loader",
                        },
                    ],
                }),
                include: [
                    path.resolve(__dirname, "node_modules/"),
                ],
            },
        ];
    })(); 

    const plugins = [ 
        new ExtractTextPlugin({filename: "static/[contenthash].css"}),
        new HtmlWebpackPlugin({
            template: 'src/index.ejs',
            inject: false,
            minify: {
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: true,
                removeScriptTypeAttributes: true,
                removeStyleLinkTypeAttributes: true,
            },
        }),
        new FaviconsWebpackPlugin({
            logo: path.resolve(__dirname, 'src/img/logo.png'),
            prefix: 'static/icons-[hash]/',
            persistentCache: true,
            inject: true,
            background: '#fff',
            title: 'devarchy',
            // FaviconsWebpackPlugin doesn't pass these to the `favicons` package
         // appName: 'devarchy',
         // appDescription: 'Catalogs of Frontend Libraries',
         // developerName: 'Romuald Brillout',
         // developerURL: 'http://brillout.com',
            icons: {
                android: true,
                appleIcon: true,
                appleStartup: true,
                coast: { offset: 25 },
                favicons: true,
                firefox: true,
                windows: true,
                yandex: true,
            },
        }),
        new ProgressBarPlugin(),
    ]; 

    if( IS_PRODUCTION ) {
        production_config({plugins});
    }

    if( IS_ANALYZE ) {
        analyze_config({entry, loaders, plugins});
    }

    return {
        entry,
        output: {
            path: path.join(__dirname, 'dist/'),
            publicPath: "/",
            filename: "static/[chunkhash].js",
        },
        module: {
            loaders,
        },
        resolve: {
            extensions: ['.js', '.jsx', '.json', ],
        },
        plugins,
        devtool: IS_PRODUCTION ? 'source-map' :
         // 'eval-source-map'
            'eval'
            ,
        devServer: {
            inline: true,
            port: 8082,
            quiet: true,
        },
    };

    function postcss(webpack) { 
        const postcss_import = require("postcss-import")();
        const postcss_reporter = require("postcss-reporter")({
            plugins: ['!postcss-discard-empty'],
        });
        const postcss_cssnext = require("postcss-cssnext")({
            features: {autoprefixer: false}, // already included in `cssnano`
        });
        const cssnano = require('cssnano')({
            reduceIdents: false,
            zindex: false,
        });
        return [
            postcss_import,
            "postcss-url",
            postcss_cssnext,
            cssnano,
            postcss_reporter,
            "postcss-easing-gradients",
        ].map(pkg => pkg.constructor===String?require(pkg):pkg);
    } 

    function analyze_config({entry, loaders, plugins}) { 
        const package_json = require('./package.json');

        let packages = Object.keys(package_json.dependencies);
        console.log(packages);
    //  packages = ['react', 'octicons', ];
    //  packages = ['react', 'react-dom', 'bluebird', 'crossroads', 'validator', 'timerlog', ];

        packages = packages.filter(p => ![
            'octicons',
            'react-icons',
        ].includes(p))

        plugins.push(
            new webpack.optimize.CommonsChunkPlugin({
                // reverse() because of https://github.com/webpack/webpack/issues/1016#issuecomment-182093533
                name: packages.reverse(),
                filename: 'vendor_[name].js',
            })
        );
        packages.forEach(package_name => {
            entry[package_name] = [package_name];
        });

        loaders.push({
            test: new RegExp('\\.woff2'),
            include: [
                path.resolve(__dirname, "src/"),
            ],
            use: [file_loader],
        });
    } 

    function production_config({plugins}) { 
        plugins.unshift(
            new webpack.DefinePlugin({
                'process.env': {
                    'NODE_ENV': JSON.stringify('production'),
                }
            })
        );
        [
            new webpack.LoaderOptionsPlugin({
                minimize: true,
            }),
            new webpack.optimize.UglifyJsPlugin({
                sourceMap: true,
            }),
        ].forEach(plugin => plugins.push(plugin));
    } 
})();
