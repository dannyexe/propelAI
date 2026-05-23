import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  const { jobPosting, tone, profile, isRegenerate, email } = req.body;

  if (!jobPosting) {
    return res.status(400).json({ error: 'Job posting is required.' });
  }

  // ── FREEMIUM CHECK (server-side) ──
  if (email) {
    const { data } = await supabase
      .from('users')
      .select('is_pro, proposal_count')
      .eq('email', email.toLowerCase())
      .single();

    const isPro = data?.is_pro || false;
    const count = data?.proposal_count || 0;

    if (!isPro && count >= 3) {
      return res.status(403).json({ error: 'Free limit reached. Please upgrade to Pro.' });
    }
  }

  if (!jobPosting) {
    return res.status(400).json({ error: 'Job posting is required.' });
  }

  // Build profile context
  const profileContext = profile && profile.name
    ? `
Freelancer Profile:
- Name: ${profile.name}
- Niche/Industry: ${profile.niche || 'Not specified'}
- Skills: ${profile.skills || 'Not specified'}
- Experience: ${profile.experience || 'Not specified'}
`
    : 'No profile provided. Write a generic but compelling proposal.';

  const prompt = `You are an expert freelance proposal writer. You write highly persuasive, personalized freelance proposals that win clients.

Your proposals:
- Open with a strong hook that shows you understand the client's problem
- Briefly highlight relevant experience and skills (2-3 sentences max)
- Outline a clear approach or solution (2-3 points)
- End with a confident call to action
- Are concise (250-350 words), ALWAYS complete, and never cut off mid-sentence
- End with a clear closing line and call to action before the TIP
- Sound human, confident, and specific

After the proposal, you MUST add a new line starting with exactly "TIP:" followed by ONE short coaching tip (1 sentence) about how to make this specific proposal even stronger. This line is mandatory.

Your response must follow this exact format with nothing else after the TIP line:
[proposal text here]

TIP: [one sentence tip here]

---

${profileContext}

Tone: ${tone || 'Professional'}
${isRegenerate ? '(Write a fresh variation, different from any previous version)' : ''}

Job Posting:
${jobPosting}

Write the proposal now.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.8 },
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json();
      return res.status(response.status).json({
        error: errData.error?.message || 'Gemini API error',
      });
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const fullText = parts.map(p => p.text || '').join('');

    if (!fullText) {
      return res.status(500).json({ error: 'No response from Gemini.' });
    }

    // Split proposal and tip
    const tipMatch = fullText.match(/(?:^|\n)\s*TIP:\s*(.+?)(?:\n|$)/is);
    const tip = tipMatch ? tipMatch[1].trim() : null;
    const proposal = tipMatch
      ? fullText.slice(0, tipMatch.index).trim()
      : fullText.trim();

    // Track usage in Supabase
    if (email) {
      await supabase.rpc('increment_proposal_count', { user_email: email.toLowerCase() });
    }

    return res.status(200).json({ proposal, tip });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
