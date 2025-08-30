// Minimal Railway Test Server - NO DEPENDENCIES
const http = require('http');

const PORT = process.env.PORT || 3000;

console.log('=== RAILWAY TEST SERVER ===');
console.log('Starting server on port:', PORT);
console.log('Time:', new Date().toISOString());

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  const response = {
    status: 'OK',
    message: 'Railway Test Server Running',
    timestamp: new Date().toISOString(),
    port: PORT,
    url: req.url,
    method: req.method,
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'not-set',
      hasNotionToken: !!process.env.NOTION_TOKEN,
      envCount: Object.keys(process.env).length
    }
  };
  
  res.end(JSON.stringify(response, null, 2));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on 0.0.0.0:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM - Shutting down');
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT - Shutting down');
  server.close();  
  process.exit(0);
});