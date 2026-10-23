# PASSTI Control Desk

Web port of `PASSTI_SampleApp` for the HYBRID-PASSTI workspace.

## Install singkat

Wajib **Node.js 22**.

Pasang nvm dan Node 22 (sekali saja):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
```

Jalankan:

```bash
cd /var/www/SDK-UANG-ELEKTRONIK-INTRACS
nvm use 22
npm ci --omit=dev
npm start
```

Lalu buka <http://localhost:4173>, klik **Connect** dan **Reader INIT**.
