const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoMemoryServer;

// Function to connect to MongoDB
async function connectToDatabase() {
  try {
    // Disable deprecation warnings
    mongoose.set('strictQuery', false);
    
    console.log('Attempting to connect to MongoDB...');
    
    // Connection options
    const options = {
      serverSelectionTimeoutMS: 5000, // Reduce timeout to fail faster
    };
    
    try {
      // Attempt to connect to the configured database
      await mongoose.connect(process.env.MONGODB_URI, options);
      console.log('Successfully connected to MongoDB!');
      return true;
    } catch (error) {
      console.error('Error connecting to MongoDB:', error.message);
      console.log("Attempting to start an in-memory database...");
      
      // Start an in-memory MongoDB database
      mongoMemoryServer = await MongoMemoryServer.create();
      const mongoUri = mongoMemoryServer.getUri();
      
      console.log(`In-memory database started at address: ${mongoUri}`);
      
      // Connect to the in-memory database
      await mongoose.connect(mongoUri);
      console.log('Successfully connected to the in-memory database!');
      
      return true;
    }
  } catch (error) {
    console.error('Fatal error connecting to MongoDB:', error.message);
    return false;
  }
}

// Check connection status
function isConnected() {
  return mongoose.connection.readyState === 1;
}

// Close connection and stop in-memory server if necessary
async function closeConnection() {
  await mongoose.connection.close();
  
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
    console.log('In-memory MongoDB server stopped');
  }
  
  console.log('MongoDB connection closed');
}

module.exports = {
  connectToDatabase,
  isConnected,
  closeConnection
}; 