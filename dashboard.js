// Add this check at the start of your file
if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded! Please check if the Chart.js script is properly included.');
} else {
    console.log('Chart.js version:', Chart.version);
}

class DashboardMetrics {
    constructor(airtableService) {
        this.airtableService = airtableService;
        this.monthlyRevenueChart = null;
        this.userGrowthChart = null;
        this.callPatternChart = null;
        this.currentTimeView = 'day';
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.totalCalls = 0;
        this.paginationCreated = false;
        this.lastUpdate = null;
        this.updateInterval = 30000; // 30 seconds
        this.cachedCalls = null;
    }

    // Helper function to safely update element text content
    safeSetText(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    // Helper function to format currency
    formatCurrency(amount) {
        return `$${Number(amount || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    async updateMetrics() {
        try {
            const calls = await this.airtableService.fetchCalls();
            
            // Calculate metrics without percentage changes
            const totalCalls = calls.length;
            const totalCost = calls.length > 0 ? 
                calls[0].fields['Cumulative Total Cost'] || 0 : 0;
            const avgCostPerMinute = calls.length > 0 ? 
                calls[0].fields['Avg cost per minute'] || 0 : 0;

            // Update only the main metrics
            this.safeSetText('total-calls', totalCalls.toLocaleString());
            this.safeSetText('cumulative-cost', this.formatCurrency(totalCost));
            this.safeSetText('avg-cost', this.formatCurrency(avgCostPerMinute));
            
        } catch (error) {
            console.error('Error updating metrics:', error);
            const defaultValues = {
                'total-calls': '0',
                'cumulative-cost': '$0.00',
                'avg-cost': '$0.00'
            };
            
            Object.entries(defaultValues).forEach(([id, value]) => {
                this.safeSetText(id, value);
            });
        }
    }

    // Create pagination controls only once
    createPaginationControls() {
        if (this.paginationCreated) return;

        const tableWrapper = document.querySelector('.table-wrapper');
        if (!tableWrapper) return;

        const paginationHtml = `
            <div class="pagination" id="pagination-controls">
                <button id="prevPage" class="pagination-btn">&lt; Previous</button>
                <span id="pageInfo" class="page-info">Page ${this.currentPage}</span>
                <button id="nextPage" class="pagination-btn">Next &gt;</button>
            </div>
        `;

        // Remove existing pagination if any
        const existingPagination = document.getElementById('pagination-controls');
        if (existingPagination) {
            existingPagination.remove();
        }

        tableWrapper.insertAdjacentHTML('afterend', paginationHtml);

        // Add event listeners
        document.getElementById('prevPage').addEventListener('click', () => this.changePage('prev'));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage('next'));

        this.paginationCreated = true;
    }

    // Update call logs with pagination
    async updateCallLogs() {
        try {
            const calls = await this.airtableService.fetchCalls();
            this.totalCalls = calls.length;
            const tableBody = document.querySelector('#recent-calls-table tbody');
            
            if (!tableBody) {
                console.error('Recent calls table not found in the DOM');
                return;
            }

            tableBody.innerHTML = '';

            // Calculate pagination
            const startIndex = (this.currentPage - 1) * this.itemsPerPage;
            const endIndex = startIndex + this.itemsPerPage;
            const paginatedCalls = calls.slice(startIndex, endIndex);

            paginatedCalls.forEach(call => {
                const row = document.createElement('tr');
                
                // Parse dates
                const startTime = new Date(call.fields['Start time']);
                const endTime = new Date(call.fields['End time']);
                
                // Calculate duration
                const duration = call.fields['Call duration'] || 0;
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

                // Format cost
                const totalCost = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                }).format(call.fields['Total cost'] || 0);

                row.innerHTML = `
                    <td>${call.fields['Phone number'] || '-'}</td>
                    <td>${formattedDuration}</td>
                    <td>${call.fields['Call status'] || '-'}</td>
                    <td>${call.fields['Ended reason'] || '-'}</td>
                    <td>${totalCost}</td>
                    <td>${startTime.toLocaleString()}</td>
                    <td>${endTime.toLocaleString()}</td>
                `;
                
                tableBody.appendChild(row);
            });

            // Update pagination info and buttons
            this.updatePaginationInfo();
            this.updatePaginationButtons();

        } catch (error) {
            console.error('Error updating call logs:', error);
            const tableBody = document.querySelector('#recent-calls-table tbody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: #ff4444;">
                            Error loading call logs. Please try again later.
                        </td>
                    </tr>
                `;
            }
        }
    }

    // Change page
    async changePage(direction) {
        const totalPages = Math.ceil(this.totalCalls / this.itemsPerPage);
        
        if (direction === 'prev' && this.currentPage > 1) {
            this.currentPage--;
        } else if (direction === 'next' && this.currentPage < totalPages) {
            this.currentPage++;
        }

        await this.updateCallLogs();
    }

    // Update pagination info
    updatePaginationInfo() {
        const totalPages = Math.ceil(this.totalCalls / this.itemsPerPage);
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        }
    }

    // Update pagination buttons state
    updatePaginationButtons() {
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const totalPages = Math.ceil(this.totalCalls / this.itemsPerPage);

        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages;
        }
    }

    async updateMonthlyRevenueChart() {
        try {
            const calls = await this.airtableService.fetchCalls();
            const monthlyData = this.groupCallsByMonth(calls);
            this.renderMonthlyRevenueChart(monthlyData);
        } catch (error) {
            console.error('Error updating monthly revenue chart:', error);
        }
    }

    groupCallsByMonth(calls) {
        const monthlyData = {};
        
        calls.forEach(call => {
            const startTime = new Date(call.fields['Start time']);
            const month = startTime.toLocaleString('default', { month: 'short' });
            const cost = parseFloat(call.fields['Total cost']) || 0;
            
            if (!monthlyData[month]) {
                monthlyData[month] = 0;
            }
            monthlyData[month] += cost;
        });

        // Get last 6 months in correct order
        const months = Object.keys(monthlyData);
        const sortedMonths = months.sort((a, b) => {
            const monthA = new Date(Date.parse(a + " 1, 2024"));
            const monthB = new Date(Date.parse(b + " 1, 2024"));
            return monthA - monthB;
        });

        // Create sorted data object
        const sortedData = {
            labels: sortedMonths,
            values: sortedMonths.map(month => monthlyData[month])
        };

        return sortedData;
    }

    renderMonthlyRevenueChart(data) {
        const ctx = document.getElementById('monthlyRevenueChart').getContext('2d');
        
        if (this.monthlyRevenueChart) {
            this.monthlyRevenueChart.destroy();
        }

        const isMobile = window.innerWidth < 768;

        const formattedData = {
            ...data,
            values: data.values.map(value => Number(value || 0))
        };

        this.monthlyRevenueChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: formattedData.labels,
                datasets: [{
                    data: formattedData.values,
                    backgroundColor: [
                        'rgba(0, 255, 136, 0.7)',
                        'rgba(0, 217, 255, 0.7)',
                        'rgba(255, 0, 230, 0.7)',
                        'rgba(255, 179, 0, 0.7)',
                        'rgba(166, 0, 255, 0.7)',
                        'rgba(255, 240, 0, 0.7)'
                    ],
                    borderColor: [
                        'rgb(0, 255, 136)',
                        'rgb(0, 217, 255)',
                        'rgb(255, 0, 230)',
                        'rgb(255, 179, 0)',
                        'rgb(166, 0, 255)',
                        'rgb(255, 240, 0)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: isMobile ? 10 : 20,
                        right: isMobile ? 10 : 20,
                        top: isMobile ? 10 : 20,
                        bottom: 0
                    }
                },
                plugins: {
                    tooltip: {
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                return `$${value.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })}`;
                            }
                        }
                    },
                    legend: {
                        position: 'bottom',
                        align: 'center',
                        labels: {
                            color: '#ffffff',
                            padding: isMobile ? 10 : 15,
                            font: {
                                family: "'Poppins', sans-serif",
                                size: isMobile ? 12 : 14,
                                weight: '500'
                            },
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const formattedValue = `$${value.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}`;
                                        const text = `${label}: ${formattedValue}`;
                                        return {
                                            text: text,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].borderColor[i],
                                            lineWidth: 2,
                                            hidden: false,
                                            index: i,
                                            fontColor: '#ffffff'
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    title: {
                        display: false
                    }
                }
            }
        });
    }

    async updateUserGrowthChart() {
        try {
            const calls = await this.airtableService.fetchCalls();
            
            // Group calls by week number
            const weeklyData = this.groupCallsByWeek(calls);
            
            // Sort by week number
            const sortedWeeks = Object.keys(weeklyData).sort((a, b) => parseInt(a) - parseInt(b));
            
            const data = {
                labels: sortedWeeks.map(week => `Week ${week}`),
                values: sortedWeeks.map(week => weeklyData[week])
            };

            this.renderUserGrowthChart(data);
            
        } catch (error) {
            console.error('Error updating user growth chart:', error);
        }
    }

    groupCallsByWeek(calls) {
        const weeklyData = {};
        
        calls.forEach(call => {
            const weekNumber = call.fields['Week number'];
            if (weekNumber) {
                weeklyData[weekNumber] = (weeklyData[weekNumber] || 0) + 1;
            }
        });

        return weeklyData;
    }

    renderUserGrowthChart(data) {
        const ctx = document.getElementById('userGrowthChart').getContext('2d');
        
        if (this.userGrowthChart) {
            this.userGrowthChart.destroy();
        }

        const isMobile = window.innerWidth < 768;

        Chart.defaults.font.family = "'Poppins', sans-serif";

        this.userGrowthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Number of Calls Weekly',
                    data: data.values,
                    borderColor: 'rgb(0, 255, 136)',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: isMobile ? 10 : 20,
                        right: isMobile ? 10 : 20,
                        top: isMobile ? 10 : 20,
                        bottom: 0
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        align: 'center',
                        labels: {
                            color: '#ffffff',
                            padding: isMobile ? 10 : 15,
                            font: {
                                family: "'Poppins', sans-serif",
                                size: isMobile ? 12 : 14,
                                weight: '500'
                            },
                            boxWidth: 40,
                            usePointStyle: true,
                            pointStyle: 'line'
                        }
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#999999',
                            font: {
                                family: "'Poppins', sans-serif",
                                size: isMobile ? 10 : 12
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#999999',
                            font: {
                                family: "'Poppins', sans-serif",
                                size: isMobile ? 10 : 12
                            }
                        }
                    }
                }
            }
        });
    }

    // Helper function to safely convert duration to minutes
    convertDurationToMinutes(duration) {
        if (!duration) return 0;
        
        // If duration is already a number, return it
        if (typeof duration === 'number') return duration;
        
        // If it's a string in format "MM:SS"
        if (typeof duration === 'string' && duration.includes(':')) {
            const [minutes, seconds] = duration.split(':').map(Number);
            return minutes + (seconds / 60);
        }
        
        // If it's a string number, convert it
        if (typeof duration === 'string') { 
            return parseFloat(duration) || 0;
        }
        
        return 0;
    }

    // Add new method to cache calls data
    async getCalls() {
        const now = new Date().getTime();
        
        // If we have cached data and it's less than 30 seconds old, use it
        if (this.cachedCalls && this.lastUpdate && 
            (now - this.lastUpdate) < this.updateInterval) {
            return this.cachedCalls;
        }

        // Otherwise fetch new data
        try {
            const calls = await this.airtableService.fetchCalls();
            this.cachedCalls = calls;
            this.lastUpdate = now;
            return calls;
        } catch (error) {
            console.error('Error fetching calls:', error);
            return this.cachedCalls || []; // Return cached data if available, else empty array
        }
    }

    // Update the changeTimeView method
    async changeTimeView(view) {
        if (this.currentTimeView === view) return; // Don't update if view hasn't changed
        
        this.currentTimeView = view;
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        await this.renderCallPatternChart();
    }

    // Update the renderCallPatternChart method
    async renderCallPatternChart() {
        try {
            const ctx = document.getElementById('callPatternChart')?.getContext('2d');
            if (!ctx) {
                console.error('Canvas context not found');
                return;
            }

            // Use cached calls data
            const calls = await this.getCalls();
            
            if (this.callPatternChart) {
                this.callPatternChart.destroy();
            }

            const patterns = this.processCallPatterns(calls);
            const labels = this.getTimeLabels();
            const currentHour = new Date().getHours();

            const getTitleText = () => {
                const now = new Date();
                switch(this.currentTimeView) {
                    case 'day':
                        return `Today's Call Pattern (${now.toLocaleDateString()})`;
                    case 'week':
                        const weekStart = this.getStartOfWeek(now);
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekEnd.getDate() + 6);
                        return `Current Week's Call Pattern (${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()})`;
                    case 'month':
                        return `Current Month's Call Pattern (${now.toLocaleString('default', { month: 'long', year: 'numeric' })})`;
                    default:
                        return 'Call Pattern Analysis';
                }
            };

            this.callPatternChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Call Volume',
                        data: patterns[this.currentTimeView],
                        borderColor: 'rgb(0, 255, 136)',
                        backgroundColor: 'rgba(0, 255, 136, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: 'rgb(0, 255, 136)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgb(0, 255, 136)',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        cubicInterpolationMode: 'monotone'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: getTitleText(),
                            color: '#ffffff',
                            padding: {
                                top: 10,
                                bottom: 30
                            }
                        },
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                color: '#ffffff',
                                padding: 20,
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        annotation: {
                            annotations: this.currentTimeView === 'day' ? {
                                line1: {
                                    type: 'line',
                                    xMin: currentHour,
                                    xMax: currentHour,
                                    borderColor: 'rgba(255, 255, 255, 0.5)',
                                    borderWidth: 2,
                                    borderDash: [5, 5],
                                    label: {
                                        content: 'Current Time',
                                        enabled: true,
                                        position: 'top'
                                    }
                                }
                            } : {}
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                drawBorder: false
                            },
                            ticks: {
                                color: '#999999',
                                padding: 10
                            }
                        },
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                drawBorder: false
                            },
                            ticks: {
                                color: '#999999',
                                maxRotation: 45,
                                minRotation: 45,
                                padding: 10
                            }
                        }
                    },
                    elements: {
                        line: {
                            tension: 0.4
                        },
                        point: {
                            radius: 4,
                            hoverRadius: 6,
                            backgroundColor: 'rgb(0, 255, 136)',
                            borderColor: '#ffffff'
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    hover: {
                        mode: 'nearest',
                        intersect: true
                    }
                }
            });
        } catch (error) {
            console.error('Error rendering call pattern chart:', error);
        }
    }

    // Update initialize method
    async initialize() {
        try {
            this.createPaginationControls();
            
            // Initial data fetch
            await this.getCalls();

            await Promise.all([
                this.updateMetrics(),
                this.updateMonthlyRevenueChart(),
                this.updateUserGrowthChart(),
                this.updateCallLogs(),
                this.renderCallPatternChart()
            ]);

            // Add event listeners for view buttons
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const newView = e.target.dataset.view;
                    this.changeTimeView(newView);
                });
            });

            // Set up periodic updates
            setInterval(async () => {
                const calls = await this.getCalls(); // This will only fetch if cache is expired
                if (calls !== this.cachedCalls) {
                    await this.renderCallPatternChart();
                }
            }, this.updateInterval);

        } catch (error) {
            console.error('Error initializing dashboard:', error);
        }
    }

    // Add these helper methods to your class
    getStartOfWeek(date) {
        const curr = new Date(date);
        curr.setHours(0, 0, 0, 0);
        const first = curr.getDate() - curr.getDay();
        return new Date(curr.setDate(first));
    }

    getStartOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    // Update the processCallPatterns method
    processCallPatterns(calls) {
        const patterns = {
            day: new Array(24).fill(0),
            week: new Array(7).fill(0),
            month: new Array(31).fill(0)
        };

        // Get current date references
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        
        const currentWeekStart = this.getStartOfWeek(now);
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
        
        const currentMonthStart = this.getStartOfMonth(now);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        calls.forEach(call => {
            const startTimeStr = call.fields['Start time'];
            if (!startTimeStr) return;

            const startTime = new Date(startTimeStr);
            if (isNaN(startTime.getTime())) {
                console.warn('Invalid date:', startTimeStr);
                return;
            }

            // Process based on current view
            switch(this.currentTimeView) {
                case 'day':
                    // Only count calls from today
                    if (startTime.toDateString() === today.toDateString()) {
                        patterns.day[startTime.getHours()]++;
                    }
                    break;

                case 'week':
                    // Only count calls from current week
                    if (startTime >= currentWeekStart && startTime < currentWeekEnd) {
                        patterns.week[startTime.getDay()]++;
                    }
                    break;

                case 'month':
                    // Only count calls from current month
                    if (startTime >= currentMonthStart && startTime <= currentMonthEnd) {
                        patterns.month[startTime.getDate() - 1]++;
                    }
                    break;
            }
        });

        return patterns;
    }

    // Update the getTimeLabels method
    getTimeLabels() {
        const now = new Date();
        
        switch(this.currentTimeView) {
            case 'day':
                return Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`);
            
            case 'week':
                const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const currentWeekStart = this.getStartOfWeek(now);
                return weekDays.map((day, index) => {
                    const date = new Date(currentWeekStart);
                    date.setDate(date.getDate() + index);
                    return `${day} (${date.getDate()}/${date.getMonth() + 1})`;
                });
            
            case 'month':
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                return Array.from({length: daysInMonth}, (_, i) => `Day ${i + 1}`);
        }
    }
}

// Update the initialization code
document.addEventListener('DOMContentLoaded', async () => {
    const airtableService = new AirtableService();
    const dashboardMetrics = new DashboardMetrics(airtableService);
    
    // Initial load
    await dashboardMetrics.initialize();
    
    // Update every 30 seconds
    setInterval(async () => {
        await dashboardMetrics.initialize();
    }, 30000);
}); 