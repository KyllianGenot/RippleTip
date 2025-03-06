require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Discord server ID
const GUILD_ID = '1344829703592083597';

// Function to register commands on a specific server
async function registerGuildCommands() {
  try {
    console.log(`Starting slash command registration for server ${GUILD_ID}...`);
    
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
    console.log(`Attempting to register ${commands.length} slash commands on the server...`);
    
    // Register commands on the specific server
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_APPLICATION_ID, GUILD_ID),
      { body: commands },
    );
    
    console.log(`✅ ${data.length} slash commands successfully registered on the server!`);
    console.log('Commands should be available immediately.');
    
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Execute the function
registerGuildCommands(); 