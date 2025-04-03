import SuperTokens from "supertokens-node";
import { ensureSuperTokensInit } from "../auth/config";

ensureSuperTokensInit();

export default defineEventHandler((event) => {
  const method = getMethod(event);

  const allowedOrigin = process.env.NITRO_APP_WEBSITE_DOMAIN || 'http://localhost:5173';

  setResponseHeaders(event, {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': ["content-type"].concat(SuperTokens.getAllCORSHeaders()).join(', '),
      'Access-Control-Allow-Credentials': 'true'
  });

  if (method === "OPTIONS") {
    event.node.res.statusCode = 204;
    return '';
  }
});
