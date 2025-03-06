require('dotenv').config();
const { REST, Routes } = require('discord.js');

// Function to delete all commands
async function deleteAllCommands() {
  try {
    console.log('Starting to delete slash commands...');
    
    // Check necessary environment variables
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('DISCORD_TOKEN not defined in .env file');
    }
    
    if (!process.env.DISCORD_APPLICATION_ID) {
      throw new Error('DISCORD_APPLICATION_ID not defined in .env file');
    }
    
    // Create a REST instance to send commands to Discord
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    // Delete all global commands
    console.log('Deleting all global slash commands...');
    
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID),
      { body: [] },
    );
    
    console.log('✅ All slash commands have been successfully deleted!');
    console.log('To re-register commands, run: npm run refresh-commands');
    
  } catch (error) {
    console.error('Error deleting commands:', error);
  }
}

// Execute the function
deleteAllCommands(); 