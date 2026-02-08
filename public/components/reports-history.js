/**
 * Reports History Component
 * Shows a timeline of all generated daily reports
 * Entry point for the Daily Reports feature
 */

class ReportsHistoryComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.reports = [];
        this.todayGenerated = false;
        this.userRole = localStorage.getItem('userRole') || 'viewer';

        if (!this.container) {
            console.error('❌ Reports History container not found:', containerId);
            return;
        }

        this.init();
    }

    async init() {
        this.render();
        await this.loadHistory();
    }

    render() {
        const today = new Date().toISOString().split('T')[0];

        this.container.innerHTML = `
            <div class="reports-history-container">
                <div class="reports-header">
                    <h2><i data-lucide="bar-chart-3"></i> Daily Reports</h2>
                    <p class="subtitle">RSP Strategic Intelligence Briefings</p>
                </div>

                <div class="generate-section" id="generate-section">
                    <div class="generate-card">
                        <div class="generate-icon"><i data-lucide="zap" style="width: 28px; height: 28px; color: #F59E0B;"></i></div>
                        <div class="generate-info">
                            <h3>Today's Report</h3>
                            <p id="today-status">Checking...</p>
                        </div>
                        <button id="generate-today-btn" class="btn btn-primary" style="display: none;">
                            Generate Report
                        </button>
                        <button id="view-today-btn" class="btn btn-secondary" style="display: none;">
                            View Report →
                        </button>
                    </div>
                </div>

                <div class="history-section">
                    <h3><i data-lucide="calendar"></i> Report History</h3>
                    <div id="reports-timeline" class="reports-timeline">
                        <div class="loading-spinner">Loading reports...</div>
                    </div>
                </div>
            </div>
        `;

        this.addStyles();
        this.setupEventListeners();
    }

    addStyles() {
        if (document.getElementById('reports-history-styles')) return;

        const style = document.createElement('style');
        style.id = 'reports-history-styles';
        style.textContent = `
            .reports-history-container {
                padding: 24px;
                max-width: 900px;
                margin: 0 auto;
            }
            .reports-header {
                text-align: center;
                margin-bottom: 32px;
            }
            .reports-header h2 {
                font-size: 28px;
                margin-bottom: 8px;
                color: #fff;
            }
            .reports-header .subtitle {
                color: #888;
                font-size: 14px;
            }
            .generate-section {
                margin-bottom: 32px;
            }
            .generate-card {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 20px 24px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 12px;
                border: 1px solid #333;
            }
            .generate-icon {
                font-size: 32px;
            }
            .generate-info {
                flex: 1;
            }
            .generate-info h3 {
                margin: 0 0 4px 0;
                color: #fff;
            }
            .generate-info p {
                margin: 0;
                color: #888;
                font-size: 14px;
            }
            .history-section h3 {
                margin-bottom: 16px;
                color: #ccc;
            }
            .reports-timeline {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .report-item {
                display: flex;
                align-items: center;
                background: #1e1e2e;
                border-radius: 10px;
                border: 1px solid #333;
                transition: all 0.2s ease;
                overflow: hidden;
            }
            .report-item:hover {
                background: #252538;
                border-color: #10B981;
            }
            .report-item-main {
                display: flex;
                align-items: center;
                flex: 1;
                padding: 16px 20px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .report-item-main:hover {
                transform: translateX(4px);
            }
            .report-date {
                min-width: 120px;
            }
            .report-date .day {
                font-size: 18px;
                font-weight: 600;
                color: #fff;
            }
            .report-date .full {
                font-size: 12px;
                color: #888;
            }
            .report-stats {
                flex: 1;
                display: flex;
                gap: 24px;
            }
            .report-stat {
                text-align: center;
            }
            .report-stat .value {
                font-size: 16px;
                font-weight: 600;
            }
            .report-stat .label {
                font-size: 11px;
                color: #888;
            }
            .report-stat.positive .value { color: #10B981; }
            .report-stat.negative .value { color: #EF4444; }
            .report-arrow {
                color: #666;
                font-size: 20px;
            }
            .report-actions {
                display: flex;
                gap: 8px;
                padding: 0 16px;
                border-left: 1px solid #333;
            }
            .action-btn {
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.05);
                color: #888;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .action-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }
            .action-btn.download-btn:hover {
                background: rgba(16, 185, 129, 0.2);
                color: #10B981;
            }
            .action-btn.delete-btn:hover {
                background: rgba(239, 68, 68, 0.2);
                color: #EF4444;
            }
            .action-btn i, .action-btn svg {
                width: 16px;
                height: 16px;
            }
            .no-reports {
                text-align: center;
                padding: 40px;
                color: #666;
            }
            .loading-spinner {
                text-align: center;
                padding: 40px;
                color: #888;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        document.getElementById('generate-today-btn')?.addEventListener('click', () => {
            this.generateTodayReport();
        });

        document.getElementById('view-today-btn')?.addEventListener('click', () => {
            this.viewReport(new Date().toISOString().split('T')[0]);
        });
    }

    async loadHistory() {
        try {
            const response = await fetch('/api/reports/history?limit=30', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });

            if (!response.ok) throw new Error('Failed to load history');

            this.reports = await response.json();
            this.renderTimeline();
            this.updateTodayStatus();
        } catch (error) {
            console.error('Load history error:', error);
            document.getElementById('reports-timeline').innerHTML = `
                <div class="no-reports">
                    <p><i data-lucide="alert-circle" style="color: #EF4444;"></i> Failed to load reports. Please try again.</p>
                </div>
            `;
        }
    }

    updateTodayStatus() {
        const today = new Date().toISOString().split('T')[0];
        const todayReport = this.reports.find(r => r.report_date === today);

        const statusEl = document.getElementById('today-status');
        const generateBtn = document.getElementById('generate-today-btn');
        const viewBtn = document.getElementById('view-today-btn');

        if (todayReport) {
            this.todayGenerated = true;
            statusEl.textContent = `Generated at ${new Date(todayReport.generated_at).toLocaleTimeString()}`;
            statusEl.style.color = '#10B981';
            generateBtn.style.display = 'none';
            viewBtn.style.display = 'inline-flex';
        } else {
            this.todayGenerated = false;
            statusEl.textContent = 'Not yet generated';
            statusEl.style.color = '#F59E0B';
            generateBtn.style.display = 'inline-flex';
            viewBtn.style.display = 'none';
        }
    }

    renderTimeline() {
        const container = document.getElementById('reports-timeline');

        if (!this.reports || this.reports.length === 0) {
            container.innerHTML = `
                <div class="no-reports">
                    <p><i data-lucide="inbox" style="width: 32px; height: 32px;"></i></p>
                    <p>No reports generated yet.</p>
                    <p style="font-size: 14px; margin-top: 8px;">Click "Generate Report" above to create your first daily briefing.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.reports.map(report => {
            const date = new Date(report.report_date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const fullDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const isAdmin = this.userRole === 'admin';

            return `
                <div class="report-item" data-date="${report.report_date}">
                    <div class="report-item-main" onclick="reportsHistory.viewReport('${report.report_date}')">
                        <div class="report-date">
                            <div class="day">${dayName}</div>
                            <div class="full">${fullDate}</div>
                        </div>
                        <div class="report-stats">
                            <div class="report-stat">
                                <div class="value">${report.total_posts_analyzed || 0}</div>
                                <div class="label">Posts</div>
                            </div>
                            <div class="report-stat">
                                <div class="value">${(report.total_comments_analyzed || 0).toLocaleString()}</div>
                                <div class="label">Comments</div>
                            </div>
                            <div class="report-stat positive">
                                <div class="value">${(report.overall_positive || 0).toFixed(0)}%</div>
                                <div class="label">Positive</div>
                            </div>
                            <div class="report-stat negative">
                                <div class="value">${(report.overall_negative || 0).toFixed(0)}%</div>
                                <div class="label">Negative</div>
                            </div>
                        </div>
                        <div class="report-arrow"><i data-lucide="chevron-right"></i></div>
                    </div>
                    <div class="report-actions">
                        <button class="action-btn download-btn" onclick="event.stopPropagation(); reportsHistory.downloadReport('${report.report_date}')" title="Download Report">
                            <i data-lucide="download"></i>
                        </button>
                        ${isAdmin ? `
                        <button class="action-btn delete-btn" onclick="event.stopPropagation(); reportsHistory.deleteReport(${report.id}, '${report.report_date}')" title="Delete Report">
                            <i data-lucide="trash-2"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Initialize Lucide icons
        if (window.lucide) window.lucide.createIcons();
    }

    async generateTodayReport() {
        const btn = document.getElementById('generate-today-btn');
        const statusEl = document.getElementById('today-status');

        btn.disabled = true;
        btn.textContent = 'Generating...';
        statusEl.textContent = 'Analyzing data...';
        statusEl.style.color = '#3B82F6';

        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ date: today })
            });

            const result = await response.json();

            if (result.success) {
                statusEl.textContent = 'Report generated!';
                statusEl.style.color = '#10B981';
                await this.loadHistory();
                // Navigate to the report
                setTimeout(() => this.viewReport(today), 500);
            } else {
                statusEl.textContent = result.message || 'Generation failed';
                statusEl.style.color = '#EF4444';
                btn.disabled = false;
                btn.textContent = 'Try Again';
            }
        } catch (error) {
            console.error('Generate error:', error);
            statusEl.textContent = 'Error connecting to server';
            statusEl.style.color = '#EF4444';
            btn.disabled = false;
            btn.textContent = 'Try Again';
        }
    }

    viewReport(date) {
        // Store selected date and switch to detail view
        sessionStorage.setItem('selectedReportDate', date);

        // Trigger navigation to detail view
        if (window.showReportDetail) {
            window.showReportDetail(date);
        } else {
            // Fallback: dispatch custom event
            window.dispatchEvent(new CustomEvent('viewReportDetail', { detail: { date } }));
        }
    }

    async downloadReport(date) {
        try {
            // Navigate to report detail which has the export function
            sessionStorage.setItem('selectedReportDate', date);
            sessionStorage.setItem('autoDownload', 'true');

            if (window.showReportDetail) {
                window.showReportDetail(date);
            }
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download report.');
        }
    }

    async deleteReport(id, date) {
        if (!confirm(`Are you sure you want to delete the report for ${date}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/reports/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });

            if (response.ok) {
                // Remove from local list and re-render
                this.reports = this.reports.filter(r => r.id !== id);
                this.renderTimeline();
                this.updateTodayStatus();
            } else {
                const result = await response.json();
                alert(result.message || 'Failed to delete report.');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Error connecting to server.');
        }
    }
}

// Initialize

