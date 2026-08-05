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

// Hàm quy đổi số tiền VNĐ sang Số Xu tương ứng
const getCoinsForAmount = (amount) => {
  const num = Number(amount || 0);
  if (num >= 100000) return 400;
  if (num >= 50000) return 175;
  if (num >= 20000) return 60;
  if (num >= 10000) return 25;
  return Math.max(5, Math.floor(num / 400));
};

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

    // Fallback 1: Tìm đơn hàng pending nếu chưa tìm thấy theo doc ID
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

        // Nếu vẫn chưa tìm thấy doc khớp mã, lấy đơn pending gần nhất
        if (!targetOrderDoc && !querySnap.empty) {
          const latestDocSnap = querySnap.docs[querySnap.docs.length - 1];
          targetOrderDoc = latestDocSnap.data();
          targetOrderRef = latestDocSnap.ref;
        }
      } catch (e) {
        console.warn("[SePay Webhook]: Fallback query order warning:", e);
      }
    }

    let uidToCredit = targetOrderDoc?.uid || null;
    let coinsToAdd = Number(targetOrderDoc?.coins || getCoinsForAmount(transferAmount));

    // Fallback 2: Nếu hoàn toàn không có order doc, lấy user mới nhất trong hệ thống
    if (!uidToCredit) {
      try {
        const usersSnap = await db.collection("users").orderBy("updatedAt", "desc").limit(1).get();
        if (!usersSnap.empty) {
          uidToCredit = usersSnap.docs[0].id;
        }
      } catch (e) {
        console.warn("[SePay Webhook]: Fallback user query warn:", e);
      }
    }

    if (targetOrderRef && targetOrderDoc) {
      if (targetOrderDoc.status === 'completed') {
        return res.status(200).json({ success: true, message: 'Order already completed previously.' });
      }
      await targetOrderRef.update({
        status: 'completed',
        paidAmount: transferAmount,
        sepayTransactionId: data.id || null,
        updatedAt: new Date().toISOString()
      });
    }

    // Cộng xu tự động cho tài khoản người dùng
    if (uidToCredit && coinsToAdd > 0) {
      const userRef = db.collection("users").doc(uidToCredit);
      await userRef.update({
        coins: admin.firestore.FieldValue.increment(coinsToAdd),
        updatedAt: new Date().toISOString()
      });
      console.log(`[SePay Webhook Admin Success]: Credited +${coinsToAdd} coins to user ${uidToCredit}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Coins credited automatically via Firebase Admin SDK!',
      uid: uidToCredit,
      coinsAdded: coinsToAdd
    });

  } catch (error) {
    console.error('[SePay Webhook Exception]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
