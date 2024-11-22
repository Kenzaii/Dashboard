class AirtableService {
    constructor() {
        this.baseId = 'appCcEuHrMg1fP0GZ';
        this.apiKey = 'patTUtoTjm52HM0XT.7e96a55bb8b9daad18614eddc178520bc23ab86a4ae493fdc2fda0ced63cc205';
        this.tableName = 'Calls';
        this.baseURL = `https://api.airtable.com/v0/${this.baseId}/${this.tableName}`;
    }

    async fetchCalls() {
        try {
            const response = await fetch(this.baseURL, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            const data = await response.json();
            return data.records;
        } catch (error) {
            console.error('Error fetching data:', error);
            return [];
        }
    }

    async getCallStats() {
        const calls = await this.fetchCalls();
        
        // Calculate statistics
        const totalCalls = calls.length;
        let totalCost = 0;
        let incomingCalls = 0;
        let outgoingCalls = 0;
        let missedCalls = 0;

        calls.forEach(call => {
            totalCost += call.fields['Total cost'] || 0;
            
            switch(call.fields['Call status']) {
                case 'incoming':
                    incomingCalls++;
                    break;
                case 'outgoing':
                    outgoingCalls++;
                    break;
                case 'missed':
                    missedCalls++;
                    break;
            }
        });

        return {
            totalCalls,
            totalCost,
            callBreakdown: {
                incoming: (incomingCalls / totalCalls) * 100,
                outgoing: (outgoingCalls / totalCalls) * 100,
                missed: (missedCalls / totalCalls) * 100
            },
            recentCalls: calls.slice(0, 10) // Get last 10 calls
        };
    }
} 