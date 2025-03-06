require('dotenv').config();
const mongoose = require('mongoose');
const Mapping = require('../models/Mapping');
const Tip = require('../models/Tip');

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// Update indexes for all collections
async function updateIndexes() {
  try {
    console.log('Updating indexes...');
    
    // Drop existing indexes first (except _id)
    console.log('Dropping existing indexes for Mapping collection...');
    const mappingIndexes = await Mapping.collection.indexes();
    for (const index of mappingIndexes) {
      if (index.name !== '_id_') {
        try {
          await Mapping.collection.dropIndex(index.name);
          console.log(`Dropped index ${index.name} from Mapping collection`);
        } catch (error) {
          console.log(`Could not drop index ${index.name}: ${error.message}`);
        }
      }
    }
    
    console.log('Dropping existing indexes for Tip collection...');
    const tipIndexes = await Tip.collection.indexes();
    for (const index of tipIndexes) {
      if (index.name !== '_id_') {
        try {
          await Tip.collection.dropIndex(index.name);
          console.log(`Dropped index ${index.name} from Tip collection`);
        } catch (error) {
          console.log(`Could not drop index ${index.name}: ${error.message}`);
        }
      }
    }
    
    // Create indexes for Mapping collection
    console.log('Creating indexes for Mapping collection...');
    await Mapping.collection.createIndexes([
      { key: { identifier: 1 }, name: 'identifier_index' },
      { key: { identifierType: 1 }, name: 'identifierType_index' },
      { key: { username: 1 }, name: 'username_index' },
      { key: { address: 1 }, name: 'address_index' },
      { key: { createdBy: 1 }, name: 'createdBy_index' },
      { key: { createdAt: 1 }, name: 'createdAt_index' },
      { key: { identifierType: 1, identifier: 1 }, name: 'identifierType_identifier_index' },
      { key: { address: 1, identifierType: 1 }, name: 'address_identifierType_index' }
    ]);
    
    // Create indexes for Tip collection
    console.log('Creating indexes for Tip collection...');
    await Tip.collection.createIndexes([
      { key: { senderId: 1 }, name: 'senderId_index' },
      { key: { senderUsername: 1 }, name: 'senderUsername_index' },
      { key: { senderWalletAddress: 1 }, name: 'senderWalletAddress_index' },
      { key: { recipientAddress: 1 }, name: 'recipientAddress_index' },
      { key: { amount: 1 }, name: 'amount_index' },
      { key: { transactionHash: 1 }, unique: true, name: 'transactionHash_unique_index' },
      { key: { status: 1 }, name: 'status_index' },
      { key: { timestamp: 1 }, name: 'timestamp_index' },
      { key: { senderId: 1, timestamp: -1 }, name: 'senderId_timestamp_index' },
      { key: { recipientAddress: 1, timestamp: -1 }, name: 'recipientAddress_timestamp_index' },
      { key: { status: 1, timestamp: -1 }, name: 'status_timestamp_index' }
    ]);
    
    console.log('All indexes created successfully');
  } catch (error) {
    console.error('Error updating indexes:', error);
  }
}

// Main function
async function main() {
  try {
    await connectToDatabase();
    await updateIndexes();
    console.log('Index update completed successfully');
  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    // Close the database connection
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
main(); 