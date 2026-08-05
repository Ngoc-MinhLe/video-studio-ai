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
    const content = (data.content || data.code || data.description || '').toString();
    const transferAmount = Number(data.transferAmount || data.amount || 0);

    if (transferType !== 'in') {
      return res.status(200).json({ success: true, message: 'Ignored outbound transaction' });
    }

    // Tách mã đơn hàng VS 123456 hoặc dãy 6 chữ số
    let matchedDigits = null;
    const vsMatch = content.match(/VS\s*[-_]?\s*(\d{6})/i);
    if (vsMatch) {
      matchedDigits = vsMatch[1];
    } else {
      const anyDigits = content.match(/(\d{6})/);
      if (anyDigits) matchedDigits = anyDigits[1];
    }

    let targetUid = null;
    let coinsToAdd = getCoinsForAmount(transferAmount);

    if (matchedDigits) {
      const candidateCodes = [`VS ${matchedDigits}`, `VS${matchedDigits}`];
      for (const code of candidateCodes) {
        const getOrderUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/orders/${encodeURIComponent(code)}`;
        const orderRes = await fetch(getOrderUrl);
        if (orderRes.ok) {
          const orderJson = await orderRes.json();
          if (orderJson.fields) {
            targetUid = orderJson.fields.uid?.stringValue || null;
            const docCoins = Number(orderJson.fields.coins?.integerValue || orderJson.fields.coins?.stringValue || 0);
            if (docCoins > 0) coinsToAdd = docCoins;

            // Cập nhật đơn hàng thành completed
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
            break;
          }
        }
      }
    }

    // Fallback: Nếu không tìm thấy UID theo đơn hàng, lấy user mới nhất trong hệ thống
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
      } catch (e) {
        console.warn("[SePay Webhook Fallback Users REST Warn]:", e);
      }
    }

    // Cộng xu cho User thông qua Firestore REST API
    if (targetUid && coinsToAdd > 0) {
      const getUserUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(targetUid)}`;
      const userRes = await fetch(getUserUrl);
      if (userRes.ok) {
        const userJson = await userRes.json();
        const currentCoins = Number(userJson.fields?.coins?.integerValue || userJson.fields?.coins?.stringValue || 0);
        const newCoins = currentCoins + coinsToAdd;

        const patchUserUrl = `${getUserUrl}?updateMask.fieldPaths=coins&updateMask.fieldPaths=updatedAt`;
        await fetch(patchUserUrl, {
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
        console.log(`[SePay Webhook REST Success]: Credited +${coinsToAdd} coins to user ${targetUid}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Processed successfully via Firestore REST API!',
      uid: targetUid,
      coinsAdded: coinsToAdd
    });

  } catch (error) {
    console.error('[SePay Webhook Exception]:', error);
    return res.status(200).json({ success: true, warning: error.message });
  }
}
