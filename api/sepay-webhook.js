import fs from 'fs';

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

    // Tách mã 6 chữ số từ chuỗi bất kỳ (VD: MBVCB.15443858530.6218BFTVGL256UBX.VS 498036)
    let matchedDigits = null;
    const vsMatch = content.match(/VS\s*[-_]?\s*(\d{6})/i);
    if (vsMatch) {
      matchedDigits = vsMatch[1];
    } else {
      const anyDigits = content.match(/(\d{6})/);
      if (anyDigits) matchedDigits = anyDigits[1];
    }

    const coins = getCoinsForAmount(transferAmount);

    // Lưu giao dịch hoàn tất vào bộ nhớ cache /tmp của Vercel Serverless
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
    } catch (e) {
      console.warn("Lỗi ghi file /tmp:", e);
    }

    return res.status(200).json({
      success: true,
      message: 'Recorded transaction into SePay bridge cache!',
      digits: matchedDigits,
      coinsAdded: coins
    });

  } catch (error) {
    console.error('[SePay Webhook Exception]:', error);
    return res.status(200).json({ success: true, warning: error.message });
  }
}
