const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getAddressForIdentifier, formatAddress } = require('../utils/relationUtils');
const { getAddressUrl } = require('../utils/tipUtils');
const { getBalance } = require('../utils/ethereumUtils');
const User = require('../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your RLUSD balance')
    .addStringOption(option =>
      option.setName('identifier')
        .setDescription('Your Ethereum address, @user, or alias')
        .setRequired(false)),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // If no identifier is provided, use the user's own Discord ID
      let identifier = interaction.options.getString('identifier') || `<@${interaction.user.id}>`;
      const isOwnBalance = !interaction.options.getString('identifier');

      // Resolve the address
      let address;
      
      // First check if the user has a wallet in our system
      if (isOwnBalance) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (user) {
          address = user.walletAddress;
        }
      }
      
      // If no address found yet, try to resolve from relations or direct address
      if (!address) {
        address = await getAddressForIdentifier(identifier);
        if (!address) {
          return interaction.editReply({ 
            content: `❌ No address found for "${identifier}". Use /map or /create-wallet to set up an address.` 
          });
        }
      }

      // Get the balance
      try {
        const balance = await getBalance(address);
        
        // Create the embed
        const embed = new EmbedBuilder()
          .setColor('#0066cc')
          .setTitle('💰 RLUSD Balance')
          .setDescription(isOwnBalance 
            ? `Your balance: **${balance} RLUSD**` 
            : `Balance for ${identifier}: **${balance} RLUSD**`)
          .addFields({ 
            name: 'Address', 
            value: `[${formatAddress(address)}](${getAddressUrl(address)})` 
          });

        // Create buttons
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setURL(getAddressUrl(address))
              .setLabel('View on Etherscan')
              .setStyle(ButtonStyle.Link)
          );

        // Add a tip button if checking someone else's balance
        if (!isOwnBalance) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`tip_user_${address}`)
              .setLabel(`Tip ${formatAddress(address)}`)
              .setStyle(ButtonStyle.Primary)
          );
        }

        await interaction.editReply({ 
          embeds: [embed], 
          components: [row] 
        });
      } catch (error) {
        console.error('Error checking balance:', error);
        await interaction.editReply({ content: '❌ Error checking balance.' });
      }
    } catch (error) {
      console.error('Error in balance command:', error);
      await interaction.editReply({ content: '❌ An error occurred while processing your request.' });
    }
  }
}; 