// Netlify Function: menerima notifikasi status pembayaran dari Midtrans
// dan memperbarui status order di Firestore secara otomatis.
//
// Setup di dashboard Midtrans: Settings → Configuration → Payment Notification URL
// Isi dengan: https://NAMA-SITE-KAMU.netlify.app/.netlify/functions/midtrans-webhook
//
// Membutuhkan environment variables:
//   MIDTRANS_SERVER_KEY
//   FIREBASE_SERVICE_ACCOUNT_JSON (isi dengan JSON service account, lihat README)

const midtransClient = require('midtrans-client');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  });
}
const db = admin.firestore();

function mapStatus(transactionStatus, fraudStatus) {
  if (transactionStatus === 'capture') {
    return fraudStatus === 'challenge' ? 'pending' : 'paid';
  }
  if (transactionStatus === 'settlement') return 'paid';
  if (transactionStatus === 'pending') return 'pending';
  if (['deny', 'cancel', 'expire'].includes(transactionStatus)) return 'cancelled';
  return null;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const notification = JSON.parse(event.body);

    const core = new midtransClient.CoreApi({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY
    });

    // Verifikasi status langsung ke Midtrans (jangan percaya body notifikasi mentah-mentah)
    const statusResponse = await core.transaction.notification(notification);
    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    const newStatus = mapStatus(transactionStatus, fraudStatus);
    if (newStatus) {
      await db.collection('orders').doc(orderId).update({
        status: newStatus,
        midtransTransactionId: statusResponse.transaction_id,
        paymentType: statusResponse.payment_type,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
