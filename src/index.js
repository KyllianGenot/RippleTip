require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { connectToDatabase, closeConnection } = require('./config/database');
const { initTransferListener } = require('./utils/transferListener');

// Discord client initialization
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// Collection to store commands
client.commands = new Collection();

// Loading commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`Command loaded: ${command.data.name}`);
  } else {
    console.log(`Warning: The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Handle clean application shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down bot...');
  
  // Close MongoDB connection
  await closeConnection();
  
  // Disconnect Discord client
  client.destroy();
  
  console.log('Bot successfully stopped');
  process.exit(0);
});

// Main function to start the application
async function main() {
  try {
    // Attempt to connect to MongoDB
    await connectToDatabase();
    
    // Start Discord bot (even if MongoDB fails)
    startDiscordBot();
  } catch (error) {
    console.error('Error starting the application:', error);
    // Start the bot even in case of error
    startDiscordBot();
  }
}

// Function to start the Discord bot
function startDiscordBot() {
  // Ready event
  client.once(Events.ClientReady, () => {
    console.log(`Connected as ${client.user.tag}`);
    
    // Register slash commands
    const commands = [];
    client.commands.forEach(command => commands.push(command.data.toJSON()));
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    (async () => {
      try {
        console.log('Starting to refresh application commands (/).');
        
        await rest.put(
          Routes.applicationCommands(client.user.id),
          { body: commands },
        );
        
        console.log('Application commands (/) refreshed successfully.');
        
        // Initialize transfer listener after registering commands
        initTransferListener(client);
      } catch (error) {
        console.error(error);
      }
    })();
  });

  // Handle interactions
  client.on(Events.InteractionCreate, async interaction => {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
          console.error(`No command matching ${interaction.commandName} was found.`);
          return;
        }
        
        try {
          await command.execute(interaction);
        } catch (error) {
          console.error(`Error executing command ${interaction.commandName}:`, error);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'An error occurred while executing this command!', ephemeral: true });
          } else {
            await interaction.reply({ content: 'An error occurred while executing this command!', ephemeral: true });
          }
        }
      }
      // Handle modal submissions
      else if (interaction.isModalSubmit()) {
        const customId = interaction.customId;
        
        // Handle tip modal submissions
        if (customId.startsWith('tip_modal_')) {
          const parts = customId.split('_');
          const recipientAddress = parts[2];
          
          // Get the values from the modal
          const amount = interaction.fields.getTextInputValue('amount_input');
          const message = interaction.fields.getTextInputValue('message_input') || '';
          
          // Get recipient display name
          const { getDisplayNameForAddress } = require('./utils/relationUtils');
          const recipientDisplay = await getDisplayNameForAddress(recipientAddress);
          
          // Create a confirmation embed
          const embed = new EmbedBuilder()
            .setColor('#0066cc')
            .setTitle('📤 Confirm Your Tip')
            .setDescription(`You are about to send **${amount} RLUSD** to ${recipientDisplay}.`)
            .addFields(
              { name: 'Amount', value: `${amount} RLUSD`, inline: true },
              { name: 'Recipient', value: recipientDisplay, inline: true }
            );
            
          if (message) {
            embed.addFields({ name: 'Message', value: message });
          }
          
          // Create confirmation buttons
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`confirm_tip_${recipientAddress}_${amount}_${message}`)
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('cancel_tip')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
            );
          
          await interaction.reply({ 
            embeds: [embed], 
            components: [row], 
            ephemeral: true 
          });
        }
      }
      // Handle button interactions
      else if (interaction.isButton()) {
        const customId = interaction.customId;
        
        // Handle tip confirmation buttons
        if (customId.startsWith('confirm_tip_')) {
          console.log('Confirm tip button clicked, customId:', customId);
          const parts = customId.split('_');
          const recipientAddress = parts[2];
          // Keep amount as a string
          const amount = parts[3];
          const message = parts.slice(4).join('_');
          
          console.log('Extracted parameters:', { recipientAddress, amount, message });
          
          const tipCommand = client.commands.get('tip');
          if (tipCommand && tipCommand.handleConfirmation) {
            await tipCommand.handleConfirmation(interaction, recipientAddress, amount, message);
          }
        }
        // Handle tip cancellation buttons
        else if (customId === 'cancel_tip') {
          await interaction.update({
            content: '❌ Tip cancelled.',
            embeds: [],
            components: [],
            ephemeral: true
          });
        }
        // Handle buttons to send a new tip
        else if (customId.startsWith('tip_again_')) {
          const parts = customId.split('_');
          const recipientAddress = parts[2];
          const suggestedAmount = parts[3] || "1"; // Use the previous amount as a suggestion
          
          // Get recipient display name
          const { getDisplayNameForAddress } = require('./utils/relationUtils');
          const recipientDisplay = await getDisplayNameForAddress(recipientAddress);
          
          // Create a modal for entering the amount
          const modal = new ModalBuilder()
            .setCustomId(`tip_modal_${recipientAddress}`)
            .setTitle(`Send RLUSD to ${recipientDisplay}`);
            
          // Add inputs to the modal
          const amountInput = new TextInputBuilder()
            .setCustomId('amount_input')
            .setLabel('Amount (RLUSD)')
            .setValue(suggestedAmount) // Pre-fill with the suggested amount
            .setPlaceholder('Enter amount to send (e.g. 1.5)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
            
          const messageInput = new TextInputBuilder()
            .setCustomId('message_input')
            .setLabel('Message (optional)')
            .setPlaceholder('Add a message with your tip')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);
            
          // Add inputs to action rows
          const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
          const secondActionRow = new ActionRowBuilder().addComponents(messageInput);
          
          // Add action rows to the modal
          modal.addComponents(firstActionRow, secondActionRow);
          
          // Show the modal
          await interaction.showModal(modal);
        }
        // Handle tip user button from balance command
        else if (customId.startsWith('tip_user_')) {
          const parts = customId.split('_');
          const recipientAddress = parts[2];
          
          // Get recipient display name
          const { getDisplayNameForAddress } = require('./utils/relationUtils');
          const recipientDisplay = await getDisplayNameForAddress(recipientAddress);
          
          // Create a modal for entering the amount
          const modal = new ModalBuilder()
            .setCustomId(`tip_modal_${recipientAddress}`)
            .setTitle(`Send RLUSD to ${recipientDisplay}`);
            
          // Add inputs to the modal
          const amountInput = new TextInputBuilder()
            .setCustomId('amount_input')
            .setLabel('Amount (RLUSD)')
            .setPlaceholder('Enter amount to send (e.g. 1.5)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
            
          const messageInput = new TextInputBuilder()
            .setCustomId('message_input')
            .setLabel('Message (optional)')
            .setPlaceholder('Add a message with your tip')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);
            
          // Add inputs to action rows
          const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
          const secondActionRow = new ActionRowBuilder().addComponents(messageInput);
          
          // Add action rows to the modal
          modal.addComponents(firstActionRow, secondActionRow);
          
          // Show the modal
          await interaction.showModal(modal);
        }
        // Handle navigation buttons in history
        else if (customId.startsWith('history_')) {
          const parts = customId.split('_');
          const action = parts[1]; // prev, next, refresh
          const currentPage = parseInt(parts[2]);
          
          const historyCommand = client.commands.get('history');
          if (historyCommand && historyCommand.handleNavigation) {
            await historyCommand.handleNavigation(interaction, action, currentPage);
          }
        }
        // Handle navigation buttons in associations
        else if (customId.startsWith('relation_')) {
          const parts = customId.split('_');
          const action = parts[1]; // 'prev' or 'next'
          const currentPage = parseInt(parts[2]);
          const searchAddress = parts[3] || '';
          const searchUserId = parts[4] || '';
          
          const relationsCommand = client.commands.get('relations');
          await relationsCommand.handleNavigation(interaction, action, currentPage, searchAddress, searchUserId);
        }
        // Handle navigation buttons in leaderboard
        else if (customId.startsWith('leaderboard_')) {
          const parts = customId.split('_');
          const action = parts[1]; // prev, next, refresh
          const currentPage = parseInt(parts[2]);
          const shouldRefresh = parts[3]; // true or false
          
          const leaderboardCommand = client.commands.get('leaderboard');
          if (leaderboardCommand && leaderboardCommand.handleNavigation) {
            await leaderboardCommand.handleNavigation(interaction, action, currentPage, shouldRefresh);
          }
        }
        // Handle back to general help button
        else if (customId === 'help_general') {
          const helpCommand = client.commands.get('help');
          if (helpCommand && helpCommand.handleBackToGeneral) {
            await helpCommand.handleBackToGeneral(interaction);
          }
        }
        // Handle lottery draw confirmation or cancellation
        else if (customId === 'confirm_draw' || customId === 'cancel_draw') {
          const drawCommand = client.commands.get('draw-lottery');
          if (drawCommand && drawCommand.handleButton) {
            await drawCommand.handleButton(interaction, customId);
          }
        }
        // Handle buy ticket confirmation or cancellation
        else if (customId.startsWith('confirm_buy_ticket_') || customId === 'cancel_buy_ticket') {
          const buyTicketCommand = client.commands.get('buy-lottery-ticket');
          if (buyTicketCommand && buyTicketCommand.handleButton) {
            await buyTicketCommand.handleButton(interaction, customId);
          }
        }
        // Unhandled button
        else {
          console.warn(`Unhandled button: ${customId}`);
          await interaction.reply({
            content: 'This button is not supported or has expired.',
            ephemeral: true
          });
        }
      }
    } catch (error) {
      console.error('Error handling interactions:', error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'An error occurred while processing this interaction.',
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            content: 'An error occurred while processing this interaction.',
            ephemeral: true
          });
        }
      } catch (replyError) {
        console.error('Error handling error reply:', replyError);
      }
    }
  });

  // Connect the bot
  client.login(process.env.DISCORD_TOKEN);
}

// Start the application
main(); 