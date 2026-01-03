// config/environment.js - Environment configuration
require('dotenv').config();

function loadEnvironment() {
  console.log('📋 Loading environment configuration...');
  
  const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_GROUP_CHAT_ID',
    'GA4_PROPERTY_ID'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please check your Railway Variables configuration');
  } else {
    console.log('✅ Environment variables loaded successfully');
    console.log(`   Group Chat ID: ${process.env.TELEGRAM_GROUP_CHAT_ID}`);
    console.log(`   GA4 Property ID: ${process.env.GA4_PROPERTY_ID}`);
  }
  
  // Validate GA4 Property ID format
  const ga4PropertyId = process.env.GA4_PROPERTY_ID;
  if (ga4PropertyId && ga4PropertyId.includes('properties/')) {
    console.warn(`⚠️  Warning: GA4_PROPERTY_ID contains 'properties/' prefix. Should be numeric only.`);
  }
  
  return process.env;
}

module.exports = { loadEnvironment };
