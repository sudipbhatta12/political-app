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
                    <h2>📊 Daily Reports</h2>
                    <p class="subtitle">RSP Strategic Intelligence Briefings</p>
                </div>

                <div class="generate-section" id="generate-section">
                    <div class="generate-card">
                        <div class="generate-icon">⚡</div>
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
                    <h3>📅 Report History</h3>
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
                padding: 16px 20px;
                background: #1e1e2e;
                border-radius: 10px;
                border: 1px solid #333;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .report-item:hover {
                background: #252538;
                border-color: #10B981;
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
                    <p>❌ Failed to load reports. Please try again.</p>
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
                    <p>📭 No reports generated yet.</p>
                    <p style="font-size: 14px; margin-top: 8px;">Click "Generate Report" above to create your first daily briefing.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.reports.map(report => {
            const date = new Date(report.report_date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const fullDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            return `
                <div class="report-item" onclick="reportsHistory.viewReport('${report.report_date}')">
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
                    <div class="report-arrow">→</div>
                </div>
            `;
        }).join('');
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
                statusEl.textContent = '✅ Report generated!';
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
}

// Initialize
let reportsHistory;
