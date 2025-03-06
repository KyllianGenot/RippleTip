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

// Verify User model
async function verifyUserModel() {
  try {
    console.log('\n--- Verifying User model ---');
    
    // Find all users
    const users = await User.find({});
    console.log(`Number of users: ${users.length}`);
    
    if (users.length > 0) {
      // Display the first user
      const user = users[0];
      console.log('\nStructure of a User document:');
      const userObj = user.toObject();
      
      // Check if balance field exists
      if (userObj.balance !== undefined) {
        console.log('⚠️ The balance field still exists in the User document!');
      } else {
        console.log('✅ The balance field has been successfully removed.');
      }
      
      // Display user fields
      console.log(JSON.stringify(userObj, null, 2));
    }
  } catch (error) {
    console.error('Error verifying User model:', error);
  }
}

// Verify Tip model
async function verifyTipModel() {
  try {
    console.log('\n--- Verifying Tip model ---');
    
    // Find all tips
    const tips = await Tip.find({});
    console.log(`Number of tips: ${tips.length}`);
    
    if (tips.length > 0) {
      // Display the first tip
      const tip = tips[0];
      console.log('\nStructure of a Tip document:');
      console.log(JSON.stringify(tip.toObject(), null, 2));
    }
  } catch (error) {
    console.error('Error verifying Tip model:', error);
  }
}

// Verify Mapping model
async function verifyMappingModel() {
  try {
    console.log('\n--- Verifying Mapping model ---');
    
    // Find all relations
    const relations = await Mapping.find({});
    console.log(`Number of relations: ${relations.length}`);
    
    if (relations.length > 0) {
      console.log('\nSample relation:');
      const relation = relations[0];
      console.log(relation);
    }
  } catch (error) {
    console.error('Error verifying Mapping model:', error);
  }
}

// Main function
async function main() {
  try {
    await connectToDatabase();
    
    // Verify models
    await verifyUserModel();
    await verifyTipModel();
    await verifyMappingModel();
    
    console.log('\nModel verification completed successfully');
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