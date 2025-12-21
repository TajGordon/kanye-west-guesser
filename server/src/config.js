/**
 * Server Configuration
 * Loads environment variables and provides configuration
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

export const config = {
    // Environment
    env: process.env.NODE_ENV || 'development',
    isProduction,
    isDevelopment,
    
    // Server
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    
    // CORS
    corsOrigin: process.env.CORS_ORIGIN 
        ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
        : (isDevelopment ? '*' : []),
    
    // Socket.IO
    socketPingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT || '60000', 10),
    socketPingInterval: parseInt(process.env.SOCKET_PING_INTERVAL || '25000', 10),
    
    // Game Settings
    maxLobbies: parseInt(process.env.MAX_LOBBIES || '100', 10),
    lobbyDestroyGraceMs: parseInt(process.env.LOBBY_DESTROY_GRACE_MS || '60000', 10),
    lobbyCleanupIntervalMs: parseInt(process.env.LOBBY_CLEANUP_INTERVAL_MS || '30000', 10),
    
    // Data Paths
    questionsDataPath: process.env.QUESTIONS_DATA_PATH || './data/questions',
    
    // Logging
    logLevel: process.env.LOG_LEVEL || (isProduction ? 'warn' : 'info'),
    
    // Security
    trustProxy: isProduction, // Trust proxy headers in production
    
    // Rate Limiting
    rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
    rateLimitMaxRequests: 100, // 100 requests per window
};

// Validate critical configuration
export function validateConfig() {
    const errors = [];
    
    if (config.isProduction && config.corsOrigin.length === 0) {
        errors.push('CORS_ORIGIN must be set in production');
    }
    
    if (config.isProduction && config.corsOrigin.includes('*')) {
        errors.push('CORS_ORIGIN should not be wildcard (*) in production');
    }
    
    if (config.port < 1 || config.port > 65535) {
        errors.push(`Invalid PORT: ${config.port}`);
    }
    
    if (errors.length > 0) {
        console.error('Configuration errors:');
        errors.forEach(err => console.error(`  - ${err}`));
        return false;
    }
    
    return true;
}

// Log configuration (hide sensitive values)
export function logConfig() {
    console.log('Server Configuration:');
    console.log(`  Environment: ${config.env}`);
    console.log(`  Port: ${config.port}`);
    console.log(`  Host: ${config.host}`);
    console.log(`  CORS Origin: ${Array.isArray(config.corsOrigin) ? config.corsOrigin.join(', ') : config.corsOrigin}`);
    console.log(`  Log Level: ${config.logLevel}`);
    console.log(`  Max Lobbies: ${config.maxLobbies}`);
}
