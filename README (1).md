# Toko Online — Panduan Setup

Struktur:
- `index.html` — storefront (dilihat pembeli)
- `admin.html` — panel admin (kelola produk & pesanan)
- `netlify/functions/create-transaction.js` — bikin token pembayaran Midtrans
- `netlify/functions/midtrans-webhook.js` — terima notifikasi status bayar otomatis

⚠️ **Penting soal deploy dari HP:** karena toko ini pakai *serverless functions* (folder `netlify/functions`), **drag-and-drop file ke Netlify TIDAK akan menjalankan functions-nya** — itu cuma untuk file statis. Supaya pembayaran otomatis (Midtrans) jalan, situs ini **harus** di-deploy lewat Netlify yang terhubung ke repo GitHub (bukan drag-drop manual). Ini beda dari cara kamu deploy KasirPro/CatatUang yang single-file HTML biasa.

Cara termudah dari HP: buat repo baru di GitHub app / web, upload semua file ini ke situ (GitHub punya upload file lewat browser, bisa dari HP), lalu di Netlify pilih "Import from Git" dan connect ke repo itu. Setelah itu, setiap kamu edit file di GitHub, Netlify auto-deploy ulang.

---

## 1. Setup Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com) → buat project baru.
2. Aktifkan **Firestore Database** (mode production).
3. Aktifkan **Authentication** → Sign-in method → **Email/Password**.
4. Tambah 1 user admin manual: Authentication → Users → Add User (email + password kamu sendiri).
5. Ambil config web app: Project Settings → General → scroll ke "Your apps" → tambah Web App → copy `firebaseConfig`.
6. Ganti config placeholder (`FIREBASE_API_KEY`, dll) di **kedua** file `index.html` dan `admin.html` dengan config asli kamu.

### Firestore Security Rules
Di Firestore → Rules, pakai ini sebagai baseline:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /orders/{orderId} {
      allow read: if request.auth != null;
      allow create: if true;
      allow update: if request.auth != null;
    }
    match /settings/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /banners/{bannerId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Ini artinya: siapa saja boleh lihat produk & bikin order (checkout), tapi cuma admin yang login yang boleh ubah produk/status order.

---

## 2. Setup Midtrans

1. Daftar di [midtrans.com](https://midtrans.com) → buat akun (mulai dari **Sandbox** dulu untuk testing).
2. Ambil **Server Key** dan **Client Key** dari Settings → Access Keys.
3. Di `index.html`, cari baris:
   ```html
   <script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key="MIDTRANS_CLIENT_KEY_PLACEHOLDER" ...>
   ```
   Ganti `MIDTRANS_CLIENT_KEY_PLACEHOLDER` dengan Client Key kamu.
4. Kalau sudah siap live (bukan testing), ganti URL script ke `https://app.midtrans.com/snap/snap.js` (tanpa `.sandbox`).

---

## 3. Setup Netlify (environment variables)

Di Netlify → Site settings → Environment variables, tambahkan:

| Key | Value |
|---|---|
| `MIDTRANS_SERVER_KEY` | Server key dari Midtrans |
| `MIDTRANS_CLIENT_KEY` | Client key dari Midtrans |
| `MIDTRANS_IS_PRODUCTION` | `false` (sandbox) atau `true` (live) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | isi dari file JSON service account (lihat di bawah) — hanya perlu kalau mau webhook otomatis |

**Untuk `FIREBASE_SERVICE_ACCOUNT_JSON`** (dipakai webhook supaya update status order otomatis saat pembayaran masuk, tanpa perlu buka admin panel manual):
1. Firebase Console → Project Settings → Service Accounts → Generate New Private Key.
2. Buka file JSON yang ke-download, copy semua isinya, paste sebagai value di Netlify (jadi satu baris JSON string).

Kalau kamu skip ini, checkout tetap jalan (bayar tetap sukses), tapi status order harus kamu update manual di admin panel setelah cek Midtrans dashboard.

---

## 4. Setup webhook Midtrans (opsional tapi disarankan)

Di dashboard Midtrans → Settings → Configuration → **Payment Notification URL**, isi dengan:
```
https://NAMA-SITE-KAMU.netlify.app/.netlify/functions/midtrans-webhook
```
Ini bikin status order otomatis berubah jadi "paid" begitu pembeli selesai bayar — tanpa kamu perlu cek manual.

---

## 5. Isi produk pertama

1. Buka `https://NAMA-SITE-KAMU.netlify.app/admin.html`
2. Login pakai email/password admin yang kamu buat di langkah 1.
3. Tab **Produk** → "+ Tambah Produk" → isi nama, kategori, harga, stok, URL gambar.
4. Tab **Pengaturan** → isi nama toko.

Selesai — buka `index.html` di HP untuk lihat storefront-nya.

---

## Alur pesanan

1. Pembeli pilih produk → checkout → isi data → bayar via Midtrans Snap (transfer/QRIS/e-wallet/kartu, semua otomatis).
2. Order tersimpan di Firestore dengan status `pending`.
3. Setelah bayar sukses, webhook otomatis update status jadi `paid` (kalau webhook sudah disetel).
4. Kamu proses pesanan dari admin panel, ubah status jadi `shipped` lalu `completed`.

## Ganti banner depan & bikin produk keliatan diskon

- **Banner:** admin panel → tab **Banner** → "+ Tambah Banner". Isi gambar, judul, sub-judul, teks tombol. Kalau kamu tambah lebih dari 1 banner aktif, otomatis jadi carousel yang gonta-ganti tiap 5 detik (kayak Shopee/Tokopedia). Kalau belum ada banner sama sekali, toko otomatis pakai tampilan default jadi nggak pernah kosong.
- **Badge/label produk** (misal "Baru", "Best Seller"): isi kolom "Label" pas tambah/edit produk.
- **Diskon otomatis:** isi "Harga Coret" di produk (harga asli sebelum diskon) — badge persen diskon & harga coret bakal otomatis muncul di kartu produk, nggak perlu apa-apa lagi.

## Yang mungkin mau ditambah nanti
- Ongkos kirim otomatis (RajaOngkir API)
- Notifikasi WhatsApp otomatis ke pembeli tiap status berubah (bisa disambung ke Fonnte, seperti di CatatHutang)
- Upload gambar produk langsung (sekarang masih pakai URL gambar)
