# Political Social Media Assessment

A comprehensive web application for tracking and analyzing social media sentiment of political candidates in Nepal's elections.

## Features

- 🗳️ **Candidate Management**: Add, edit, and delete political candidates by constituency
- 📊 **Sentiment Analysis**: Track positive, negative, and neutral sentiment percentages
- 📈 **Interactive Charts**: Beautiful pie charts per candidate + combined bar graph
- 🔍 **Smart Filtering**: Cascading Province → District → Constituency dropdowns
- 🔎 **Search**: Find candidates by name or party
- 💬 **Comments**: Drill-down to view/add actual comments by sentiment type
- 📱 **Responsive**: Works on desktop, tablet, and mobile devices
- 🌐 **Multi-User**: Host on your laptop, access from any device on the network

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

### 3. Open in Browser

- **Local**: http://localhost:3000
- **Network**: http://YOUR_IP:3000 (run `ipconfig` to find your IP)

## Project Structure

```
poletical social media assisment/
├── server/
│   ├── server.js          # Express server & REST API
│   ├── database.js        # SQLite database module
│   └── data/
│       ├── provinces.json # 7 provinces of Nepal
│       ├── districts.json # 77 districts
│       └── constituencies.json # 165 FPTP constituencies
├── public/
│   ├── index.html         # Main HTML
│   ├── index.css          # Premium dark theme styling
│   └── app.js             # Frontend application logic
├── data/
│   └── assessment.db      # SQLite database (auto-created)
├── package.json
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/provinces` | GET | List all provinces |
| `/api/districts/:provinceId` | GET | Districts in a province |
| `/api/constituencies/:districtId` | GET | Constituencies in a district |
| `/api/candidates` | GET/POST | List/create candidates |
| `/api/candidates/:id` | PUT/DELETE | Update/delete candidate |
| `/api/posts` | POST | Create post for candidate |
| `/api/posts/:id` | PUT/DELETE | Update/delete post |
| `/api/posts/:postId/comments` | GET/POST | List/add comments |

## How to Use

1. **Select Location**: Choose Province → District → Constituency from dropdowns
2. **View Candidates**: See party cards with sentiment pie charts
3. **Add Candidate**: Click "Add Candidate" button, fill the form
4. **View Comments**: Click on any sentiment percentage to see/add comments
5. **Compare**: Scroll down to see combined bar chart comparing all parties

## Multi-User Access

1. Run `ipconfig` in PowerShell to find your IPv4 address (e.g., `192.168.1.100`)
2. Other users on the same network can access: `http://192.168.1.100:3000`
3. All data is stored centrally on your laptop in `data/assessment.db`

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite with better-sqlite3 (WAL mode for concurrency)
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Charts**: ApexCharts
- **Design**: Glassmorphism dark theme

## Nepal Electoral Data

Pre-loaded with:
- 7 Provinces
- 77 Districts
- 165 Election Constituencies (FPTP)

## License

ISC
