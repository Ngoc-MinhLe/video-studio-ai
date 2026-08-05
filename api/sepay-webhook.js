import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, increment } from "firebase/firestore";

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
  // CORS Headers
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
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {}
    } else if (Buffer.isBuffer(data)) {
      try {
        data = JSON.parse(data.toString('utf-8'));
      } catch (e) {}
    }
    data = data || {};
    console.log('[SePay Webhook Received Payload]:', JSON.stringify(data));

    const transferType = data.transferType || 'in';
    const content = (data.content || data.code || data.description || '').toString();
    const transferAmount = Number(data.transferAmount || data.amount || 0);

    if (transferType !== 'in') {
      return res.status(200).json({ success: true, message: 'Ignored outbound transaction' });
    }

    // Match order code pattern: VS 123456 or VS123456 or 123456
    let matchedDigits = null;
    const vsMatch = content.match(/VS\s*[-_]?\s*(\d{6})/i);
    if (vsMatch) {
      matchedDigits = vsMatch[1];
    } else {
      const anyDigits = content.match(/(\d{6})/);
      if (anyDigits) {
        matchedDigits = anyDigits[1];
      }
    }

    let targetOrderDoc = null;
    let targetOrderRef = null;

    if (matchedDigits) {
      const candidateCodes = [`VS ${matchedDigits}`, `VS${matchedDigits}`];
      for (const code of candidateCodes) {
        const orderRef = doc(db, "orders", code);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          targetOrderDoc = orderSnap.data();
          targetOrderRef = orderRef;
          break;
        }
      }
    }

    // Fallback: Nếu không thấy bằng doc ID, tìm trong collection "orders" trạng thái pending
    if (!targetOrderDoc) {
      try {
        const ordersCol = collection(db, "orders");
        const q = query(ordersCol, where("status", "==", "pending"));
        const querySnap = await getDocs(q);

        querySnap.forEach((docSnap) => {
          const d = docSnap.data();
          if (!targetOrderDoc && matchedDigits && (d.orderCode || '').includes(matchedDigits)) {
            targetOrderDoc = d;
            targetOrderRef = docSnap.ref;
          }
        });
      } catch (e) {
        console.warn("[SePay Webhook]: Query collection fallback warn:", e);
      }
    }

    if (!targetOrderDoc || !targetOrderRef) {
      console.warn(`[SePay Webhook]: Could not find matching pending order for content: "${content}"`);
      return res.status(200).json({
        success: true,
        message: `Received transaction ${data.id || ''}, but no matching pending order found.`
      });
    }

    if (targetOrderDoc.status === 'completed') {
      return res.status(200).json({ success: true, message: 'Order already completed previously.' });
    }

    // Cập nhật trạng thái đơn hàng thành completed
    await updateDoc(targetOrderRef, {
      status: 'completed',
      paidAmount: transferAmount,
      sepayTransactionId: data.id || null,
      updatedAt: new Date().toISOString()
    });

    // Cộng xu tự động cho tài khoản người dùng
    const uid = targetOrderDoc.uid;
    const coinsToAdd = Number(targetOrderDoc.coins || 0);

    if (uid && coinsToAdd > 0) {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        coins: increment(coinsToAdd),
        updatedAt: new Date().toISOString()
      });
      console.log(`[SePay Webhook Success]: Credited +${coinsToAdd} coins to user ${uid}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Coins credited automatically!',
      uid,
      coinsAdded: coinsToAdd
    });

  } catch (error) {
    console.error('[SePay Webhook Exception]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
