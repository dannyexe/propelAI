// ── STATE ──────────────────────────────────────────────────────────
let selectedTone = 'Professional';
let lastJobPosting = '';
let proposalCount = parseInt(localStorage.getItem('propelai_count') || '0');
const FREE_LIMIT = 3;
// ⚠️ Replace this with your real Stripe Payment Link once you create it
const STRIPE_LINK = 'https://buy.stripe.com/your_link_here';

// ── INIT ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
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

// ── PROPOSAL GENERATION ───────────────────────────────────────────
async function generateProposal() {
  const jobPosting = document.getElementById('jobPosting').value.trim();

  if (!jobPosting) {
    alert('Please paste a job posting first.');
    return;
  }

  // ── FREEMIUM CHECK ──
  if (!isPro() && proposalCount >= FREE_LIMIT) {
    showPaywall();
    return;
  }

  lastJobPosting = jobPosting;
  showLoading(true);

  try {
    const result = await callBackend(jobPosting, selectedTone, false);
    displayProposal(result.proposal, result.tip);
    incrementUsage();
  } catch (err) {
    showLoading(false);
    alert(`Error: ${err.message}`);
  }
}

async function regenerate() {
  if (!lastJobPosting) return;
  showLoading(true);
  try {
    const result = await callBackend(lastJobPosting, selectedTone, true);
    displayProposal(result.proposal, result.tip);
  } catch (err) {
    showLoading(false);
    alert(`Error: ${err.message}`);
  }
}

// ── BACKEND CALL ──────────────────────────────────────────────────
async function callBackend(jobPosting, tone, isRegenerate = false) {
  const profile = getProfile();

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobPosting, tone, profile, isRegenerate }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Server error');
  return data;
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

// ── FREEMIUM ──────────────────────────────────────────────────────
function isPro() {
  return localStorage.getItem('propelai_pro') === 'true';
}

function showPaywall() {
  document.getElementById('stripeLink').href = STRIPE_LINK;
  document.getElementById('paywallModal').classList.add('show');
}

function closePaywall() {
  document.getElementById('paywallModal').classList.remove('show');
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('paywallModal');
  if (e.target === modal) closePaywall();
});

// ── USAGE COUNTER ─────────────────────────────────────────────────
function incrementUsage() {
  proposalCount++;
  localStorage.setItem('propelai_count', proposalCount);
  updateUsageBadge();
}

function updateUsageBadge() {
  const badge = document.getElementById('usageBadge');
  const count = document.getElementById('usageCount');
  if (isPro()) {
    count.textContent = '∞';
    badge.title = 'Pro — unlimited proposals';
  } else {
    const remaining = Math.max(0, FREE_LIMIT - proposalCount);
    count.textContent = remaining;
    badge.title = `${remaining} free proposals left`;
    document.getElementById('usageCount').textContent = remaining;
  }
  // Update label text
  badge.querySelector ? null : null;
  badge.innerHTML = `<span id="usageCount">${isPro() ? '∞' : Math.max(0, FREE_LIMIT - proposalCount)}</span> ${isPro() ? 'Pro — unlimited' : 'free proposals left'}`;
}

// ── FLASH CONFIRM ─────────────────────────────────────────────────
function flashConfirm(id) {
  const el = document.getElementById(id);
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}
