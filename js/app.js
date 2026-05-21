// ── CONFIG ─────────────────────────────────────────────────────────
const LEMONSQUEEZY_LINK = 'https://buy.stripe.com/your_link_here'; // Replace with your Lemon Squeezy link
const FREE_LIMIT = 3;

// ── STATE ──────────────────────────────────────────────────────────
let selectedTone = 'Professional';
let lastJobPosting = '';
let proposalCount = parseInt(localStorage.getItem('propelai_count') || '0');
let userEmail = localStorage.getItem('propelai_email') || '';
let isProUser = localStorage.getItem('propelai_pro') === 'true';

// ── INIT ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  updateUsageDisplay();
  setupToneButtons();
  setupNavigation();

  if (userEmail) {
    document.getElementById('user-email').value = userEmail;
    verifyProStatus(userEmail);
  }
});

// ── PRO STATUS ─────────────────────────────────────────────────────
async function verifyProStatus(email) {
  try {
    const res = await fetch('/api/check-pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    isProUser = data.isPro;
    localStorage.setItem('propelai_pro', isProUser ? 'true' : 'false');
    updateUsageDisplay();
  } catch (e) {
    console.error('Could not verify pro status:', e);
  }
}

function isPro() {
  return isProUser;
}

// ── USAGE DISPLAY ──────────────────────────────────────────────────
function updateUsageDisplay() {
  const badge = document.getElementById('usage-badge');
  if (!badge) return;
  if (isPro()) {
    badge.textContent = '✨ Pro — Unlimited';
    badge.style.color = '#f59e0b';
  } else {
    const remaining = Math.max(0, FREE_LIMIT - proposalCount);
    badge.textContent = `${remaining} free proposal${remaining !== 1 ? 's' : ''} left`;
    badge.style.color = remaining === 0 ? '#ef4444' : '#94a3b8';
  }
}

// ── PAYWALL ────────────────────────────────────────────────────────
function showPaywall() {
  document.getElementById('paywall-modal').classList.remove('hidden');
}

function hidePaywall() {
  document.getElementById('paywall-modal').classList.add('hidden');
}

function upgradeNow() {
  window.open(LEMONSQUEEZY_LINK, '_blank');
  hidePaywall();
}

// ── EMAIL HANDLING ─────────────────────────────────────────────────
async function saveEmail() {
  const emailInput = document.getElementById('user-email');
  const email = emailInput.value.trim();
  if (!email || !email.includes('@')) {
    alert('Please enter a valid email address.');
    return;
  }
  userEmail = email;
  localStorage.setItem('propelai_email', email);
  await verifyProStatus(email);

  const btn = document.getElementById('save-email-btn');
  btn.textContent = isPro() ? '✨ Pro Verified!' : '✅ Saved';
  setTimeout(() => btn.textContent = 'Save', 2000);
}

// ── PROFILE ────────────────────────────────────────────────────────
function saveProfile() {
  const profile = {
    name: document.getElementById('profile-name').value,
    skills: document.getElementById('profile-skills').value,
    experience: document.getElementById('profile-experience').value,
    niche: document.getElementById('profile-niche').value,
  };
  localStorage.setItem('propelai_profile', JSON.stringify(profile));
  const btn = document.querySelector('.save-profile-btn');
  if (btn) { btn.textContent = '✅ Saved!'; setTimeout(() => btn.textContent = 'Save Profile', 2000); }
}

function loadProfile() {
  const profile = JSON.parse(localStorage.getItem('propelai_profile') || '{}');
  if (profile.name) document.getElementById('profile-name').value = profile.name;
  if (profile.skills) document.getElementById('profile-skills').value = profile.skills;
  if (profile.experience) document.getElementById('profile-experience').value = profile.experience;
  if (profile.niche) document.getElementById('profile-niche').value = profile.niche;
}

function getProfile() {
  return JSON.parse(localStorage.getItem('propelai_profile') || '{}');
}

// ── TONE BUTTONS ───────────────────────────────────────────────────
function setupToneButtons() {
  document.querySelectorAll('.tone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTone = btn.dataset.tone;
    });
  });
}

// ── NAVIGATION ─────────────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
      btn.classList.add('active');
      const target = btn.dataset.section;
      document.getElementById(`section-${target}`)?.classList.remove('hidden');
    });
  });
}

// ── MARKDOWN RENDERER ──────────────────────────────────────────────
function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^\d+\.\s(.+)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hol])/gm, '')
    .replace(/(.+?)(?=<\/?[hol]|$)/gs, (m) => m.trim() ? `<p>${m.trim()}</p>` : '');
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,3} /gm, '')
    .replace(/^\d+\. /gm, '')
    .trim();
}

// ── GENERATE ───────────────────────────────────────────────────────
async function generateProposal(isRegenerate = false) {
  const jobPosting = document.getElementById('job-posting').value.trim();
  if (!jobPosting) { alert('Please paste a job posting first.'); return; }

  if (!isPro() && proposalCount >= FREE_LIMIT) {
    showPaywall();
    return;
  }

  lastJobPosting = jobPosting;
  const profile = getProfile();

  const generateBtn = document.getElementById('generate-btn');
  generateBtn.disabled = true;
  generateBtn.textContent = isRegenerate ? '🔄 Regenerating...' : '⏳ Generating...';

  document.getElementById('output-section').classList.remove('hidden');
  document.getElementById('proposal-text').innerHTML = '<p style="color:#94a3b8">Generating your proposal...</p>';
  document.getElementById('tip-box').classList.add('hidden');

  try {
    const result = await callBackend(jobPosting, selectedTone, profile, isRegenerate);

    // Parse TIP from response
    const tipMatch = result.match(/TIP:\s*(.+?)(?:\n|$)/i);
    const tip = tipMatch ? tipMatch[1].trim() : null;
    const proposalOnly = result.replace(/TIP:.*$/im, '').trim();

    displayProposal(proposalOnly);

    if (tip) {
      document.getElementById('tip-text').textContent = tip;
      document.getElementById('tip-box').classList.remove('hidden');
    }

    if (!isPro()) {
      proposalCount++;
      localStorage.setItem('propelai_count', proposalCount);
      updateUsageDisplay();
    }

  } catch (err) {
    document.getElementById('proposal-text').innerHTML = `<p style="color:#ef4444">Error: ${err.message}</p>`;
  }

  generateBtn.disabled = false;
  generateBtn.textContent = '✨ Generate Proposal';
}

function displayProposal(text) {
  const html = renderMarkdown(text);
  document.getElementById('proposal-text').innerHTML = html;
}

// ── BACKEND CALL ───────────────────────────────────────────────────
async function callBackend(jobPosting, tone, profile, isRegenerate) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobPosting, tone, profile, isRegenerate })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${response.status}`);
  }

  const data = await response.json();
  return data.proposal;
}

// ── COPY / EXPORT ──────────────────────────────────────────────────
function copyProposal() {
  const text = stripMarkdown(document.getElementById('proposal-text').innerText);
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = '📋 Copy', 2000);
  });
}

function exportProposal() {
  const text = stripMarkdown(document.getElementById('proposal-text').innerText);
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'proposal.txt';
  a.click();
}
