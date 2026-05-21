// ── STATE ──────────────────────────────────────────────────────────
let selectedTone = 'Professional';
let lastJobPosting = '';
let proposalCount = parseInt(localStorage.getItem('propelai_count') || '0');
const FREE_LIMIT = 3;
const LEMONSQUEEZY_LINK = 'https://buy.stripe.com/your_link_here'; // ⚠️ Replace with your Lemon Squeezy link
let userEmail = localStorage.getItem('propelai_email') || '';
let isProUser = localStorage.getItem('propelai_pro') === 'true';

// ── INIT ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  updateUsageBadge();
  checkProfileAlert();

  if (userEmail) {
    const emailInput = document.getElementById('account-email');
    if (emailInput) emailInput.value = userEmail;
    verifyProStatus(userEmail, false);
  }
  updatePlanStatus();
  const upgradeLink = document.getElementById('accountUpgradeLink');
  if (upgradeLink) upgradeLink.href = LEMONSQUEEZY_LINK;

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

// ── EMAIL & PRO VERIFICATION ──────────────────────────────────────
async function saveEmail() {
  const emailInput = document.getElementById('account-email');
  const email = emailInput.value.trim();
  if (!email || !email.includes('@')) {
    alert('Please enter a valid email address.');
    return;
  }
  userEmail = email;
  localStorage.setItem('propelai_email', email);
  await verifyProStatus(email, true);
}

async function verifyProStatus(email, showConfirm) {
  try {
    const res = await fetch('/api/check-pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    isProUser = data.isPro;
    localStorage.setItem('propelai_pro', isProUser ? 'true' : 'false');
    updateUsageBadge();
    updatePlanStatus();
    if (showConfirm) flashConfirm('emailConfirm');
  } catch (e) {
    console.error('Could not verify pro status:', e);
  }
}

function updatePlanStatus() {
  const el = document.getElementById('plan-status');
  if (!el) return;
  el.textContent = isProUser
    ? '✦ Pro — Unlimited proposals'
    : `Free — ${Math.max(0, FREE_LIMIT - proposalCount)} proposals remaining`;
  el.style.color = isProUser ? 'var(--accent)' : 'var(--muted)';
}

// ── PROPOSAL GENERATION ───────────────────────────────────────────
async function generateProposal() {
  const jobPosting = document.getElementById('jobPosting').value.trim();

  if (!jobPosting) {
    alert('Please paste a job posting first.');
    return;
  }

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
  document.getElementById('emptyState').style.display     = 'none';
  document.getElementById('loadingState').style.display   = show ? 'flex' : 'none';
  document.getElementById('proposalOutput').style.display = 'none';
  document.getElementById('outputActions').style.display  = 'none';
  document.getElementById('tipBox').style.display         = 'none';
  document.getElementById('generateBtn').disabled         = show;
}

// ── MARKDOWN RENDERER ─────────────────────────────────────────────
function renderMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, match => `<ol>${match}</ol>`)
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, match =>
      match.includes('<ol>') ? match : `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)$/, '<p>$1</p>');
}

function displayProposal(proposal, tip) {
  document.getElementById('loadingState').style.display   = 'none';
  document.getElementById('proposalOutput').style.display = 'block';
  document.getElementById('outputActions').style.display  = 'flex';
  document.getElementById('proposalText').innerHTML = renderMarkdown(proposal);

  if (tip) {
    document.getElementById('tipBox').style.display = 'block';
    document.getElementById('tipText').innerText    = tip;
  } else {
    document.getElementById('tipBox').style.display = 'none';
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
  return isProUser;
}

function showPaywall() {
  document.getElementById('stripeLink').href = LEMONSQUEEZY_LINK;
  document.getElementById('paywallModal').classList.add('show');
}

function closePaywall() {
  document.getElementById('paywallModal').classList.remove('show');
}

document.addEventListener('click', (e) => {
  const modal = document.getElementById('paywallModal');
  if (e.target === modal) closePaywall();
});

// ── USAGE COUNTER ─────────────────────────────────────────────────
function incrementUsage() {
  if (!isPro()) {
    proposalCount++;
    localStorage.setItem('propelai_count', proposalCount);
  }
  updateUsageBadge();
  updatePlanStatus();
}

function updateUsageBadge() {
  const badge = document.getElementById('usageBadge');
  if (!badge) return;
  const remaining = Math.max(0, FREE_LIMIT - proposalCount);
  badge.innerHTML = isPro()
    ? '✦ Pro — unlimited'
    : `<span>${remaining}</span> free proposals left`;
}

// ── FLASH CONFIRM ─────────────────────────────────────────────────
function flashConfirm(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}
