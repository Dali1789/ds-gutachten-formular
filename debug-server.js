const http = require('http');

console.log('=== DEBUG SERVER STARTUP ===');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Memory usage:', process.memoryUsage());
console.log('Environment variables count:', Object.keys(process.env).length);

// Log some key environment variables
const keyVars = ['PORT', 'NODE_ENV', 'NOTION_TOKEN', 'KONTAKTE_DATABASE_ID', 'BUSINESS_RESOURCES_DATABASE_ID'];
keyVars.forEach(key => {
  const value = process.env[key];
  console.log(`${key}:`, value ? (key.includes('TOKEN') ? 'SET (****)' : value) : 'NOT SET');
});

const port = process.env.PORT || 3000;

console.log('Creating HTTP server on port:', port);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    console.log('Health check requested');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Debug Server Running\nPort: ${port}\nTime: ${new Date().toISOString()}\nUptime: ${process.uptime()}s`);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Debug server listening on 0.0.0.0:${port}`);
  console.log('Server started successfully at:', new Date().toISOString());
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('=== DEBUG SERVER SETUP COMPLETE ===');