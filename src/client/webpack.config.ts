import * as AssetsPlugin from "assets-webpack-plugin";
import * as CleanPlugin from "clean-webpack-plugin";
import * as CopyWebpackPlugin from "copy-webpack-plugin";
import * as ExtractTextPlugin from "extract-text-webpack-plugin";
import * as webpack from "webpack";
import {
  DEV_TOOL,
  EXTENSIONS,
  PATHS,
  STATS,
  definePlugin,
  typescriptLoader
} from "../common/webpack.config";
import {
  PRODUCTION,
  VERBOSE,
  WEBPACK_DEV_SERVER_PORT,
  WEBPACK_DEV_SERVER_URL
} from "../server/config";

const UglifyJSPlugin = require("uglifyjs-webpack-plugin");

// `chunkhash` is used instead of `hash` to get per-file / chunk hashes instead
// of a global build hash. When a global build hash is used, it updates whenever
// any change occurs which unnecessarily invalidates independent chunks. See
// https://webpack.js.org/guides/caching/#output-filenames. For the
// development server, the hash is omitted because a manifest is not used.
const CHUNK_FILENAME = PRODUCTION ? "[name].[chunkhash].js" : "[name].js";

const config: webpack.Configuration = {
  entry: {
    // _The_ browser entry point is needed to load and render pages and perform
    // routing and has full-control over the site's browsing experience
    //
    // This output changes whenever the entry or its dependencies, or common
    // modules lifted from pages from CommonsChunkPlugin changes.
    //
    // `src/client/index` has no correspondence to which page a browser visits.
    // e.g., `/`, `/wiki/Foobar`, and `/about` all use the client so that
    // subsequent pages can be loaded dynamically inline.
    index: __dirname

    // (runtime): reserved for the Webpack runtime chunk.
    //   DO NOT DEFINE AN entry NAMED "runtime"
    //
    // This chunk performs module resolution, dynamic importing, and more for
    // all other code during execution. Without a distinct runtime chunk, it's
    // instead bundled into each entry which breaks caching. This chunk changes
    // whenever any code anywhere changes.
  },

  stats: STATS,

  output: {
    // The filesystem base destination directory for the client entry point
    // chunk files given as an absolute path. All outputs specified in
    // `config.entry` will be generated here.
    path: PATHS.public.output,

    // The base web request path for chunk files to appear in the asset
    // manifest. This is just a prefix, not a filename join, so a trailing slash
    // is necessary. For production, use an absolute path for assets to load
    // fine in nested pathnames. For development, use the Webpack development
    // server.
    publicPath: PRODUCTION ? "/public/" : `${WEBPACK_DEV_SERVER_URL}/public/`,

    // `config.entry` chunk filenames. e.g.:
    //
    //   {
    //     ...
    //     "index": {
    //       "js": "public/index.123.js",
    //       "css": "public/index.abc.css"
    //     },
    //     ...
    //   }
    //
    // The property names are derived from `config.entry`. The values are
    // derived from `config.output.publicPath` and `config.output.filename`. The
    // manifest itself is generated by the assets-webpack-plugin.
    filename: CHUNK_FILENAME,

    // Dynamic dependency chunk filenames. e.g.:
    //
    //   {
    //     ...
    //     "pages/home": {
    //       "js": "public/pages/home.123.js"
    //     },
    //     ...
    //   }
    //
    // These chunks or code splits correspond to dynamic imports that are
    // resolved asynchronously and lazily as needed. e.g.:
    // `import("./foo").then(foo => foo.bar())`. The promised module may have
    // required fetching a chunk asynchronously over the network for the client
    // or may be local to the filesystem for the server. The purpose of code
    // splitting is to minimize client bandwidth (e.g., the main page doesn't
    // require the JavaScript and CSS for the about page and vice versa). See
    // https://webpack.js.org/guides/code-splitting/.
    //
    // The properties are derived from directive comments inlined within the
    // imports like `/* webpackChunkName: "pages/home" */`.
    // The values are derived from `config.output.publicPath` and
    // `CHUNK_FILENAME`. The manifest itself is generated by the
    // assets-webpack-plugin.
    chunkFilename: CHUNK_FILENAME
  },

  performance: {
    hints: PRODUCTION ? "error" : false,

    maxAssetSize: 48 * 1024,

    // Limits the sum of all assets (index, runtime, and vendor) required
    // for an initial load for a specific entry (e.g., index).
    maxEntrypointSize: 64 * 1024
  },

  resolve: {
    alias: {
      // todo: remove. https://github.com/developit/preact/issues/924
      preact$: "preact/dist/preact.js"
    },

    extensions: EXTENSIONS
  },

  module: {
    rules: [
      typescriptLoader,
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: {
            loader: "style-loader",
            options: {
              // Hot module replacement is not enabled.
              hmr: false
            }
          },
          use: { loader: "css-loader", options: { minimize: PRODUCTION } }
        })
      },
      {
        test: /\.svg$/,
        loader: "svg-inline-loader",
        options: {
          // Don't remove SVG attributes, which defaulted to true.
          removeSVGTagAttrs: false
        }
      }
    ]
  },

  devtool: DEV_TOOL,

  // For development builds, serve the packaged result over
  // http://localhost:8080/ and live reload the browser when the bundle is
  // rebuilt.
  devServer: PRODUCTION
    ? undefined
    : {
        // Forbid static files. All responses are in memory.
        contentBase: false,

        // Explicitly specify the default port so a failure to allocate will
        // cause Webpack to exit with a nonzero. Otherwise, a free port is
        // allocated and requests fail to execute when made.
        port: WEBPACK_DEV_SERVER_PORT,

        // Log warnings and errors in the browser console.
        clientLogLevel: VERBOSE ? "info" : "warning",

        // Log bundling progress in the browser console.
        progress: VERBOSE,

        // Hide bundling start and finish messages.
        noInfo: !VERBOSE,

        // Show warnings and errors as an obtrusive opaque overlay in the
        // browser.
        overlay: { warnings: true, errors: true },

        stats: STATS
      }
};

// See also
// https://medium.com/webpack/predictable-long-term-caching-with-webpack-d3eee1d3fa31.
config.plugins = [
  new CleanPlugin([PATHS.public.output], {
    verbose: VERBOSE,

    // Enable cleaning to occur at the project root and not just at the
    // server-specific Webpack source root.
    allowExternal: true
  }),

  new webpack.IgnorePlugin(/domino/),

  definePlugin,

  // Reference modules by name instead of by chunk ID so hashes don't change
  // when new files are added. For example,
  // `"./node_modules/preact/dist/preact.esm.js"` instead of `18`.
  new webpack.NamedModulesPlugin(),

  new ExtractTextPlugin({
    // `contenthash` is not actually a chunk hash:
    // https://github.com/webpack-contrib/extract-text-webpack-plugin/issues/504#issuecomment-306581954.
    filename: PRODUCTION ? "[name].[contenthash].css" : "[name].css",

    // Extract from all additional chunks too (by default it extracts only from
    // the initial chunks). When using CommonsChunkPlugin (see plugin below) and
    // there are extracted chunks (from ExtractTextPlugin.extract module rule
    // above) in the commons chunk, allChunks must be set to true.
    // https://github.com/webpack-contrib/extract-text-webpack-plugin/blob/8de6558/README.md#options
    allChunks: true
  }),

  // Create a separate chunk for client package dependencies. External
  // dependencies are expected to change less often than repo code so isolating
  // them to a separate chunk improves the cacheability of a significant portion
  // of the client. This chunk changes whenever external dependencies change.
  new webpack.optimize.CommonsChunkPlugin({
    name: "vendor",

    // Do not include common code identified from other entries. Only include
    // what was explicitly required from node_modules to keep the result
    // strictly limited to external package dependencies.
    // https://webpack.js.org/plugins/commons-chunk-plugin/#passing-the-minchunks-property-a-function
    minChunks(module) {
      // This prevents stylesheet resources with the .css extension from being
      // moved from their original chunk to the vendor chunk
      if (module.resource && /^.*\.(css)$/.test(module.resource)) {
        return false;
      }
      return module.context && module.context.indexOf("node_modules") !== -1;
    }
  }),

  // When using code splitting, move common chunks of child chunks into the
  // parent chunks, when used a minimum number of times. 3 times used is
  // considered right now like a good tradeoff.
  // https://webpack.js.org/plugins/commons-chunk-plugin/#move-common-modules-into-the-parent-chunk
  new webpack.optimize.CommonsChunkPlugin({ children: true, minChunks: 3 }),

  // Create a separate chunk for the client's Webpack runtime. When a name with
  // no corresponding entry and no chunks configuration is specified, Webpack's
  // CommonsChunkPlugin injects all the code needed during execution for module
  // resolution, dynamic importing, and more. Without this distinct runtime
  // chunk, it's instead bundled into each entry, which breaks caching. This
  // chunk changes whenever any other file changes. See
  // https://webpack.js.org/plugins/commons-chunk-plugin/#manifest-file.
  // This runtime plugin instance needs to happen after the previous
  // CommonsChunkPlugin invocations, order matters between them, see:
  // * https://webpack.js.org/plugins/commons-chunk-plugin/#combining-implicit-common-vendor-chunks-and-manifest-file
  // * and https://webpack.js.org/guides/caching/#extracting-boilerplate
  new webpack.optimize.CommonsChunkPlugin({
    // This name should NOT match any `config.entry`.
    name: "runtime"
  }),

  // Copy all files in src/public to the dist/public directory, so that we are
  // able to provide with static assets without having to import them in the
  // client code. Like for example, favicon and logos, among others.
  new CopyWebpackPlugin([{ from: "**/*", context: "src/public" }])
];

if (PRODUCTION) {
  // Generate the asset manifest, a chunk name to relative HTTP path map in JSON
  // format. This mapping allows the server to use constant, human readable
  // strings like `manifest["index"]["js"]` to reference a cache-busting
  // resource whose location is not known until post-compilation such as
  // `public/index.789.js`. The server uses the result when generating an
  // initial HTML page template for the browser.
  //
  // The manifest is NOT used by the client.
  //
  // The manifest is only used in production. Chunk names and path names are
  // identical for development (webpack-dev-server) builds, because they do not
  // include a hash, and the server would need to be restarted to re-import
  // manifest changes such as file additions or removals.
  //
  // The manifest changes whenever any other file or chunk name changes.
  //
  // An example manifest:
  //
  //   {
  //     ...
  //     "pages/home": {
  //       "js": "public/pages/home.123.js"
  //     },
  //     "pages/about": {
  //       "js": "public/pages/about.456.js"
  //     },
  //     "index": {
  //       "js": "public/index.789.js",
  //       "css": "public/index.abc.css"
  //     },
  //     "runtime": {
  //       "js": "public/runtime.def.js"
  //     },
  //     ...
  //   }
  //
  // The property names are derived from ` config.entry` and directive comments
  // inlined within dynamic imports like `/* webpackChunkName: "pages/home" */`.
  // The property values are derived from `config.output.publicPath` and either
  // `CHUNK_FILENAME` or, for CSS only, `ExtractPluginOptions.filename`.
  config.plugins.push(
    new AssetsPlugin({
      prettyPrint: VERBOSE,
      filename: "assets-manifest.json",
      path: PATHS.public.output
    }),

    new UglifyJSPlugin({
      // Improve rebuild performance with file caching.
      cache: true,
      // Improve build performance with parallel processing.
      parallel: true,
      // Generate source maps at the expense of compilation time.
      sourceMap: true
      // extractComments appears to be enabled by default although the
      // documentation says otherwise.
    })
  );
}

export default config;
