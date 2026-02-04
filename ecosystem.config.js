/**
 * PM2 Ecosystem Configuration for Plesk Deployment
 * This file configures PM2 process manager for production deployment
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 logs
 *   pm2 restart centxo
 *   pm2 stop centxo
 */

module.exports = {
    apps: [
        {
            name: 'centxo',
            script: './server.js',
            instances: 1,
            exec_mode: 'cluster',

            // Environment variables
            env: {
                NODE_ENV: 'production',
                PORT: 4000,
            },

            // Auto-restart configuration
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',

            // Logging
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            log_file: './logs/pm2-combined.log',
            time: true,

            // Advanced settings
            min_uptime: '10s',
            max_restarts: 10,
            restart_delay: 4000,

            // Kill timeout
            kill_timeout: 5000,
        },
    ],
};
