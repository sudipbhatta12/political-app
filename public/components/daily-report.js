/**
 * Daily Report Component
 * Displays daily sentiment reports with interactive charts
 */

class DailyReportComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentReport = null;
        this.charts = {};
        this.init();
    }

    init() {
        this.render();
        this.loadTodayReport();
    }

    render() {
        this.container.innerHTML = `
            <div class="daily-report-container">
                <!-- Header with Date Selector -->
                <div class="report-header">
                    <h2 class="report-title">📊 Daily Political Analysis Report</h2>
                    <div class="report-controls">
                        <input type="date" id="report-date-picker" class="date-picker">
                        <button id="generate-report-btn" class="btn btn-primary">
                            <span class="btn-icon">⚡</span> Generate Report
                        </button>
                    </div>
                </div>

                <!-- Loading State -->
                <div id="report-loading" class="report-loading" style="display: none;">
                    <div class="spinner"></div>
                    <p>Generating report with AI analysis...</p>
                </div>

                <!-- No Data State -->
                <div id="report-no-data" class="report-no-data" style="display: none;">
                    <div class="no-data-icon">📭</div>
                    <h3>No Report Available</h3>
                    <p>No data found for this date. Click "Generate Report" to create one.</p>
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
                            <div class="card-label">Comments Analyzed</div>
                        </div>
                        <div class="summary-card">
                            <div class="card-icon">📡</div>
                            <div class="card-value" id="total-sources">0</div>
                            <div class="card-label">Sources Covered</div>
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

                    <!-- Charts Section -->
                    <div class="charts-section">
                        <div class="chart-container">
                            <h3>Overall Sentiment Distribution</h3>
                            <canvas id="sentiment-pie-chart"></canvas>
                        </div>
                        <div class="chart-container">
                            <h3>Sentiment by Source</h3>
                            <canvas id="source-bar-chart"></canvas>
                        </div>
                    </div>

                    <!-- AI Summary -->
                    <div class="ai-summary-section">
                        <h3>📋 AI Analysis Summary</h3>
                        <div id="ai-summary" class="ai-summary"></div>
                    </div>

                    <!-- Source Breakdown Table -->
                    <div class="source-breakdown">
                        <h3>📰 Source Breakdown</h3>
                        <div class="source-tabs">
                            <button class="source-tab active" data-type="all">All</button>
                            <button class="source-tab" data-type="news_media">News Media</button>
                            <button class="source-tab" data-type="political_party">Parties</button>
                            <button class="source-tab" data-type="candidate">Candidates</button>
                        </div>
                        <table class="source-table">
                            <thead>
                                <tr>
                                    <th>Source</th>
                                    <th>Type</th>
                                    <th>Posts</th>
                                    <th>Comments</th>
                                    <th>Positive</th>
                                    <th>Negative</th>
                                    <th>Neutral</th>
                                </tr>
                            </thead>
                            <tbody id="source-table-body"></tbody>
                        </table>
                    </div>

                    <!-- Report History -->
                    <div class="report-history">
                        <h3>📅 Recent Reports</h3>
                        <div id="report-history-list" class="history-list"></div>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Date picker
        const datePicker = document.getElementById('report-date-picker');
        const today = new Date().toISOString().split('T')[0];
        datePicker.value = today;
        datePicker.max = today;
        datePicker.addEventListener('change', (e) => this.loadReportByDate(e.target.value));

        // Generate button
        document.getElementById('generate-report-btn').addEventListener('click', () => {
            const date = datePicker.value;
            this.generateReport(date);
        });

        // Source tabs
        document.querySelectorAll('.source-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.filterSourceTable(e.target.dataset.type);
            });
        });
    }

    async loadTodayReport() {
        const today = new Date().toISOString().split('T')[0];
        await this.loadReportByDate(today);
    }

    async loadReportByDate(date) {
        this.showLoading();

        try {
            const response = await fetch(`/api/reports/daily/${date}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });

            if (response.ok) {
                const report = await response.json();
                if (report.id) {
                    this.currentReport = report;
                    this.displayReport(report);
                } else {
                    this.showNoData();
                }
            } else {
                this.showNoData();
            }
        } catch (error) {
            console.error('Error loading report:', error);
            this.showNoData();
        }
    }

    async generateReport(date) {
        this.showLoading();

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
                await this.loadReportByDate(date);
            } else {
                alert(result.message || 'Failed to generate report');
                this.showNoData();
            }
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Error generating report. Please try again.');
            this.showNoData();
        }
    }

    displayReport(report) {
        document.getElementById('report-loading').style.display = 'none';
        document.getElementById('report-no-data').style.display = 'none';
        document.getElementById('report-content').style.display = 'block';

        // Update summary cards
        document.getElementById('total-posts').textContent = report.total_posts_analyzed?.toLocaleString() || '0';
        document.getElementById('total-comments').textContent = report.total_comments_analyzed?.toLocaleString() || '0';
        document.getElementById('total-sources').textContent = report.total_sources || '0';
        document.getElementById('positive-pct').textContent = `${(report.overall_positive || 0).toFixed(1)}%`;
        document.getElementById('negative-pct').textContent = `${(report.overall_negative || 0).toFixed(1)}%`;
        document.getElementById('neutral-pct').textContent = `${(report.overall_neutral || 0).toFixed(1)}%`;

        // Update AI summary
        const summaryEl = document.getElementById('ai-summary');
        summaryEl.innerHTML = this.formatSummary(report.summary_text || 'No summary available.');

        // Update charts
        this.renderCharts(report);

        // Update source table
        this.renderSourceTable(report.source_summaries || []);

        // Load history
        this.loadReportHistory();
    }

    formatSummary(text) {
        return text.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('');
    }

    renderCharts(report) {
        // Destroy existing charts
        Object.values(this.charts).forEach(chart => chart.destroy());
        this.charts = {};

        // Sentiment Pie Chart
        const pieCtx = document.getElementById('sentiment-pie-chart').getContext('2d');
        this.charts.pie = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['Positive', 'Negative', 'Neutral'],
                datasets: [{
                    data: [
                        report.overall_positive || 0,
                        report.overall_negative || 0,
                        report.overall_neutral || 0
                    ],
                    backgroundColor: ['#10B981', '#EF4444', '#6B7280'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#ccc', padding: 20, font: { size: 14 } }
                    }
                }
            }
        });

        // Source Bar Chart
        const summaries = report.source_summaries || [];
        if (summaries.length > 0) {
            const barCtx = document.getElementById('source-bar-chart').getContext('2d');
            this.charts.bar = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: summaries.slice(0, 10).map(s => this.truncateLabel(s.source_name)),
                    datasets: [
                        {
                            label: 'Positive %',
                            data: summaries.slice(0, 10).map(s => s.avg_positive || 0),
                            backgroundColor: '#10B981'
                        },
                        {
                            label: 'Negative %',
                            data: summaries.slice(0, 10).map(s => s.avg_negative || 0),
                            backgroundColor: '#EF4444'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        x: { ticks: { color: '#999' }, grid: { color: '#333' } },
                        y: { ticks: { color: '#999' }, grid: { color: '#333' }, max: 100 }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: '#ccc', padding: 15 }
                        }
                    }
                }
            });
        }
    }

    truncateLabel(label, maxLen = 15) {
        if (!label) return '';
        return label.length > maxLen ? label.substring(0, maxLen) + '...' : label;
    }

    renderSourceTable(summaries) {
        const tbody = document.getElementById('source-table-body');
        tbody.innerHTML = summaries.map(s => `
            <tr data-type="${s.source_type}">
                <td>${s.source_name || 'Unknown'}</td>
                <td><span class="type-badge type-${s.source_type}">${this.formatSourceType(s.source_type)}</span></td>
                <td>${s.post_count || 0}</td>
                <td>${(s.comment_count || 0).toLocaleString()}</td>
                <td class="positive">${(s.avg_positive || 0).toFixed(1)}%</td>
                <td class="negative">${(s.avg_negative || 0).toFixed(1)}%</td>
                <td class="neutral">${(s.avg_neutral || 0).toFixed(1)}%</td>
            </tr>
        `).join('');
    }

    formatSourceType(type) {
        const types = {
            'news_media': 'News',
            'political_party': 'Party',
            'candidate': 'Candidate'
        };
        return types[type] || type;
    }

    filterSourceTable(type) {
        const rows = document.querySelectorAll('#source-table-body tr');
        rows.forEach(row => {
            if (type === 'all' || row.dataset.type === type) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    async loadReportHistory() {
        try {
            const response = await fetch('/api/reports/history?limit=10', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            const history = await response.json();

            const container = document.getElementById('report-history-list');
            container.innerHTML = history.map(r => `
                <div class="history-item" onclick="dailyReport.loadReportByDate('${r.report_date}')">
                    <div class="history-date">${new Date(r.report_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div class="history-stats">
                        <span>${r.total_posts_analyzed} posts</span>
                        <span class="positive">${(r.overall_positive || 0).toFixed(0)}% +</span>
                    </div>
                </div>
            `).join('') || '<p class="no-history">No reports yet</p>';
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    showLoading() {
        document.getElementById('report-loading').style.display = 'flex';
        document.getElementById('report-no-data').style.display = 'none';
        document.getElementById('report-content').style.display = 'none';
    }

    showNoData() {
        document.getElementById('report-loading').style.display = 'none';
        document.getElementById('report-no-data').style.display = 'flex';
        document.getElementById('report-content').style.display = 'none';
    }
}

// Initialize when DOM is ready
let dailyReport;
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('daily-report-container')) {
        dailyReport = new DailyReportComponent('daily-report-container');
    }
});
