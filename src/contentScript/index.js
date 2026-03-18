import { addRuntimeMessageListener } from "../common/extensionApi.js";

addRuntimeMessageListener(async (request) => {
  console.log("Request", request);
  return "response";
});
