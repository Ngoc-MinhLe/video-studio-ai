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

    const coins = getCoinsForAmount(transferAmount);

    // 1. Cập nhật trực tiếp đơn hàng orders/{orderCode} trên Cloud Firestore bằng REST API (Nhờ Quy tắc orders đã xuất bản)
    if (matchedDigits) {
      const candidateCodes = [`VS ${matchedDigits}`, `VS${matchedDigits}`];
      for (const code of candidateCodes) {
        try {
          const patchOrderUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/orders/${encodeURIComponent(code)}`;
          await fetch(patchOrderUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                orderCode: { stringValue: code },
                status: { stringValue: 'completed' },
                coins: { integerValue: String(coins) },
                paidAmount: { integerValue: String(transferAmount) },
                updatedAt: { stringValue: new Date().toISOString() }
              }
            })
          });
          console.log(`[Firestore Order Update Success]: Marked ${code} as completed`);
        } catch (err) {
          console.warn(`[Firestore Order Update Error]:`, err);
        }
      }
    }

    // 2. Đồng thời ghi vào bộ nhớ /tmp làm Cầu nối phụ (Backup)
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
        coins: coins,
        timestamp: Date.now()
      };
    }

    store[`amount_${transferAmount}`] = {
      digits: matchedDigits || 'unknown',
      amount: transferAmount,
      coins: coins,
      timestamp: Date.now()
    };

    try {
      fs.writeFileSync(tmpPath, JSON.stringify(store));
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: 'Recorded transaction into Firestore order & SePay bridge cache!',
      digits: matchedDigits,
      coinsAdded: coins
    });

  } catch (error) {
    console.error('[SePay Webhook Exception]:', error);
    return res.status(200).json({ success: true, warning: error.message });
  }
}
