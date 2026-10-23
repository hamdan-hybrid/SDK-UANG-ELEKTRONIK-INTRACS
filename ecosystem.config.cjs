module.exports = {
  apps: [{
    name: 'hybrid-passti',
    script: 'server.js',
    node_args: '--env-file=.env',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    time: true,
    env: {
      NODE_ENV: 'production',
      PORT: 4173,
    },
  }],
};
