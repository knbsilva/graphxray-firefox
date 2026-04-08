import { addRuntimeMessageListener } from "../common/extensionApi.js";

addRuntimeMessageListener(async (request) => {
  return "response";
});
