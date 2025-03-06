require('dotenv').config();
const mongoose = require('mongoose');
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

// Update Tip documents
async function updateTipDocuments() {
  try {
    console.log('Starting to update Tip documents...');
    
    // Find all tips
    const tips = await Tip.find({});
    console.log(`Found ${tips.length} tips to update`);
    
    // Process each tip
    for (const tip of tips) {
      console.log(`Processing tip: ${tip._id}`);
      
      // Ensure all required fields are present
      let updated = false;
      
      // If senderId exists but senderUsername is missing, try to find the username
      if (tip.senderId && !tip.senderUsername) {
        const user = await User.findOne({ discordId: tip.senderId });
        if (user) {
          tip.senderUsername = user.username;
          console.log(`Added senderUsername: ${user.username} for senderId: ${tip.senderId}`);
          updated = true;
        }
      }
      
      // If senderId exists but senderWalletAddress is missing, try to find the wallet address
      if (tip.senderId && !tip.senderWalletAddress) {
        const user = await User.findOne({ discordId: tip.senderId });
        if (user) {
          tip.senderWalletAddress = user.walletAddress;
          console.log(`Added senderWalletAddress: ${user.walletAddress} for senderId: ${tip.senderId}`);
          updated = true;
        }
      }
      
      // Ensure status field exists
      if (!tip.status) {
        // If transactionHash exists, assume it's confirmed
        if (tip.transactionHash) {
          tip.status = 'confirmed';
        } else {
          tip.status = 'pending';
        }
        console.log(`Added status: ${tip.status}`);
        updated = true;
      }
      
      // Ensure timestamp field exists
      if (!tip.timestamp) {
        // Use createdAt if it exists, otherwise use current date
        tip.timestamp = tip.createdAt || new Date();
        console.log(`Added timestamp: ${tip.timestamp}`);
        updated = true;
      }
      
      // Save the updated tip if changes were made
      if (updated) {
        await tip.save();
        console.log(`Tip ${tip._id} updated successfully`);
      } else {
        console.log(`No updates needed for tip ${tip._id}`);
      }
    }
    
    console.log('Tip documents update completed');
  } catch (error) {
    console.error('Error updating Tip documents:', error);
  }
}

// Main function
async function main() {
  try {
    await connectToDatabase();
    await updateTipDocuments();
    console.log('Update process completed successfully');
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