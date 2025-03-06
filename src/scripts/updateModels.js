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

// Function to display the structure of collections
async function displayCollectionStructure() {
  try {
    console.log('Displaying collection structure...');
    
    // Display an example of a Mapping document
    const mappingExample = await Mapping.findOne();
    if (mappingExample) {
      console.log('\nStructure of a Mapping document:');
      console.log(JSON.stringify(mappingExample.toObject(), null, 2));
    } else {
      console.log('No Mapping document found');
    }
    
    // Display an example of a Tip document
    const tipExample = await Tip.findOne();
    if (tipExample) {
      console.log('\nStructure of a Tip document:');
      console.log(JSON.stringify(tipExample.toObject(), null, 2));
    } else {
      console.log('No Tip document found');
    }
    
    // Display collection statistics
    const mappingCount = await Mapping.countDocuments();
    const tipCount = await Tip.countDocuments();
    const userCount = await User.countDocuments();
    
    console.log('\nCollection statistics:');
    console.log(`- Number of relations: ${mappingCount}`);
    console.log(`- Number of tips: ${tipCount}`);
    console.log(`- Number of users: ${userCount}`);
  } catch (error) {
    console.error('Error displaying collection structure:', error);
  }
}

// Main function
async function main() {
  try {
    await connectToDatabase();
    await displayCollectionStructure();
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