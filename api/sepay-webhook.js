import fs from 'fs';

const PROJECT_ID = "lengocminh-74a9e";

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

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  try {
    let data = req.body;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) {}
    } else if (Buffer.isBuffer(data)) {
      try { data = JSON.parse(data.toString('utf-8')); } catch (e) {}
    }
    data = data || {};
    console.log('[SePay Webhook Received Payload]:', JSON.stringify(data));

    const transferType = data.transferType || 'in';
    const content = (data.content || data.code || data.description || data.referenceCode || '').toString();
    const transferAmount = Number(data.transferAmount || data.amount || 0);

    if (transferType !== 'in') {
      return res.status(200).json({ success: true, message: 'Ignored outbound transaction' });
    }

    // Tách mã 6 chữ số từ chuỗi bất kỳ (VD: MBVCB.15444160238.6218BFTVGL256UBX.VS 655879)
    let matchedDigits = null;
    const vsMatch = content.match(/VS\s*[-_]?\s*(\d{6})/i);
    if (vsMatch) {
      matchedDigits = vsMatch[1];
    } else {
      const anyDigits = content.match(/(\d{6})/);
      if (anyDigits) matchedDigits = anyDigits[1];
    }

    const coinsToAdd = getCoinsForAmount(transferAmount);
    let targetUid = null;

    // 1. Tìm đơn hàng orders/{orderCode} để lấy UID người dùng
    if (matchedDigits) {
      const candidateCodes = [`VS ${matchedDigits}`, `VS${matchedDigits}`];
      for (const code of candidateCodes) {
        try {
          const getOrderUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/orders/${encodeURIComponent(code)}`;
          const orderRes = await fetch(getOrderUrl);
          if (orderRes.ok) {
            const orderJson = await orderRes.json();
            if (orderJson.fields) {
              targetUid = orderJson.fields.uid?.stringValue || null;

              // Đánh dấu đơn hàng completed
              const patchOrderUrl = `${getOrderUrl}?updateMask.fieldPaths=status&updateMask.fieldPaths=paidAmount&updateMask.fieldPaths=updatedAt`;
              await fetch(patchOrderUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fields: {
                    ...orderJson.fields,
                    status: { stringValue: 'completed' },
                    paidAmount: { integerValue: String(transferAmount) },
                    updatedAt: { stringValue: new Date().toISOString() }
                  }
                })
              });
              console.log(`[SePay Webhook REST]: Order ${code} marked as completed for uid: ${targetUid}`);
              break;
            }
          }
        } catch (err) {
          console.warn(`[SePay Order Check Error]:`, err);
        }
      }
    }

    // 2. Nếu không có order Code, lấy tài khoản người dùng gần nhất hoặc theo UID
    if (!targetUid) {
      try {
        const usersListUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users?pageSize=1`;
        const usersRes = await fetch(usersListUrl);
        if (usersRes.ok) {
          const usersJson = await usersRes.json();
          if (usersJson.documents && usersJson.documents.length > 0) {
            const pathParts = usersJson.documents[0].name.split('/');
            targetUid = pathParts[pathParts.length - 1];
          }
        }
      } catch (e) {}
    }

    // 3. Cập nhật thẳng số dư Xu vào users/{uid} trên Firestore REST API
    if (targetUid && coinsToAdd > 0) {
      try {
        const getUserUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}`;
        const userRes = await fetch(getUserUrl);
        if (userRes.ok) {
          const userJson = await userRes.json();
          const currentCoins = Number(userJson.fields?.coins?.integerValue || userJson.fields?.coins?.stringValue || 0);
          const newCoins = currentCoins + coinsToAdd;

          const patchUserUrl = `${getUserUrl}?updateMask.fieldPaths=coins&updateMask.fieldPaths=updatedAt`;
          const patchRes = await fetch(patchUserUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                ...(userJson.fields || {}),
                coins: { integerValue: String(newCoins) },
                updatedAt: { stringValue: new Date().toISOString() }
              }
            })
          });
          console.log(`[SePay Webhook REST Direct Coin Update]: Credited +${coinsToAdd} coins (Total: ${newCoins}) to user ${targetUid}. Patch Status: ${patchRes.status}`);
        }
      } catch (err) {
        console.warn(`[SePay User Coin Update Error]:`, err);
      }
    }

    // 4. Lưu vết bộ nhớ /tmp
    let store = {};
    const tmpPath = '/tmp/sepay_completed.json';
    try {
      if (fs.existsSync(tmpPath)) {
        store = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
      }
    } catch (e) {}

    if (matchedDigits) {
      store[matchedDigits] = {
        code: `VS ${matchedDigits}`,
        digits: matchedDigits,
        amount: transferAmount,
        coins: coinsToAdd,
        timestamp: Date.now()
      };
    }

    try {
      fs.writeFileSync(tmpPath, JSON.stringify(store));
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: 'Directly credited user coins in Firestore!',
      uid: targetUid,
      digits: matchedDigits,
      coinsAdded: coinsToAdd
    });

  } catch (error) {
    console.error('[SePay Webhook Exception]:', error);
    return res.status(200).json({ success: true, warning: error.message });
  }
}
