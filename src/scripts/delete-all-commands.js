require('dotenv').config();
const { REST, Routes } = require('discord.js');

// Discord server ID
const GUILD_ID = '1344829703592083597';

async function deleteAllCommands() {
  try {
    // Check necessary environment variables
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('DISCORD_TOKEN not defined in .env file');
    }
    
    if (!process.env.DISCORD_APPLICATION_ID) {
      throw new Error('DISCORD_APPLICATION_ID not defined in .env file');
    }
    
    // Create a REST instance
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    console.log('Deleting all global slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID),
      { body: [] }
    );
    console.log('✅ All global slash commands have been successfully deleted!');
    
    console.log(`Deleting all slash commands from server ${GUILD_ID}...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_APPLICATION_ID, GUILD_ID),
      { body: [] }
    );
    console.log(`✅ All server slash commands have been successfully deleted!`);
    
    console.log('To re-register commands, run: npm run register-guild');
    
  } catch (error) {
    console.error('Error deleting commands:', error);
  }
}

// Execute the function
deleteAllCommands(); 