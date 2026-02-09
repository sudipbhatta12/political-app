/**
 * Political Social Media Assessment - Frontend Application
 * Handles UI interactions, API calls, and chart rendering
 */

// ============================================
// Utility Functions
// ============================================
/**
 * Debounce function to limit API calls while typing
 * @param {Function} func - The function to debounce
 * @param {number} wait - Milliseconds to wait before calling
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Calculate sentiment stats weighted by comment count
 * Posts with more comments have proportionally larger impact on the average.
 * Falls back to simple average if no comments exist.
 * @param {Array} posts - Array of post objects
 * @returns {Object} { avgPositive, avgNegative, avgNeutral, totalComments, postCount }
 */
function calculateWeightedStats(posts) {
    const validPosts = posts.filter(p => p.id);
    const postCount = validPosts.length;

    if (postCount === 0) {
        return { avgPositive: 0, avgNegative: 0, avgNeutral: 0, totalComments: 0, postCount: 0 };
    }

    const totalComments = validPosts.reduce((sum, p) => sum + (p.comment_count || 0), 0);

    // If no comments at all, fall back to simple average
    if (totalComments === 0) {
        return {
            avgPositive: validPosts.reduce((sum, p) => sum + (p.positive_percentage || 0), 0) / postCount,
            avgNegative: validPosts.reduce((sum, p) => sum + (p.negative_percentage || 0), 0) / postCount,
            avgNeutral: validPosts.reduce((sum, p) => sum + (p.neutral_percentage || 0), 0) / postCount,
            totalComments: 0,
            postCount
        };
    }

    // Weighted Average: (Sum of (Percentage * Comments)) / Total Comments
    const weightedPositive = validPosts.reduce((sum, p) => sum + ((p.positive_percentage || 0) * (p.comment_count || 0)), 0) / totalComments;
    const weightedNegative = validPosts.reduce((sum, p) => sum + ((p.negative_percentage || 0) * (p.comment_count || 0)), 0) / totalComments;
    const weightedNeutral = validPosts.reduce((sum, p) => sum + ((p.neutral_percentage || 0) * (p.comment_count || 0)), 0) / totalComments;

    return {
        avgPositive: weightedPositive,
        avgNegative: weightedNegative,
        avgNeutral: weightedNeutral,
        totalComments,
        postCount
    };
}

// ============================================
// State Management
// ============================================
const state = {
    provinces: [],
    districts: [],
    constituencies: [],
    candidates: [],
    selectedConstituencyId: null,
    availableDates: [], // List of available dates strings
    currentDateIndex: 0, // 0 = newest
    filterByDate: false, // Whether to filter by specific date (false = show all)
    charts: {},
    currentPostId: null,
    currentSentiment: null
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    // Header
    homeBtn: document.getElementById('homeBtn'),
    brandLogoBtn: document.getElementById('brandLogoBtn'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Filters
    searchBox: document.querySelector('.search-box'),
    searchInput: document.getElementById('searchInput'),
    provinceSelect: document.getElementById('provinceSelect'),
    districtSelect: document.getElementById('districtSelect'),
    constituencySelect: document.getElementById('constituencySelect'),

    // Party Grid
    partyGrid: document.getElementById('partyGrid'),
    emptyState: document.getElementById('emptyState'),

    // Summary
    summarySection: document.getElementById('summarySection'),
    summaryChart: document.getElementById('summaryChart'),

    // Recent Updates
    recentConstituencies: document.getElementById('recentConstituencies'),
    recentTags: document.getElementById('recentTags'),

    // Unified Add Source Modal
    addSourceBtn: document.getElementById('addSourceBtn'),
    addSourceModal: document.getElementById('addSourceModal'),
    addSourceModalClose: document.getElementById('addSourceModalClose'),
    addSourceModalCancel: document.getElementById('addSourceModalCancel'),
    addSourceSubmitBtn: document.getElementById('addSourceSubmitBtn'),
    addSourceTypeContainer: document.getElementById('addSourceTypeContainer'),
    addSourceCandidateSection: document.getElementById('addSourceCandidateSection'),
    addSourceNewsSection: document.getElementById('addSourceNewsSection'),
    addSourcePartySection: document.getElementById('addSourcePartySection'),

    // Forms
    candidateForm: document.getElementById('candidateForm'),
    newsArticleForm: document.getElementById('newsArticleForm'),
    partyPostForm: document.getElementById('partyPostForm'),

    // Candidate Form Fields
    candidateId: document.getElementById('candidateId'),
    postId: document.getElementById('postId'),
    modalProvince: document.getElementById('modalProvince'),
    modalDistrict: document.getElementById('modalDistrict'),
    modalConstituency: document.getElementById('modalConstituency'),
    candidateSelect: document.getElementById('candidateSelect'),
    candidateName: document.getElementById('candidateName'),
    partyName: document.getElementById('partyName'),
    postUrl: document.getElementById('postUrl'),
    publishedDate: document.getElementById('publishedDate'),
    positivePercent: document.getElementById('positivePercent'),
    negativePercent: document.getElementById('negativePercent'),
    neutralPercent: document.getElementById('neutralPercent'),
    positiveRemarks: document.getElementById('positiveRemarks'),
    negativeRemarks: document.getElementById('negativeRemarks'),
    neutralRemarks: document.getElementById('neutralRemarks'),
    conclusion: document.getElementById('conclusion'),
    newsSourceSelect: document.getElementById('newsSourceSelect'),
    partySelect: document.getElementById('partySelect'),
    newNewsSourceRow: document.getElementById('newNewsSourceRow'),
    newNewsSourceName: document.getElementById('newNewsSourceName'),
    newPartyRow: document.getElementById('newPartyRow'),
    newPartyName: document.getElementById('newPartyName'),
    newPartyAbbrev: document.getElementById('newPartyAbbrev'),
    newsArticleUrl: document.getElementById('newsArticleUrl'),
    newsArticleDate: document.getElementById('newsArticleDate'),
    partyPostUrl: document.getElementById('partyPostUrl'),
    partyPostDate: document.getElementById('partyPostDate'),

    // Comments Modal
    commentsModal: document.getElementById('commentsModal'),
    commentsTitle: document.getElementById('commentsTitle'),
    commentsModalClose: document.getElementById('commentsModalClose'),
    commentsList: document.getElementById('commentsList'),
    newCommentInput: document.getElementById('newCommentInput'),
    commentSentiment: document.getElementById('commentSentiment'),
    addCommentBtn: document.getElementById('addCommentBtn'),

    // Remarks Modal
    remarksModal: document.getElementById('remarksModal'),
    remarksTitle: document.getElementById('remarksTitle'),
    remarksModalClose: document.getElementById('remarksModalClose'),
    remarksContent: document.getElementById('remarksContent'),

    // Library View (was Library Modal)
    libraryBtn: document.getElementById('libraryBtn'),
    libraryView: document.getElementById('library-view'),
    libraryTableBody: document.getElementById('libraryTableBody'),
    libraryCount: document.getElementById('libraryCount'),
    libraryEmpty: document.getElementById('libraryEmpty'),
    exportAllExcel: document.getElementById('exportAllExcel'),
    exportAllPdf: document.getElementById('exportAllPdf'),
    libraryDateFilter: document.getElementById('libraryDateFilter'),
    clearLibraryFilter: document.getElementById('clearLibraryFilter'),

    // AI Modal
    aiBtn: document.getElementById('aiBtn'),
    aiModal: document.getElementById('aiModal'),
    aiModalClose: document.getElementById('aiModalClose'),
    aiModalCancel: document.getElementById('aiModalCancel'),
    aiForm: document.getElementById('aiForm'),
    aiProvince: document.getElementById('aiProvince'),
    aiDistrict: document.getElementById('aiDistrict'),
    aiConstituency: document.getElementById('aiConstituency'),
    aiCandidateSelect: document.getElementById('aiCandidateSelect'),
    aiFile: document.getElementById('aiFile'),
    fileUploadZone: document.getElementById('fileUploadZone'),
    fileName: document.getElementById('fileName'),
    aiSubmitBtn: document.getElementById('aiSubmitBtn'),
    aiLoading: document.getElementById('aiLoading'),
    aiSourceUrl: document.getElementById('aiSourceUrl'),
    aiSourceTypeContainer: document.getElementById('aiSourceTypeContainer'),
    aiSourceType: document.getElementById('aiSourceType'),
    aiCandidateSection: document.getElementById('aiCandidateSection'),
    aiNewsSection: document.getElementById('aiNewsSection'),
    aiPartySection: document.getElementById('aiPartySection'),
    aiNewsSelect: document.getElementById('aiNewsSelect'),
    aiPartySelect: document.getElementById('aiPartySelect'),
    aiNewsPartySelect: document.getElementById('aiNewsPartySelect'),

    // Timeline
    timelineSection: document.getElementById('timelineSection'),
    prevDateBtn: document.getElementById('prevDateBtn'),
    nextDateBtn: document.getElementById('nextDateBtn'),
    viewAllDatesBtn: document.getElementById('viewAllDatesBtn'),
    currentDateDisplay: document.getElementById('currentDateDisplay'),
    dateStatus: document.getElementById('dateStatus'),

    // Winner Section
    winnerSection: document.getElementById('winnerSection'),
    winnerName: document.getElementById('winnerName'),
    winnerParty: document.getElementById('winnerParty'),
    winnerPositive: document.getElementById('winnerPositive'),
    winnerNegative: document.getElementById('winnerNegative'),
    winnerNeutral: document.getElementById('winnerNeutral'),
    winnerChart: document.getElementById('winnerChart'),
    winnerPositiveRemarks: document.getElementById('winnerPositiveRemarks'),
    winnerNegativeRemarks: document.getElementById('winnerNegativeRemarks'),
    winnerNeutralRemarks: document.getElementById('winnerNeutralRemarks'),
    winnerConclusion: document.getElementById('winnerConclusion'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),

    // Post Preview Modal
    postPreviewModal: document.getElementById('postPreviewModal'),
    postPreviewTitle: document.getElementById('postPreviewTitle'),
    postPreviewModalClose: document.getElementById('postPreviewModalClose'),
    postPreviewContainer: document.getElementById('postPreviewContainer'),
    postPreviewLoading: document.getElementById('postPreviewLoading'),
    postPreviewIframe: document.getElementById('postPreviewIframe'),
    openInNewTab: document.getElementById('openInNewTab')
};

// ============================================
// API Helper
// ============================================
const API = {
    async get(endpoint) {
        const response = await fetch(`/api${endpoint}`);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return response.json();
    },

    async post(endpoint, data) {
        const response = await fetch(`/api${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API Error');
        }
        return response.json();
    },

    async put(endpoint, data) {
        const response = await fetch(`/api${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return response.json();
    },

    async delete(endpoint) {
        const response = await fetch(`/api${endpoint}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return response.json();
    }
};

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '<i data-lucide="check-circle" style="width: 18px; height: 18px;"></i>' : type === 'error' ? '<i data-lucide="alert-circle" style="width: 18px; height: 18px;"></i>' : '<i data-lucide="info" style="width: 18px; height: 18px;"></i>'}</span>
        <span>${message}</span>
    `;
    elements.toastContainer.appendChild(toast);
    lucide.createIcons({ root: toast }); // Initialize icons for the new element

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// Role-Based Access Control
// ============================================
function checkUserRole() {
    const role = localStorage.getItem('userRole');

    if (role === 'viewer') {
        // Hide "Add Post Data" button
        if (elements.addCandidateBtn) elements.addCandidateBtn.style.display = 'none';

        // Hide "AI Analysis" button
        if (elements.aiBtn) elements.aiBtn.style.display = 'none';

        // Hide Search Box completely
        const searchSection = document.querySelector('.filters__search');
        if (searchSection) searchSection.style.display = 'none';

        // Hide "Add Source" Button in Header
        const headerAddBtn = document.getElementById('addSourceBtn');
        if (headerAddBtn) headerAddBtn.style.display = 'none';

        // Hide Library Action Buttons
        const libAddCandidate = document.getElementById('addCandidateLibraryBtn');
        const libAddNews = document.getElementById('addNewsMediaBtn');
        const libAddParty = document.getElementById('addPartyBtn');

        if (libAddCandidate) libAddCandidate.style.display = 'none';
        if (libAddNews) libAddNews.style.display = 'none';
        if (libAddParty) libAddParty.style.display = 'none';

        // Add Viewer Badge
        const headerTitle = document.querySelector('.header__title');
        if (headerTitle) {
            const badge = document.createElement('span');
            badge.textContent = ' (Viewer Mode)';
            badge.style.fontSize = '0.8em';
            badge.style.opacity = '0.7';
            headerTitle.appendChild(badge);
        }
    }
}

// Call on load
document.addEventListener('DOMContentLoaded', checkUserRole);

// ============================================
// Logout Functionality
// ============================================
if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', async () => {
        // Optional: Call server to invalidate token
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                await API.post('/logout', {}, false); // Pass false to startLoading to avoid spinner on exit
            }
        } catch (e) {
            console.warn('Logout server call failed', e);
        }

        // Clear local storage
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');

        // Redirect to login
        window.location.href = '/';
    });
}

// ============================================
// Home Navigation
// ============================================
function goHome() {
    // Reset all dropdowns
    elements.provinceSelect.value = '';
    resetSelect(elements.districtSelect, 'Select District');
    elements.districtSelect.disabled = true;
    resetSelect(elements.constituencySelect, 'Select Constituency');
    elements.constituencySelect.disabled = true;

    // Clear search (if search box exists)
    if (elements.searchInput) elements.searchInput.value = '';

    // Reset state
    state.candidates = [];
    state.selectedConstituencyId = null;
    state.filterByDate = false;
    state.availableDates = [];
    state.currentDateIndex = 0;

    // Show empty state, hide charts
    elements.partyGrid.innerHTML = '';
    elements.emptyState.style.display = 'flex';
    elements.summarySection.style.display = 'none';
    elements.winnerSection.style.display = 'none';

    // Destroy charts
    if (state.charts.summary) {
        state.charts.summary.destroy();
        state.charts.summary = null;
    }
    if (state.charts.winner) {
        state.charts.winner.destroy();
        state.charts.winner = null;
    }

    showToast('Welcome back!', 'info');
}

// ============================================
// Province/District/Constituency Cascading
// ============================================
async function loadProvinces() {
    try {
        state.provinces = await API.get('/provinces');
        populateSelect(elements.provinceSelect, state.provinces, 'name_en');
        populateSelect(elements.modalProvince, state.provinces, 'name_en');
    } catch (error) {
        showToast('Failed to load provinces', 'error');
        console.error(error);
    }
}

async function loadDistricts(provinceId, targetSelect, districtSelect, constituencySelect) {
    if (!provinceId) {
        resetSelect(districtSelect, 'Select District');
        resetSelect(constituencySelect, 'Select Constituency');
        return;
    }

    try {
        const districts = await API.get(`/districts/${provinceId}`);
        populateSelect(districtSelect, districts, 'name_en');
        districtSelect.disabled = false;
        resetSelect(constituencySelect, 'Select Constituency');
        constituencySelect.disabled = true;
    } catch (error) {
        showToast('Failed to load districts', 'error');
        console.error(error);
    }
}

async function loadConstituencies(districtId, constituencySelect) {
    if (!districtId) {
        resetSelect(constituencySelect, 'Select Constituency');
        return;
    }

    try {
        const constituencies = await API.get(`/constituencies/${districtId}`);
        populateSelect(constituencySelect, constituencies, 'name');
        constituencySelect.disabled = false;
    } catch (error) {
        showToast('Failed to load constituencies', 'error');
        console.error(error);
    }
}

function populateSelect(select, items, labelKey) {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = ''; // Clear all

    // Determine placeholder based on select ID
    let placeholderTxt = 'Item';
    if (select.id.toLowerCase().includes('province')) {
        placeholderTxt = 'Province';
    } else if (select.id.toLowerCase().includes('district')) {
        placeholderTxt = 'District';
    } else if (select.id.toLowerCase().includes('constituency')) {
        placeholderTxt = 'Constituency';
    }

    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = "";
    placeholderOpt.textContent = `Select ${placeholderTxt}`;
    select.appendChild(placeholderOpt);

    // Sort items - use natural numeric sorting for constituencies
    const sortedItems = [...items].sort((a, b) => {
        const aLabel = a[labelKey] || '';
        const bLabel = b[labelKey] || '';

        // Extract numbers from labels for natural sorting
        const aNum = aLabel.match(/\d+/);
        const bNum = bLabel.match(/\d+/);

        if (aNum && bNum) {
            return parseInt(aNum[0]) - parseInt(bNum[0]);
        }
        return aLabel.localeCompare(bLabel);
    });

    sortedItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item[labelKey];
        select.appendChild(option);
    });

    // Only restore selection if the value still exists in the new options
    if (currentValue && items.some(item => String(item.id) === String(currentValue))) {
        select.value = currentValue;
    } else {
        select.value = ""; // Default to empty/placeholder
        select.selectedIndex = 0; // Explicitly select the placeholder
    }
}

function resetSelect(select, placeholder) {
    if (!select) return;
    select.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = "";
    opt.textContent = placeholder;
    select.appendChild(opt);
    select.disabled = true;
}

// Reset candidate selector dropdown
function resetCandidateSelector() {
    elements.candidateSelect.innerHTML = '<option value="">-- Select a Candidate --</option>';
    elements.candidateSelect.disabled = true;
    elements.candidateName.value = '';
    elements.partyName.value = '';
    elements.candidateId.value = '';
}

// Populate candidate selector with candidates from selected constituency
function populateCandidateSelector(candidates) {
    elements.candidateSelect.innerHTML = '<option value="">-- Select a Candidate --</option>';

    // Sort candidates: first by party name, then by candidate name within each party
    const sorted = [...candidates].sort((a, b) => {
        // First compare by party name
        const partyCompare = (a.party_name || '').localeCompare(b.party_name || '', 'ne');
        if (partyCompare !== 0) return partyCompare;
        // Then by candidate name
        return (a.name || '').localeCompare(b.name || '', 'ne');
    });

    // Group by party for better visual separation
    let currentParty = null;
    sorted.forEach(candidate => {
        // Add party group label if party changed
        if (candidate.party_name !== currentParty) {
            currentParty = candidate.party_name;
            const groupOption = document.createElement('option');
            groupOption.disabled = true;
            groupOption.textContent = `── ${currentParty || 'स्वतन्त्र'} ──`;
            groupOption.style.fontWeight = 'bold';
            groupOption.style.color = '#888';
            elements.candidateSelect.appendChild(groupOption);
        }

        const option = document.createElement('option');
        option.value = candidate.id;
        option.textContent = `  ${candidate.name} `;
        option.dataset.name = candidate.name;
        option.dataset.party = candidate.party_name;
        elements.candidateSelect.appendChild(option);
    });

    elements.candidateSelect.disabled = false;
}

// ============================================
// Candidates Loading & Display
// ============================================
async function loadCandidatesByConstituency(constituencyId, date = null, filterByDate = false) {
    if (!constituencyId) {
        renderEmptyState();
        return;
    }

    // If new constituency selected (not just date change), reset timeline
    if (constituencyId !== state.selectedConstituencyId) {
        state.selectedConstituencyId = constituencyId;
        state.filterByDate = false; // Reset date filter for new constituency
        await loadConstituencyDates(constituencyId);
    }

    // Track if user wants to filter by date
    if (filterByDate) {
        state.filterByDate = true;
    }

    try {
        // ALWAYS fetch ALL data first to generate the "All Time Summary"
        // This is inefficient for huge datasets but necessary for the requested UI "Summary of all data ever posted"
        // Optimization: In a real app, we might request summary stats separately from the daily posts.
        // For now, we'll fetch all and filter client-side or stick to the current logic if "All Time" is just "All Available".

        // Actually, let's keep it simple:
        // 1. Fetch ALL candidates for the summary (no date filter)
        const allCandidatesMap = await API.get(`/candidates?constituency_id=${constituencyId}`);

        // Render Summary Chart using ALL data
        renderSummaryChart(allCandidatesMap);

        // 2. Determine what to show in the Grid (Timeline)
        let dateToFetch = null;
        if (state.filterByDate && state.availableDates.length > 0) {
            dateToFetch = date || state.availableDates[state.currentDateIndex];
        }

        let candidatesForGrid = allCandidatesMap; // Default is all

        // If specific date requested, filter
        // Note: The API `/candidates?constituency_id=X&date=Y` does the filtering better than client side 
        // if we want to reduce payload, but we just fetched all for summary. 
        // Let's filter client-side to save a request since we have the data, 
        // UNLESS the API returns different join structures.
        // The API returns `posts` array. We can filter that array.

        if (dateToFetch) {
            // Clone to avoid modifying the summary source
            candidatesForGrid = allCandidatesMap.map(c => ({
                ...c,
                posts: c.posts.filter(p => p.published_date === dateToFetch)
            })).filter(c => c.posts.length > 0); // Only show candidates with posts on that date? Or show empty card?
            // Usually show empty card if they exist but no posts, or hide them?
            // "Recent data should be shown".
        } else {
            // "All Dates" behavior: Show everything, latest first.
            // Ensure posts are sorted by date desc
            candidatesForGrid = allCandidatesMap.map(c => ({
                ...c,
                posts: c.posts.sort((a, b) => new Date(b.published_date) - new Date(a.published_date))
            }));
        }

        state.candidates = candidatesForGrid;

        renderCandidateCards();
        updateTimelineUI();
        lucide.createIcons(); // Fix arrows
    } catch (error) {
        showToast('Failed to load candidates', 'error');
        console.error(error);
    }
}

async function loadConstituencyDates(constituencyId) {
    try {
        const dates = await API.get(`/constituency/${constituencyId}/dates`);
        state.availableDates = dates;
        state.currentDateIndex = 0; // Reset to newest

        if (dates.length > 0) {
            elements.timelineSection.style.display = 'block';
        } else {
            elements.timelineSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load dates:', error);
        state.availableDates = [];
        elements.timelineSection.style.display = 'none';
    }
}

function updateTimelineUI() {
    if (state.availableDates.length === 0) {
        elements.timelineSection.style.display = 'none';
        return;
    }

    elements.timelineSection.style.display = 'block';

    // Show "All Dates" when not filtering, otherwise show specific date
    if (!state.filterByDate) {
        elements.currentDateDisplay.textContent = 'All Dates';
        elements.dateStatus.textContent = `${state.availableDates.length} date(s) available - Click arrows to filter`;
        elements.nextDateBtn.disabled = true;
        elements.prevDateBtn.disabled = false; // Allow going to specific dates

        if (elements.viewAllDatesBtn) elements.viewAllDatesBtn.style.display = 'none';

    } else {
        const dateStr = state.availableDates[state.currentDateIndex];
        const dateObj = new Date(dateStr);

        // Format: "Wednesday, Jan 29, 2026"
        elements.currentDateDisplay.textContent = dateObj.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
        });

        // Status text
        if (state.currentDateIndex === 0) {
            elements.dateStatus.textContent = "Latest Data";
            elements.nextDateBtn.disabled = true;
        } else {
            elements.dateStatus.textContent = "Historical Data";
            elements.nextDateBtn.disabled = false;
        }

        // Disable Prev if at end
        if (state.currentDateIndex >= state.availableDates.length - 1) {
            elements.prevDateBtn.disabled = true;
        } else {
            elements.prevDateBtn.disabled = false;
        }

        if (elements.viewAllDatesBtn) elements.viewAllDatesBtn.style.display = 'block';
    }
}

function changeDate(direction) {
    // If currently showing "All Dates" and user clicks prev (older), start filtering from newest
    if (!state.filterByDate && direction === 1) {
        state.filterByDate = true;
        state.currentDateIndex = 0;
        const newDate = state.availableDates[0];
        loadCandidatesByConstituency(state.selectedConstituencyId, newDate, true);
        return;
    }

    // If filtering and user clicks next (newer) at index 0, go back to "All Dates"
    if (state.filterByDate && direction === -1 && state.currentDateIndex === 0) {
        state.filterByDate = false;
        loadCandidatesByConstituency(state.selectedConstituencyId, null, false);
        return;
    }

    const newIndex = state.currentDateIndex + direction; // -1 for next (newer), +1 for prev (older)

    if (newIndex >= 0 && newIndex < state.availableDates.length) {
        state.currentDateIndex = newIndex;
        const newDate = state.availableDates[newIndex];
        loadCandidatesByConstituency(state.selectedConstituencyId, newDate, true);
    }
}

async function searchCandidates(query) {
    if (!query || query.length < 2) {
        if (state.selectedConstituencyId) {
            loadCandidatesByConstituency(state.selectedConstituencyId);
        } else {
            renderEmptyState();
        }
        return;
    }

    try {
        state.candidates = await API.get(`/candidates?search=${encodeURIComponent(query)}`);

        // Transform search results
        state.candidates = state.candidates.map(c => ({
            ...c,
            posts: []
        }));

        // Render Suggestions
        if (elements.searchSuggestions) {
            renderSearchSuggestions(state.candidates);
        }

        renderCandidateCards(true);
        elements.summarySection.style.display = 'none';
    } catch (error) {
        showToast('Search failed', 'error');
        console.error(error);
    }
}

// Helper to define elements.searchBox since we used it in the previous step but it might not be in 'elements' object
// Wait, 'elements' is defined at the top. I need to make sure 'searchBox' is there or use searchInput.parentElement.
// In the previous step I used `elements.searchBox`. Let's add it to the elements object at the top of the file to be safe.

function renderEmptyState() {
    state.candidates = [];
    elements.partyGrid.innerHTML = '';
    elements.partyGrid.appendChild(elements.emptyState.cloneNode(true));
    elements.summarySection.style.display = 'none';

    // Destroy existing charts
    Object.values(state.charts).forEach(chart => chart?.destroy());
    state.charts = {};
}

function renderCandidateCards(isSearchResult = false) {
    // Clear existing
    elements.partyGrid.innerHTML = '';
    Object.values(state.charts).forEach(chart => chart?.destroy());
    state.charts = {};

    // Filter to only show candidates WITH posts (unless search result)
    const candidatesWithPosts = isSearchResult
        ? state.candidates
        : state.candidates.filter(c => c.posts && c.posts.length > 0 && c.posts[0].id);

    if (candidatesWithPosts.length === 0 && !state.selectedConstituencyId) {
        elements.partyGrid.innerHTML = `
            <div class="empty-state">
                <i data-lucide="search-x" style="width: 64px; height: 64px; opacity: 0.5; color: var(--accent-primary);"></i>
                <h3 class="empty-state__title">No Candidates Found</h3>
                <p class="empty-state__subtitle">${isSearchResult ? 'Try modifying your search criteria' : 'Select a constituency to view assessments'}</p>
            </div>
        `;
        lucide.createIcons();
        elements.summarySection.style.display = 'none';
        elements.winnerSection.style.display = 'none';
        return;
    }

    // Render each candidate card (only those with posts)
    candidatesWithPosts.forEach((candidate, index) => {
        const card = createCandidateCard(candidate, index, isSearchResult);
        elements.partyGrid.appendChild(card);
    });

    // Always show "Add More Candidate" card when constituency is selected (Only for Admin)
    const isViewer = localStorage.getItem('userRole') === 'viewer';
    if (!isSearchResult && state.selectedConstituencyId && !isViewer) {
        const constituencyName = elements.constituencySelect.options[elements.constituencySelect.selectedIndex]?.text || '';
        const addCard = document.createElement('div');
        addCard.className = 'party-card add-party-card';
        addCard.innerHTML = `
            <div class="add-party-card__icon"><i data-lucide="plus-circle"></i></div>
            <span class="add-party-card__text">Add Candidate</span>
            <span class="add-party-card__subtext">${constituencyName}</span>
        `;
        addCard.addEventListener('click', () => openCandidateModal());
        elements.partyGrid.appendChild(addCard);
        lucide.createIcons();
    }

    // Show summary if not search result and has candidates
    elements.summarySection.style.display = (isSearchResult || candidatesWithPosts.length === 0) ? 'none' : 'block';
}

function createCandidateCard(candidate, index, isSearchResult) {
    const card = document.createElement('div');
    card.className = 'party-card';
    card.dataset.candidateId = candidate.id;

    const posts = candidate.posts || [];
    const hasPosts = posts.length > 0 && posts[0].id;
    // Calculate aggregated stats across all posts using WEIGHTED AVERAGE
    const stats = calculateWeightedStats(posts);
    const { avgPositive, avgNegative, avgNeutral, totalComments, postCount } = stats;

    // Check role
    const isViewer = localStorage.getItem('userRole') === 'viewer';

    // Build posts list HTML
    const postsListHtml = hasPosts ? posts.filter(p => p.id).map((post, idx) => {
        // Parse popular comments
        let popularComments = [];
        try {
            popularComments = typeof post.popular_comments === 'string'
                ? JSON.parse(post.popular_comments)
                : (post.popular_comments || []);
        } catch (e) {
            popularComments = [];
        }

        const popularCommentsHtml = popularComments.length > 0 ? `
            <div class="popular-comments-section" style="margin-top: 12px; padding: 12px; background: rgba(139, 92, 246, 0.1); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.2);">
                <h5 style="margin: 0 0 10px 0; font-size: 0.85rem; color: #a78bfa; display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="flame" style="width: 14px; height: 14px; color: #f97316;"></i> Popular Comments (${popularComments.length})
                </h5>
                <div class="popular-comments-list" style="max-height: 250px; overflow-y: auto;">
                    ${popularComments.map((c, i) => `
                        <div class="popular-comment" style="padding: 8px 10px; margin-bottom: 6px; background: rgba(255,255,255,0.05); border-radius: 6px; font-size: 0.8rem; line-height: 1.4;">
                            <span style="color: rgba(255,255,255,0.5); font-size: 0.7rem;">#${i + 1}</span>
                            <p style="margin: 4px 0; color: rgba(255,255,255,0.9);">${escapeHtml(c.content.length > 200 ? c.content.substring(0, 200) + '...' : c.content)}</p>
                            <div style="display: flex; gap: 12px; font-size: 0.7rem; color: rgba(255,255,255,0.5);">
                                ${c.likes > 0 ? `<span><i data-lucide="thumbs-up" style="width: 12px; height: 12px;"></i> ${c.likes}</span>` : ''}
                                ${c.replies > 0 ? `<span><i data-lucide="message-circle" style="width: 12px; height: 12px;"></i> ${c.replies}</span>` : ''}
                                ${c.shares > 0 ? `<span><i data-lucide="repeat" style="width: 12px; height: 12px;"></i> ${c.shares}</span>` : ''}
                                ${c.engagement_score > 0 ? `<span style="color: #a78bfa;"><i data-lucide="zap" style="width: 12px; height: 12px;"></i> ${c.engagement_score}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';

        return `
        <div class="post-item ${idx === 0 ? 'post-item--active' : ''}" data-post-index="${idx}">
            <div class="post-item__header" data-post-toggle="${idx}">
                <div class="post-item__info">
                    <span class="post-item__number">#${idx + 1}</span>
                    <span class="post-item__date"><i data-lucide="calendar" style="width: 12px; height: 12px;"></i> ${post.published_date ? formatDate(post.published_date) : 'No date'}</span>
                    ${post.comment_count ? `<span class="post-item__comments"><i data-lucide="message-square" style="width: 12px; height: 12px;"></i> ${post.comment_count.toLocaleString()}</span>` : ''}
                </div>
                <div class="post-item__sentiment-preview">
                    <span class="text-positive">+${post.positive_percentage || 0}%</span>
                    <span class="text-negative">-${post.negative_percentage || 0}%</span>
                    <span class="text-neutral">~${post.neutral_percentage || 0}%</span>
                </div>
                <button class="post-item__toggle" data-post-toggle="${idx}">
                    <i data-lucide="${idx === 0 ? 'chevron-up' : 'chevron-down'}" style="width: 16px; height: 16px;"></i>
                </button>
            </div>
            <div class="post-item__content ${idx === 0 ? 'post-item__content--expanded' : ''}" data-post-content="${idx}">
                ${post.post_url && post.post_url.startsWith('http') ? `
                    <div class="post-item__source">
                        <i data-lucide="link" style="width: 12px; height: 12px;"></i> <a href="#" class="view-source-link" data-url="${escapeHtml(post.post_url)}" style="color: var(--accent-primary);">
                            ${(() => { try { return new URL(post.post_url).hostname; } catch (e) { return 'View Source'; } })()}
                        </a>
                    </div>
                ` : ''}
                <div class="post-item__chart" id="chart-${candidate.id}-${idx}"></div>
                <div class="post-item__actions">
                    <button class="btn btn--small btn--secondary view-remarks" data-remarks="${escapeHtml(post.positive_remarks || '')}" data-type="Positive">
                        <span class="text-positive">Positive</span>
                    </button>
                    <button class="btn btn--small btn--secondary view-remarks" data-remarks="${escapeHtml(post.negative_remarks || '')}" data-type="Negative">
                        <span class="text-negative">Negative</span>
                    </button>
                    <button class="btn btn--small btn--secondary view-remarks" data-remarks="${escapeHtml(post.neutral_remarks || '')}" data-type="Neutral">
                        <span class="text-neutral">Neutral</span>
                    </button>
                </div>
                ${post.conclusion ? `
                    <button class="btn btn--small btn--primary view-conclusion" data-conclusion="${escapeHtml(post.conclusion)}" style="margin-top: 8px; width: 100%;">
                        <i data-lucide="file-text" style="width: 14px; height: 14px;"></i>
                        View Conclusion
                    </button>
                ` : ''}
                ${popularCommentsHtml}
                ${!isViewer ? `
                <button class="btn btn--small btn--danger delete-post-btn" data-post-id="${post.id}" style="margin-top: 8px; width: 100%;">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Delete This Analysis
                </button>
                ` : ''}
            </div>
        </div>
    `;
    }).join('') : '';

    card.innerHTML = `
        <div class="party-card__header">
            <span class="party-card__party-name">${escapeHtml(candidate.party_name)}</span>
            <div class="party-card__actions-top">
                ${!isViewer ? `<button class="btn btn--icon btn--secondary edit-btn" title="Edit Candidate"><i data-lucide="pencil" style="width: 14px; height: 14px;"></i></button>` : ''}
            </div>
        </div>
        <h3 class="party-card__candidate-name">${escapeHtml(candidate.name)}</h3>
        ${isSearchResult && candidate.constituency_name ? `
            <p class="text-muted" style="font-size: 0.75rem; margin-bottom: 0.5rem;">
                ${candidate.constituency_name}, ${candidate.district_name}
            </p>
        ` : ''}
        
        <!-- Summary Stats -->
        <div class="party-card__summary">
            ${hasPosts ? `
                <div class="summary-stats">
                    <div class="summary-stat">
                        <span class="summary-stat__value">${postCount}</span>
                        <span class="summary-stat__label">Post${postCount > 1 ? 's' : ''}</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-stat__value">${totalComments.toLocaleString()}</span>
                        <span class="summary-stat__label">Comments</span>
                    </div>
                    <div class="summary-stat summary-stat--positive">
                        <span class="summary-stat__value text-positive">+${avgPositive.toFixed(0)}%</span>
                        <span class="summary-stat__label">Avg Positive</span>
                    </div>
                    <div class="summary-stat summary-stat--negative">
                        <span class="summary-stat__value text-negative">-${avgNegative.toFixed(0)}%</span>
                        <span class="summary-stat__label">Avg Negative</span>
                    </div>
                </div>
            ` : `
                <div class="party-card__meta-item text-muted">
                    <i data-lucide="info" class="text-muted" style="width: 16px; height: 16px;"></i>
                    <span>No analyses yet - use AI Analyze to add posts</span>
                </div>
            `}
        </div>
        
        <!-- Posts List -->
        ${hasPosts ? `
            <div class="posts-list">
                <div class="posts-list__header">
                    <h4><i data-lucide="bar-chart-3" style="width: 16px; height: 16px;"></i> Analyzed Posts</h4>
                </div>
                ${postsListHtml}
            </div>
        ` : ''}
    `;

    // Render charts for each post (with delay for animation)
    if (hasPosts) {
        posts.filter(p => p.id).forEach((post, idx) => {
            setTimeout(() => {
                const chartEl = document.getElementById(`chart-${candidate.id}-${idx}`);
                if (chartEl) {
                    const chartKey = `${candidate.id}-${idx}`;
                    state.charts[chartKey] = new ApexCharts(chartEl, {
                        chart: {
                            type: 'donut',
                            height: 160,
                            background: 'transparent',
                            animations: { enabled: true, easing: 'easeinout', speed: 600 },
                            events: {
                                dataPointSelection: (event, chartContext, config) => {
                                    const sentiments = ['Positive', 'Negative', 'Neutral'];
                                    const remarks = [
                                        post.positive_remarks || '',
                                        post.negative_remarks || '',
                                        post.neutral_remarks || ''
                                    ];
                                    openRemarksModal(sentiments[config.dataPointIndex], remarks[config.dataPointIndex]);
                                }
                            }
                        },
                        series: [
                            post.positive_percentage || 0,
                            post.negative_percentage || 0,
                            post.neutral_percentage || 0
                        ],
                        labels: ['Positive', 'Negative', 'Neutral'],
                        colors: ['#10b981', '#ef4444', '#6b7280'],
                        legend: { show: false },
                        dataLabels: {
                            enabled: true,
                            formatter: (val) => `${val.toFixed(0)}%`,
                            style: { fontSize: '10px' }
                        },
                        plotOptions: {
                            pie: {
                                donut: {
                                    size: '55%',
                                    labels: { show: false }
                                }
                            }
                        },
                        stroke: { show: false },
                        tooltip: { theme: 'dark' }
                    });
                    state.charts[chartKey].render();
                }
            }, 100 * (index + idx));
        });
    }

    // Post toggle event listeners
    card.querySelectorAll('[data-post-toggle]').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = toggle.dataset.postToggle;
            const content = card.querySelector(`[data-post-content="${idx}"]`);
            const icon = toggle.querySelector('i') || toggle.parentElement.querySelector('.post-item__toggle i');

            if (content) {
                content.classList.toggle('post-item__content--expanded');
                if (icon) {
                    const isExpanded = content.classList.contains('post-item__content--expanded');
                    icon.setAttribute('data-lucide', isExpanded ? 'chevron-up' : 'chevron-down');
                    lucide.createIcons({ node: icon.parentElement });
                }
            }
        });
    });

    // Event listeners - Edit candidate button
    const editBtn = card.querySelector('.edit-btn');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCandidateModal(candidate, posts[0] || {});
        });
    }

    // Delete individual post buttons
    card.querySelectorAll('.delete-post-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const postId = btn.dataset.postId;

            if (confirm(`Delete this analysis? This action cannot be undone.`)) {
                try {
                    await API.delete(`/posts/${postId}`);
                    showToast('Analysis deleted successfully', 'success');
                    loadCandidatesByConstituency(state.selectedConstituencyId);
                } catch (error) {
                    showToast('Failed to delete analysis', 'error');
                }
            }
        });
    });

    // Remarks buttons (percentage buttons)
    card.querySelectorAll('.view-remarks').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const remarks = btn.dataset.remarks;
            const type = btn.dataset.type;
            openRemarksModal(type, remarks);
        });
    });

    // Conclusion buttons
    card.querySelectorAll('.view-conclusion').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const conclusion = btn.dataset.conclusion;
            openRemarksModal('Conclusion', conclusion);
        });
    });

    // Source link click - open in popup window
    card.querySelectorAll('.view-source-link').forEach(sourceLink => {
        sourceLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = sourceLink.dataset.url;
            if (url) {
                const width = 800;
                const height = 600;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;
                window.open(
                    url,
                    'SourcePostPopup',
                    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
                );
            }
        });
    });

    // Initialize Lucide icons in the card
    lucide.createIcons({ node: card });

    return card;
}

// ============================================
// Summary Chart
// ============================================
// ============================================
// Summary Chart
// ============================================
function renderSummaryChart(candidatesData) {
    if (state.charts.summary) {
        state.charts.summary.destroy();
    }

    // Use provided data (ALL TIME) or fallback to state
    const dataSource = candidatesData || state.candidates;

    // Only include candidates with posts
    const candidatesWithPosts = dataSource.filter(c => c.posts && c.posts.length > 0);

    if (candidatesWithPosts.length === 0) {
        elements.summarySection.style.display = 'none';
        elements.winnerSection.style.display = 'none';
        return;
    }

    elements.summarySection.style.display = 'block';

    // --- POPULATE METRICS ---
    let totalPosts = 0;
    let totalComments = 0;

    candidatesWithPosts.forEach(c => {
        c.posts.forEach(p => {
            totalPosts++;
            totalComments += (p.comment_count || 0);
        });
    });

    const summaryMetrics = document.getElementById('summaryMetrics');
    if (summaryMetrics) {
        summaryMetrics.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="background: rgba(16, 185, 129, 0.2); padding: 6px; border-radius: 6px;">
                        <i data-lucide="file-text" style="width: 16px; height: 16px; color: #10b981;"></i>
                    </div>
                    <span style="color: #ccc; font-size: 0.9rem;">Total Posts</span>
                </div>
                <span style="font-size: 1.1rem; font-weight: 600;">${totalPosts}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="background: rgba(245, 158, 11, 0.2); padding: 6px; border-radius: 6px;">
                        <i data-lucide="message-circle" style="width: 16px; height: 16px; color: #f59e0b;"></i>
                    </div>
                    <span style="color: #ccc; font-size: 0.9rem;">Total Comments</span>
                </div>
                <span style="font-size: 1.1rem; font-weight: 600;">${totalComments.toLocaleString()}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="background: rgba(99, 102, 241, 0.2); padding: 6px; border-radius: 6px;">
                        <i data-lucide="users" style="width: 16px; height: 16px; color: #6366f1;"></i>
                    </div>
                    <span style="color: #ccc; font-size: 0.9rem;">Active Candidates</span>
                </div>
                <span style="font-size: 1.1rem; font-weight: 600;">${candidatesWithPosts.length}</span>
            </div>
        `;
        lucide.createIcons({ node: summaryMetrics });
    }

    // --- RENDER CHART ---
    // We want to show the Overall Sentiment Split for the Constituency (Pie/Donut)
    // NOT a bar chart of each candidate (user asked for Summary)

    // Calculate aggregate weighted sentiment
    let totalWeightedPositive = 0;
    let totalWeightedNegative = 0;
    let totalWeightedNeutral = 0;
    let grandTotalComments = 0;

    candidatesWithPosts.forEach(c => {
        const stats = calculateWeightedStats(c.posts);
        // Reverse calculations to get raw weighted sums
        // avg = weightedSum / totalComments
        // weightedSum = avg * totalComments
        totalWeightedPositive += stats.avgPositive * stats.totalComments;
        totalWeightedNegative += stats.avgNegative * stats.totalComments;
        totalWeightedNeutral += stats.avgNeutral * stats.totalComments;
        grandTotalComments += stats.totalComments;
    });

    let series = [0, 0, 0];
    if (grandTotalComments > 0) {
        series = [
            (totalWeightedPositive / grandTotalComments),
            (totalWeightedNegative / grandTotalComments),
            (totalWeightedNeutral / grandTotalComments)
        ];
    } else {
        // Fallback to simple average of averages if no comments
        const count = candidatesWithPosts.length;
        if (count > 0) {
            const sumPos = candidatesWithPosts.reduce((s, c) => s + calculateWeightedStats(c.posts).avgPositive, 0);
            const sumNeg = candidatesWithPosts.reduce((s, c) => s + calculateWeightedStats(c.posts).avgNegative, 0);
            const sumNeu = candidatesWithPosts.reduce((s, c) => s + calculateWeightedStats(c.posts).avgNeutral, 0);
            series = [sumPos / count, sumNeg / count, sumNeu / count];
        }
    }

    state.charts.summary = new ApexCharts(elements.summaryChart, {
        chart: {
            type: 'donut',
            height: 280,
            background: 'transparent',
            fontFamily: 'Inter, sans-serif'
        },
        series: series,
        labels: ['Positive', 'Negative', 'Neutral'],
        colors: ['#10b981', '#ef4444', '#6b7280'],
        legend: {
            position: 'bottom',
            labels: { colors: '#ffffff' }
        },
        dataLabels: {
            enabled: true,
            formatter: function (val) {
                return val.toFixed(1) + "%";
            }
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Overall',
                            color: '#ffffff',
                            formatter: function (w) {
                                return "Sentiment";
                            }
                        }
                    }
                }
            }
        },
        stroke: { show: false },
        tooltip: { theme: 'dark' }
    });

    state.charts.summary.render();

    // Update winner section (optional, keeping it based on filtered content or all time? 
    // Usually Winner should match the grid below, so let's pass state.candidates if available, or just hide it)
    // The previous code passed candidatesWithPosts which is ALL TIME. 
    // Let's stick to ALL TIME for winner too as "Constituency Winner".
    updateWinnerSection(candidatesWithPosts);
}

// ============================================
// Winner Section
// ============================================
function updateWinnerSection(candidatesWithPosts) {
    if (!candidatesWithPosts || candidatesWithPosts.length === 0) {
        elements.winnerSection.style.display = 'none';
        return;
    }

    // Find candidate with highest WEIGHTED positive percentage
    const candidatesWithStats = candidatesWithPosts.map(c => ({
        ...c,
        stats: calculateWeightedStats(c.posts || [])
    }));

    const winner = candidatesWithStats.reduce((best, current) => {
        return current.stats.avgPositive > best.stats.avgPositive ? current : best;
    });

    const winnerStats = winner.stats;
    const post = winner.posts?.[0]; // Still used for remarks

    if (!post) {
        elements.winnerSection.style.display = 'none';
        return;
    }

    // Update winner info with WEIGHTED AVERAGES
    elements.winnerName.textContent = winner.name;
    elements.winnerParty.textContent = winner.party_name;
    elements.winnerPositive.textContent = `${winnerStats.avgPositive.toFixed(0)}%`;
    elements.winnerNegative.textContent = `${winnerStats.avgNegative.toFixed(0)}%`;
    elements.winnerNeutral.textContent = `${winnerStats.avgNeutral.toFixed(0)}%`;

    // Update remarks (from first/latest post)
    elements.winnerPositiveRemarks.textContent = post.positive_remarks || 'No remarks available';
    elements.winnerNegativeRemarks.textContent = post.negative_remarks || 'No remarks available';
    elements.winnerNeutralRemarks.textContent = post.neutral_remarks || 'No remarks available';
    elements.winnerConclusion.textContent = post.conclusion || 'No conclusion available';

    // Render winner chart
    if (state.charts.winner) {
        state.charts.winner.destroy();
    }

    state.charts.winner = new ApexCharts(elements.winnerChart, {
        chart: {
            type: 'donut',
            height: 200,
            background: 'transparent'
        },
        series: [
            winnerStats.avgPositive,
            winnerStats.avgNegative,
            winnerStats.avgNeutral
        ],
        labels: ['Positive', 'Negative', 'Neutral'],
        colors: ['#30d158', '#ff453a', '#8e8e93'],
        plotOptions: {
            pie: {
                donut: {
                    size: '70%',
                    labels: {
                        show: true,
                        name: { show: true, color: '#fff' },
                        value: { show: true, color: '#fff', formatter: (val) => `${val.toFixed(0)}%` },
                        total: {
                            show: true,
                            label: '#1',
                            color: '#ffd700',
                            formatter: () => `${winnerStats.avgPositive.toFixed(0)}%`
                        }
                    }
                }
            }
        },
        legend: { show: false },
        dataLabels: { enabled: false },
        stroke: { width: 0 }
    });

    state.charts.winner.render();
    elements.winnerSection.style.display = 'block';
    lucide.createIcons();
}

// ============================================
// Candidate Modal
// ============================================
async function openCandidateModal(candidate = null, post = null) {
    const isEdit = !!candidate;
    elements.modalTitle.textContent = isEdit ? 'Edit Post Data' : 'Add Post Data';

    // Reset form
    elements.candidateForm.reset();
    elements.candidateId.value = candidate?.id || '';
    elements.postId.value = post?.id || '';
    resetCandidateSelector();

    // Pre-fill location if constituency is selected
    if (state.selectedConstituencyId && !isEdit) {
        // Get current filter values
        elements.modalProvince.value = elements.provinceSelect.value;
        if (elements.provinceSelect.value) {
            await loadDistricts(elements.provinceSelect.value, null, elements.modalDistrict, elements.modalConstituency);
            elements.modalDistrict.value = elements.districtSelect.value;
            elements.modalDistrict.disabled = false;

            if (elements.districtSelect.value) {
                await loadConstituencies(elements.districtSelect.value, elements.modalConstituency);
                elements.modalConstituency.value = state.selectedConstituencyId;
                elements.modalConstituency.disabled = false;

                // Load candidates for the pre-selected constituency
                try {
                    const candidates = await API.get(`/candidates?constituency_id=${state.selectedConstituencyId}`);
                    populateCandidateSelector(candidates);
                } catch (error) {
                    console.error('Failed to load candidates:', error);
                }
            }
        }
    }

    // Fill form if editing
    if (isEdit) {
        elements.candidateName.value = candidate.name || '';
        elements.partyName.value = candidate.party_name || '';
        elements.candidateId.value = candidate.id;
        elements.postUrl.value = post?.post_url || '';
        elements.publishedDate.value = post?.published_date || '';
        elements.positivePercent.value = post?.positive_percentage || 0;
        elements.negativePercent.value = post?.negative_percentage || 0;
        elements.neutralPercent.value = post?.neutral_percentage || 0;
        elements.positiveRemarks.value = post?.positive_remarks || '';
        elements.negativeRemarks.value = post?.negative_remarks || '';
        elements.neutralRemarks.value = post?.neutral_remarks || '';
        elements.conclusion.value = post?.conclusion || '';

        // Pre-select the candidate in dropdown (if loaded)
        if (elements.candidateSelect.querySelector(`option[value="${candidate.id}"]`)) {
            elements.candidateSelect.value = candidate.id;
        }

        // Disable location fields when editing
        elements.modalProvince.disabled = true;
        elements.modalDistrict.disabled = true;
        elements.modalConstituency.disabled = true;
        elements.candidateSelect.disabled = true;
    } else {
        elements.modalProvince.disabled = false;
    }

    elements.candidateModal.classList.add('active');
}

function closeCandidateModal() {
    elements.candidateModal.classList.remove('active');
    elements.candidateForm.reset();
    elements.modalProvince.disabled = false;
    elements.modalDistrict.disabled = true;
    elements.modalConstituency.disabled = true;
    resetCandidateSelector();
}

async function handleCandidateSubmit(e) {
    e.preventDefault();

    const candidateId = elements.candidateId.value;
    const postId = elements.postId.value;
    const selectedCandidateId = elements.candidateSelect.value;

    // Must select a candidate
    if (!candidateId && !selectedCandidateId) {
        showToast('Please select a candidate', 'error');
        return;
    }

    const postData = {
        post_url: elements.postUrl.value.trim(),
        published_date: elements.publishedDate.value,
        positive_percentage: parseFloat(elements.positivePercent.value) || 0,
        negative_percentage: parseFloat(elements.negativePercent.value) || 0,
        neutral_percentage: parseFloat(elements.neutralPercent.value) || 0,
        positive_remarks: elements.positiveRemarks.value.trim(),
        negative_remarks: elements.negativeRemarks.value.trim(),
        neutral_remarks: elements.neutralRemarks.value.trim(),
        conclusion: elements.conclusion.value.trim()
    };

    // Validate percentages
    const total = postData.positive_percentage + postData.negative_percentage + postData.neutral_percentage;
    if (total > 0 && (total < 99 || total > 101)) {
        showToast('Sentiment percentages should add up to 100%', 'error');
        return;
    }

    try {
        const targetCandidateId = candidateId || selectedCandidateId;

        // Capture values BEFORE closing modal (which resets form)
        const modalProvinceId = elements.modalProvince.value;
        const modalDistrictId = elements.modalDistrict.value;
        const modalConstituencyId = elements.modalConstituency.value;
        const currentConstituencyId = state.selectedConstituencyId;

        if (postId) {
            // Update existing post
            await API.put(`/posts/${postId}`, postData);
        } else if (postData.post_url || total > 0) {
            // Create new post for selected candidate
            await API.post('/posts', { ...postData, candidate_id: parseInt(targetCandidateId) });
        } else {
            showToast('Please add post URL or sentiment data', 'error');
            return;
        }

        // Close modal now that we have values
        closeAddSourceModal();

        // Determine where to redirect
        // Logic: specific constituency from modal > current selected > fallback
        const targetConstituencyId = modalConstituencyId || currentConstituencyId;

        if (targetConstituencyId) {
            // If the modal selection is different from current main filters, sync them
            if (modalConstituencyId && (modalConstituencyId !== currentConstituencyId || !currentConstituencyId)) {
                // Sync Province
                if (modalProvinceId) {
                    elements.provinceSelect.value = modalProvinceId;
                    await loadDistricts(modalProvinceId, null, elements.districtSelect, elements.constituencySelect);
                }

                // Sync District
                if (modalDistrictId) {
                    elements.districtSelect.value = modalDistrictId;
                    elements.districtSelect.disabled = false;
                    await loadConstituencies(modalDistrictId, elements.constituencySelect);
                }

                // Sync Constituency
                elements.constituencySelect.value = targetConstituencyId;
                elements.constituencySelect.disabled = false;
            }

            // Update state and load cards
            state.selectedConstituencyId = parseInt(targetConstituencyId);
            await loadCandidatesByConstituency(targetConstituencyId);

            // Auto-scroll to show the cards
            elements.partyGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });

            showToast('Saved successfully', 'success');
        }
    } catch (error) {
        showToast(error.message || 'Failed to save', 'error');
        console.error(error);
    }
}

// ============================================
// Post Preview Modal
// ============================================
function openPostPreview(postUrl) {
    if (!postUrl) {
        showToast('No post URL available', 'error');
        return;
    }

    // Check if it's a valid URL (e.g. not an AI Analysis label)
    try {
        new URL(postUrl);
    } catch (e) {
        showToast('This is an uploaded file analysis, not a web link.', 'info');
        return;
    }

    // Open in a popup window - this works for all Facebook posts
    const width = 800;
    const height = 700;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    const popup = window.open(
        postUrl,
        'PostPreview',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=yes,status=yes`
    );

    if (popup) {
        popup.focus();
        showToast('Post opened in popup window', 'info');
    } else {
        // Popup was blocked, open in new tab instead
        window.open(postUrl, '_blank');
        showToast('Post opened in new tab (popup blocked)', 'info');
    }
}

function closePostPreview() {
    elements.postPreviewModal.classList.remove('active');
    elements.postPreviewIframe.src = '';
    elements.postPreviewLoading.innerHTML = `
        <div class="spinner"></div>
        <p>Loading post...</p>
    `;
    elements.postPreviewLoading.classList.remove('hidden');
}

// ============================================
// Comments Modal
// ============================================
async function openCommentsModal(postId, sentiment) {
    state.currentPostId = postId;
    state.currentSentiment = sentiment;

    const sentimentLabel = sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
    elements.commentsTitle.textContent = `${sentimentLabel} Comments`;
    elements.commentSentiment.value = sentiment;

    try {
        const comments = await API.get(`/posts/${postId}/comments?sentiment=${sentiment}`);
        renderComments(comments);
    } catch (error) {
        showToast('Failed to load comments', 'error');
    }

    elements.commentsModal.classList.add('active');
}

function closeCommentsModal() {
    elements.commentsModal.classList.remove('active');
    state.currentPostId = null;
    state.currentSentiment = null;
}

function renderComments(comments) {
    if (comments.length === 0) {
        elements.commentsList.innerHTML = `
            <div class="empty-state" style="padding: 2rem;">
                <p class="text-muted">No comments yet</p>
            </div>
        `;
        return;
    }

    const isViewer = localStorage.getItem('userRole') === 'viewer';
    elements.commentsList.innerHTML = comments.map(comment => `
        <div class="comment-item comment-item--${comment.sentiment}">
            <p class="comment-item__text">${escapeHtml(comment.content)}</p>
            <div class="comment-item__actions">
                ${!isViewer ? `<button class="btn btn--small btn--danger delete-comment" data-id="${comment.id}">Delete</button>` : ''}
            </div>
        </div>
    `).join('');

    // Add delete handlers
    elements.commentsList.querySelectorAll('.delete-comment').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await API.delete(`/comments/${btn.dataset.id}`);
                showToast('Comment deleted', 'success');
                openCommentsModal(state.currentPostId, state.currentSentiment);
            } catch (error) {
                showToast('Failed to delete comment', 'error');
            }
        });
    });
}

async function addComment() {
    const content = elements.newCommentInput.value.trim();
    if (!content) {
        showToast('Please enter a comment', 'error');
        return;
    }

    try {
        await API.post(`/posts/${state.currentPostId}/comments`, {
            content,
            sentiment: elements.commentSentiment.value
        });

        elements.newCommentInput.value = '';
        showToast('Comment added', 'success');
        openCommentsModal(state.currentPostId, state.currentSentiment);
    } catch (error) {
        showToast('Failed to add comment', 'error');
    }
}

// ============================================
// Remarks Modal
// ============================================
function openRemarksModal(type, content) {
    const colors = {
        'Positive': '#10b981',
        'Negative': '#ef4444',
        'Neutral': '#6b7280',
        'Conclusion': '#8b5cf6'
    };

    elements.remarksTitle.textContent = `${type} Remarks`;
    elements.remarksTitle.style.color = colors[type] || '#ffffff';

    if (content && content.trim()) {
        elements.remarksContent.innerHTML = `
            <div class="remarks-text" style="border-left: 3px solid ${colors[type]}; padding-left: 16px;">
                <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(content)}</p>
            </div>
        `;
    } else {
        elements.remarksContent.innerHTML = `
            <div class="empty-state" style="padding: 24px;">
                <p class="text-muted">No ${type.toLowerCase()} remarks added yet.</p>
            </div>
        `;
    }

    elements.remarksModal.classList.add('active');
}

function closeRemarksModal() {
    elements.remarksModal.classList.remove('active');
}

// ============================================
// Library Functions
// ============================================
let libraryData = [];
let libraryNewsData = [];
let libraryPartiesData = [];

async function showLibraryView() {
    // Determine views
    const dashboard = document.getElementById('dashboard-view');
    const reports = document.getElementById('reports-view');
    const library = document.getElementById('library-view');

    // Hide others, show library
    if (dashboard) dashboard.style.display = 'none';
    if (reports) reports.style.display = 'none';
    if (library) library.style.display = 'block';

    // Update nav active state (if library button exists in nav)
    // Update nav active state (if library button exists in nav)
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('libraryBtn')?.classList.add('active');

    // Load default tab (Candidates) if it's the first time or every time?
    // Original openLibrary called it every time.
    loadCandidatesLibrary();
    lucide.createIcons();
}

function closeLibrary() {
    // Legacy support: go back to dashboard
    showDashboardView();
}

function renderLibraryTable() {
    const dateFilter = elements.libraryDateFilter ? elements.libraryDateFilter.value : '';

    // Filter data
    const filteredData = libraryData.filter(c => {
        if (!dateFilter) return true;
        let recordDate = '';
        if (c.post.published_date) {
            recordDate = c.post.published_date.toString().substring(0, 10);
        }
        return recordDate === dateFilter;
    });

    // Update count
    elements.libraryCount.textContent = `${filteredData.length} record${filteredData.length !== 1 ? 's' : ''}`;

    if (filteredData.length === 0) {
        elements.libraryTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No records found for this date</td></tr>';
        return;
    }

    const isViewer = localStorage.getItem('userRole') === 'viewer';
    elements.libraryTableBody.innerHTML = filteredData.map(candidate => {
        const post = candidate.post;
        return `
            <tr data-candidate-id="${candidate.id}">
                <td>${escapeHtml(candidate.name)}</td>
                <td>${escapeHtml(candidate.party_name)}</td>
                <td>${escapeHtml(candidate.constituency_name || '')}</td>
                <td class="text-positive">${post.positive_percentage}%</td>
                <td class="text-negative">${post.negative_percentage}%</td>
                <td class="text-neutral">${post.neutral_percentage}%</td>
                <td>${post.published_date || '-'}</td>
                <td class="actions-cell">
                    <button class="btn btn--icon btn--secondary export-pdf" title="Export PDF" data-id="${candidate.id}">
                        <i data-lucide="file-text"></i>
                    </button>
                    <button class="btn btn--icon btn--secondary export-excel" title="Export Excel" data-id="${candidate.id}">
                        <i data-lucide="file-spreadsheet"></i>
                    </button>
                    ${!isViewer ? `
                    <button class="btn btn--icon btn--danger delete-library-item" title="Delete" data-id="${candidate.id}">
                        <i data-lucide="trash-2"></i>
                    </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');

    // Initialize icons
    lucide.createIcons();

    // Add event listeners
    // 1. Row Click -> View Candidate
    elements.libraryTableBody.querySelectorAll('tr[data-candidate-id]').forEach(row => {
        row.addEventListener('click', (e) => {
            // Prevent if clicking actual buttons
            if (e.target.closest('button')) return;

            const candidateId = parseInt(row.dataset.candidateId);
            const candidate = libraryData.find(c => c.id === candidateId);
            if (candidate) {
                closeLibrary();
                state.candidates = [{
                    ...candidate,
                    posts: [candidate.post]
                }];
                renderCandidateCards(true);
                state.selectedConstituencyId = null;
                elements.summarySection.style.display = 'none';
                elements.partyGrid.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // 2. Export Actions
    elements.libraryTableBody.querySelectorAll('.export-pdf').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            exportToPDF(parseInt(btn.dataset.id));
        });
    });
    elements.libraryTableBody.querySelectorAll('.export-excel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            exportToExcel(parseInt(btn.dataset.id));
        });
    });

    // 3. Delete Action
    elements.libraryTableBody.querySelectorAll('.delete-library-item').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const candidateId = parseInt(btn.dataset.id);
            const candidate = libraryData.find(c => c.id === candidateId);

            if (confirm(`Are you sure you want to delete the assessment for "${candidate.name}"? This action cannot be undone.`)) {
                try {
                    // We delete the POST, not the candidate (unless you want to delete the candidate entirely?)
                    // The requirement says "delete data from library". 
                    // Usually this means deleting the analysis (post).
                    // If we delete the post, the candidate remains but won't show in library (filter(c => c.post)).

                    if (candidate.post && candidate.post.id) {
                        await API.delete(`/posts/${candidate.post.id}`);
                        showToast('Assessment deleted', 'success');

                        // Refresh library
                        openLibrary();

                        // If this candidate was currently displayed on dashboard, clear it
                        const currentCard = document.querySelector(`.party-card[data-candidate-id="${candidateId}"]`);
                        if (currentCard) {
                            // If we are in "View" mode (single card), go home
                            if (!state.selectedConstituencyId) {
                                goHome();
                            } else {
                                // Reload constituency
                                loadCandidatesByConstituency(state.selectedConstituencyId);
                            }
                        }
                    }
                } catch (error) {
                    showToast('Failed to delete assessment', 'error');
                    console.error(error);
                }
            }
        });
    });
}

async function exportToPDF(candidateId = null) {
    const { jsPDF } = window.jspdf;

    const dataToExport = candidateId
        ? libraryData.filter(c => c.id === candidateId)
        : libraryData;

    if (dataToExport.length === 0) {
        showToast('No data to export', 'error');
        return;
    }

    try {
        showToast('Preparing PDF...', 'info');

        const container = document.getElementById('pdf-export-container');
        container.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.style.marginBottom = '20px';
        header.innerHTML = `
            <h1 style="color: #0a84ff; font-size: 24px; margin-bottom: 5px;">Political Social Media Assessment</h1>
            <p style="color: #333; font-size: 12px; font-weight: 500;">Export Date: ${new Date().toLocaleDateString()}</p>
        `;
        container.appendChild(header);

        // Table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontSize = '10px';
        table.style.color = '#000'; // Explicit black

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr style="background-color: #1c1c1e; color: white;">
                <th style="padding: 8px; text-align: left;">Candidate</th>
                <th style="padding: 8px; text-align: left;">Party</th>
                <th style="padding: 8px; text-align: left;">Constituency</th>
                <th style="padding: 8px; text-align: left;">Positive</th>
                <th style="padding: 8px; text-align: left;">Negative</th>
                <th style="padding: 8px; text-align: left;">Neutral</th>
                <th style="padding: 8px; text-align: left;">Date</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        dataToExport.forEach((c, index) => {
            const tr = document.createElement('tr');
            tr.style.backgroundColor = index % 2 === 0 ? 'white' : '#f5f5f7';
            tr.style.borderBottom = '1px solid #e0e0e0';
            tr.innerHTML = `
                <td style="padding: 8px; color: #000;">${c.name}</td>
                <td style="padding: 8px; color: #000;">${c.party_name}</td>
                <td style="padding: 8px; color: #000;">${c.constituency_name || ''}</td>
                <td style="padding: 8px; color: #000;">${c.post.positive_percentage}%</td>
                <td style="padding: 8px; color: #000;">${c.post.negative_percentage}%</td>
                <td style="padding: 8px; color: #000;">${c.post.neutral_percentage}%</td>
                <td style="padding: 8px; color: #000;">${c.post.published_date || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);

        // Remarks (only if single candidate)
        if (candidateId && dataToExport[0]) {
            const c = dataToExport[0];
            const post = c.post;

            const remarksDiv = document.createElement('div');
            remarksDiv.style.marginTop = '20px';
            remarksDiv.innerHTML = `<h2 style="font-size: 16px; margin-bottom: 10px; color: #000;">Detailed Remarks</h2>`;

            const remarks = [
                { label: 'Positive Remarks', text: post.positive_remarks },
                { label: 'Negative Remarks', text: post.negative_remarks },
                { label: 'Neutral Remarks', text: post.neutral_remarks },
                { label: 'Conclusion', text: post.conclusion }
            ];

            remarks.forEach(r => {
                if (r.text) {
                    const rBlock = document.createElement('div');
                    rBlock.style.marginBottom = '10px';
                    rBlock.innerHTML = `
                        <strong style="color: #222; font-size: 11px;">${r.label}:</strong>
                        <p style="font-size: 10px; margin: 2px 0 0 0; white-space: pre-wrap; color: #000;">${r.text}</p>
                    `;
                    remarksDiv.appendChild(rBlock);
                }
            });
            container.appendChild(remarksDiv);
        }

        // Wait for DOM to render scripts/fonts
        await new Promise(resolve => setTimeout(resolve, 500));

        // Generate Canvas
        const canvas = await html2canvas(container, {
            scale: 2, // Higher scale for better quality
            useCORS: true,
            logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;

        const doc = new jsPDF('p', 'mm', 'a4');
        let position = 0;

        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            doc.addPage();
            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        const outFilename = candidateId
            ? `assessment_${dataToExport[0]?.name?.replace(/\s+/g, '_') || 'candidate'}.pdf`
            : 'all_assessments.pdf';

        doc.save(outFilename);

        // Cleanup
        container.innerHTML = '';

        showToast(`PDF exported successfully`, 'success');

    } catch (error) {
        console.error('PDF Export Error:', error);
        showToast('Failed to export PDF: ' + error.message, 'error');
    }
}

function exportToExcel(candidateId = null) {
    const dataToExport = candidateId
        ? libraryData.filter(c => c.id === candidateId)
        : libraryData;

    if (dataToExport.length === 0) {
        showToast('No data to export', 'error');
        return;
    }

    const wsData = dataToExport.map(c => ({
        'Candidate Name': c.name,
        'Party': c.party_name,
        'Constituency': c.constituency_name || '',
        'Positive %': c.post.positive_percentage,
        'Negative %': c.post.negative_percentage,
        'Neutral %': c.post.neutral_percentage,
        'Published Date': c.post.published_date || '',
        'Post URL': c.post.post_url || '',
        'Positive Remarks': c.post.positive_remarks || '',
        'Negative Remarks': c.post.negative_remarks || '',
        'Neutral Remarks': c.post.neutral_remarks || '',
        'Conclusion': c.post.conclusion || ''
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assessments');

    // Auto-fit columns
    const maxWidth = 50;
    ws['!cols'] = Object.keys(wsData[0] || {}).map(() => ({ wch: maxWidth }));

    const filename = candidateId
        ? `assessment_${dataToExport[0]?.name?.replace(/\s+/g, '_') || 'candidate'}.xlsx`
        : 'all_assessments.xlsx';

    XLSX.writeFile(wb, filename);
    showToast(`Excel exported successfully`, 'success');
}

// ============================================
// Utility Functions
// ============================================
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Debounce for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// ============================================
// Event Listeners
// ============================================
function initEventListeners() {
    // Filter dropdowns - Main filters
    elements.provinceSelect.addEventListener('change', (e) => {
        loadDistricts(e.target.value, null, elements.districtSelect, elements.constituencySelect);
        renderEmptyState();
    });

    elements.districtSelect.addEventListener('change', (e) => {
        loadConstituencies(e.target.value, elements.constituencySelect);
        renderEmptyState();
    });

    elements.constituencySelect.addEventListener('change', (e) => {
        loadCandidatesByConstituency(e.target.value);
    });

    // Modal filter dropdowns
    elements.modalProvince.addEventListener('change', (e) => {
        loadDistricts(e.target.value, null, elements.modalDistrict, elements.modalConstituency);
        resetCandidateSelector();
    });

    elements.modalDistrict.addEventListener('change', (e) => {
        loadConstituencies(e.target.value, elements.modalConstituency);
        resetCandidateSelector();
    });

    // When constituency is selected in modal, load candidates for that constituency
    elements.modalConstituency.addEventListener('change', async (e) => {
        const constituencyId = e.target.value;
        if (!constituencyId) {
            resetCandidateSelector();
            return;
        }

        try {
            const candidates = await API.get(`/candidates?constituency_id=${constituencyId}`);
            populateCandidateSelector(candidates);
        } catch (error) {
            showToast('Failed to load candidates', 'error');
            console.error(error);
        }
    });

    // When candidate is selected, auto-fill name and party
    elements.candidateSelect.addEventListener('change', (e) => {
        const option = e.target.options[e.target.selectedIndex];
        if (option && option.dataset.name) {
            elements.candidateName.value = option.dataset.name;
            elements.partyName.value = option.dataset.party;
            elements.candidateId.value = option.value;

            // Clear post data fields for manual entry
            elements.postId.value = '';
            elements.postUrl.value = '';
            elements.publishedDate.value = '';
            elements.positivePercent.value = 0;
            elements.negativePercent.value = 0;
            elements.neutralPercent.value = 0;
            elements.positiveRemarks.value = '';
            elements.negativeRemarks.value = '';
            elements.neutralRemarks.value = '';
            elements.conclusion.value = '';
        } else {
            elements.candidateName.value = '';
            elements.partyName.value = '';
            elements.candidateId.value = '';
        }
    });

    // Search
    elements.searchSuggestions = document.getElementById('searchSuggestions');

    // Suggestions UI Renderer
    function renderSearchSuggestions(candidates) {
        elements.searchSuggestions.innerHTML = '';
        if (!candidates || candidates.length === 0) {
            elements.searchSuggestions.classList.remove('show');
            return;
        }

        elements.searchSuggestions.classList.add('show');

        // Take top 6 results
        candidates.slice(0, 6).forEach(c => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="suggestion-name">${c.name} (${c.party_name})</span>
                <span class="suggestion-meta">
                    ${c.constituency_name || ''}, ${c.district_name || ''}
                </span>
            `;
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                elements.searchInput.value = c.name; // Fill input with name
                searchCandidates(c.name); // Trigger full search
                elements.searchSuggestions.classList.remove('show');
            });
            elements.searchSuggestions.appendChild(li);
        });
    }

    // Search functionality (only if search box exists)
    if (elements.searchBox && elements.searchInput && elements.searchSuggestions) {
        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!elements.searchBox.contains(e.target)) {
                elements.searchSuggestions.classList.remove('show');
            }
        });

        elements.searchInput.addEventListener('input', debounce((e) => {
            const query = e.target.value;
            searchCandidates(query);
        }, 300));

        // Show suggestions on focus
        elements.searchInput.addEventListener('focus', () => {
            if (elements.searchInput.value.length >= 2) {
                searchCandidates(elements.searchInput.value);
            }
        });
    }

    // Unified Add Source Modal Events
    if (elements.addSourceBtn) {
        elements.addSourceBtn.addEventListener('click', () => openAddSourceModal());
    }
    if (elements.addSourceModalClose) {
        elements.addSourceModalClose.addEventListener('click', closeAddSourceModal);
    }
    if (elements.addSourceModalCancel) {
        elements.addSourceModalCancel.addEventListener('click', closeAddSourceModal);
    }
    if (elements.addSourceModal) {
        elements.addSourceModal.addEventListener('click', (e) => {
            if (e.target === elements.addSourceModal) closeAddSourceModal();
        });
    }

    elements.candidateForm.addEventListener('submit', handleCandidateSubmit);
    elements.newsArticleForm.addEventListener('submit', handleNewsArticleSubmit);
    elements.partyPostForm.addEventListener('submit', handlePartyPostSubmit);

    // Comments modal
    elements.commentsModalClose.addEventListener('click', closeCommentsModal);
    elements.commentsModal.addEventListener('click', (e) => {
        if (e.target === elements.commentsModal) closeCommentsModal();
    });
    elements.addCommentBtn.addEventListener('click', addComment);
    elements.newCommentInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addComment();
    });

    // Remarks modal
    elements.remarksModalClose.addEventListener('click', closeRemarksModal);
    elements.remarksModal.addEventListener('click', (e) => {
        if (e.target === elements.remarksModal) closeRemarksModal();
    });

    // Library View
    elements.libraryBtn.addEventListener('click', showLibraryView);
    // elements.libraryModalClose.addEventListener('click', closeLibrary); // Removed
    // elements.libraryModal.addEventListener('click', (e) => { // Removed
    //     if (e.target === elements.libraryModal) closeLibrary();
    // });
    elements.exportAllExcel.addEventListener('click', () => exportToExcel());
    elements.exportAllPdf.addEventListener('click', () => exportToPDF());

    // AI Modal Events
    elements.aiBtn.addEventListener('click', openAIModal);
    elements.aiModalClose.addEventListener('click', closeAIModal);
    elements.aiModalCancel.addEventListener('click', closeAIModal);
    elements.aiModal.addEventListener('click', (e) => {
        if (e.target === elements.aiModal) closeAIModal();
    });

    // Segmented Control Logic for Add Source Modal
    console.log('Initializing Add Source Modal Segmented Control...');
    if (elements.addSourceTypeContainer) {
        console.log('addSourceTypeContainer found!');
        const addSourceSegmentBtns = elements.addSourceTypeContainer.querySelectorAll('.segment-btn');
        console.log(`Found ${addSourceSegmentBtns.length} segment buttons inside addSourceTypeContainer`);
        addSourceSegmentBtns.forEach((btn, index) => {
            console.log(`Attaching listener to button ${index}: ${btn.dataset.value}`);
            btn.addEventListener('click', () => {
                console.log(`Button clicked: ${btn.dataset.value}`);
                addSourceSegmentBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                handleSourceTypeChange(btn.dataset.value);
            });
        });
    } else {
        console.error('CRITICAL: addSourceTypeContainer NOT found in elements!');
    }

    if (elements.addSourceSubmitBtn) {
        elements.addSourceSubmitBtn.addEventListener('click', async (e) => {
            // Find which form is active and submit it
            if (elements.addSourceCandidateSection.style.display !== 'none') {
                elements.candidateForm.requestSubmit();
            } else if (elements.addSourceNewsSection.style.display !== 'none') {
                elements.newsArticleForm.requestSubmit();
            } else if (elements.addSourcePartySection.style.display !== 'none') {
                elements.partyPostForm.requestSubmit();
            }
        });
    }

    // Segmented Control Logic for AI Source Type
    if (elements.aiSourceTypeContainer) {
        const aiSegmentButtons = elements.aiSourceTypeContainer.querySelectorAll('.segment-btn');
        aiSegmentButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // 1. Visual Update
                aiSegmentButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 2. Data Update
                const type = btn.dataset.value;
                if (elements.aiSourceType) elements.aiSourceType.value = type;

                // 3. Trigger Logic
                handleAnalysisTypeChange(type);
            });
        });
    }



    if (elements.aiForm) {
        elements.aiForm.addEventListener('submit', handleAISubmit);
    }

    // Dashboard Buttons
    if (elements.brandLogoBtn) {
        elements.brandLogoBtn.addEventListener('click', goHome);
    }
    if (elements.homeBtn) {
        elements.homeBtn.addEventListener('click', goHome);
    }

    // Timeline Buttons
    if (elements.prevDateBtn) {
        elements.prevDateBtn.addEventListener('click', () => changeDate(1)); // Older (index + 1)
    }
    if (elements.nextDateBtn) {
        elements.nextDateBtn.addEventListener('click', () => changeDate(-1)); // Newer (index - 1)
    }
    if (elements.viewAllDatesBtn) {
        elements.viewAllDatesBtn.addEventListener('click', () => {
            state.filterByDate = false;
            loadCandidatesByConstituency(state.selectedConstituencyId);
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAddSourceModal();
            closeCommentsModal();
            closeRemarksModal();
            if (typeof closeLibrary === 'function') closeLibrary();
            if (typeof closePostPreview === 'function') closePostPreview();
        }
    });

    // Clear zero on focus for numeric inputs
    if (elements.positivePercent) {
        [elements.positivePercent, elements.negativePercent, elements.neutralPercent].forEach(input => {
            if (!input) return;

            input.addEventListener('focus', (e) => {
                if (e.target.value === '0') {
                    e.target.value = '';
                }
            });

            input.addEventListener('blur', (e) => {
                if (e.target.value === '') {
                    e.target.value = '0';
                }
            });
        });
    }
}



function handleAnalysisTypeChange(type) {
    console.log('Changing AI Analysis type to:', type);
    const candidateSec = elements.aiCandidateSection;
    const newsSec = elements.aiNewsSection;
    const partySec = elements.aiPartySection;

    if (!candidateSec || !newsSec || !partySec) {
        console.error('AI Source sections not found!');
        return;
    }

    candidateSec.style.display = 'none';
    newsSec.style.display = 'none';
    partySec.style.display = 'none';

    if (type === 'candidate') {
        candidateSec.style.display = 'block';
        if (elements.aiProvince) elements.aiProvince.setAttribute('required', '');
        if (elements.aiNewsSelect) elements.aiNewsSelect.removeAttribute('required');
        if (elements.aiPartySelect) elements.aiPartySelect.removeAttribute('required');
    } else if (type === 'news') {
        newsSec.style.display = 'block';
        populateNewsSelectorInAI();
        if (elements.aiProvince) elements.aiProvince.removeAttribute('required');
        if (elements.aiNewsSelect) elements.aiNewsSelect.setAttribute('required', '');
        if (elements.aiPartySelect) elements.aiPartySelect.removeAttribute('required');
    } else if (type === 'party') {
        partySec.style.display = 'block';
        populatePartySelectorInAI();
        if (elements.aiProvince) elements.aiProvince.removeAttribute('required');
        if (elements.aiNewsSelect) elements.aiNewsSelect.removeAttribute('required');
        if (elements.aiPartySelect) elements.aiPartySelect.setAttribute('required', '');
    }
}

// Initial State Check
// if (elements.aiSourceType) handleAnalysisTypeChange(elements.aiSourceType.value);

// AI Form Location Selectors
elements.aiProvince.addEventListener('change', (e) => {
    loadDistricts(e.target.value, null, elements.aiDistrict, elements.aiConstituency);
    resetCandidateSelectorInAI();
});

elements.aiDistrict.addEventListener('change', (e) => {
    loadConstituencies(e.target.value, elements.aiConstituency);
    resetCandidateSelectorInAI();
});

elements.aiConstituency.addEventListener('change', async (e) => {
    const constituencyId = e.target.value;
    if (!constituencyId) {
        resetCandidateSelectorInAI();
        return;
    }
    try {
        const candidates = await API.get(`/candidates?constituency_id=${constituencyId}`);
        populateCandidateSelectorInAI(candidates);
    } catch (error) {
        console.error(error);
    }
});

// File Upload Zone
elements.fileUploadZone.addEventListener('click', () => elements.aiFile.click());
elements.aiFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const count = e.target.files.length;
        elements.fileName.textContent = count === 1 ? e.target.files[0].name : `${count} files selected`;
        elements.fileUploadZone.style.borderColor = '#10b981';
        elements.fileUploadZone.style.background = 'rgba(16, 185, 129, 0.1)';
    }
});

// Drag & Drop
elements.fileUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.fileUploadZone.style.borderColor = '#8b5cf6';
    elements.fileUploadZone.style.background = 'rgba(139, 92, 246, 0.1)';
});

elements.fileUploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    elements.fileUploadZone.style.borderColor = 'rgba(255,255,255,0.2)';
    elements.fileUploadZone.style.background = 'transparent';
});

elements.fileUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.fileUploadZone.style.borderColor = '#10b981';
    elements.fileUploadZone.style.background = 'rgba(16, 185, 129, 0.1)';

    if (e.dataTransfer.files.length > 0) {
        elements.aiFile.files = e.dataTransfer.files;
        const count = e.dataTransfer.files.length;
        elements.fileName.textContent = count === 1 ? e.dataTransfer.files[0].name : `${count} files selected`;
    }
});

elements.aiForm.addEventListener('submit', handleAISubmit);

// Post Preview modal
elements.postPreviewModalClose.addEventListener('click', closePostPreview);
elements.postPreviewModal.addEventListener('click', (e) => {
    if (e.target === elements.postPreviewModal) closePostPreview();
});

// Library Filter
elements.libraryDateFilter.addEventListener('change', (e) => {
    if (e.target.value) {
        elements.clearLibraryFilter.style.display = 'flex';
    } else {
        elements.clearLibraryFilter.style.display = 'none';
    }

    // Reload current active tab
    const activeTab = document.querySelector('.library-tab.active')?.dataset.tab || 'candidates';
    if (activeTab === 'candidates') {
        loadCandidatesLibrary();
    } else if (activeTab === 'news') {
        loadNewsMediaLibrary();
    } else if (activeTab === 'parties') {
        loadPartiesLibrary();
    }
});

elements.clearLibraryFilter.addEventListener('click', () => {
    elements.libraryDateFilter.value = '';
    elements.clearLibraryFilter.style.display = 'none';

    // Reload current active tab to fetch all data
    const activeTab = document.querySelector('.library-tab.active')?.dataset.tab || 'candidates';
    if (activeTab === 'candidates') {
        loadCandidatesLibrary();
    } else if (activeTab === 'news') {
        loadNewsMediaLibrary();
    } else if (activeTab === 'parties') {
        loadPartiesLibrary();
    }
});

// Home button (header brand)
elements.homeBtn.addEventListener('click', goHome);

// Timeline Buttons
elements.prevDateBtn.addEventListener('click', () => changeDate(1)); // Older (index + 1)
elements.nextDateBtn.addEventListener('click', () => changeDate(-1)); // Newer (index - 1)

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAddSourceModal();
        closeCommentsModal();
        closeRemarksModal();
        closeLibrary();
        closePostPreview();
    }
});

// Clear zero on focus for numeric inputs
[elements.positivePercent, elements.negativePercent, elements.neutralPercent].forEach(input => {
    if (!input) return;

    input.addEventListener('focus', (e) => {
        if (e.target.value === '0') {
            e.target.value = '';
        }
    });

    input.addEventListener('blur', (e) => {
        if (e.target.value === '') {
            e.target.value = '0';
        }
    });
});

// ============================================
// Recent Constituencies
// ============================================
async function loadRecentConstituencies() {
    try {
        // User requested customization: Static list of locations
        // Note: Sarlahi 6 requested but DB only has up to 4. Using Sarlahi 4.
        const staticConstituencies = [
            { constituency_id: 171, province_id: 1, district_id: 4, district_name: "Jhapa", constituency_name: "Constituency No. 5" },
            { constituency_id: 228, province_id: 3, district_id: 30, district_name: "Kathmandu", constituency_name: "Constituency No. 9" },
            { constituency_id: 255, province_id: 3, district_id: 35, district_name: "Chitwan", constituency_name: "Constituency No. 3" },
            { constituency_id: 254, province_id: 3, district_id: 35, district_name: "Chitwan", constituency_name: "Constituency No. 2" },
            { constituency_id: 253, province_id: 3, district_id: 35, district_name: "Chitwan", constituency_name: "Constituency No. 1" },
            { constituency_id: 214, province_id: 2, district_id: 19, district_name: "Sarlahi", constituency_name: "Constituency No. 4" }
        ];

        const constituencies = staticConstituencies;

        if (constituencies && constituencies.length > 0) {
            elements.recentTags.innerHTML = constituencies.map(c => {
                // Abbreviate "Constituency No." to just the number for cleaner UI
                const shortName = c.constituency_name
                    .replace('Constituency No.', '')
                    .replace('Constituency', '')
                    .replace('निर्वाचन क्षेत्र नं.', '')
                    .replace('निर्वाचन क्षेत्र', '')
                    .replace('#', '')
                    .trim();

                return `
                <div class="recent-tag" onclick="openRecentConstituency(${c.constituency_id}, ${c.province_id}, ${c.district_id})" style="display: inline-flex; align-items: center; gap: 6px;">
                    <span>${c.district_name}, ${shortName}</span>
                </div>
            `}).join('');

            elements.recentConstituencies.style.display = 'block';
            lucide.createIcons();
        } else {
            elements.recentConstituencies.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load recent constituencies:', error);
    }
}

async function openRecentConstituency(constituencyId, provinceId, districtId) {
    try {
        // 1. Set Province
        elements.provinceSelect.value = provinceId;

        // 2. Load Districts
        // Passing null for targetSelect as it seems unused in loadDistricts based on review
        await loadDistricts(provinceId, null, elements.districtSelect, elements.constituencySelect);

        // 3. Set District
        elements.districtSelect.value = districtId;
        elements.districtSelect.disabled = false;

        // 4. Load Constituencies
        await loadConstituencies(districtId, elements.constituencySelect);

        // 5. Set Constituency
        elements.constituencySelect.value = constituencyId;
        elements.constituencySelect.disabled = false;

        // 6. Load Candidates
        state.selectedConstituencyId = constituencyId;
        loadCandidatesByConstituency(constituencyId);

        // Show success toast
        showToast('Loaded recent constituency', 'success');
    } catch (error) {
        console.error('Failed to open recent constituency:', error);
        showToast('Failed to load constituency data', 'error');
    }
}

// ============================================
// AI Analysis Modal
// ============================================

function resetCandidateSelectorInAI() {
    elements.aiCandidateSelect.innerHTML = '<option value="">-- Select a Candidate --</option>';
    elements.aiCandidateSelect.disabled = true;
}

function populateCandidateSelectorInAI(candidates) {
    elements.aiCandidateSelect.innerHTML = '<option value="">-- Select a Candidate --</option>';

    const sorted = [...candidates].sort((a, b) => {
        const partyCompare = (a.party_name || '').localeCompare(b.party_name || '', 'ne');
        if (partyCompare !== 0) return partyCompare;
        return (a.name || '').localeCompare(b.name || '', 'ne');
    });

    let currentParty = null;
    sorted.forEach(candidate => {
        if (candidate.party_name !== currentParty) {
            currentParty = candidate.party_name;
            const groupOption = document.createElement('option');
            groupOption.disabled = true;
            groupOption.textContent = `── ${currentParty || 'स्वतन्त्र'} ──`;
            elements.aiCandidateSelect.appendChild(groupOption);
        }

        const option = document.createElement('option');
        option.value = candidate.id;
        option.textContent = `  ${candidate.name}`;
        elements.aiCandidateSelect.appendChild(option);
    });

    elements.aiCandidateSelect.disabled = false;
}

async function openAddSourceModal(type = 'candidate') {
    elements.candidateForm.reset();
    elements.newsArticleForm.reset();
    elements.partyPostForm.reset();

    // Reset segmented control
    const candidateBtn = elements.addSourceTypeContainer.querySelector('.segment-btn[data-value="candidate"]');
    if (candidateBtn) candidateBtn.click();

    // Common reset for candidate form
    elements.modalProvince.value = '';
    resetSelect(elements.modalDistrict, 'Select District');
    resetSelect(elements.modalConstituency, 'Select Constituency');
    elements.candidateSelect.innerHTML = '<option value="">-- Select a Candidate --</option>';
    elements.candidateSelect.disabled = true;

    // Load provinces for candidate form
    await populateSelect(elements.modalProvince, state.provinces, 'name_en');

    elements.addSourceModal.classList.add('active');
}

function closeAddSourceModal() {
    elements.addSourceModal.classList.remove('active');
}

function handleSourceTypeChange(type) {
    console.log('--- handleSourceTypeChange triggered ---');
    console.log('Type:', type);

    if (!elements.addSourceCandidateSection || !elements.addSourceNewsSection || !elements.addSourcePartySection) {
        console.error('CRITICAL: Add Source sections not found in elements object!');
        console.log('Sections state:', {
            candidate: !!elements.addSourceCandidateSection,
            news: !!elements.addSourceNewsSection,
            party: !!elements.addSourcePartySection
        });
        return;
    }

    // Hide all
    elements.addSourceCandidateSection.style.display = 'none';
    elements.addSourceNewsSection.style.display = 'none';
    elements.addSourcePartySection.style.display = 'none';

    // Show selected
    if (type === 'candidate') {
        console.log('Showing Candidate Section');
        elements.addSourceCandidateSection.style.display = 'block';
        if (elements.addSourceSubmitBtn) elements.addSourceSubmitBtn.style.background = 'var(--accent-primary)';
    } else if (type === 'news') {
        console.log('Showing News Section');
        elements.addSourceNewsSection.style.display = 'block';
        if (elements.addSourceSubmitBtn) elements.addSourceSubmitBtn.style.background = 'linear-gradient(135deg, #F59E0B, #D97706)';
        populateNewsSourceSelect();
    } else if (type === 'party') {
        console.log('Showing Party Section');
        elements.addSourcePartySection.style.display = 'block';
        if (elements.addSourceSubmitBtn) elements.addSourceSubmitBtn.style.background = 'linear-gradient(135deg, #8B5CF6, #7C3AED)';
        populatePartySelect();
    }
}

async function populateNewsSourceSelect() {
    try {
        const sources = await API.get('/news-media');
        elements.newsSourceSelect.innerHTML = '<option value="">-- Select or Add New --</option><option value="new">+ Add New News Source</option>';
        sources.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name_en || s.name_np || s.name;
            elements.newsSourceSelect.appendChild(opt);
        });
    } catch (e) { console.error('Failed to load news sources', e); }
}

async function populatePartySelect() {
    try {
        const parties = await API.get('/parties');
        elements.partySelect.innerHTML = '<option value="">-- Select or Add New --</option><option value="new">+ Add New Party</option>';
        parties.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name_en || p.name_np || p.name || p.abbreviation;
            elements.partySelect.appendChild(opt);
        });
    } catch (e) { console.error('Failed to load parties', e); }
}

async function openAIModal() {
    elements.aiForm.reset();

    // Reset to "Candidate" view using the segmented control
    const candidateBtn = document.querySelector('.segment-btn[data-value="candidate"]');
    if (candidateBtn) {
        candidateBtn.click();
    } else {
        // Fallback if elements aren't initialized
        elements.aiSourceType.value = 'candidate';
    }

    elements.aiProvince.value = '';
    resetSelect(elements.aiDistrict, 'Select District');
    resetSelect(elements.aiConstituency, 'Select Constituency');

    elements.aiCandidateSelect.innerHTML = '<option value="">-- Select a Candidate --</option>';
    elements.aiCandidateSelect.disabled = true;

    elements.fileName.textContent = 'Click to browse or drag up to 10 files here';
    elements.fileUploadZone.classList.remove('has-file');
    elements.fileUploadZone.style.borderColor = 'rgba(255,255,255,0.2)';
    elements.fileUploadZone.style.background = 'transparent';
    elements.aiLoading.style.display = 'none';
    elements.aiSubmitBtn.disabled = false;

    // Load provinces
    await populateSelect(elements.aiProvince, state.provinces, 'name_en');

    elements.aiModal.classList.add('active');
}

async function populateNewsSelectorInAI() {
    try {
        const sources = await API.get('/news-media');
        elements.aiNewsSelect.innerHTML = '<option value="">-- Select News Source --</option>';
        sources.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name_en || s.name_np;
            elements.aiNewsSelect.appendChild(opt);
        });
        // Add "Other" option
        const otherOpt = document.createElement('option');
        otherOpt.value = 'other';
        otherOpt.textContent = 'Other (Add New)';
        otherOpt.style.fontWeight = 'bold';
        otherOpt.style.color = '#ffd700';
        elements.aiNewsSelect.appendChild(otherOpt);
    } catch (e) { console.error('Failed to load news sources', e); }
}

async function populatePartySelectorInAI() {
    try {
        const parties = await API.get('/parties');
        elements.aiPartySelect.innerHTML = '<option value="">-- Select Political Party --</option>';
        elements.aiNewsPartySelect.innerHTML = '<option value="">-- Select Related Party --</option>';
        parties.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name_en || p.name_np || p.abbreviation;
            elements.aiPartySelect.appendChild(opt);
            elements.aiNewsPartySelect.appendChild(opt.cloneNode(true));
        });
    } catch (e) { console.error('Failed to load parties', e); }
}

function closeAIModal() {
    if (elements.aiLoading.style.display === 'block') return; // Prevent closing while loading
    elements.aiModal.classList.remove('active');

    // Reset the source URL field
    if (elements.aiSourceUrl) {
        elements.aiSourceUrl.value = '';
    }
}

async function handleAISubmit(e) {
    e.preventDefault();

    const sourceType = elements.aiSourceType ? elements.aiSourceType.value : 'candidate';
    const files = elements.aiFile.files;

    // Validate based on type
    if (sourceType === 'candidate' && !elements.aiCandidateSelect.value) {
        showToast('Please select a candidate', 'error');
        return;
    }

    if (files.length === 0) {
        showToast('Please upload at least one file', 'error');
        return;
    }

    if (files.length > 10) {
        showToast('Maximum 10 files allowed', 'error');
        return;
    }

    // Show loading state
    elements.aiLoading.style.display = 'block';
    elements.aiSubmitBtn.disabled = true;

    const formData = new FormData();
    // sourceType is already defined at the top of the function

    // Add source identifier based on type
    if (sourceType === 'candidate') {
        const candidateId = elements.aiCandidateSelect.value;
        if (!candidateId) { showToast('Please select a candidate', 'error'); elements.aiLoading.style.display = 'none'; elements.aiSubmitBtn.disabled = false; return; }
        formData.append('candidate_id', candidateId);
        formData.append('source_type', 'candidate');
    } else if (sourceType === 'news') {
        let newsId = elements.aiNewsSelect.value;

        // Handle "Other" news source creation
        if (newsId === 'other') {
            const newSourceName = document.getElementById('aiRecNewsSourceName')?.value?.trim();
            if (!newSourceName) {
                showToast('Please enter the new news media name', 'error');
                elements.aiLoading.style.display = 'none';
                elements.aiSubmitBtn.disabled = false;
                return;
            }

            try {
                // Create new source on the fly
                const res = await fetch('/api/news-media', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ name_en: newSourceName })
                });

                if (!res.ok) throw new Error('Failed to create new news source');
                const newSource = await res.json();
                newsId = newSource.id;

                // Refresh list for next time (optional but good UI)
                await populateNewsSelectorInAI();
            } catch (err) {
                showToast('Failed to create new news source: ' + err.message, 'error');
                elements.aiLoading.style.display = 'none';
                elements.aiSubmitBtn.disabled = false;
                return;
            }
        }

        if (!newsId) { showToast('Please select a news source', 'error'); elements.aiLoading.style.display = 'none'; elements.aiSubmitBtn.disabled = false; return; }
        formData.append('news_media_id', newsId);
        formData.append('source_type', 'news_media');

        // Related party is now REQUIRED for news media
        const relatedPartyId = elements.aiNewsPartySelect.value;
        if (!relatedPartyId) {
            showToast('Please select which political party this article discusses', 'error');
            elements.aiLoading.style.display = 'none';
            elements.aiSubmitBtn.disabled = false;
            return;
        }
        formData.append('related_party_id', relatedPartyId);
    } else if (sourceType === 'party') {
        const partyId = elements.aiPartySelect.value;
        if (!partyId) { showToast('Please select a political party', 'error'); elements.aiLoading.style.display = 'none'; elements.aiSubmitBtn.disabled = false; return; }
        formData.append('political_party_id', partyId);
        formData.append('source_type', 'political_party');
    }

    // Add source URL if provided
    const sourceUrl = elements.aiSourceUrl?.value?.trim();
    if (sourceUrl) {
        formData.append('source_url', sourceUrl);
    }

    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    try {
        const response = await fetch('/api/ai-analyze', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        // Handle duplicate URL warning
        if (response.status === 409 && data.error === 'duplicate_url') {
            elements.aiLoading.style.display = 'none';
            elements.aiSubmitBtn.disabled = false;

            const confirmReanalyze = confirm(
                `⚠️ This post URL has already been analyzed for this candidate.\n\n` +
                `Previous analysis date: ${data.existingDate || 'Unknown'}\n\n` +
                `Do you want to delete the previous analysis and run a new one?`
            );

            if (confirmReanalyze) {
                // Re-submit with force flag
                formData.append('force_reanalyze', 'true');
                elements.aiLoading.style.display = 'block';
                elements.aiSubmitBtn.disabled = true;

                const retryResponse = await fetch('/api/ai-analyze', {
                    method: 'POST',
                    body: formData
                });

                const retryData = await retryResponse.json();

                if (!retryResponse.ok) {
                    throw new Error(retryData.error || 'Analysis failed');
                }

                const commentCount = retryData.commentCount || 0;
                showToast(`Re-analysis complete! ${commentCount.toLocaleString()} comments analyzed.`, 'success');
            } else {
                showToast('Analysis cancelled - using existing results', 'info');
                return;
            }
        } else if (!response.ok) {
            throw new Error(data.error || 'Analysis failed');
        } else {
            // Show comment count in success message
            const commentCount = data.commentCount || 0;
            showToast(`Analysis complete! ${commentCount.toLocaleString()} comments analyzed.`, 'success');
        }

        // Reset loading state BEFORE closing to bypass the guard clause in closeAIModal
        elements.aiLoading.style.display = 'none';
        elements.aiSubmitBtn.disabled = false;

        closeAIModal();

        // Auto-navigate to the result
        const provinceId = elements.aiProvince.value;
        const districtId = elements.aiDistrict.value;
        const constituencyId = elements.aiConstituency.value;

        // Update main filters
        elements.provinceSelect.value = provinceId;
        await loadDistricts(provinceId, null, elements.districtSelect, elements.constituencySelect);
        elements.districtSelect.value = districtId;
        elements.districtSelect.disabled = false;
        await loadConstituencies(districtId, elements.constituencySelect);
        elements.constituencySelect.value = constituencyId;
        elements.constituencySelect.disabled = false;

        // Load candidates
        state.selectedConstituencyId = constituencyId;
        await loadCandidatesByConstituency(constituencyId);

    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
        elements.aiLoading.style.display = 'none';
        elements.aiSubmitBtn.disabled = false;
    }
}

// ============================================
// Initialize App
// ============================================
async function init() {
    console.log('🚀 Political Social Media Assessment - Initializing...');
    initEventListeners();
    await loadProvinces();
    await loadRecentConstituencies();
    initLibraryTabs();
    initDailyReports();
    console.log('✅ App ready!');
}

// ============================================
// Add Source Dropdown
// ============================================
function initAddSourceDropdown() {
    const btn = document.getElementById('addSourceBtn');
    const menu = document.getElementById('addSourceMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        if (menu) menu.classList.remove('show');
    });

    // News Article button
    document.getElementById('addNewsArticleBtn')?.addEventListener('click', () => {
        menu.classList.remove('show');
        openNewsArticleModal();
    });

    // Party Post button
    document.getElementById('addPartyPostBtn')?.addEventListener('click', () => {
        menu.classList.remove('show');
        openPartyPostModal();
    });

    // Candidate Post button
    document.getElementById('addCandidateBtn')?.addEventListener('click', () => {
        menu.classList.remove('show');
        // openCandidateModal is attached in initEventListeners, 
        // but verify if that listener triggers if elements are cached on init
    });
}

// ============================================
// Library Tabs
// ============================================
function initLibraryTabs() {
    document.querySelectorAll('.library-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update tab styles
            document.querySelectorAll('.library-tab').forEach(t => {
                t.style.color = '#999';
                t.style.borderBottom = '2px solid transparent';
                t.classList.remove('active');
            });
            tab.style.color = '#10B981';
            tab.style.borderBottom = '2px solid #10B981';
            tab.classList.add('active');

            // Show corresponding content
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
            });

            if (tabName === 'candidates') {
                document.getElementById('tabCandidates').style.display = 'block';
                loadCandidatesLibrary();
            } else if (tabName === 'news') {
                document.getElementById('tabNews').style.display = 'block';
                loadNewsMediaLibrary();
            } else if (tabName === 'parties') {
                document.getElementById('tabParties').style.display = 'block';
                loadPartiesLibrary();
            }
        });
    });

    // Add News Source / Party buttons in library
    document.getElementById('addNewsMediaBtn')?.addEventListener('click', () => {
        openNewsArticleModal();
    });

    document.getElementById('addPartyBtn')?.addEventListener('click', () => {
        openPartyPostModal();
    });

    document.getElementById('addCandidateLibraryBtn')?.addEventListener('click', () => {
        openAddSourceModal('candidate');
    });
}

// ============================================
// Candidates Library Load (New)
// ============================================
async function loadCandidatesLibrary() {
    // Check if library view is active
    if (!elements.libraryView || elements.libraryView.style.display === 'none') return;

    elements.libraryLoading = true; // Optional flag

    try {
        const date = elements.libraryDateFilter ? elements.libraryDateFilter.value : '';
        const url = `/library/candidates${date ? '?date=' + date : ''}`;

        // Use the Updated Endpoint
        const candidates = await API.get(url);

        // Sort by date descending (Newest first)
        libraryData = candidates
            .filter(c => c.post)
            .sort((a, b) => new Date(b.post.published_date || 0) - new Date(a.post.published_date || 0));

        renderLibraryTable(); // Render using the data

    } catch (error) {
        console.error('Failed to load candidates library:', error);
        showToast('Failed to load candidates', 'error');
        elements.libraryTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #666;">Failed to load</td></tr>';
    }
}

// ============================================
// News Media Library Load
// ============================================
async function loadNewsMediaLibrary() {
    const tbody = document.getElementById('newsTableBody');
    const empty = document.getElementById('newsEmpty');
    const count = document.getElementById('newsCount');
    if (!tbody) return;

    try {
        const date = elements.libraryDateFilter ? elements.libraryDateFilter.value : '';
        // Use unified library endpoint which supports date
        const url = `/library/news-media${date ? '?date=' + date : ''}`;

        const response = await fetch(`/api${url}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (!response.ok) throw new Error('Failed to load news media');

        const data = await response.json();
        // Store for export
        libraryNewsData = data;

        count.textContent = `${data.length || 0} sources`;

        if (!data || data.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        // Sort by post count or recent activity? 
        // News media usually don't have a single "published_date" field on the source itself, 
        // but the table shows 'Source Name', 'Posts', 'Sentiments'.
        // It doesn't show "Date".
        // Wait, the table columns are: Source Name, Posts, Pos, Neg, Neu, Actions.
        // It does NOT show date.
        // So sorting by date is not visible, but maybe consistent?
        // Let's sort by Post Count descending? Or Name?
        // User asked to "short all of them by date".
        // If I filter by date, the data returned IS for that date range.
        // But News Media is an aggregate (Source).
        // The endpoint returns Sources with aggregate sentiment FOR that date range.
        // So sorting by Sentiment or Post Count makes sense.
        // I will sort by Post Count descending.
        data.sort((a, b) => (b.posts_count || 0) - (a.posts_count || 0));

        empty.style.display = 'none';
        tbody.innerHTML = data.map(n => `
            <tr>
                <td>${escapeHtml(n.name_en || n.name_np || 'N/A')}</td>
                <td>${n.posts_count || 0}</td>
                <td class="sentiment-positive">${(n.avg_positive || 0).toFixed(1)}%</td>
                <td class="sentiment-negative">${(n.avg_negative || 0).toFixed(1)}%</td>
                <td class="sentiment-neutral">${(n.avg_neutral || 0).toFixed(1)}%</td>
                <td>
                    <button class="btn btn--icon btn--small" onclick="viewNewsDetails(${n.id})" title="View">
                        <i data-lucide="eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        lucide?.createIcons();
    } catch (error) {
        console.error('Error loading news media:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">Failed to load</td></tr>';
    }
}

// ============================================
// Political Parties Library Load
// ============================================
async function loadPartiesLibrary() {
    const tbody = document.getElementById('partiesTableBody');
    const empty = document.getElementById('partiesEmpty');
    const count = document.getElementById('partiesCount');
    if (!tbody) return;

    try {
        const date = elements.libraryDateFilter ? elements.libraryDateFilter.value : '';
        // Use unified library endpoint which supports date
        const url = `/library/parties${date ? '?date=' + date : ''}`;

        const response = await fetch(`/api${url}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (!response.ok) throw new Error('Failed to load parties');

        const data = await response.json();
        // Store for export
        libraryPartiesData = data;

        count.textContent = `${data.length || 0} parties`;

        if (!data || data.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        // Sort by Post Count descending
        data.sort((a, b) => (b.posts_count || 0) - (a.posts_count || 0));

        empty.style.display = 'none';
        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${escapeHtml(p.name_en || p.name_np || 'N/A')}</td>
                <td>${escapeHtml(p.abbreviation || '-')}</td>
                <td>${p.posts_count || 0}</td>
                <td class="sentiment-positive">${(p.avg_positive || 0).toFixed(1)}%</td>
                <td class="sentiment-negative">${(p.avg_negative || 0).toFixed(1)}%</td>
                <td class="sentiment-neutral">${(p.avg_neutral || 0).toFixed(1)}%</td>
                <td>
                    <button class="btn btn--icon btn--small" onclick="viewPartyDetails(${p.id})" title="View">
                        <i data-lucide="eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        lucide?.createIcons();
    } catch (error) {
        console.error('Error loading parties:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666;">Failed to load</td></tr>';
    }
}

// ============================================
// Source Detail Modal Functions
// ============================================

/**
 * View News Media Details
 */
async function viewNewsDetails(newsMediaId) {
    const modal = document.getElementById('sourceDetailModal');
    const loading = document.getElementById('sourceDetailLoading');
    const content = document.getElementById('sourceDetailContent');
    const nameEl = document.getElementById('sourceDetailName');
    const postsContainer = document.getElementById('sourceDetailPosts');
    const emptyState = document.getElementById('sourceDetailEmpty');

    // Show modal with loading state
    modal.classList.add('active');
    loading.style.display = 'block';
    content.style.display = 'none';

    try {
        // Fetch news media details
        const response = await fetch(`/api/news-media/${newsMediaId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch news media');
        const newsMedia = await response.json();

        // Fetch posts for this news source
        const postsResponse = await fetch(`/api/news-media/${newsMediaId}/posts`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        const posts = postsResponse.ok ? await postsResponse.json() : [];

        // Calculate sentiment averages
        const sentiment = calculateSourceSentiment(posts);

        // Update UI
        nameEl.textContent = newsMedia.name_en || newsMedia.name_np || 'News Media';
        document.getElementById('detailPostCount').textContent = posts.length;
        document.getElementById('detailPositive').textContent = sentiment.avg_positive.toFixed(1) + '%';
        document.getElementById('detailNegative').textContent = sentiment.avg_negative.toFixed(1) + '%';
        document.getElementById('detailNeutral').textContent = sentiment.avg_neutral.toFixed(1) + '%';

        // Render posts list with comments summary
        if (posts.length > 0) {
            // Calculate total comments
            const totalComments = posts.reduce((sum, p) => sum + (p.comment_count || 0), 0);
            document.getElementById('detailPostCount').textContent = `${posts.length} (${totalComments.toLocaleString()} comments)`;

            postsContainer.innerHTML = posts.map(post => {
                // Summary paragraph from content field
                const summaryHtml = post.content ? `
                    <div style="margin-top: 12px; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.2);">
                        <h5 style="margin: 0 0 8px 0; font-size: 0.85rem; color: #60A5FA; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="file-text" style="width: 14px; height: 14px;"></i>
                            Analysis Summary
                        </h5>
                        <p style="margin: 0; font-size: 0.85rem; color: rgba(255,255,255,0.85); line-height: 1.5;">${escapeHtml(post.content)}</p>
                    </div>
                ` : '';

                return `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="color: #a0a0b0; font-size: 0.8rem;">
                                ${post.published_date ? new Date(post.published_date).toLocaleDateString() : 'No date'}
                            </span>
                            ${post.comment_count ? `<span style="color: #8B5CF6; font-size: 0.75rem;"><i data-lucide="message-square" style="width: 12px; height: 12px;"></i> ${post.comment_count.toLocaleString()} comments</span>` : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <span style="color: #10B981; font-size: 0.8rem;">${(post.positive_percentage || 0).toFixed(1)}%</span>
                            <span style="color: #EF4444; font-size: 0.8rem;">${(post.negative_percentage || 0).toFixed(1)}%</span>
                            <span style="color: #9CA3AF; font-size: 0.8rem;">${(post.neutral_percentage || 0).toFixed(1)}%</span>
                        </div>
                    </div>
                    ${post.post_url ? `<a href="${escapeHtml(post.post_url)}" target="_blank" style="color: #3B82F6; font-size: 0.85rem; word-break: break-all;">View Post →</a>` : ''}
                    ${summaryHtml}
                </div>
            `}).join('');
            emptyState.style.display = 'none';
        } else {
            postsContainer.innerHTML = '';
            emptyState.style.display = 'block';
        }

        loading.style.display = 'none';
        content.style.display = 'block';
        lucide?.createIcons();

    } catch (error) {
        console.error('Error viewing news details:', error);
        showToast('Failed to load news media details', 'error');
        modal.classList.remove('active');
    }
}

/**
 * View Political Party Details
 */
async function viewPartyDetails(partyId) {
    const modal = document.getElementById('sourceDetailModal');
    const loading = document.getElementById('sourceDetailLoading');
    const content = document.getElementById('sourceDetailContent');
    const nameEl = document.getElementById('sourceDetailName');
    const postsContainer = document.getElementById('sourceDetailPosts');
    const emptyState = document.getElementById('sourceDetailEmpty');

    // Show modal with loading state
    modal.classList.add('active');
    loading.style.display = 'block';
    content.style.display = 'none';

    try {
        // Fetch party details
        const response = await fetch(`/api/parties/${partyId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch party');
        const party = await response.json();

        // Fetch posts for this party
        const postsResponse = await fetch(`/api/parties/${partyId}/posts`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        const posts = postsResponse.ok ? await postsResponse.json() : [];

        // Calculate sentiment averages
        const sentiment = calculateSourceSentiment(posts);

        // Update UI
        nameEl.textContent = party.name_en || party.name_np || party.abbreviation || 'Political Party';
        document.getElementById('detailPostCount').textContent = posts.length;
        document.getElementById('detailPositive').textContent = sentiment.avg_positive.toFixed(1) + '%';
        document.getElementById('detailNegative').textContent = sentiment.avg_negative.toFixed(1) + '%';
        document.getElementById('detailNeutral').textContent = sentiment.avg_neutral.toFixed(1) + '%';

        // Render posts list with comments summary
        if (posts.length > 0) {
            // Calculate total comments
            const totalComments = posts.reduce((sum, p) => sum + (p.comment_count || 0), 0);
            document.getElementById('detailPostCount').textContent = `${posts.length} (${totalComments.toLocaleString()} comments)`;

            postsContainer.innerHTML = posts.map(post => {
                // Summary paragraph from content field
                const summaryHtml = post.content ? `
                    <div style="margin-top: 12px; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.2);">
                        <h5 style="margin: 0 0 8px 0; font-size: 0.85rem; color: #60A5FA; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="file-text" style="width: 14px; height: 14px;"></i>
                            Analysis Summary
                        </h5>
                        <p style="margin: 0; font-size: 0.85rem; color: rgba(255,255,255,0.85); line-height: 1.5;">${escapeHtml(post.content)}</p>
                    </div>
                ` : '';

                return `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="color: #a0a0b0; font-size: 0.8rem;">
                                ${post.published_date ? new Date(post.published_date).toLocaleDateString() : 'No date'}
                            </span>
                            ${post.comment_count ? `<span style="color: #8B5CF6; font-size: 0.75rem;"><i data-lucide="message-square" style="width: 12px; height: 12px;"></i> ${post.comment_count.toLocaleString()} comments</span>` : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <span style="color: #10B981; font-size: 0.8rem;">${(post.positive_percentage || 0).toFixed(1)}%</span>
                            <span style="color: #EF4444; font-size: 0.8rem;">${(post.negative_percentage || 0).toFixed(1)}%</span>
                            <span style="color: #9CA3AF; font-size: 0.8rem;">${(post.neutral_percentage || 0).toFixed(1)}%</span>
                        </div>
                    </div>
                    ${post.post_url ? `<a href="${escapeHtml(post.post_url)}" target="_blank" style="color: #3B82F6; font-size: 0.85rem; word-break: break-all;">View Post →</a>` : ''}
                    ${summaryHtml}
                </div>
            `}).join('');
            emptyState.style.display = 'none';
        } else {
            postsContainer.innerHTML = '';
            emptyState.style.display = 'block';
        }

        loading.style.display = 'none';
        content.style.display = 'block';
        lucide?.createIcons();

    } catch (error) {
        console.error('Error viewing party details:', error);
        showToast('Failed to load party details', 'error');
        modal.classList.remove('active');
    }
}

/**
 * Calculate average sentiment from posts array
 */
function calculateSourceSentiment(posts) {
    if (!posts || posts.length === 0) {
        return { avg_positive: 0, avg_negative: 0, avg_neutral: 0 };
    }
    const sum = posts.reduce((acc, p) => ({
        positive: acc.positive + (p.positive_percentage || 0),
        negative: acc.negative + (p.negative_percentage || 0),
        neutral: acc.neutral + (p.neutral_percentage || 0)
    }), { positive: 0, negative: 0, neutral: 0 });

    return {
        avg_positive: sum.positive / posts.length,
        avg_negative: sum.negative / posts.length,
        avg_neutral: sum.neutral / posts.length
    };
}

/**
 * Close source detail modal
 */
function closeSourceDetailModal() {
    document.getElementById('sourceDetailModal').classList.remove('active');
}

// Initialize source detail modal close button
document.getElementById('sourceDetailModalClose')?.addEventListener('click', closeSourceDetailModal);
document.getElementById('sourceDetailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'sourceDetailModal') closeSourceDetailModal();
});

function closeAddSourceModal() {
    elements.addSourceModal.classList.remove('active');
}

async function handleNewsArticleSubmit(e) {
    e.preventDefault();

    const sourceSelect = document.getElementById('newsSourceSelect');
    const newSourceName = document.getElementById('newNewsSourceName');

    let sourceId = sourceSelect.value;

    // Create new source if needed
    if (sourceId === 'new') {
        if (!newSourceName.value.trim()) {
            showToast('Please enter source name', 'error');
            return;
        }

        try {
            const res = await fetch('/api/news-media', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ name_en: newSourceName.value.trim() })
            });

            if (!res.ok) throw new Error('Failed to create source');
            const newSource = await res.json();
            sourceId = newSource.id;
        } catch (err) {
            showToast('Failed to create news source', 'error');
            return;
        }
    }

    // Create post for this source
    const postData = {
        news_media_id: sourceId,
        post_url: document.getElementById('newsArticleUrl')?.value || '',
        published_date: document.getElementById('newsArticleDate')?.value || null,
        positive_percentage: parseFloat(document.getElementById('newsPositive')?.value) || 0,
        negative_percentage: parseFloat(document.getElementById('newsNegative')?.value) || 0,
        neutral_percentage: parseFloat(document.getElementById('newsNeutral')?.value) || 0,
        remarks: document.getElementById('newsRemarks')?.value || ''
    };

    // Show loading state
    const submitBtn = elements.addSourceSubmitBtn;
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const res = await fetch(`/api/news-media/${sourceId}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(postData)
        });

        if (!res.ok) throw new Error('Failed to save article');
        showToast('News article saved successfully!', 'success');
        closeAddSourceModal();
    } catch (err) {
        showToast('Failed to save article: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}



async function handlePartyPostSubmit(e) {
    e.preventDefault();

    const partySelect = document.getElementById('partySelect');
    const newPartyName = document.getElementById('newPartyName');
    const newPartyAbbrev = document.getElementById('newPartyAbbrev');

    let partyId = partySelect.value;

    // Create new party if needed
    if (partyId === 'new') {
        if (!newPartyName.value.trim()) {
            showToast('Please enter party name', 'error');
            return;
        }

        try {
            const res = await fetch('/api/parties', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    name_en: newPartyName.value.trim(),
                    abbreviation: newPartyAbbrev.value.trim() || null
                })
            });

            if (!res.ok) throw new Error('Failed to create party');
            const newParty = await res.json();
            partyId = newParty.id;
        } catch (err) {
            showToast('Failed to create party', 'error');
            return;
        }
    }

    // Create post for this party
    const postData = {
        political_party_id: partyId,
        post_url: document.getElementById('partyPostUrl')?.value || '',
        published_date: document.getElementById('partyPostDate')?.value || null,
        positive_percentage: parseFloat(document.getElementById('partyPositive')?.value) || 0,
        negative_percentage: parseFloat(document.getElementById('partyNegative')?.value) || 0,
        neutral_percentage: parseFloat(document.getElementById('partyNeutral')?.value) || 0,
        remarks: document.getElementById('partyRemarks')?.value || ''
    };

    // Show loading state
    const submitBtn = elements.addSourceSubmitBtn;
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const res = await fetch(`/api/parties/${partyId}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(postData)
        });

        if (!res.ok) throw new Error('Failed to save post');
        showToast('Party post saved successfully!', 'success');
        closeAddSourceModal();
    } catch (err) {
        showToast('Failed to save post: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// ============================================
// Daily Reports Module
let dailyReportComponent = null;
let reportsHistoryComponent = null;

function initDailyReports() {
    const btn = document.getElementById('dailyReportsBtn');

    if (!btn) return;

    btn.addEventListener('click', () => {
        showReportsHistory();
    });

    // Set up global navigation functions that components can call
    window.showReportsHistory = showReportsHistory;
    window.showReportDetail = showReportDetail;

    // Listen for custom events from components
    window.addEventListener('viewReportDetail', (e) => showReportDetail(e.detail.date));
    window.addEventListener('showReportsHistory', () => showReportsHistory());
}

function showReportsHistory() {
    // Hide dashboard and detail view, show history view
    const dashboard = document.getElementById('dashboard-view');
    const reportsView = document.getElementById('reports-view');
    const library = document.getElementById('library-view');
    const historyContainer = document.getElementById('reports-history-root');
    const detailContainer = document.getElementById('daily-report-root');

    if (dashboard) dashboard.style.display = 'none';
    if (reportsView) reportsView.style.display = 'block';
    if (library) library.style.display = 'none';
    if (historyContainer) historyContainer.style.display = 'block';
    if (detailContainer) detailContainer.style.display = 'none';

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('dailyReportsBtn')?.classList.add('active');

    // Initialize history component if first time
    if (!window.reportsHistory && historyContainer) {
        console.log('Initializing ReportsHistoryComponent...');
        window.reportsHistory = new ReportsHistoryComponent('reports-history-root');
    } else if (window.reportsHistory) {
        // Refresh history when returning
        window.reportsHistory.loadHistory();
    }
}

function showReportDetail(date) {
    // Show detail view, hide history
    const historyContainer = document.getElementById('reports-history-root');
    const detailContainer = document.getElementById('daily-report-root');

    if (historyContainer) historyContainer.style.display = 'none';
    if (detailContainer) detailContainer.style.display = 'block';

    // Store date for detail view to pick up
    if (date) {
        sessionStorage.setItem('selectedReportDate', date);
    }

    // Initialize or reinit component
    if (!dailyReportComponent && detailContainer) {
        console.log('Initializing DailyReportComponent...');
        dailyReportComponent = new DailyReportComponent('daily-report-root');
    } else if (dailyReportComponent) {
        // Load the specific date
        const targetDate = sessionStorage.getItem('selectedReportDate') || date;
        if (targetDate) {
            sessionStorage.removeItem('selectedReportDate');
            dailyReportComponent.loadReport(targetDate);
        }
    }
}

// Legacy function for backward compatibility
function showReportsView() {
    showReportsHistory();
}

function showDashboardView() {
    const dashboard = document.getElementById('dashboard-view');
    const reports = document.getElementById('reports-view');
    const library = document.getElementById('library-view');

    if (dashboard) dashboard.style.display = 'block';
    if (reports) reports.style.display = 'none';
    if (library) library.style.display = 'none';

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('homeBtn')?.classList.add('active');
}

function closeDailyReportsModal() {
    // Legacy function support if called from elsewhere, redirects to dashboard view
    showDashboardView();
}

// Start the app
init();

// ============================================
// Export Functions
// ============================================

// --- News Exports ---
function exportNewsToExcel() {
    if (!libraryNewsData || libraryNewsData.length === 0) {
        showToast('No news data to export', 'error');
        return;
    }

    const exportData = libraryNewsData.map(item => ({
        'Source Name': item.name_en || item.name_np || 'N/A',
        'Total Posts': item.posts_count || 0,
        'Positive %': (item.avg_positive || 0).toFixed(2),
        'Negative %': (item.avg_negative || 0).toFixed(2),
        'Neutral %': (item.avg_neutral || 0).toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "News Analysis");
    XLSX.writeFile(wb, `news_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('News analysis exported to Excel', 'success');
}

function exportNewsToPDF() {
    if (!libraryNewsData || libraryNewsData.length === 0) {
        showToast('No news data to export', 'error');
        return;
    }

    const doc = new jspdf.jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text('News Media Analysis Report', 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableColumn = ["Source Name", "Posts", "Positive %", "Negative %", "Neutral %"];
    const tableRows = libraryNewsData.map(item => [
        item.name_en || item.name_np || 'N/A',
        item.posts_count || 0,
        (item.avg_positive || 0).toFixed(1) + '%',
        (item.avg_negative || 0).toFixed(1) + '%',
        (item.avg_neutral || 0).toFixed(1) + '%'
    ]);

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });

    doc.save(`news_analysis_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('News analysis exported to PDF', 'success');
}

// --- Party Exports ---
function exportPartiesToExcel() {
    if (!libraryPartiesData || libraryPartiesData.length === 0) {
        showToast('No party data to export', 'error');
        return;
    }

    const exportData = libraryPartiesData.map(item => ({
        'Party Name': item.name_en || item.name_np || 'N/A',
        'Abbreviation': item.abbreviation || '',
        'Total Posts': item.posts_count || 0,
        'Positive %': (item.avg_positive || 0).toFixed(2),
        'Negative %': (item.avg_negative || 0).toFixed(2),
        'Neutral %': (item.avg_neutral || 0).toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Party Analysis");
    XLSX.writeFile(wb, `party_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Party analysis exported to Excel', 'success');
}

function exportPartiesToPDF() {
    if (!libraryPartiesData || libraryPartiesData.length === 0) {
        showToast('No party data to export', 'error');
        return;
    }

    const doc = new jspdf.jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text('Political Party Analysis Report', 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableColumn = ["Party Name", "Abbr", "Posts", "Positive %", "Negative %", "Neutral %"];
    const tableRows = libraryPartiesData.map(item => [
        item.name_en || item.name_np || 'N/A',
        item.abbreviation || '-',
        item.posts_count || 0,
        (item.avg_positive || 0).toFixed(1) + '%',
        (item.avg_negative || 0).toFixed(1) + '%',
        (item.avg_neutral || 0).toFixed(1) + '%'
    ]);

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [46, 204, 113], textColor: 255 } // Green for parties
    });

    doc.save(`party_analysis_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('Party analysis exported to PDF', 'success');
}

// Attach Event Listeners for Exports
function initNavigation() {
    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) {
        homeBtn.style.cursor = 'pointer';
        homeBtn.addEventListener('click', () => {
            showDashboardView();
        });
    }

    const brandLogoBtn = document.getElementById('brandLogoBtn');
    if (brandLogoBtn) {
        brandLogoBtn.style.cursor = 'pointer';
        brandLogoBtn.addEventListener('click', () => {
            showDashboardView();
        });
    }

    const libraryBtn = document.getElementById('libraryBtn');
    if (libraryBtn) {
        libraryBtn.addEventListener('click', () => {
            showLibraryView();
        });
    }

    const dailyReportsBtn = document.getElementById('dailyReportsBtn');
    if (dailyReportsBtn) {
        dailyReportsBtn.addEventListener('click', () => {
            showReportsView();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    // ... rest of init
    // News Exports
    document.getElementById('exportNewsExcel')?.addEventListener('click', exportNewsToExcel);
    document.getElementById('exportNewsPdf')?.addEventListener('click', exportNewsToPDF);

    // Party Exports
    document.getElementById('exportPartiesExcel')?.addEventListener('click', exportPartiesToExcel);
    document.getElementById('exportPartiesPdf')?.addEventListener('click', exportPartiesToPDF);

    // AI "Other" News Source Listener
    const aiNewsSelect = document.getElementById('aiNewsSelect');
    if (aiNewsSelect) {
        aiNewsSelect.addEventListener('change', (e) => {
            const container = document.getElementById('aiRecNewsSourceContainer');
            if (container) {
                container.style.display = e.target.value === 'other' ? 'block' : 'none';
            }
        });
    }

    // Manual "Add New" News Source Listener
    const newsSourceSelect = document.getElementById('newsSourceSelect');
    if (newsSourceSelect) {
        newsSourceSelect.addEventListener('change', (e) => {
            const newRow = document.getElementById('newNewsSourceRow');
            if (newRow) {
                newRow.style.display = e.target.value === 'new' ? 'flex' : 'none';
            }
        });
    }
});
