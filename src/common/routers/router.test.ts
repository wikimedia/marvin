import { newRoute } from "./route";
import { newRouter } from "./router";

const routes = [
  newRoute({
    path: "/",
    endpoint: () => import("../pages/home"),
    chunkName: "components/pages/home"
  })
];

describe("router()", () => {
  describe(".route()", () => {
    it(`a known route is resolved`, done => {
      newRouter(routes)
        .route("/")
        .then(() => done());
    });

    it(`an unknown route is rejected`, done => {
      newRouter(routes)
        .route("/404")
        .catch(() => done());
    });
  });
});
