class AirtableService {
    constructor() {
        this.baseId = 'appCcEuHrMg1fP0GZ';
        this.apiKey = 'patTUtoTjm52HM0XT.7e96a55bb8b9daad18614eddc178520bc23ab86a4ae493fdc2fda0ced63cc205';
        this.tableName = 'Calls';
        this.baseURL = `https://api.airtable.com/v0/${this.baseId}/${this.tableName}`;
    }

    async fetchCalls() {
        try {
            // Sort by Start time in descending order
            const url = `${this.baseURL}?sort[0][field]=Start time&sort[0][direction]=desc`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data.records;
        } catch (error) {
            console.error('Error fetching data:', error);
            return [];
        }
    }

    // Add error handling for the interval
    startPolling(interval = 30000) {
        this.pollingInterval = setInterval(async () => {
            try {
                await this.fetchCalls();
            } catch (error) {
                console.error('Polling error:', error);
                // Optional: stop polling on persistent errors
                // clearInterval(this.pollingInterval);
            }
        }, interval);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
    }
} 