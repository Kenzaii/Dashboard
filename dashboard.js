class DashboardMetrics {
    constructor(airtableService) {
        this.airtableService = airtableService;
        this.previousMetrics = null;
    }

    async updateMetrics() {
        try {
            const calls = await this.airtableService.fetchCalls();
            
            // Sort calls by Start time to get the latest entry
            const sortedCalls = calls.sort((a, b) => {
                return new Date(b.fields['Start time']) - new Date(a.fields['Start time']);
            });

            // Get the latest call's cumulative cost
            const latestCall = sortedCalls[0];
            const currentMetrics = {
                totalCalls: calls.length,
                cumulativeCost: latestCall?.fields['Cumulative Total Cost'] || 0,
                avgCostPerMinute: latestCall?.fields['Avg cost per minute'] || 0
            };
            
            // Update UI
            this.updateUI(currentMetrics);
            
            // Store metrics for next comparison
            this.previousMetrics = currentMetrics;
            
        } catch (error) {
            console.error('Error updating metrics:', error);
        }
    }

    updateUI(metrics) {
        // Update Total Calls
        const totalCallsElement = document.getElementById('total-calls');
        const callsChangeElement = document.getElementById('calls-change');
        totalCallsElement.textContent = metrics.totalCalls.toLocaleString();

        // Update Cumulative Cost (Latest Value)
        const costElement = document.getElementById('cumulative-cost');
        costElement.textContent = `$${metrics.cumulativeCost.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

        // Update Average Cost Per Minute
        const avgCostElement = document.getElementById('avg-cost');
        avgCostElement.textContent = `$${metrics.avgCostPerMinute.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    async updateCallLogs() {
        try {
            const calls = await this.airtableService.fetchCalls();
            
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
        }
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

        this.userGrowthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Number of Calls',
                    data: data.values,
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#00ff88',
                    pointBorderColor: '#00ff88',
                    pointHoverBackgroundColor: '#ffffff',
                    pointHoverBorderColor: '#00ff88',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: window.innerWidth < 768 ? 'bottom' : 'right',
                        labels: {
                            boxWidth: window.innerWidth < 768 ? 12 : 20,
                            padding: window.innerWidth < 768 ? 10 : 20,
                            font: {
                                size: window.innerWidth < 768 ? 11 : 12
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1a1a1a',
                        titleColor: '#ffffff',
                        bodyColor: '#00ff88',
                        borderColor: '#333333',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            title: (tooltipItems) => {
                                return tooltipItems[0].label;
                            },
                            label: (context) => {
                                return `Calls: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#333333',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#999999',
                            font: {
                                size: window.innerWidth < 768 ? 10 : 12
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#333333',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#999999',
                            precision: 0,
                            font: {
                                size: window.innerWidth < 768 ? 10 : 12
                            }
                        }
                    }
                }
            }
        });
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

        // Modern neon color palette
        const colorPalette = {
            backgrounds: [
                'rgba(0, 255, 136, 0.7)',    // Neon Green
                'rgba(0, 217, 255, 0.7)',    // Neon Blue
                'rgba(255, 0, 230, 0.7)',    // Neon Pink
                'rgba(255, 179, 0, 0.7)',    // Neon Orange
                'rgba(166, 0, 255, 0.7)',    // Neon Purple
                'rgba(255, 240, 0, 0.7)',    // Neon Yellow
                'rgba(255, 0, 102, 0.7)',    // Neon Red
                'rgba(0, 255, 217, 0.7)',    // Neon Cyan
                'rgba(242, 0, 255, 0.7)',    // Neon Magenta
                'rgba(0, 255, 64, 0.7)',     // Light Neon Green
                'rgba(0, 162, 255, 0.7)',    // Light Neon Blue
                'rgba(255, 0, 170, 0.7)'     // Light Neon Pink
            ],
            borders: [
                'rgb(0, 255, 136)',      // Neon Green
                'rgb(0, 217, 255)',      // Neon Blue
                'rgb(255, 0, 230)',      // Neon Pink
                'rgb(255, 179, 0)',      // Neon Orange
                'rgb(166, 0, 255)',      // Neon Purple
                'rgb(255, 240, 0)',      // Neon Yellow
                'rgb(255, 0, 102)',      // Neon Red
                'rgb(0, 255, 217)',      // Neon Cyan
                'rgb(242, 0, 255)',      // Neon Magenta
                'rgb(0, 255, 64)',       // Light Neon Green
                'rgb(0, 162, 255)',      // Light Neon Blue
                'rgb(255, 0, 170)'       // Light Neon Pink
            ]
        };

        Chart.defaults.color = '#ffffff'; // Set default color for all chart text
        Chart.defaults.font.family = "'Poppins', sans-serif";

        this.monthlyRevenueChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: colorPalette.backgrounds,
                    borderColor: colorPalette.borders,
                    borderWidth: 2,
                    hoverOffset: 15,
                    hoverBorderWidth: 3,
                    hoverBorderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: 20
                },
                plugins: {
                    legend: {
                        position: window.innerWidth < 768 ? 'bottom' : 'right',
                        labels: {
                            boxWidth: window.innerWidth < 768 ? 12 : 20,
                            padding: window.innerWidth < 768 ? 10 : 20,
                            font: {
                                size: window.innerWidth < 768 ? 11 : 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1a1a1a',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#333333',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return [
                                    `Amount: $${value.toFixed(2)}`,
                                    `Percentage: ${percentage}%`
                                ];
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1500,
                    easing: 'easeInOutQuart'
                },
                elements: {
                    arc: {
                        borderAlign: 'inner',
                        borderJoinStyle: 'round'
                    }
                }
            }
        });

        // Add glow effect to the chart
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0, 255, 136, 0.5)';
    }
}

// Initialize and start updates
document.addEventListener('DOMContentLoaded', async () => {
    const airtableService = new AirtableService();
    const dashboardMetrics = new DashboardMetrics(airtableService);
    
    // Initial updates
    await Promise.all([
        dashboardMetrics.updateMetrics(),
        dashboardMetrics.updateCallLogs(),
        dashboardMetrics.updateUserGrowthChart(),
        dashboardMetrics.updateMonthlyRevenueChart()
    ]);
    
    // Update every 30 seconds
    setInterval(async () => {
        await Promise.all([
            dashboardMetrics.updateMetrics(),
            dashboardMetrics.updateCallLogs(),
            dashboardMetrics.updateUserGrowthChart(),
            dashboardMetrics.updateMonthlyRevenueChart()
        ]);
    }, 30000);
});

// Add window resize handler
window.addEventListener('resize', () => {
    if (window.monthlyRevenueChart) {
        window.monthlyRevenueChart.options.plugins.legend.position = 
            window.innerWidth < 768 ? 'bottom' : 'right';
        window.monthlyRevenueChart.update();
    }
    if (window.userGrowthChart) {
        window.userGrowthChart.options.plugins.legend.position = 
            window.innerWidth < 768 ? 'bottom' : 'right';
        window.userGrowthChart.update();
    }
}); 