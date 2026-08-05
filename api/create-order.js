import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string' 
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : process.env.FIREBASE_SERVICE_ACCOUNT;
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      admin.initializeApp({ projectId: "lengocminh-74a9e" });
    }
  } catch (err) {
    admin.initializeApp({ projectId: "lengocminh-74a9e" });
  }
}

const db = admin.firestore();

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

    const orderRef = db.collection("orders").doc(orderCode);
    await orderRef.set({
      orderCode,
      uid,
      userEmail: userEmail || '',
      coins: Number(coins || 0),
      amount: Number(amount || 0),
      status: 'pending',
      createdAt: new Date().toISOString()
    }, { merge: true });

    return res.status(200).json({ success: true, orderCode });
  } catch (error) {
    console.error('[Create Order API Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
