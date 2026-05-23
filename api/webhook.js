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

  // Verify webhook is really from Paystack
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  const eventType = event?.event;
  const data = event?.data;

  // Handle successful payment
  if (
    eventType === 'charge.success' ||
    eventType === 'subscription.create'
  ) {
    const email = data?.customer?.email;

    if (!email) {
      return res.status(400).json({ error: 'No email found in webhook' });
    }

    // Mark user as Pro in Supabase
    const { error } = await supabase
      .from('users')
      .upsert(
        { email: email.toLowerCase(), is_pro: true },
        { onConflict: 'email' }
      );

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    console.log(`✅ Pro unlocked for ${email}`);
    return res.status(200).json({ success: true });
  }

  // Handle cancellation
  if (eventType === 'subscription.disable') {
    const email = data?.customer?.email;
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
