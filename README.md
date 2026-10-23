# PASSTI Control Desk

Web port of `PASSTI_SampleApp` for the HYBRID-PASSTI workspace.

## Versi Node.js

Jalankan dengan **Node.js 22 LTS** (bukan 26). Diuji 2026-10-23: modul `serialport` (12 maupun 13) di Node 26 baru membaca jawaban reader ±30 detik kemudian, sedangkan di Node 22 langsung (±0 dtk setelah reader menjawab).

## Run

From this folder:

```bash
npm install
npm start
```

Open <http://localhost:4173> in Chrome or Edge.

## Build untuk komputer client

Buat paket deploy yang bisa dipindahkan ke komputer lain:

```bash
npm run build
```

Hasilnya ada di folder `build/` dalam bentuk folder production dan file ZIP. JavaScript server, client, dan `lib` di dalam paket sudah di-obfuscate agar sulit dibaca atau diedit. Di komputer tujuan, masuk ke folder hasil ekstrak lalu jalankan `npm install --omit=dev` dan `npm run pm2:start`.

## Production with PM2

Install PM2 once on the production machine, then run the application from this folder:

```bash
npm install
npm install --global pm2
npm run pm2:start
pm2 save
pm2 startup
```

Useful commands:

```bash
npm run pm2:restart
npm run pm2:stop
npm run pm2:logs
```

The PM2 configuration is stored in `ecosystem.config.cjs`. It runs one forked process, loads `.env`, restarts after crashes, and does not watch source files.

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
