require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Function to refresh commands
async function refreshCommands() {
  try {
    console.log('Starting to refresh slash commands...');
    
    // Check necessary environment variables
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('DISCORD_TOKEN not defined in .env file');
    }
    
    if (!process.env.DISCORD_APPLICATION_ID) {
      throw new Error('DISCORD_APPLICATION_ID not defined in .env file');
    }
    
    // Create an array to store commands
    const commands = [];
    
    // Read command files
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    // Load each command
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`Command loaded: ${command.data.name}`);
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing required properties.`);
      }
    }
    
    // Create a REST instance to send commands to Discord
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    // Register commands
    console.log(`Attempting to register ${commands.length} slash commands...`);
    
    // Register commands globally (for all servers)
    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID),
      { body: commands },
    );
    
    console.log(`✅ ${data.length} slash commands successfully registered!`);
    
  } catch (error) {
    console.error('Error refreshing commands:', error);
  }
}

// Execute the function
refreshCommands(); 