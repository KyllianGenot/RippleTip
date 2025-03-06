require('dotenv').config();
const mongoose = require('mongoose');

// Function to test different MongoDB connection configurations
async function testMongoDBConnection() {
  console.log('Testing MongoDB connection...');
  console.log('URI:', process.env.MONGODB_URI.replace(/:[^:]*@/, ':***@')); // Hide password
  
  // Try different configurations
  const configs = [
    {
      name: "Basic configuration",
      options: {}
    },
    {
      name: "Configuration with SSL disabled",
      options: { ssl: false }
    },
    {
      name: "Configuration with SSL and invalid certificates allowed",
      options: { ssl: true, tlsAllowInvalidCertificates: true }
    },
    {
      name: "Configuration with increased timeouts",
      options: { 
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000
      }
    },
    {
      name: "Configuration with all options",
      options: {
        ssl: true,
        tlsAllowInvalidCertificates: true,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000
      }
    }
  ];
  
  // Test each configuration
  for (const config of configs) {
    console.log(`\nTesting with ${config.name}...`);
    
    try {
      // Close previous connection if it exists
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
      
      // Attempt connection with this configuration
      await mongoose.connect(process.env.MONGODB_URI, config.options);
      
      console.log(`✅ Connection successful with ${config.name}!`);
      console.log(`Connection state: ${mongoose.connection.readyState}`);
      
      // Test a simple operation
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log(`Available collections: ${collections.map(c => c.name).join(', ') || 'none'}`);
      
      // Close the connection
      await mongoose.connection.close();
      
      // This configuration works, save it to a file
      console.log(`\n✅ Working configuration: ${config.name}`);
      console.log('Options:');
      console.log(JSON.stringify(config.options, null, 2));
      
      // Exit the loop because we found a working configuration
      process.exit(0);
    } catch (error) {
      console.error(`❌ Failed with ${config.name}:`, error.message);
    }
  }
  
  console.log('\n❌ No configuration worked. Check your connection string and credentials.');
  process.exit(1);
}

// Run the test
testMongoDBConnection(); 