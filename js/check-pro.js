import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const { data, error } = await supabase
    .from('users')
    .select('is_pro')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !data) return res.status(200).json({ isPro: false });

  res.status(200).json({ isPro: data.is_pro });
}
