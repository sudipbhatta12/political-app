/**
 * Source Manager Component
 * Manage News Media and Political Parties with Add/Edit functionality
 */

class SourceManagerComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentTab = 'news-media';
        this.init();
    }

    init() {
        this.render();
        this.loadSources();
    }

    render() {
        this.container.innerHTML = `
            <div class="source-manager-container">
                <div class="manager-header">
                    <h2><i data-lucide="library"></i> Source Library Manager</h2>
                    <button id="add-source-btn" class="btn btn-primary">
                        <span>+</span> Add New Source
                    </button>
                </div>

                <div class="manager-tabs">
                    <button class="manager-tab active" data-tab="news-media"><i data-lucide="newspaper"></i> News Media</button>
                    <button class="manager-tab" data-tab="parties"><i data-lucide="landmark"></i> Political Parties</button>
                </div>

                <div class="source-grid" id="source-grid">
                    <!-- Sources will be loaded here -->
                </div>

                <!-- Add/Edit Modal -->
                <div id="source-modal" class="modal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="modal-title">Add New Source</h3>
                            <button class="modal-close" onclick="sourceManager.closeModal()">&times;</button>
                        </div>
                        <form id="source-form">
                            <input type="hidden" id="source-id">
                            <input type="hidden" id="source-type">
                            
                            <div class="form-group">
                                <label for="source-name-en">Name (English) *</label>
                                <input type="text" id="source-name-en" required placeholder="e.g., The Himalayan Times">
                            </div>
                            
                            <div class="form-group">
                                <label for="source-name-np">Name (Nepali)</label>
                                <input type="text" id="source-name-np" placeholder="e.g., हिमालयन टाइम्स">
                            </div>
                            
                            <div class="form-group" id="abbreviation-group" style="display: none;">
                                <label for="source-abbreviation">Abbreviation</label>
                                <input type="text" id="source-abbreviation" placeholder="e.g., NC, UML">
                            </div>
                            
                            <div class="form-group">
                                <label for="source-website">Website URL</label>
                                <input type="url" id="source-website" placeholder="https://example.com">
                            </div>
                            
                            <div class="form-group">
                                <label for="source-facebook">Facebook URL</label>
                                <input type="url" id="source-facebook" placeholder="https://facebook.com/page">
                            </div>
                            
                            <div class="form-group">
                                <label for="source-twitter">Twitter/X URL</label>
                                <input type="url" id="source-twitter" placeholder="https://twitter.com/handle">
                            </div>
                            
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" onclick="sourceManager.closeModal()">Cancel</button>
                                <button type="submit" class="btn btn-primary">Save Source</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.manager-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.manager-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTab = e.target.dataset.tab;
                this.loadSources();
            });
        });

        // Add button
        document.getElementById('add-source-btn').addEventListener('click', () => {
            this.openAddModal();
        });

        // Form submission
        document.getElementById('source-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSource();
        });

        // Close modal on outside click
        document.getElementById('source-modal').addEventListener('click', (e) => {
            if (e.target.id === 'source-modal') this.closeModal();
        });
    }

    async loadSources() {
        const grid = document.getElementById('source-grid');
        grid.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const endpoint = this.currentTab === 'news-media'
                ? '/api/news-media?withSentiment=true'
                : '/api/parties?withSentiment=true';

            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            const sources = await response.json();

            grid.innerHTML = sources.map(s => this.renderSourceCard(s)).join('') ||
                '<div class="no-sources">No sources found. Add one to get started!</div>';
        } catch (error) {
            console.error('Error loading sources:', error);
            grid.innerHTML = '<div class="error">Error loading sources</div>';
        }
    }

    renderSourceCard(source) {
        const sentiment = source.sentiment || {};
        const isNewsMedia = this.currentTab === 'news-media';

        return `
            <div class="source-card">
                <div class="source-card-header">
                    <h4>${source.name_en}</h4>
                    ${source.abbreviation ? `<span class="abbreviation">${source.abbreviation}</span>` : ''}
                </div>
                ${source.name_np ? `<p class="name-np">${source.name_np}</p>` : ''}
                
                <div class="source-stats">
                    <div class="stat">
                        <span class="stat-value">${sentiment.post_count || 0}</span>
                        <span class="stat-label">Posts</span>
                    </div>
                    <div class="stat positive">
                        <span class="stat-value">${(sentiment.avg_positive || 0).toFixed(1)}%</span>
                        <span class="stat-label">Positive</span>
                    </div>
                    <div class="stat negative">
                        <span class="stat-value">${(sentiment.avg_negative || 0).toFixed(1)}%</span>
                        <span class="stat-label">Negative</span>
                    </div>
                </div>
                
                <div class="source-links">
                    ${source.website_url ? `<a href="${source.website_url}" target="_blank" title="Website"><i data-lucide="globe" style="width:16px; height:16px;"></i></a>` : ''}
                    ${source.facebook_url ? `<a href="${source.facebook_url}" target="_blank" title="Facebook"><i data-lucide="facebook" style="width:16px; height:16px;"></i></a>` : ''}
                    ${source.twitter_url ? `<a href="${source.twitter_url}" target="_blank" title="Twitter"><i data-lucide="twitter" style="width:16px; height:16px;"></i></a>` : ''}
                </div>
                
                <div class="source-actions">
                    <button class="btn btn-sm btn-secondary" onclick="sourceManager.editSource(${source.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="sourceManager.deleteSource(${source.id})">Delete</button>
                </div>
            </div>
        `;

        // Initialize icons
        if (window.lucide) {
            window.lucide.createIcons({
                root: this.container,
                attrs: {
                    width: "16",
                    height: "16"
                }
            });
        }
    }

    openAddModal() {
        document.getElementById('modal-title').textContent =
            this.currentTab === 'news-media' ? 'Add News Media' : 'Add Political Party';
        document.getElementById('source-form').reset();
        document.getElementById('source-id').value = '';
        document.getElementById('source-type').value = this.currentTab;

        // Show/hide abbreviation field for parties
        document.getElementById('abbreviation-group').style.display =
            this.currentTab === 'parties' ? 'block' : 'none';

        document.getElementById('source-modal').style.display = 'flex';
    }

    async editSource(id) {
        const endpoint = this.currentTab === 'news-media'
            ? `/api/news-media/${id}`
            : `/api/parties/${id}`;

        try {
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            const source = await response.json();

            document.getElementById('modal-title').textContent =
                this.currentTab === 'news-media' ? 'Edit News Media' : 'Edit Political Party';
            document.getElementById('source-id').value = id;
            document.getElementById('source-type').value = this.currentTab;
            document.getElementById('source-name-en').value = source.name_en || '';
            document.getElementById('source-name-np').value = source.name_np || '';
            document.getElementById('source-abbreviation').value = source.abbreviation || '';
            document.getElementById('source-website').value = source.website_url || '';
            document.getElementById('source-facebook').value = source.facebook_url || '';
            document.getElementById('source-twitter').value = source.twitter_url || '';

            document.getElementById('abbreviation-group').style.display =
                this.currentTab === 'parties' ? 'block' : 'none';

            document.getElementById('source-modal').style.display = 'flex';
        } catch (error) {
            console.error('Error loading source:', error);
            alert('Error loading source details');
        }
    }

    async saveSource() {
        const id = document.getElementById('source-id').value;
        const type = document.getElementById('source-type').value;

        const data = {
            name_en: document.getElementById('source-name-en').value,
            name_np: document.getElementById('source-name-np').value || null,
            website_url: document.getElementById('source-website').value || null,
            facebook_url: document.getElementById('source-facebook').value || null,
            twitter_url: document.getElementById('source-twitter').value || null
        };

        if (type === 'parties') {
            data.abbreviation = document.getElementById('source-abbreviation').value || null;
        }

        const endpoint = type === 'news-media' ? '/api/news-media' : '/api/parties';
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${endpoint}/${id}` : endpoint;

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.closeModal();
                this.loadSources();
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to save source');
            }
        } catch (error) {
            console.error('Error saving source:', error);
            alert('Error saving source');
        }
    }

    async deleteSource(id) {
        if (!confirm('Are you sure you want to delete this source?')) return;

        const endpoint = this.currentTab === 'news-media'
            ? `/api/news-media/${id}`
            : `/api/parties/${id}`;

        try {
            await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            this.loadSources();
        } catch (error) {
            console.error('Error deleting source:', error);
            alert('Error deleting source');
        }
    }

    closeModal() {
        document.getElementById('source-modal').style.display = 'none';
    }
}

// Initialize
let sourceManager;
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('source-manager-container')) {
        sourceManager = new SourceManagerComponent('source-manager-container');
    }
});
