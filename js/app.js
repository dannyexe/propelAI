// ── STATE ──────────────────────────────────────────────────────────
let selectedTone = 'Professional';
let lastJobPosting = '';
let proposalCount = parseInt(localStorage.getItem('propelai_count') || '0');

// ── INIT ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  loadApiKey();
  updateUsageBadge();
  checkProfileAlert();

  // Tone button listeners
  document.querySelectorAll('.tone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTone = btn.dataset.tone;
    });
  });
});

// ── NAVIGATION ────────────────────────────────────────────────────
function switchView(viewId, btnEl) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`view-${viewId}`).classList.add('active');
  if (btnEl) btnEl.classList.add('active');
  else {
    const match = document.querySelector(`[data-view="${viewId}"]`);
    if (match) match.classList.add('active');
  }
}

// ── PROFILE ───────────────────────────────────────────────────────
function saveProfile() {
  const profile = {
    name:       document.getElementById('p-name').value.trim(),
    niche:      document.getElementById('p-niche').value.trim(),
    skills:     document.getElementById('p-skills').value.trim(),
    experience: document.getElementById('p-experience').value.trim(),
    tone:       document.getElementById('p-tone').value,
  };
  localStorage.setItem('propelai_profile', JSON.stringify(profile));
  flashConfirm('saveConfirm');
  checkProfileAlert();
}

function loadProfile() {
  const saved = localStorage.getItem('propelai_profile');
  if (!saved) return;
  const p = JSON.parse(saved);
  document.getElementById('p-name').value       = p.name       || '';
  document.getElementById('p-niche').value      = p.niche      || '';
  document.getElementById('p-skills').value     = p.skills     || '';
  document.getElementById('p-experience').value = p.experience || '';
  document.getElementById('p-tone').value       = p.tone       || 'Professional';
}

function getProfile() {
  const saved = localStorage.getItem('propelai_profile');
  return saved ? JSON.parse(saved) : null;
}

function checkProfileAlert() {
  const p = getProfile();
  const alert = document.getElementById('profileAlert');
  if (!p || !p.name || !p.skills) {
    alert.style.display = 'block';
  } else {
    alert.style.display = 'none';
  }
}

// ── API KEY ───────────────────────────────────────────────────────
function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key) return;
  localStorage.setItem('propelai_apikey', key);
  flashConfirm('keyConfirm');
}

function loadApiKey() {
  const key = localStorage.getItem('propelai_apikey');
  if (key) document.getElementById('apiKeyInput').value = key;
}

function getApiKey() {
  return localStorage.getItem('propelai_apikey') || '';
}

// ── PROPOSAL GENERATION ───────────────────────────────────────────
async function generateProposal() {
  const jobPosting = document.getElementById('jobPosting').value.trim();

  if (!jobPosting) {
    alert('Please paste a job posting first.');
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    alert('Please add your Anthropic API key under the API Key section.');
    switchView('settings', null);
    return;
  }

  lastJobPosting = jobPosting;
  showLoading(true);

  try {
    const result = await callGeminiAPI(apiKey, jobPosting, selectedTone);
    displayProposal(result.proposal, result.tip);
    incrementUsage();
  } catch (err) {
    showLoading(false);
    alert(`Error: ${err.message}`);
  }
}

async function regenerate() {
  if (!lastJobPosting) return;
  const apiKey = getApiKey();
  if (!apiKey) return;

  showLoading(true);

  try {
    const result = await callGeminiAPI(apiKey, lastJobPosting, selectedTone, true);
    displayProposal(result.proposal, result.tip);
  } catch (err) {
    showLoading(false);
    alert(`Error: ${err.message}`);
  }
}

async function callGeminiAPI(apiKey, jobPosting, tone, isRegenerate = false) {
  const profile = getProfile();

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

Tone: ${tone}
${isRegenerate ? '(Write a fresh variation, different from any previous version)' : ''}

Job Posting:
${jobPosting}

Write the proposal now.`;

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
    throw new Error(errData.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();

  // Gemini can return text split across multiple parts — join them all
  const parts = data.candidates?.[0]?.content?.parts || [];
  const fullText = parts.map(p => p.text || '').join('');

  // Check if response was cut off
  const finishReason = data.candidates?.[0]?.finishReason;
  if (!fullText) throw new Error('No response from Gemini. Check your API key.');
  if (finishReason === 'MAX_TOKENS') throw new Error('Response was cut off. Try a shorter job description.');

  // Split proposal and tip — handle varied formatting from Gemini
  const tipMatch = fullText.match(/(?:^|\n)\s*TIP:\s*(.+?)(?:\n|$)/is);
  const tip = tipMatch ? tipMatch[1].trim() : null;
  const proposal = tipMatch
    ? fullText.slice(0, tipMatch.index).trim()
    : fullText.trim();

  return { proposal, tip };
}

// ── UI HELPERS ────────────────────────────────────────────────────
function showLoading(show) {
  document.getElementById('emptyState').style.display    = 'none';
  document.getElementById('loadingState').style.display  = show ? 'flex' : 'none';
  document.getElementById('proposalOutput').style.display = 'none';
  document.getElementById('outputActions').style.display  = 'none';
  document.getElementById('tipBox').style.display         = 'none';
  document.getElementById('generateBtn').disabled         = show;
}

// ── MARKDOWN RENDERER ─────────────────────────────────────────────
function renderMarkdown(text) {
  return text
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Numbered lists: "1. " at start of line
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ol>
    .replace(/(<li>.*<\/li>\n?)+/gs, match => `<ol>${match}</ol>`)
    // Bullet lists: "- " or "* " at start of line
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, match =>
      match.includes('<ol>') ? match : `<ul>${match}</ul>`)
    // Line breaks: double newline = paragraph break
    .replace(/\n{2,}/g, '</p><p>')
    // Single newline = line break
    .replace(/\n/g, '<br>')
    // Wrap everything in a paragraph
    .replace(/^(.+)$/, '<p>$1</p>');
}

function displayProposal(proposal, tip) {
  document.getElementById('loadingState').style.display   = 'none';
  document.getElementById('proposalOutput').style.display = 'block';
  document.getElementById('outputActions').style.display  = 'flex';

  // Render markdown as HTML instead of raw text
  document.getElementById('proposalText').innerHTML = renderMarkdown(proposal);

  if (tip) {
    document.getElementById('tipBox').style.display  = 'block';
    document.getElementById('tipText').innerText     = tip;
  } else {
    document.getElementById('tipBox').style.display  = 'none';
  }

  document.getElementById('generateBtn').disabled = false;
}

// ── COPY & EXPORT ─────────────────────────────────────────────────
function copyProposal() {
  const text = document.getElementById('proposalText').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('[onclick="copyProposal()"]');
    const original = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => btn.textContent = original, 1800);
  });
}

function exportTxt() {
  const text = document.getElementById('proposalText').innerText;
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `proposal-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── USAGE COUNTER ─────────────────────────────────────────────────
function incrementUsage() {
  proposalCount++;
  localStorage.setItem('propelai_count', proposalCount);
  updateUsageBadge();
}

function updateUsageBadge() {
  document.getElementById('usageCount').textContent = proposalCount;
}

// ── FLASH CONFIRM ─────────────────────────────────────────────────
function flashConfirm(id) {
  const el = document.getElementById(id);
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}
