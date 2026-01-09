module.exports = {
  apps: [
    {
      name: 'kontado',
      script: './server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_file: '.env',  // Load environment variables from .env file
      env: {
        NODE_ENV: 'production',
        // PORT can be overridden in .env file if needed
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      merge_logs: true,
      // Restart delay
      restart_delay: 4000,
      // Listen timeout
      listen_timeout: 10000,
      // Kill timeout
      kill_timeout: 5000,
      // Wait ready before considering the app as online
      wait_ready: true,
      // Max restarts in 1 minute before considering the app as errored
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
}

