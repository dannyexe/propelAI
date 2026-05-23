import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the webhook is really from Lemon Squeezy
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.headers['x-signature'];
    const body = JSON.stringify(req.body);
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    if (hash !== signature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const event = req.body;
  const eventName = event?.meta?.event_name;

  // Handle successful subscription payment
  if (
    eventName === 'order_created' ||
    eventName === 'subscription_created' ||
    eventName === 'subscription_payment_success'
  ) {
    const email = event?.data?.attributes?.user_email
      || event?.data?.attributes?.customer_email
      || event?.meta?.custom_data?.email;

    if (!email) {
      return res.status(400).json({ error: 'No email found in webhook' });
    }

    // Upsert user as Pro in Supabase
    const { error } = await supabase
      .from('users')
      .upsert({ email: email.toLowerCase(), is_pro: true }, { onConflict: 'email' });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    console.log(`✅ Pro unlocked for ${email}`);
    return res.status(200).json({ success: true });
  }

  // Handle subscription cancellation
  if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
    const email = event?.data?.attributes?.user_email
      || event?.data?.attributes?.customer_email;

    if (email) {
      await supabase
        .from('users')
        .update({ is_pro: false })
        .eq('email', email.toLowerCase());

      console.log(`❌ Pro removed for ${email}`);
    }
  }

  return res.status(200).json({ received: true });
}
