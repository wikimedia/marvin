import * as AssetsPlugin from "assets-webpack-plugin";
import * as ExtractTextPlugin from "extract-text-webpack-plugin";
import * as path from "path";
import * as webpack from "webpack";
import {
  PRODUCTION,
  VERBOSE,
  WEBPACK_DEV_SERVER_PORT,
  WEBPACK_DEV_SERVER_URL
} from "./src/server/configuration";

const PATHS = {
  // Files used by the client and the server.
  public: {
    output: path.resolve("./dist/public/")
  }
};

// `chunkhash` is used instead of `hash` to get per-file / chunk hashes instead
// of a global build hash. When a global build hash is used, it updates whenever
// any change occurs which unnecessarily invalidates independent chunks. See
// https://webpack.js.org/guides/caching/#output-filenames. For the
// development server, the hash is omitted because a manifest is not used.
const CHUNK_FILENAME = PRODUCTION ? "[name].[chunkhash].js" : "[name].js";

// There is no builtin Stats "warnings" preset.
// https://github.com/webpack/webpack/blob/7fe0371/lib/Stats.js#L886
// https://github.com/webpack/webpack/blob/7fe0371/lib/Stats.js#L101-L131
const STATS = {
  all: VERBOSE, // Default all outputs to verbosity.
  errors: true,
  errorDetails: true,
  warnings: true
};

const configuration: webpack.Configuration = {
  // Bundled outputs and their source inputs. For each entry, the source input
  // and any dependencies are compiled together into one chunk file output
  // except where split by the CommonsChunkPlugin.
  entry: {
    // _The_ client. A single page app. This statically specified output or
    // "entry point" is needed to dynamically load and render any subsequent
    // page or content a browser requests and has full-control over the site's
    // browsing experience when included and executed on a page by the browser.
    //
    // This output changes whenever a client source or its non-vendor dependency
    // changes.
    //
    // `src/client/index` has no correspondence to which page a browser visits.
    // e.g., `/`, `/wiki/Foobar`, and `/about` all use the client so that
    // subsequent pages can be loaded dynamically inline.
    index: "./src/client/index",

    // (runtime): reserved for the Webpack runtime chunk. This chunk performs
    // module resolution, dynamic importing, and more for all other code during
    // execution. Without a distinct runtime chunk, it's instead bundled into
    // each entry which breaks caching. This chunk changes whenever any code
    // anywhere changes.

    // Client package dependencies (these should match package.json's
    // `dependencies`). This chunk changes when one of the specified
    // dependencies changes.
    vendor: ["history", "path-to-regexp", "preact"]
  },

  stats: STATS,

  output: {
    // The filesystem base destination directory for the client entry point
    // chunk files given as an absolute path. All outputs specified in
    // `configuration.entry` will be generated here.
    path: PATHS.public.output,

    // The base web request path for chunk files to appear in the asset
    // manifest. This is just a prefix, not a filename join, so a trailing slash
    // is necessary. For production, use a relative path. For development, use
    // the Webpack development server.
    publicPath: PRODUCTION ? "public/" : `${WEBPACK_DEV_SERVER_URL}/public/`,

    // `configuration.entry` chunk filenames. e.g.:
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
    // The property names are derived from `configuration.entry`. The values
    // are derived from `configuration.output.publicPath` and
    // `configuration.output.filename`. The manifest itself is generated by the
    // assets-webpack-plugin.
    filename: CHUNK_FILENAME,

    // Dynamic dependency chunk filenames. e.g.:
    //
    //   {
    //     ...
    //     "components/pages/index": {
    //       "js": "public/components/pages/index.123.js"
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
    // imports like `/* webpackChunkName: "components/pages/index" */`.
    // The values are derived from `configuration.output.publicPath` and
    // `CHUNK_FILENAME`. The manifest itself is generated by the
    // assets-webpack-plugin.
    chunkFilename: CHUNK_FILENAME
  },

  resolve: {
    // Add `.ts` and `.tsx` as a resolvable extension.
    extensions: [".ts", ".tsx", ".js"]
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          logLevel: VERBOSE ? "info" : "warn"
        }
      },
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: ["css-loader"]
        })
      }
    ]
  },

  devtool: PRODUCTION ? "source-map" : "cheap-module-eval-source-map",

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
configuration.plugins = [
  // Reference modules by name instead of by chunk ID so hashes don't change
  // when new files are added. For example,
  // `"./node_modules/preact/dist/preact.esm.js"` instead of `18`.
  new webpack.NamedModulesPlugin(),

  new ExtractTextPlugin({
    filename: PRODUCTION ? "[name].[contenthash].css" : "[name].css"
  }),

  // Create a separate chunk for client package dependencies. External
  // dependencies are expected to change less often than repo code so isolating
  // them to a separate chunk improves the cacheability of a significant portion
  // of the client. This chunk changes whenever external dependencies change.
  new webpack.optimize.CommonsChunkPlugin({
    // This name should match `configuration.entry.vendor`.
    name: "vendor",

    // Do not include common code identified from other entries. Only include
    // what was explicitly specified in the vendor entry to keep the result
    // strictly limited to external package dependencies.
    minChunks: Infinity
  }),

  // Create a separate chunk for the client's Webpack runtime. When a name with
  // no corresponding entry is specified, Webpack injects all the code needed
  // during execution for module resolution, dynamic importing, and more.
  // Without this distinct runtime chunk, it's instead bundled into each entry,
  // including vendor, which breaks caching. This chunk changes whenever any
  // other file changes.
  new webpack.optimize.CommonsChunkPlugin({
    // This name should NOT match any `configuration.entry`.
    name: "runtime"
  })
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
  //     "components/pages/index": {
  //       "js": "public/components/pages/index.123.js"
  //     },
  //     "components/pages/about": {
  //       "js": "public/components/pages/about.456.js"
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
  // The property names are derived from ` configuration.entry` and directive
  // comments inlined within dynamic imports like
  // `/* webpackChunkName: "components/pages/index" */`. The property values are
  // derived from `configuration.output.publicPath` and either `CHUNK_FILENAME`
  // or, for CSS only, `ExtractPluginOptions.filename`.
  configuration.plugins.push(
    new AssetsPlugin({
      prettyPrint: VERBOSE,
      filename: "assets-manifest.json",
      path: PATHS.public.output
    })
  );
}

export default configuration;
