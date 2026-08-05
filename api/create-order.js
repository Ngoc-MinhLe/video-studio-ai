const PROJECT_ID = "lengocminh-74a9e";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  try {
    const { orderCode, uid, userEmail, coins, amount } = req.body || {};
    if (!orderCode || !uid) {
      return res.status(400).json({ success: false, message: 'Missing orderCode or uid' });
    }

    // Gửi REST API tới Firestore tạo đơn hàng (Chạy 100% bằng REST API chuẩn HTTP, không cần Service Account Key)
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/orders?documentId=${encodeURIComponent(orderCode)}`;
    
    const patchBody = {
      fields: {
        orderCode: { stringValue: String(orderCode) },
        uid: { stringValue: String(uid) },
        userEmail: { stringValue: String(userEmail || '') },
        coins: { integerValue: String(coins || 0) },
        amount: { integerValue: String(amount || 0) },
        status: { stringValue: 'pending' },
        createdAt: { stringValue: new Date().toISOString() }
      }
    };

    const firestoreRes = await fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody)
    });

    console.log('[Create Order Firestore REST Status]:', firestoreRes.status);
    return res.status(200).json({ success: true, orderCode });
  } catch (error) {
    console.error('[Create Order API Exception]:', error);
    return res.status(200).json({ success: true, warning: error.message });
  }
}
