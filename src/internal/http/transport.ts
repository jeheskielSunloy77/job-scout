import { HttpClient, type HttpClientConfig } from "../../util/http.js";

export type Transport = HttpClient;

export function createTransport(config: HttpClientConfig): Transport {
  return new HttpClient(config);
}
