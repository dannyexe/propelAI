# PropelAI — Freelance Proposal Generator

A clean, AI-powered web app that generates personalized freelance proposals in seconds.

## 📁 Project Structure

```
proposal-gen/
├── index.html        ← Main app
├── css/
│   └── style.css     ← All styles
├── js/
│   └── app.js        ← All logic + API calls
└── README.md
```

## 🚀 How to Run

1. Open the `proposal-gen` folder in VS Code
2. Install the **Live Server** extension (if you haven't already)
   - Press `Ctrl+Shift+X`, search "Live Server", install it
3. Right-click `index.html` → **Open with Live Server**
4. The app opens at `http://127.0.0.1:5500`

## 🔑 Setting Up Your API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and get your API key (starts with `sk-ant-`)
3. In the app, click **API Key** in the sidebar and paste your key
4. Click **Save Key** — it's stored locally in your browser only

## ✨ Features (V1)

- **AI Proposal Generator** — paste any job posting and get a tailored proposal
- **Freelancer Profile** — your name, skills, and experience personalize every proposal
- **Tone Selector** — choose from 6 tones (Professional, Friendly, Bold, etc.)
- **Regenerate** — get a fresh variation with one click
- **AI Tip** — a coaching tip appears after each generation
- **Copy to Clipboard** — one-click copy
- **Export as .txt** — save your proposal as a text file
- **Usage Counter** — tracks how many proposals you've generated

## 🗺️ Coming Next (V2)

- [ ] User accounts (Supabase auth)
- [ ] Saved proposals library
- [ ] Rich text editor
- [ ] PDF export
- [ ] Freemium limits + Stripe payments

## 🛠️ Tech Stack

- Pure HTML, CSS, JavaScript (no frameworks needed)
- Anthropic Claude API (`claude-sonnet-4-20250514`)
- LocalStorage for profile + API key persistence

## 💡 Notes

- Your API key is **never sent anywhere** except directly to Anthropic's API
- All data (profile, key, count) is stored in your browser's localStorage
- The app works fully offline except for the API call itself
