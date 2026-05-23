import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Look up user in Supabase
  const { data, error } = await supabase
    .from('users')
    .select('is_pro, proposal_count')
    .eq('email', email.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (not an error, just new user)
    return res.status(500).json({ error: 'Database error' });
  }

  return res.status(200).json({
    isPro: data?.is_pro || false,
    proposalCount: data?.proposal_count || 0,
  });
}
