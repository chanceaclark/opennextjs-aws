import type { InternalEvent, InternalResult } from "types/open-next";
import type { WrapperHandler } from "types/overrides";

import type { MiddlewareOutputEvent } from "../../core/routingHandler";

const cfPropNameToHeaderName = {
  city: "x-open-next-city",
  country: "x-open-next-country",
  regionCode: "x-open-next-region",
  latitude: "x-open-next-latitude",
  longitude: "x-open-next-longitude",
};

interface WorkerContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

const handler: WrapperHandler<
  InternalEvent,
  InternalResult | ({ type: "middleware" } & MiddlewareOutputEvent)
> =
  async (handler, converter) =>
  async (
    request: Request,
    env: Record<string, string>,
    ctx: WorkerContext,
  ): Promise<Response> => {
    globalThis.process = process;
    globalThis.openNextWaitUntil = ctx.waitUntil;

    // Set the environment variables
    // Cloudflare suggests to not override the process.env object but instead apply the values to it
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string") {
        process.env[key] = value;
      }
    }

    const internalEvent = await converter.convertFrom(request);

    // Retrieve geo information from the cloudflare request
    // See https://developers.cloudflare.com/workers/runtime-apis/request
    // Note: This code could be moved to a cloudflare specific converter when one is created.
    const cfProperties = (request as any).cf as Record<string, string | null>;
    for (const [propName, headerName] of Object.entries(
      cfPropNameToHeaderName,
    )) {
      const propValue = cfProperties[propName];
      if (propValue !== null) {
        internalEvent.headers[headerName] = propValue;
      }
    }

    const response = await handler(internalEvent);

    const result: Response = await converter.convertTo(response);

    return result;
  };

export default {
  wrapper: handler,
  name: "cloudflare",
  supportStreaming: true,
  edgeRuntime: true,
};
