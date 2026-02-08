/**
 * Test script for Daily Report generation
 */
const dailyReportService = require('./server/services/daily-report');

async function runTest() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`🧪 Starting test for date: ${today}`);

    try {
        const result = await dailyReportService.generateDailyReport(today);
        console.log('\n📊 TEST RESULT:');
        console.log(JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('\n✅ SUCCESS: Report generated or updated.');
        } else {
            console.log('\n❌ FAILED:', result.message);
        }
    } catch (error) {
        console.error('\n💥 TEST ERROR:', error);
    }
}

runTest();
