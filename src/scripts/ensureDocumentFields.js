require('dotenv').config();
const mongoose = require('mongoose');
const Mapping = require('../models/Mapping');
const Tip = require('../models/Tip');
const User = require('../models/User');

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

// Ensure all Mapping documents have the required fields
async function ensureMappingFields() {
  try {
    console.log('Ensuring all Mapping documents have the required fields...');
    
    // Find all relations
    const relations = await Mapping.find({});
    console.log(`Found ${relations.length} relations to check`);
    
    let updatedCount = 0;
    
    // Check each relation
    for (const relation of relations) {
      let needsUpdate = false;
      
      // Check for missing fields
      if (!relation.username) {
        relation.username = '';
        needsUpdate = true;
      }
      
      // Save if needed
      if (needsUpdate) {
        await relation.save();
        updatedCount++;
      }
    }
    
    console.log(`Updated ${updatedCount} relations`);
  } catch (error) {
    console.error('Error ensuring mapping fields:', error);
  }
}

// Ensure all Tip documents have the required fields
async function ensureTipFields() {
  try {
    console.log('Ensuring all Tip documents have the required fields...');
    
    // Find all tips
    const tips = await Tip.find({});
    console.log(`Found ${tips.length} tips to check`);
    
    let updatedCount = 0;
    
    // Check each tip
    for (const tip of tips) {
      let needsUpdate = false;
      
      // Check if senderUsername field exists
      if (!tip.senderUsername) {
        const user = await User.findOne({ discordId: tip.senderId });
        if (user) {
          tip.senderUsername = user.username;
          needsUpdate = true;
          console.log(`Adding senderUsername ${user.username} to tip ${tip._id}`);
        }
      }
      
      // Check if senderWalletAddress field exists
      if (!tip.senderWalletAddress) {
        const user = await User.findOne({ discordId: tip.senderId });
        if (user) {
          tip.senderWalletAddress = user.walletAddress;
          needsUpdate = true;
          console.log(`Adding senderWalletAddress to tip ${tip._id}`);
        }
      }
      
      // Check if timestamp field exists
      if (!tip.timestamp) {
        tip.timestamp = new Date();
        needsUpdate = true;
        console.log(`Adding timestamp to tip ${tip._id}`);
      }
      
      // Save if needed
      if (needsUpdate) {
        await tip.save();
        updatedCount++;
      }
    }
    
    console.log(`Updated ${updatedCount} tips`);
  } catch (error) {
    console.error('Error ensuring tip fields:', error);
  }
}

// Main function
async function main() {
  try {
    await connectToDatabase();
    
    // Ensure all documents have the required fields
    await ensureMappingFields();
    await ensureTipFields();
    
    console.log('Document field verification completed successfully');
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