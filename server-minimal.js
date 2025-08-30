const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('=== MINIMAL SERVER STARTUP ===');
console.log('Node version:', process.version);
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Basic middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health endpoint
app.get('/health', (req, res) => {
    console.log('Health check requested');
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: {
            NODE_ENV: process.env.NODE_ENV || 'not set',
            PORT: PORT,
            NOTION_TOKEN: process.env.NOTION_TOKEN ? 'SET' : 'NOT SET',
            GOOGLE_CREDENTIALS: process.env.GOOGLE_CREDENTIALS ? 'SET' : 'NOT SET'
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.send(`
        <h1>DS Gutachten Formular - Minimal Server</h1>
        <p>Server is running on port ${PORT}</p>
        <p>Time: ${new Date().toISOString()}</p>
        <p><a href="/health">Health Check</a></p>
        <h2>Environment Variables:</h2>
        <ul>
            <li>NODE_ENV: ${process.env.NODE_ENV || 'not set'}</li>
            <li>NOTION_TOKEN: ${process.env.NOTION_TOKEN ? 'SET (*****)' : 'NOT SET'}</li>
            <li>GOOGLE_CREDENTIALS: ${process.env.GOOGLE_CREDENTIALS ? 'SET (*****)' : 'NOT SET'}</li>
            <li>KONTAKTE_DATABASE_ID: ${process.env.KONTAKTE_DATABASE_ID || 'NOT SET'}</li>
        </ul>
    `);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Time: ${new Date().toISOString()}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});