// Netlify Function: membuat transaksi Midtrans Snap dan mengembalikan token pembayaran.
// Membutuhkan environment variable MIDTRANS_SERVER_KEY (diset di Netlify dashboard).
// Gunakan mode 'sandbox' untuk testing, ganti ke 'production' saat sudah live.

const midtransClient = require('midtrans-client');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { orderId, total, customerName, phone, items } = JSON.parse(event.body);

    if (!orderId || !total || !customerName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Data tidak lengkap' }) };
    }

    const snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY
    });

    const itemDetails = (items || []).map(i => ({
      id: i.id,
      price: i.price,
      quantity: i.qty,
      name: (i.name || 'Produk').substring(0, 50)
    }));

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: total
      },
      customer_details: {
        first_name: customerName,
        phone: phone
      },
      item_details: itemDetails,
      credit_card: { secure: true }
    };

    const transaction = await snap.createTransaction(parameter);

    return {
      statusCode: 200,
      body: JSON.stringify({ token: transaction.token, redirect_url: transaction.redirect_url })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Gagal membuat transaksi' }) };
  }
};
