import fs from 'fs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { memo, amount } = req.query || {};
  const matchedDigits = (memo || '').toString().match(/(\d{6})/)?.[1];

  let store = {};
  const tmpPath = '/tmp/sepay_completed.json';
  try {
    if (fs.existsSync(tmpPath)) {
      store = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
    }
  } catch (e) {}

  let found = null;

  if (matchedDigits && store[matchedDigits]) {
    found = store[matchedDigits];
  } else if (amount && store[`amount_${amount}`]) {
    found = store[`amount_${amount}`];
  }

  if (found) {
    return res.status(200).json({
      success: true,
      completed: true,
      coins: found.coins,
      amount: found.amount,
      digits: found.digits
    });
  }

  return res.status(200).json({ success: true, completed: false });
}
