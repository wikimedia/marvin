// Ignore importing style and image files when running on Node.js
import "ignore-styles";

import * as express from "express";
import {
  PRODUCTION,
  SERVER_PORT,
  SERVER_URL,
  WEBPACK_DEV_SERVER_URL
} from "./configuration";
import { RouteResponse, newRouter } from "../common/routers/router";
import Page from "./components/Page";
import { h } from "preact";
import { render as renderToString } from "preact-render-to-string";
import { routes } from "../common/routers/api";

// The asset manifest built or the webpack-dev-server URL (which has no
// manifest).
const manifest = PRODUCTION
  ? require("../../dist/public/assets-manifest.json")
  : WEBPACK_DEV_SERVER_URL;

const server = express();

server.use("/public", express.static("dist/public"));

const render = (response: RouteResponse<any, any>) => {
  const Body = response.component;
  return (
    "<!doctype html>" + // eslint-disable-line prefer-template
    renderToString(
      <Page title="" manifest={manifest} chunkName={response.chunkName}>
        <Body />
      </Page>
    )
  );
};

const router = newRouter(routes);
server.get("*", (request, response) => {
  router
    .route(request.url)
    .then(routeResponse =>
      response.status(routeResponse.status).send(render(routeResponse))
    )
    .catch((error: Error) => {
      const message = `${error.message}\n${error.stack}`;
      console.error(message); // eslint-disable-line no-console
      response.status(500).send(message);
    });
});

server.listen(SERVER_PORT, () => {
  console.log(`Server started on ${SERVER_URL}/`); // eslint-disable-line no-console

  if (!PRODUCTION) {
    const touch = require("touch");

    // The server is now listening and ready to receive requests. If
    // developmental, touch the client sources to trigger a webpack-dev-server
    // file watch event which triggers a browser reload. If the server was
    // previously running, the browser will be updated with the latest results.
    // The negative offset accounts for:
    // https://github.com/webpack/watchpack/issues/25.
    const nowish: number = Date.now() - 10 * 1000;
    touch("src/client/index.tsx", { time: nowish });
  }
});
