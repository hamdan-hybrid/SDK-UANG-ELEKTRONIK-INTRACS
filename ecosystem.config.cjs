const { findNode22 } = require('./lib/node22');

module.exports = {
  apps: [{
    name: 'hybrid-passti',
    script: 'server.js',
    node_args: '--env-file=.env',
    // serialport di Node 26 lambat (data reader ±30 dtk); pakai Node 22. Dicari otomatis (PASSTI_NODE, nvm, fnm, n, node sistem).
    interpreter: findNode22() || 'node',
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
