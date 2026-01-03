// services/ga4-client.js - Google Analytics 4 client
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { GoogleAuth } = require('google-auth-library');

function initializeGA4Client() {
  console.log('🔧 Initializing GA4 Client...');
  
  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error('❌ GOOGLE_APPLICATION_CREDENTIALS not found in environment');
      return null;
    }
    
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    
    if (!credentials.client_email) {
      console.error('❌ Invalid Google credentials: missing client_email');
      return null;
    }
    
    console.log(`   Service Account: ${credentials.client_email}`);
    
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });
    
    const analyticsDataClient = new BetaAnalyticsDataClient({ auth });
    
    // Test the connection
    testGA4Connection(analyticsDataClient);
    
    console.log('✅ GA4 Client initialized successfully');
    return analyticsDataClient;
    
  } catch (error) {
    console.error('❌ Failed to initialize GA4 Client:', error.message);
    
    // Detailed error logging
    if (error.message.includes('Unexpected token')) {
      console.error('   This usually means GOOGLE_APPLICATION_CREDENTIALS contains invalid JSON');
      console.error('   Check the value in Railway Variables - it should be complete JSON, not a filename');
    }
    
    return null;
  }
}

async function testGA4Connection(client) {
  if (!client || !process.env.GA4_PROPERTY_ID) {
    console.log('   ⚠️  GA4 connection test skipped (missing client or property ID)');
    return;
  }
  
  const propertyId = process.env.GA4_PROPERTY_ID;
  console.log(`   Testing connection to GA4 Property: ${propertyId}`);
  
  try {
    // Simple test query
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '1daysAgo', endDate: 'today' }],
      metrics: [{ name: 'sessions' }],
      limit: 1
    });
    
    console.log(`   ✅ GA4 connection test successful`);
    console.log(`      Data available: ${response.rows ? 'Yes' : 'No'}`);
    
  } catch (error) {
    console.error(`   ❌ GA4 connection test failed:`);
    console.error(`      Error: ${error.message}`);
    
    // Provide helpful diagnostics
    if (error.message.includes('INVALID_ARGUMENT')) {
      console.error(`      Likely causes:`);
      console.error(`      1. Property ID "${propertyId}" is incorrect`);
      console.error(`      2. Service account lacks access to this property`);
      console.error(`      3. Property doesn't exist or isn't a GA4 property`);
    }
    
    if (error.message.includes('PERMISSION_DENIED')) {
      console.error(`      Service account needs "Viewer" access in Google Analytics`);
      console.error(`      Add this email to GA4 Property Access Management:`);
      console.error(`      ${JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS).client_email}`);
    }
  }
}

module.exports = { initializeGA4Client };
