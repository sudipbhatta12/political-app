# Scalability Analysis & Recommendations (Free Tier Optimized)

## Current Architecture Status
- **Platform**: Render.
- **Limitation**: Render's **Free Tier** for Web Services has significant constraints:
    - **Spins Down**: The server "sleeps" after 15 minutes of inactivity. The first user afterwards waits 30+ seconds (Cold Start).
    - **Single Instance**: You cannot run multiple servers to handle load.
    - **Memory**: Limited to 512MB.
    - **In-Memory Auth**: If the server restarts (which Render free tier does often), **all users get logged out**.

## The Best "Free" Source Architecture

To handle high traffic for **free**, you must move the "heavy lifting" (serving HTML/Images) away from the weak Render server and onto a **Content Delivery Network (CDN)**.

### Recommendation: The Hybrid "Split Stack"
This architecture handles **Unlimited Read Traffic** for free (Frontend) and keeps your API on Render (Backend).

#### 1. Frontend (Public View): **Vercel** or **Netlify** (Free)
- **Why**: They are specialized for serving static files (`index.html`, `images`, `js`).
- **Capacity**: Can handle millions of visitors without crashing.
- **Cost**: $0.
- **Speed**: Served from edge locations worldwide (Nepal, India, etc.), much faster than a single Render server in Oregon/Singapore.

#### 2. Backend (API): **Render** (Free - Current)
- **Why**: You already have it set up. It works fine for just data/API calls.
- **Optimization**: Since it doesn't serve images anymore, it uses less RAM and CPU, handling more API requests.

#### 3. Database: **Supabase** (Free)
- **Status**: Excellent. Keep using this.

---

## Action Plan: Make the App "High Traffic Ready" on Free Tier

### Step 1: Fix the "Restart Bug" (Authentication) - **Start Here**
**Problem**: On Render Free Tier, your server restarts multiple times a day. Currently, `const tokens = new Set()` in `server.js` loses all login sessions on every restart.
**Fix**:
- Create a `sessions` table in Supabase.
- Update `server.js` to check the database for tokens, not RAM.
- **Result**: Users stay logged in even if the Render server sleeps or restarts.

### Step 2: Decouple Frontend & Backend
**Goal**: Allow the frontend to potentially live on Vercel while backend stays on Render.
1. Update `server.js` CORS settings to allow connections from your Vercel URL.
2. (Optional) Move `public` folder to a separate git repo or configure build to deploy only `public` to Vercel.

### Step 3: Deployment Strategy
1. **Push Backend**: Deploy current code to Render (Start Command: `node server/server.js`).
2. **Push Frontend**: valid `index.html` structure allows drag-and-drop deployment to Netlify drop.

---

## Conclusion
Stay on **Render** for the backend API, but **Fix Authentication Persistence** immediately. This is the single biggest reliability upgrade you can make for the free tier.
