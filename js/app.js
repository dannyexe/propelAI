// ── STATE ──────────────────────────────────────────────────────────
let selectedTone = 'Professional';
let lastJobPosting = '';
let proposalCount = parseInt(localStorage.getItem('propelai_count') || '0');
let userEmail = localStorage.getItem('propelai_email') || null;
let userIsPro = false;
const FREE_LIMIT = 3;
const PAYSTACK_LINK = 'https://paystack.shop/pay/w16b54mmsw';

// ── INIT ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  loadProfile();
  updateUsageBadge();
  checkProfileAlert();

  // Pre-fill email if saved
  if (userEmail) {
    document.getElementById('emailInput').value = userEmail;
    await syncProStatus(userEmail);
    updateUsageBadge();
  }

  // Handle return from Paystack
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    window.history.replaceState({}, '', '/');
    setTimeout(() => {
      showToast('🎉 Payment successful! Enter your email and click Restore Pro to unlock unlimited proposals.', 'success');
    }, 800);
  }

  // Tone buttons
  document.querySelectorAll('.tone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTone = btn.dataset.tone;
    });
  });

  // Close paywall when clicking overlay
  document.getElementById('paywallModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('paywallModal')) closePaywall();
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
  const alertEl = document.getElementById('profileAlert');
  alertEl.style.display = (!p || !p.name || !p.skills) ? 'block' : 'none';
}

// ── PRO STATUS ────────────────────────────────────────────────────
async function syncProStatus(email) {
  try {
    const res = await fetch('/api/check-pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    userIsPro = data.isPro || false;
    // Only use server count if higher than local (prevents reset exploits)
    const serverCount = data.proposalCount || 0;
    proposalCount = Math.max(proposalCount, serverCount);
  } catch (err) {
    console.error('Could not sync pro status:', err);
  }
}

// ── EMAIL RESTORE ─────────────────────────────────────────────────
async function handleEmailSave() {
  const input = document.getElementById('emailInput');
  const email = input.value.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }

  userEmail = email;
  localStorage.setItem('propelai_email', email);
  await syncProStatus(email);
  updateUsageBadge();

  if (userIsPro) {
    showToast('✅ Pro access restored! Enjoy unlimited proposals.', 'success');
  } else {
    showToast('No Pro subscription found. If you just paid, wait a moment and try again.', 'error');
  }
}

// ── PROPOSAL GENERATION ───────────────────────────────────────────
async function generateProposal() {
  const jobPosting = document.getElementById('jobPosting').value.trim();

  if (!jobPosting) {
    alert('Please paste a job posting first.');
    return;
  }

  // Check limit using localStorage count (simple & reliable)
  if (!userIsPro && proposalCount >= FREE_LIMIT) {
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
    body: JSON.stringify({ jobPosting, tone, profile, isRegenerate, email: userEmail }),
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
  document.getElementById('proposalText').innerHTML       = renderMarkdown(proposal);
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

// ── PAYWALL ───────────────────────────────────────────────────────
function upgradeNow() {
  window.location.href = PAYSTACK_LINK;
}

function showPaywall() {
  document.getElementById('paywallModal').classList.add('show');
}

function closePaywall() {
  document.getElementById('paywallModal').classList.remove('show');
}

// ── USAGE ─────────────────────────────────────────────────────────
function incrementUsage() {
  proposalCount++;
  localStorage.setItem('propelai_count', proposalCount);
  updateUsageBadge();
}

function updateUsageBadge() {
  const remaining = userIsPro ? '∞' : Math.max(0, FREE_LIMIT - proposalCount);
  const label = userIsPro ? 'Pro — unlimited' : 'free proposals left';
  document.getElementById('usageBadge').innerHTML =
    `<span id="usageCount">${remaining}</span> ${label}`;
}

// ── TOAST ─────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('toast-show'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ── FLASH CONFIRM ─────────────────────────────────────────────────
function flashConfirm(id) {
  const el = document.getElementById(id);
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}
