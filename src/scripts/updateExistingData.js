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

// Update existing relations with usernames
async function updateRelations() {
  try {
    console.log('Updating relations...');
    
    // Find all user relations
    const userRelations = await Mapping.find({ identifierType: 'user' });
    console.log(`Found ${userRelations.length} user relations to update`);
    
    let updatedCount = 0;
    
    // Update each relation with the username
    for (const relation of userRelations) {
      const user = await User.findOne({ discordId: relation.identifier });
      
      if (user && user.username) {
        relation.username = user.username;
        await relation.save();
        updatedCount++;
      }
    }
    
    console.log(`Updated ${updatedCount} relations with usernames`);
  } catch (error) {
    console.error('Error updating relations:', error);
  }
}

// Update existing tips with sender usernames and wallet addresses
async function updateTips() {
  try {
    console.log('Updating tips...');
    
    // Find all tips
    const tips = await Tip.find({});
    console.log(`Found ${tips.length} tips to update`);
    
    let updatedCount = 0;
    
    // Update each tip with the sender username and wallet address
    for (const tip of tips) {
      const user = await User.findOne({ discordId: tip.senderId });
      
      if (user) {
        // Only update if fields are empty
        let updated = false;
        
        if (!tip.senderUsername) {
          tip.senderUsername = user.username;
          updated = true;
        }
        
        if (!tip.senderWalletAddress) {
          tip.senderWalletAddress = user.walletAddress;
          updated = true;
        }
        
        if (updated) {
          await tip.save();
          updatedCount++;
          console.log(`Updated tip from ${user.username} (${tip.senderId})`);
        }
      }
    }
    
    console.log(`Updated ${updatedCount} tips with sender information`);
  } catch (error) {
    console.error('Error updating tips:', error);
  }
}

// Main function
async function main() {
  try {
    await connectToDatabase();
    
    // Update relations and tips
    await updateRelations();
    await updateTips();
    
    console.log('Data update completed successfully');
  } catch (error) {
    console.error('Error updating data:', error);
  } finally {
    // Close the database connection
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
main(); 