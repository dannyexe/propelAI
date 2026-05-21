import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify the webhook is really from Lemon Squeezy
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const signature = req.headers['x-signature'];
  const body = JSON.stringify(req.body);
  const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (hash !== signature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const eventName = req.body.meta?.event_name;
  const email = req.body.data?.attributes?.user_email;

  // Mark user as Pro on successful payment
  if (
    eventName === 'order_created' ||
    eventName === 'subscription_created' ||
    eventName === 'subscription_payment_success'
  ) {
    if (email) {
      const { error } = await supabase
        .from('users')
        .upsert({ email: email.toLowerCase(), is_pro: true }, { onConflict: 'email' });

      if (error) return res.status(500).json({ error: 'Database error' });
    }
  }

  res.status(200).json({ received: true });
}
