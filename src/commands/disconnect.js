const { SlashCommandBuilder } = require('discord.js');
const User = require('../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Disconnect your Ethereum wallet'),
  
  async execute(interaction) {
    try {
      // Check if the user has a connected wallet
      const user = await User.findOne({ discordId: interaction.user.id });
      
      if (!user || !user.walletAddress) {
        return interaction.reply({
          content: '❌ You don\'t have a connected wallet.',
          ephemeral: true
        });
      }
      
      // Store the address for the confirmation message
      const walletAddress = user.walletAddress;
      
      // Delete the user from the database
      await User.deleteOne({ discordId: interaction.user.id });
      
      return interaction.reply({
        content: `✅ Your wallet \`${walletAddress}\` has been successfully disconnected.\n\n To reconnect a wallet with RLUSD, use the \`/connect\` command.`,
        ephemeral: true
      });
      
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      return interaction.reply({
        content: '❌ An error occurred while disconnecting your wallet. Please try again later.',
        ephemeral: true
      });
    }
  }
}; 