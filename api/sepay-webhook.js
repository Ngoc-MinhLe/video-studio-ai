import admin from 'firebase-admin';

// Khởi tạo Firebase Admin SDK (Chạy trên Vercel Serverless có quyền Admin tối cao, bypass rules an toàn mà KHÔNG cần sửa quy tắc bảo mật của ứng dụng khác)
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
      admin.initializeApp({
        projectId: "lengocminh-74a9e"
      });
    }
  } catch (err) {
    console.warn("Lỗi khởi tạo Firebase Admin SDK:", err);
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

    // Tách mã đơn hàng dạng VS 123456 hoặc VS123456 hoặc dãy 6 chữ số
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
        const orderRef = db.collection("orders").doc(code);
        const orderSnap = await orderRef.get();
        if (orderSnap.exists) {
          targetOrderDoc = orderSnap.data();
          targetOrderRef = orderRef;
          break;
        }
      }
    }

    // Fallback: Tìm đơn hàng pending nếu chưa thấy
    if (!targetOrderDoc) {
      try {
        const querySnap = await db.collection("orders").where("status", "==", "pending").get();
        querySnap.forEach((docSnap) => {
          const d = docSnap.data();
          if (!targetOrderDoc && matchedDigits && (d.orderCode || '').includes(matchedDigits)) {
            targetOrderDoc = d;
            targetOrderRef = docSnap.ref;
          }
        });
      } catch (e) {
        console.warn("[SePay Webhook]: Fallback query order warning:", e);
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

    // Cập nhật đơn hàng thành công bằng Firebase Admin SDK (Bypass rules an toàn)
    await targetOrderRef.update({
      status: 'completed',
      paidAmount: transferAmount,
      sepayTransactionId: data.id || null,
      updatedAt: new Date().toISOString()
    });

    // Tự động cộng Xu cho người dùng bằng Firebase Admin SDK
    const uid = targetOrderDoc.uid;
    const coinsToAdd = Number(targetOrderDoc.coins || 0);

    if (uid && coinsToAdd > 0) {
      const userRef = db.collection("users").doc(uid);
      await userRef.update({
        coins: admin.firestore.FieldValue.increment(coinsToAdd),
        updatedAt: new Date().toISOString()
      });
      console.log(`[SePay Webhook Admin Success]: Credited +${coinsToAdd} coins to user ${uid}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Coins credited automatically via Firebase Admin SDK!',
      uid,
      coinsAdded: coinsToAdd
    });

  } catch (error) {
    console.error('[SePay Webhook Exception]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
