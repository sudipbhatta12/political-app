/**
 * Daily Report Component - Redesigned
 * Displays daily sentiment reports with interactive charts
 * 
 * Simplified structure:
 * - init(): Setup and load initial data
 * - render(): Build the UI
 * - loadReport(date): Fetch and display a report
 * - generateReport(date): Create a new report
 * - displayReport(report): Render report data
 * - exportPDF(): Generate PDF download
 */

class DailyReportComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentReport = null;
        this.charts = {};
        this.userRole = localStorage.getItem('userRole') || 'viewer';

        if (!this.container) {
            console.error('❌ Daily Report container not found:', containerId);
            return;
        }

        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
        this.loadTodayReport();
    }

    render() {
        this.container.innerHTML = `
            <div class="daily-report-container">
                <!-- Header -->
                <div class="report-header">
                    <h2 class="report-title">📊 Daily Political Analysis</h2>
                    <div class="report-controls">
                        <input type="date" id="report-date-picker" class="date-picker">
                        <button id="generate-report-btn" class="btn btn-primary">
                            <span class="btn-icon">⚡</span> Generate Report
                        </button>
                        <button id="refresh-report-btn" class="btn btn-secondary" style="margin-left: 8px;">
                            <span class="btn-icon">🔄</span> Refresh
                        </button>
                        <button id="download-pdf-btn" class="btn btn-secondary" style="margin-left: 8px; display: none;">
                            <span class="btn-icon">📥</span> PDF
                        </button>
                        ${this.userRole !== 'viewer' ? `
                        <button id="delete-report-btn" class="btn btn-danger" style="display: none; margin-left: 8px;">
                            <span class="btn-icon">🗑️</span> Delete
                        </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Status Messages -->
                <div id="report-status" class="report-status" style="display: none;"></div>

                <!-- Loading State -->
                <div id="report-loading" class="report-loading" style="display: none;">
                    <div class="spinner"></div>
                    <p>Generating report...</p>
                </div>

                <!-- No Data State -->
                <div id="report-no-data" class="report-no-data" style="display: none;">
                    <div class="no-data-icon">📭</div>
                    <h3>No Report Available</h3>
                    <p id="no-data-message">No data found for this date.</p>
                    <button id="generate-from-nodata-btn" class="btn btn-primary" style="margin-top: 16px;">
                        <span class="btn-icon">⚡</span> Generate Report Now
                    </button>
                </div>

                <!-- Report Content -->
                <div id="report-content" class="report-content" style="display: none;">
                    <!-- Summary Cards -->
                    <div class="summary-cards">
                        <div class="summary-card">
                            <div class="card-icon">📝</div>
                            <div class="card-value" id="total-posts">0</div>
                            <div class="card-label">Posts Analyzed</div>
                        </div>
                        <div class="summary-card">
                            <div class="card-icon">💬</div>
                            <div class="card-value" id="total-comments">0</div>
                            <div class="card-label">Comments</div>
                        </div>
                        <div class="summary-card">
                            <div class="card-icon">📡</div>
                            <div class="card-value" id="total-sources">0</div>
                            <div class="card-label">Sources</div>
                        </div>
                        <div class="summary-card sentiment-positive">
                            <div class="card-icon">👍</div>
                            <div class="card-value" id="positive-pct">0%</div>
                            <div class="card-label">Positive</div>
                        </div>
                        <div class="summary-card sentiment-negative">
                            <div class="card-icon">👎</div>
                            <div class="card-value" id="negative-pct">0%</div>
                            <div class="card-label">Negative</div>
                        </div>
                        <div class="summary-card sentiment-neutral">
                            <div class="card-icon">😐</div>
                            <div class="card-value" id="neutral-pct">0%</div>
                            <div class="card-label">Neutral</div>
                        </div>
                    </div>

                    <!-- Charts -->
                    <div class="charts-section">
                        <div class="chart-container">
                            <h3>Sentiment Distribution</h3>
                            <canvas id="sentiment-pie-chart"></canvas>
                        </div>
                        <div class="chart-container">
                            <h3>By Source</h3>
                            <canvas id="source-bar-chart"></canvas>
                        </div>
                    </div>

                    <!-- AI Summary -->
                    <div class="ai-summary-section">
                        <h3>📋 Analysis Summary <span id="summary-source-badge" class="badge"></span></h3>
                        <div id="ai-summary" class="ai-summary"></div>
                    </div>

                    <!-- Source Table -->
                    <div class="source-breakdown">
                        <h3>📰 Source Breakdown</h3>
                        <div class="source-tabs">
                            <button class="source-tab active" data-type="all">All</button>
                            <button class="source-tab" data-type="news_media">News</button>
                            <button class="source-tab" data-type="political_party">Parties</button>
                            <button class="source-tab" data-type="candidate">Candidates</button>
                        </div>
                        <table class="source-table">
                            <thead>
                                <tr>
                                    <th>Source</th>
                                    <th>Type</th>
                                    <th>Posts</th>
                                    <th>Positive</th>
                                    <th>Negative</th>
                                </tr>
                            </thead>
                            <tbody id="source-table-body"></tbody>
                        </table>
                    </div>

                    <!-- History -->
                    <div class="report-history">
                        <h3>📅 Recent Reports</h3>
                        <div id="report-history-list" class="history-list"></div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const datePicker = document.getElementById('report-date-picker');
        const today = new Date().toISOString().split('T')[0];
        datePicker.value = today;
        datePicker.max = today;
        datePicker.addEventListener('change', (e) => this.loadReport(e.target.value));

        document.getElementById('generate-report-btn')?.addEventListener('click', () => {
            this.generateReport(datePicker.value);
        });

        document.getElementById('refresh-report-btn')?.addEventListener('click', () => {
            this.loadReport(datePicker.value);
        });

        document.getElementById('generate-from-nodata-btn')?.addEventListener('click', () => {
            this.generateReport(datePicker.value);
        });

        document.getElementById('download-pdf-btn')?.addEventListener('click', () => {
            this.exportPDF();
        });

        document.getElementById('delete-report-btn')?.addEventListener('click', () => {
            if (confirm('Delete this report? This cannot be undone.')) {
                this.deleteReport();
            }
        });

        document.querySelectorAll('.source-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.filterSourceTable(e.target.dataset.type);
            });
        });
    }

    // ============================================
    // Status & State Management
    // ============================================

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('report-status');
        const colors = {
            info: '#3B82F6',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444'
        };

        statusEl.innerHTML = `
            <div style="padding: 12px 16px; background: ${colors[type]}20; border-left: 4px solid ${colors[type]}; border-radius: 4px; margin-bottom: 16px;">
                ${message}
            </div>
        `;
        statusEl.style.display = 'block';

        // Auto-hide after 5 seconds for non-errors
        if (type !== 'error') {
            setTimeout(() => { statusEl.style.display = 'none'; }, 5000);
        }
    }

    showLoading(message = 'Loading...') {
        document.getElementById('report-loading').style.display = 'flex';
        document.getElementById('report-loading').querySelector('p').textContent = message;
        document.getElementById('report-no-data').style.display = 'none';
        document.getElementById('report-content').style.display = 'none';
    }

    showNoData(message = 'No data found for this date.') {
        document.getElementById('report-loading').style.display = 'none';
        document.getElementById('report-no-data').style.display = 'flex';
        document.getElementById('no-data-message').textContent = message;
        document.getElementById('report-content').style.display = 'none';
        document.getElementById('download-pdf-btn').style.display = 'none';
        document.getElementById('delete-report-btn')?.style.setProperty('display', 'none');
    }

    showContent() {
        document.getElementById('report-loading').style.display = 'none';
        document.getElementById('report-no-data').style.display = 'none';
        document.getElementById('report-content').style.display = 'block';
        document.getElementById('download-pdf-btn').style.display = 'inline-flex';

        if (this.userRole !== 'viewer') {
            document.getElementById('delete-report-btn')?.style.setProperty('display', 'inline-flex');
        }
    }

    // ============================================
    // API Calls
    // ============================================

    async loadTodayReport() {
        await this.loadReport(new Date().toISOString().split('T')[0]);
    }

    async loadReport(date) {
        this.showLoading('Loading report...');

        try {
            const response = await fetch(`/api/reports/daily/${date}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });

            if (response.ok) {
                const report = await response.json();
                if (report.id) {
                    this.currentReport = report;
                    this.displayReport(report);
                    this.loadHistory();
                } else {
                    this.showNoData('No report exists for this date. Click "Generate Report" to create one.');
                }
            } else if (response.status === 404) {
                this.showNoData('No report exists for this date. Click "Generate Report" to create one.');
            } else {
                const error = await response.json();
                this.showNoData(error.message || 'Failed to load report.');
            }
        } catch (error) {
            console.error('Load report error:', error);
            this.showNoData('Error connecting to server. Please check your connection.');
        }
    }

    async generateReport(date) {
        this.showLoading('Generating report with AI analysis...');

        try {
            const response = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ date })
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus('✅ Report generated successfully!', 'success');
                await this.loadReport(date);
            } else {
                // Show specific error message
                if (result.error_code === 'MISSING_TABLE') {
                    this.showStatus('⚠️ Database not initialized. Please run the daily_reports_schema.sql script in Supabase.', 'error');
                } else if (result.posts_found === 0) {
                    this.showNoData(result.message || 'No posts found for this date.');
                } else {
                    this.showStatus(`❌ ${result.message || 'Failed to generate report.'}`, 'error');
                }
                this.showNoData(result.message || 'Could not generate report.');
            }
        } catch (error) {
            console.error('Generate report error:', error);
            this.showStatus('❌ Error connecting to server.', 'error');
            this.showNoData('Error connecting to server.');
        }
    }

    async deleteReport() {
        if (!this.currentReport?.id) return;

        try {
            const response = await fetch(`/api/reports/${this.currentReport.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });

            const result = await response.json();
            if (result.success) {
                this.showStatus('Report deleted.', 'success');
                this.currentReport = null;
                const date = document.getElementById('report-date-picker').value;
                this.loadReport(date);
            } else {
                this.showStatus(`❌ ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            this.showStatus('❌ Failed to delete report.', 'error');
        }
    }

    async loadHistory() {
        try {
            const response = await fetch('/api/reports/history?limit=10', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            const history = await response.json();

            const container = document.getElementById('report-history-list');
            if (!history || history.length === 0) {
                container.innerHTML = '<p class="no-history">No previous reports</p>';
                return;
            }

            container.innerHTML = history.map(r => `
                <div class="history-item" onclick="dailyReport.loadReport('${r.report_date}')">
                    <div class="history-date">${new Date(r.report_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div class="history-stats">
                        <span>${r.total_posts_analyzed} posts</span>
                        <span class="positive">${(r.overall_positive || 0).toFixed(0)}%+</span>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Load history error:', error);
        }
    }

    // ============================================
    // Display
    // ============================================

    displayReport(report) {
        this.showContent();

        // Update stats
        document.getElementById('total-posts').textContent = (report.total_posts_analyzed || 0).toLocaleString();
        document.getElementById('total-comments').textContent = (report.total_comments_analyzed || 0).toLocaleString();
        document.getElementById('total-sources').textContent = report.total_sources || 0;
        document.getElementById('positive-pct').textContent = `${(report.overall_positive || 0).toFixed(1)}%`;
        document.getElementById('negative-pct').textContent = `${(report.overall_negative || 0).toFixed(1)}%`;
        document.getElementById('neutral-pct').textContent = `${(report.overall_neutral || 0).toFixed(1)}%`;

        // Summary
        const summaryEl = document.getElementById('ai-summary');
        summaryEl.innerHTML = this.formatSummary(report.summary_text || 'No summary available.');

        // Show summary source badge
        const badge = document.getElementById('summary-source-badge');
        if (report.summary_source === 'ai') {
            badge.textContent = '🤖 AI';
            badge.style.background = '#10B981';
        } else {
            badge.textContent = '📊 Auto';
            badge.style.background = '#6B7280';
        }

        // Charts
        this.renderCharts(report);

        // Source table
        this.renderSourceTable(report.source_summaries || []);
    }

    formatSummary(text) {
        if (!text) return '<p>No summary available.</p>';

        // Convert markdown-style formatting
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .split('\n')
            .filter(p => p.trim())
            .map(p => `<p>${p}</p>`)
            .join('');
    }

    renderCharts(report) {
        // Destroy existing
        Object.values(this.charts).forEach(c => c?.destroy());
        this.charts = {};

        // Pie chart
        const pieCtx = document.getElementById('sentiment-pie-chart')?.getContext('2d');
        if (pieCtx) {
            this.charts.pie = new Chart(pieCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Positive', 'Negative', 'Neutral'],
                    datasets: [{
                        data: [report.overall_positive || 0, report.overall_negative || 0, report.overall_neutral || 0],
                        backgroundColor: ['#10B981', '#EF4444', '#6B7280'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#ccc', padding: 15 } }
                    }
                }
            });
        }

        // Bar chart
        const summaries = report.source_summaries || [];
        if (summaries.length > 0) {
            const barCtx = document.getElementById('source-bar-chart')?.getContext('2d');
            if (barCtx) {
                this.charts.bar = new Chart(barCtx, {
                    type: 'bar',
                    data: {
                        labels: summaries.slice(0, 8).map(s => this.truncate(s.source_name, 12)),
                        datasets: [
                            { label: 'Positive %', data: summaries.slice(0, 8).map(s => s.avg_positive || 0), backgroundColor: '#10B981' },
                            { label: 'Negative %', data: summaries.slice(0, 8).map(s => s.avg_negative || 0), backgroundColor: '#EF4444' }
                        ]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            x: { ticks: { color: '#999' }, grid: { color: '#333' } },
                            y: { ticks: { color: '#999' }, grid: { color: '#333' }, max: 100 }
                        },
                        plugins: {
                            legend: { position: 'top', labels: { color: '#ccc' } }
                        }
                    }
                });
            }
        }
    }

    truncate(str, max = 15) {
        if (!str) return '';
        return str.length > max ? str.substring(0, max) + '...' : str;
    }

    renderSourceTable(summaries) {
        const tbody = document.getElementById('source-table-body');
        if (!tbody) return;

        tbody.innerHTML = summaries.map(s => `
            <tr data-type="${s.source_type}">
                <td>${s.source_name || 'Unknown'}</td>
                <td><span class="type-badge type-${s.source_type}">${this.formatType(s.source_type)}</span></td>
                <td>${s.post_count || s.total_posts || 0}</td>
                <td class="positive">${(s.avg_positive || 0).toFixed(1)}%</td>
                <td class="negative">${(s.avg_negative || 0).toFixed(1)}%</td>
            </tr>
        `).join('');
    }

    formatType(type) {
        const map = { 'news_media': 'News', 'political_party': 'Party', 'candidate': 'Candidate' };
        return map[type] || type;
    }

    filterSourceTable(type) {
        document.querySelectorAll('#source-table-body tr').forEach(row => {
            row.style.display = (type === 'all' || row.dataset.type === type) ? '' : 'none';
        });
    }

    // ============================================
    // PDF Export
    // ============================================

    async exportPDF() {
        if (!this.currentReport) {
            alert('No report to export.');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const report = this.currentReport;

            // Header
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, 210, 35, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.text('Daily Political Sentiment Report', 14, 18);
            doc.setFontSize(11);
            doc.text(new Date(report.report_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), 14, 28);

            let y = 45;

            // Stats
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.text('Overview', 14, y);
            y += 8;

            doc.autoTable({
                startY: y,
                head: [],
                body: [
                    ['Posts Analyzed', report.total_posts_analyzed, 'Positive', `${(report.overall_positive || 0).toFixed(1)}%`],
                    ['Comments', report.total_comments_analyzed, 'Negative', `${(report.overall_negative || 0).toFixed(1)}%`],
                    ['Sources', report.total_sources, 'Neutral', `${(report.overall_neutral || 0).toFixed(1)}%`]
                ],
                theme: 'grid',
                styles: { fontSize: 10 },
                columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } }
            });

            y = doc.lastAutoTable.finalY + 12;

            // Summary
            doc.setFontSize(14);
            doc.text('Analysis Summary', 14, y);
            y += 6;

            const summaryText = (report.summary_text || '').replace(/<[^>]*>/g, '').replace(/\*\*/g, '');
            const lines = doc.splitTextToSize(summaryText, 180);
            doc.setFontSize(10);
            doc.text(lines, 14, y);
            y += lines.length * 5 + 10;

            // Sources
            if (y > 240) { doc.addPage(); y = 20; }
            doc.setFontSize(14);
            doc.text('Source Breakdown', 14, y);
            y += 4;

            const sourceData = (report.source_summaries || []).map(s => [
                s.source_name,
                s.post_count || s.total_posts || 0,
                `${(s.avg_positive || 0).toFixed(1)}%`,
                `${(s.avg_negative || 0).toFixed(1)}%`
            ]);

            doc.autoTable({
                startY: y,
                head: [['Source', 'Posts', 'Positive', 'Negative']],
                body: sourceData,
                headStyles: { fillColor: [16, 185, 129] },
                styles: { fontSize: 9 }
            });

            // Footer
            const pages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Page ${i}/${pages} - Political Assessment Tool`, 105, 290, { align: 'center' });
            }

            doc.save(`DailyReport_${report.report_date}.pdf`);
        } catch (error) {
            console.error('PDF error:', error);
            alert('Failed to generate PDF.');
        }
    }
}

// Initialize
let dailyReport;
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('daily-report-container')) {
        dailyReport = new DailyReportComponent('daily-report-container');
    }
});
