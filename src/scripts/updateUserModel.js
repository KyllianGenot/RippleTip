require('dotenv').config();
const mongoose = require('mongoose');
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

// Update User documents to remove balance field
async function updateUserDocuments() {
  try {
    console.log('Updating User documents to remove balance field...');
    
    // Find all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to update`);
    
    // Update each user using updateMany to remove the balance field
    const result = await mongoose.connection.collection('users').updateMany(
      {}, // filter - all documents
      { $unset: { balance: "" } } // update - remove balance field
    );
    
    console.log(`Updated ${result.modifiedCount} users`);
    
    // Verify the update
    const updatedUsers = await User.find({});
    for (const user of updatedUsers) {
      console.log(`User ${user.username} (${user.discordId}): balance field exists: ${user.balance !== undefined}`);
    }
    
    console.log('User documents updated successfully');
  } catch (error) {
    console.error('Error updating User documents:', error);
  }
}

// Main function
async function main() {
  try {
    await connectToDatabase();
    await updateUserDocuments();
    console.log('User model update completed successfully');
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