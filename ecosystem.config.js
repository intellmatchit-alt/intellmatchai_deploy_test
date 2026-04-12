/**
 * PM2 Ecosystem Configuration
 *
 * Run with: pm2 start ecosystem.config.js
 */

const fs = require('fs');
const path = require('path');

// Load frontend env vars from .env.local
function loadEnvFile(filePath) {
  const env = {};
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) return;
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) return;
      const key = line.substring(0, eqIndex).trim();
      let value = line.substring(eqIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key) {
        env[key] = value;
      }
    });
  }
  return env;
}

const frontendEnv = loadEnvFile(path.join(__dirname, 'frontend', '.env.local'));
const backendEnv = loadEnvFile(path.join(__dirname, 'backend', '.env'));

module.exports = {
  apps: [
    {
      name: 'p2p-backend',
      cwd: './backend',
      script: './dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        ...backendEnv,
      },
    },
    {
      name: 'p2p-frontend',
      cwd: './frontend',
      script: './.next/standalone/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ...frontendEnv,
      },
    },
  ],
};
