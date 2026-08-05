import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc, increment } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBRz-WubZ9tsp_bfaiGpu5Iz_kOgC68vbQ",
  authDomain: "lengocminh-74a9e.firebaseapp.com",
  projectId: "lengocminh-74a9e",
  storageBucket: "lengocminh-74a9e.firebasestorage.app",
  messagingSenderId: "528797008471",
  appId: "1:528797008471:web:d2c169aa256980a7645912",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const data = req.body;
    console.log('[SePay Webhook Received]:', JSON.stringify(data));

    const transferType = data.transferType || 'in';
    const content = data.content || '';
    const transferAmount = Number(data.transferAmount || 0);

    if (transferType !== 'in') {
      return res.status(200).json({ success: true, message: 'Ignored outbound transaction' });
    }

    // Match code pattern: VS 123456 or VS123456
    const match = content.match(/VS\s*(\d{6})/i);
    if (!match) {
      return res.status(200).json({ success: true, message: 'No VS order code found in content' });
    }

    const orderCode = `VS ${match[1]}`;
    const cleanCodeNoSpace = `VS${match[1]}`;

    let orderRef = doc(db, "orders", orderCode);
    let orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      orderRef = doc(db, "orders", cleanCodeNoSpace);
      orderSnap = await getDoc(orderRef);
    }

    if (!orderSnap.exists()) {
      console.warn(`[SePay Webhook]: Order ${orderCode} not found in Firestore`);
      return res.status(200).json({ success: true, message: `Order ${orderCode} not found` });
    }

    const orderData = orderSnap.data();
    if (orderData.status === 'completed') {
      return res.status(200).json({ success: true, message: 'Order already processed' });
    }

    // Update order status to completed
    await updateDoc(orderRef, {
      status: 'completed',
      paidAmount: transferAmount,
      sepayTransactionId: data.id || null,
      updatedAt: new Date().toISOString()
    });

    // Credit coins to user
    const uid = orderData.uid;
    const coinsToAdd = Number(orderData.coins || 0);

    if (uid && coinsToAdd > 0) {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        coins: increment(coinsToAdd),
        updatedAt: new Date().toISOString()
      });
      console.log(`[SePay Webhook]: Successfully credited ${coinsToAdd} coins to user ${uid}`);
    }

    return res.status(200).json({ success: true, message: 'Payment processed and coins credited successfully' });
  } catch (error) {
    console.error('[SePay Webhook Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
