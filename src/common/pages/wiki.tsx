import { h } from "preact";
import App from "../components/app/app";
import ContentHeader from "../components/content-header/content-header";
import { Page as PageModel } from "../models/page/page";
import { PageTitleID, PageTitlePath } from "../models/page/title";
import Page from "../components/page/page";
import { RouteParams } from "../router/route";
import { wiki } from "../router/routes";
import { requestPage } from "../http/page-http-client";
import ContentFooter from "../components/content-footer/content-footer";
import ContentPage from "../components/content-page/content-page";
import HttpResponse from "../http/http-response";
import { RedirectError } from "../http/fetch";
import { Thumbnail } from "../components/thumbnail/thumbnail";
import { unmarshalPageTitleID } from "../marshallers/page-base/page-base-unmarshaller"; // eslint-disable-line max-len

interface PageParams extends RouteParams {
  /**
   * When used as an input, an (unencoded, not necessarily denormalized)
   * possible PageTitleID; when used as an output of Route.toParams(), an
   * (encoded, not necessarily denormalized) PageTitlePath.
   */
  title: PageTitleID | PageTitlePath | string;
  revision?: string;
}

// undefined means random input (Route.toPath()) and {} means random output
// (Route.toParams()).
export type Params =
  | PageParams
  | { title?: undefined; revision?: undefined }
  | undefined;

export interface Props {
  page: PageModel;
}

function request(
  params: Params = {},
  init?: RequestInit
): Promise<HttpResponse<PageModel>> {
  return requestPage(
    params.title === undefined
      ? { random: true, init }
      : {
          titlePath: params.title,
          revision:
            params.revision === undefined
              ? undefined
              : parseInt(params.revision, 10),
          init
        }
  ).catch(error => {
    if (error instanceof RedirectError) {
      const title = unmarshalPageTitleID(error.url);
      const url = wiki.toPath({ title, revision: params.revision });
      throw new RedirectError(error.status, url);
    }

    throw error;
  });
}

export default {
  getInitialProps(params: Params = {}): Promise<HttpResponse<Props>> {
    return request(params).then(({ status, data }) => ({
      status,
      data: { page: data }
    }));
  },

  Component({ page }: Props): JSX.Element {
    return (
      <App>
        <Page
          title={<ContentHeader titleHTML={page.titleHTML} />}
          subtitle={page.descriptionText}
          footer={<ContentFooter lastModified={page.lastModified} />}
        >
          {page.fileImage && (
            <Thumbnail
              image={page.fileImage.thumbnail}
              url={page.fileImage.url}
            />
          )}
          <ContentPage sections={page.sections} />
        </Page>
      </App>
    );
  }
};
