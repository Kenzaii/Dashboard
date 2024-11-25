// Add this check at the start of your file
if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded!');
}

class DashboardMetrics {
    constructor(airtableService) {
        this.airtableService = airtableService;
        this.monthlyRevenueChart = null;
        this.userGrowthChart = null;
        this.retryDelay = 5000; // 5 seconds between retries
        this.maxRetries = 3;
    }

    async fetchWithRetry(fetchFunction, retries = 0) {
        try {
            return await fetchFunction();
        } catch (error) {
            if (retries < this.maxRetries) {
                console.log(`Retry attempt ${retries + 1} of ${this.maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.fetchWithRetry(fetchFunction, retries + 1);
            }
            throw error;
        }
    }

    async updateCallLogs() {
        try {
            const calls = await this.fetchWithRetry(() => this.airtableService.fetchCalls());
            if (!calls || calls.length === 0) {
                console.log('No calls data available');
                return;
            }
            
            // Get the table body element
            const tableBody = document.getElementById('calls-table-body');
            tableBody.innerHTML = ''; // Clear existing rows
            
            // Take the 10 most recent calls
            const recentCalls = calls.slice(0, 10);
            
            recentCalls.forEach(call => {
                const row = document.createElement('tr');
                
                // Get values using exact field names
                const callId = call.fields['Call Id'] || '-';
                const phoneNumber = call.fields['Phone number'] || '-';
                const duration = call.fields['Call duration'] || '0';
                const status = call.fields['Call status']?.toLowerCase() || 'unknown';
                const cost = call.fields['Total cost'] || 0;
                
                row.innerHTML = `
                    <td>${callId}</td>
                    <td>${phoneNumber}</td>
                    <td>${duration}</td>
                    <td>
                        <span class="status ${status}">
                            ${status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                    </td>
                    <td>$${Number(cost).toFixed(2)}</td>
                `;
                
                tableBody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error updating call logs:', error);
            // Show user-friendly error message
            const tableBody = document.getElementById('calls-table-body');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: #ff4444;">
                            Unable to load call data. Please try again later.
                        </td>
                    </tr>
                `;
            }
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
        
        // Destroy existing chart if it exists
        if (this.monthlyRevenueChart) {
            this.monthlyRevenueChart.destroy();
        }

        // Set default Chart.js colors and fonts
        Chart.defaults.color = '#ffffff';
        Chart.defaults.font.family = "'Poppins', sans-serif";

        const isMobile = window.innerWidth < 768;

        this.monthlyRevenueChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
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
                        bottom: isMobile ? 10 : 20
                    }
                },
                plugins: {
                    legend: {
                        position: isMobile ? 'bottom' : 'right',
                        labels: {
                            padding: isMobile ? 10 : 20,
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
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
        
        // Destroy existing chart if it exists
        if (this.userGrowthChart) {
            this.userGrowthChart.destroy();
        }

        const isMobile = window.innerWidth < 768;

        this.userGrowthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'User Growth',
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
                        bottom: isMobile ? 10 : 20
                    }
                },
                plugins: {
                    legend: {
                        position: isMobile ? 'bottom' : 'top',
                        labels: {
                            padding: isMobile ? 10 : 20,
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            font: {
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

    // Helper function to format currency
    formatCurrency(amount) {
        return `$${Number(amount || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    // Helper function to safely update element text content
    safeSetText(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`Element with id '${elementId}' not found`);
        }
    }

    async updateMetrics() {
        try {
            const calls = await this.airtableService.fetchCalls();
            
            // Calculate total calls
            const totalCalls = calls.length;
            
            // Get latest Cumulative Total Cost (from the first record)
            const totalCost = calls.length > 0 ? 
                calls[0].fields['Cumulative Total Cost'] || 0 : 0;
            
            // Get Average Cost Per Minute
            const avgCostPerMinute = calls.length > 0 ? 
                calls[0].fields['Avg cost per minute'] || 0 : 0;

            // Update the DOM with formatted values using safe method
            this.safeSetText('total-calls', totalCalls.toLocaleString());
            this.safeSetText('cumulative-cost', this.formatCurrency(totalCost));
            this.safeSetText('avg-cost', this.formatCurrency(avgCostPerMinute));
            
            // Calculate percentage changes
            const previousTotalCalls = totalCalls * 0.9;
            const callsChange = ((totalCalls - previousTotalCalls) / previousTotalCalls) * 100;
            
            const previousTotalCost = totalCost * 0.9;
            const costChange = ((totalCost - previousTotalCost) / previousTotalCost) * 100;
            
            const previousAvgCost = avgCostPerMinute * 0.9;
            const avgCostChange = ((avgCostPerMinute - previousAvgCost) / previousAvgCost) * 100;
            
            // Format percentage changes
            const formatPercentage = (value) => {
                const sign = value >= 0 ? '+' : '';
                return `${sign}${value.toFixed(1)}%`;
            };
            
            // Update change percentages using safe method
            this.safeSetText('calls-change', formatPercentage(callsChange));
            this.safeSetText('cost-change', formatPercentage(costChange));
            this.safeSetText('avg-cost-change', formatPercentage(avgCostChange));
            
            // Update classes for styling
            const updateChangeClass = (elementId, value) => {
                const element = document.getElementById(elementId);
                if (element) {
                    element.className = `change ${value >= 0 ? 'positive' : 'negative'}`;
                }
            };
            
            updateChangeClass('calls-change', callsChange);
            updateChangeClass('cost-change', costChange);
            updateChangeClass('avg-cost-change', avgCostChange);
            
        } catch (error) {
            console.error('Error updating metrics:', error);
            // Set default values if there's an error
            const defaultValues = {
                'total-calls': '0',
                'cumulative-cost': '$0.00',
                'avg-cost': '$0.00',
                'calls-change': '0%',
                'cost-change': '0%',
                'avg-cost-change': '0%'
            };
            
            Object.entries(defaultValues).forEach(([id, value]) => {
                this.safeSetText(id, value);
            });
        }
    }

    // Update initialization
    async initialize() {
        try {
            await Promise.all([
                this.updateMetrics(),
                this.updateCallLogs(),
                this.updateMonthlyRevenueChart(),
                this.updateUserGrowthChart()
            ]);
        } catch (error) {
            console.error('Error initializing dashboard:', error);
        }
    }
}

// Update the initialization code
document.addEventListener('DOMContentLoaded', async () => {
    const airtableService = new AirtableService();
    const dashboardMetrics = new DashboardMetrics(airtableService);
    
    // Initial load
    await dashboardMetrics.initialize();
    
    // Update every 30 seconds with error handling
    const updateInterval = 30000;
    setInterval(async () => {
        try {
            await dashboardMetrics.initialize();
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    }, updateInterval);
}); 