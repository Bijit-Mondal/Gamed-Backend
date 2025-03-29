export default defineEventHandler((event) => {
    const method = getMethod(event);
  
    // ✅ Set CORS Headers
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': 'http://localhost:5173', // Must be a specific origin (NOT '*')
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': event.node.req.headers['access-control-request-headers'] || '*',
      'Access-Control-Allow-Credentials': 'true', // Required for cookies/auth headers
    });
  
    // ✅ Handle Preflight Requests (OPTIONS)
    if (method === 'OPTIONS') {
      event.node.res.statusCode = 204; // No Content (Success)
      return ''; // Empty response for preflight
    }
  });
  