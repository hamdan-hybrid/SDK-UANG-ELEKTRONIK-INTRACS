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

Lalu buka <http://localhost:4173>, klik **Connect** dan **Reader INIT**. Panduan lengkap ada di bawah.

## Cara menjalankan

### 1. Syarat: Node.js 22

SDK **wajib Node.js 22 LTS**. Di Node 26, modul `serialport` baru menerima jawaban reader ±30 detik kemudian (diuji 2026-10-23), sehingga potong saldo sangat lambat. Di Node 22 jawaban langsung diterima.

Node 22 cukup **terpasang**, tidak harus menjadi node bawaan. `npm start` dan `npm run pm2:start` mencari node 22 sendiri (nvm, fnm, n, atau node sistem). Bila node 22 tidak ditemukan, server menolak jalan dengan pesan yang jelas.

Pasang Node 22 lewat nvm (sekali saja):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
```

Bila node 22 terpasang di lokasi lain, isi `PASSTI_NODE` dengan path-nya, misalnya `PASSTI_NODE=/opt/node22/bin/node npm start`.

### 2. Izin akses reader (sekali saja)

```bash
sudo usermod -aG dialout $USER
```

Lalu logout dan login lagi agar `/dev/ttyUSB0` bisa dibuka.

### 3. Pasang modul

Dari folder ini (folder hasil ekstrak ZIP di komputer client):

```bash
nvm exec 22 npm ci --omit=dev
```

`npm ci` harus dengan node 22 karena modul reader dipasang untuk versi node yang menjalankannya. Di versi lain perintah ini ditolak (`EBADENGINE`, dari `engine-strict` di `.npmrc`).

### 4. Jalankan dan sambungkan reader (pertama kali)

```bash
npm install --global pm2     # sekali saja, untuk service PM2
npm start
```

Buka <http://localhost:4173> di Chrome atau Edge **di komputer SDK**, pilih port reader (mis. `/dev/ttyUSB0`), klik **Connect**, lalu **Reader INIT**.

### 5. Jalankan sebagai service PM2 (sekali klik)

Setelah Reader INIT berhasil, muncul tombol **Jalankan sebagai service PM2**. Klik tombol itu: SDK berhenti sebentar (±5 detik), lalu berjalan di PM2 (`hybrid-passti`, node 22) dan daftar PM2 disimpan (`pm2 save`). Tombol hanya bisa dipakai dari komputer SDK sendiri (localhost).

Bila halaman menampilkan perintah `sudo env PATH=... pm2 startup ...`, jalankan perintah itu **sekali** di terminal agar PM2 (dan SDK) otomatis jalan saat komputer menyala.

Lewat terminal juga bisa: `npm run pm2:start`, `pm2 save`, lalu `pm2 startup`.

### Reader otomatis connect + INIT

Port reader yang terakhir berhasil INIT disimpan di `reader.json` (di luar folder `data`, jadi tidak ikut terhapus saat closing data). Setelah itu reader **otomatis connect + INIT** tanpa klik:

- saat SDK start atau restart (PM2, `npm start`, komputer menyala);
- saat USB reader dicabut lalu dipasang lagi.

Bila reader belum terpasang, SDK mencoba lagi tiap 5 detik. Klik **Disconnect** menghentikan sambung ulang otomatis sampai SDK restart. Untuk mengganti port reader: Disconnect, pilih port baru, Connect, lalu Reader INIT. Hapus `reader.json` untuk mematikan fitur ini.

Perintah harian:

```bash
pm2 ls                    # hybrid-passti harus "online"
npm run pm2:logs          # lihat log ([auto-reader] = sambung otomatis)
npm run pm2:restart       # restart SDK
npm run pm2:stop          # hentikan SDK
```

### Masalah umum

- **"SDK uang elektronik wajib dijalankan dengan Node.js 22"** atau **"Node.js 22 tidak ditemukan"**: node 22 belum terpasang. Jalankan `nvm install 22`. Untuk PM2, setelah itu jalankan `pm2 delete hybrid-passti` lalu `npm run pm2:start` dan `pm2 save`.
- **`EBADENGINE` saat `npm ci`**: jalankan dengan `nvm exec 22 npm ci --omit=dev`.
- **Reader tidak bisa dibuka (permission denied)**: langkah 2 belum dilakukan, atau belum logout/login.
- **Tombol service PM2 gagal / SDK tidak kembali**: cek `pm2-service.log` di folder SDK dan `npm run pm2:logs`.

## Build untuk komputer client

Buat paket deploy yang bisa dipindahkan ke komputer lain:

```bash
npm run build
```

Hasilnya ada di folder `build/` dalam bentuk folder production dan file ZIP. JavaScript server, client, dan `lib` di dalam paket sudah di-obfuscate agar sulit dibaca atau diedit. `npm run build` menghapus seluruh folder `build/`, termasuk `build/hybrid-passti/data`. Bila SDK sedang dijalankan dari folder itu, backup `data` lebih dulu lalu kembalikan setelah build. Di komputer tujuan, ikuti **Cara menjalankan** di atas mulai langkah 1.

## Modes

- **Serial**: the Node.js server opens the configured serial port at `38400 baud, 8N1`, sends and parses binary PASSTI frames, validates LRC, and returns structured JSON to the dashboard.

The Web Serial adapter uses the PASSTI frame format from the desktop app:

```text
STX 02 + 4-hex-byte payload length + payload + XOR LRC
```

Transactions are persisted in `data/transactions.json`. The original WinForms app remains unchanged in `../PASSTI_SampleApp`.

For a physical reader, enter the detected port such as `/dev/ttyUSB0` in the dashboard. Use `GET /api/ports` to inspect ports detected by Node SerialPort.

## Deduct dan saldo kurang

Deduct tidak lagi mewajibkan check balance lebih dulu. Check balance dan deduct bisa dipakai dalam urutan apa pun.

Setiap deduct berjalan dalam sesi pembayaran dengan `transactionId` dan tagihan:

1. Tap kartu: reader memotong seluruh tagihan dari kartu itu.
2. Jika deduct gagal (mis. saldo kurang `011004`), kartu tidak dipotong sama sekali. Nomor kartu disimpan di log sesi; sesi tetap terbuka dan terkunci ke kartu itu.
3. Pelanggan mengisi saldo kartu tersebut lalu tap lagi dengan `transactionId` yang sama. Ada 3 percobaan, semuanya harus dengan **kartu yang sama**. Kartu lain yang ditempel selama percobaan ini ditolak tanpa dipotong (`reader.statusCode: "WRONG_CARD"`) dan tetap menghabiskan satu percobaan. Deduct kartu awal yang masih gagal juga menghabiskan satu percobaan. Jika kartu yang sama sudah cukup saldonya, deduct berhasil, transaksi lunas.
4. Jika percobaan ketiga tetap gagal, log kartu dihapus (`sameCard: null`) dan transaksi tetap terbuka. Tap berikutnya dengan `transactionId` yang sama boleh memakai kartu apa pun; jika kartu itu gagal juga, kartu tersebut yang masuk log. Satu transaksi hanya memotong satu kartu, sebesar tagihan penuh.

Tap normal langsung mengirim deduct (satu operasi kartu, satu bunyi), jadi kartu tidak terangkat sebelum terpotong. Bila deduct gagal sementara kartu masih di reader (mis. saldo kurang `011004`), server langsung membaca nomor kartu (check balance, menunggu kartu maks. 2 detik) karena reader tidak mengirim nomor kartu saat deduct gagal; kartu itu yang dikunci. Selama sesi mengunci kartu, setiap tap membaca kartu dulu (check balance) lalu deduct, agar kartu lain ditolak tanpa dipotong. Response pembayaran berisi `sameCard` (`{"cardNo":"6032 98** **** 4438","retriesLeft":2}`, atau `null` jika kartu apa pun boleh dipakai).
5. Jika reader membalas `011005` (kontak kartu terputus / deduct parsial), tap berikutnya mengulang nominal yang sama dengan kartu yang sama. Selama deduct parsial belum selesai, server langsung mengirim deduct (`EF0103`) tanpa check balance, dan reader menolak kartu lain dengan `011006`. Balasan ini berisi nomor kartu yang ditempel (bukan UID). Jika kartu dengan nomor yang sama ditolak 3 kali berturut-turut, pada penolakan ke-3 server langsung mengirim **Cancel Deduct Correction** (`EF0104`). Tap ke-4 sudah menjadi deduct baru sebesar sisa tagihan. Response berisi `correctionRefused` (`{cardNo, count}`). **Batalkan transaksi** juga mengirim Cancel Deduct Correction jika masih ada deduct parsial.
6. Jika reader membalas `011007` (jarak deduct kurang dari 10 detik), server menunggu 10 detik lalu mencoba sekali lagi. Kartu harus tetap menempel.

**Batalkan transaksi** menutup sesi yang belum lunas (misalnya pelanggan tidak punya kartu dengan saldo cukup).

Endpoint:

- `POST /api/payments/deduct` `{"transactionId":"DESK-1","amount":5000}`: satu tap kartu
- `GET /api/payments/:transactionId`: status sesi
- `POST /api/payments/:transactionId/cancel`: batalkan sisa tagihan

Sesi disimpan di `data/payment-sessions.json`.

## Automatic settlement

After every successful deduct, the Node.js server automatically generates the Intracs Multibank Merchant File:

- FS filename: `yyyyMMdd + 000000 + MID(16) + TID(8) + Shift(2) + Batch(3) + .txt`
- FS header: `Trx Count(3) + Trx Amount(10) + LF`
- FS data: reader deduct transaction data from `cardType` through `CardLog Transaction`, one line per transaction
- QR transactions with card type `09` are excluded
- More than 999 transactions are split into new files with increasing batch numbers
- RFS filename uses the same identity fields with `.rsp`
- RFS header: `01 + Trx Count(3) + LF`
- RFS data: settlement transaction followed by a two-digit status and LF

Generated files are saved under `data/settlement`. There is no manual settlement form in the dashboard.

## Data closing

Use `http://localhost:4173/api/data/closing` or the **Closing data / Download ZIP** link in the dashboard to download a timestamped ZIP of the `data` folder. After the download completes, the server deletes the contents of `data`.

## Parking API

The parking application sends a REST request after a vehicle is ready to pay:

```http
POST /api/parking/deduct
Content-Type: application/json

{"transactionId":"PARK-0001","amount":5000,"gateId":"GATE-01"}
```

The reader must already be connected. A successful response is:

```json
{"success":true,"transactionId":"PARK-0001","amount":5000,"paid":5000,"remaining":0,"barrier":{"requested":true}}
```

If the deduct fails (e.g. the card balance is too low), the card is not charged, its number is logged, and the response contains `"success":false` with a `message` asking the driver to top up and tap the same card again. The parking application sends the same request again (same `transactionId` and `amount`) after each tap, until `success` is `true`. The next 3 taps must use that same card; any other card is rejected without being charged and uses up one of the 3 retries. If all 3 retries fail, the logged card is cleared (`sameCard` becomes `null`) and the transaction stays open, so the next tap may use any card. `sameCard` in the response shows the masked card number and `retriesLeft`. Only one card is charged, for the full amount. The barrier opens only when the bill is fully paid.

The same `transactionId` is idempotent, so retrying a paid parking request does not deduct twice. Set `BARRIER_URL` when a real barrier controller has an HTTP endpoint. Without it, the barrier response runs in demo mode and no physical gate is activated.
