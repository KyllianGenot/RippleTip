require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
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

// Export data to JSON files
async function exportData() {
  try {
    console.log('Exporting data to JSON files...');
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '../../data/export');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Export relations
    const relations = await Mapping.find({});
    fs.writeFileSync(
      path.join(dataDir, 'relations.json'),
      JSON.stringify(relations, null, 2)
    );
    console.log(`Exported ${relations.length} relations to relations.json`);
    
    // Export tips
    const tips = await Tip.find({});
    fs.writeFileSync(
      path.join(dataDir, 'tips.json'),
      JSON.stringify(tips, null, 2)
    );
    console.log(`Exported ${tips.length} tips to tips.json`);
    
    // Export users (with sensitive data removed)
    const users = await User.find({});
    const safeUsers = users.map(user => {
      const userObj = user.toObject();
      // Remove sensitive data
      delete userObj.privateKey;
      return userObj;
    });
    
    fs.writeFileSync(
      path.join(dataDir, 'users.json'),
      JSON.stringify(safeUsers, null, 2)
    );
    console.log(`Exported ${users.length} users to users.json`);
    
    console.log(`All data exported to ${dataDir}`);
  } catch (error) {
    console.error('Error exporting data:', error);
  }
}

// Main function
async function main() {
  try {
    await connectToDatabase();
    await exportData();
    console.log('Data export completed successfully');
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