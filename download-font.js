const fs = require('fs');
const https = require('https');
const path = require('path');

const fontsToTry = [
    'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf',
    'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansdevanagari/NotoSansDevanagari-Regular.ttf',
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-400-normal.woff',
    'https://fonts.gstatic.com/s/notosansdevanagari/v25/5aUu9_aHVQlgLZmwH56t8p_iVL45CO96.ttf'
];

const outputDir = path.join(__dirname, 'public', 'fonts');
const outputPath = path.join(outputDir, 'NotoSansDevanagari-Regular.ttf');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

function downloadFont(urlIndex) {
    if (urlIndex >= fontsToTry.length) {
        console.error('All download attempts failed.');
        return;
    }

    const url = fontsToTry[urlIndex];
    console.log(`Attempting download from: ${url}`);

    https.get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
            // Handle redirect
            if (res.headers.location) {
                console.log(`Redirecting to: ${res.headers.location}`);
                https.get(res.headers.location, (redirectRes) => {
                    handleResponse(redirectRes, urlIndex);
                }).on('error', (err) => tryNext(err.message, urlIndex));
                return;
            }
        }
        handleResponse(res, urlIndex);
    }).on('error', (err) => {
        tryNext(err.message, urlIndex);
    });
}

function handleResponse(res, urlIndex) {
    if (res.statusCode !== 200) {
        tryNext(`Status code: ${res.statusCode}`, urlIndex);
        return;
    }

    const file = fs.createWriteStream(outputPath);
    res.pipe(file);
    file.on('finish', () => {
        file.close();
        console.log('✅ Font downloaded successfully to:', outputPath);
    });
    file.on('error', (err) => {
        fs.unlink(outputPath, () => { }); // Delete failed file
        tryNext(`File write error: ${err.message}`, urlIndex);
    });
}

function tryNext(reason, currentIndex) {
    console.error(`❌ Failed: ${reason}`);
    downloadFont(currentIndex + 1);
}

// Start download
downloadFont(0);
