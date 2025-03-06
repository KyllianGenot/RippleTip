const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getAddressForIdentifier, getDisplayNameForAddress } = require('../utils/relationUtils');
const { sendTip, getTransactionUrl, getAddressUrl } = require('../utils/tipUtils');
const { isValidEthereumAddress } = require('../utils/ethereumUtils');
const { calculateFees } = require('../utils/paymasterUtils');
const { ethers } = require('ethers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tip')
    .setDescription('Send RLUSD to a recipient')
    .addStringOption(option =>
      option.setName('recipient')
        .setDescription('Recipient Ethereum address, @user, or alias')
        .setRequired(true))
    .addNumberOption(option =>
      option.setName('amount')
        .setDescription('Amount of RLUSD to send')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Add a personal message with your tip')
        .setRequired(false)),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const recipient = interaction.options.getString('recipient');
      const amount = interaction.options.getNumber('amount');
      const message = interaction.options.getString('message') || '';

      // Validate the amount
      if (amount <= 0) {
        return interaction.editReply({ content: '❌ Invalid amount. Use a positive number.' });
      }

      // Check if the amount is sufficient (minimum 1 RLUSD)
      if (amount < 1) {
        return interaction.editReply({ content: '❌ The minimum amount for a tip is 1 RLUSD.' });
      }

      // Calculate fees
      const feeDetails = calculateFees(amount);
      if (feeDetails.error) {
        return interaction.editReply({ content: `❌ ${feeDetails.error}` });
      }

      // Resolve the recipient address
      let recipientAddress = await getAddressForIdentifier(recipient);
      if (!recipientAddress) {
        if (isValidEthereumAddress(recipient)) {
          recipientAddress = recipient;
        } else {
          return interaction.editReply({ 
            content: `❌ No address mapped for "${recipient}". Use /map or provide a direct address.` 
          });
        }
      }

      // Get the display name for the recipient
      const recipientDisplay = await getDisplayNameForAddress(recipientAddress);

      // Create confirmation embed
      const embed = new EmbedBuilder()
        .setColor('#0066cc')
        .setTitle('📤 Confirm Your Tip')
        .setDescription(`You are about to send **${amount} RLUSD** to ${recipientDisplay}.`)
        .addFields(
          { name: 'Amount', value: `${amount} RLUSD`, inline: true },
          { name: 'Recipient', value: recipientDisplay, inline: true },
          { name: 'Fee', value: `${feeDetails.fee.toFixed(2)} RLUSD (${feeDetails.feePercentage}%)`, inline: true },
          { name: 'Amount After Fee', value: `${feeDetails.amountAfterFee.toFixed(2)} RLUSD`, inline: true }
        );
      
      if (message) {
        embed.addFields({ name: 'Message', value: message });
      }

      // Create confirmation buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_tip_${recipientAddress}_${amount}_${message.replace(/ /g, '_')}`)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('cancel_tip')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('Error in tip command:', error);
      await interaction.editReply({ content: '❌ An error occurred while processing your request.' });
    }
  },

  // Handle tip confirmation
  async handleConfirmation(interaction, recipientAddress, amount, message) {
    try {
      console.log('Tip confirmation - Parameters received:', { 
        recipientAddress, 
        amount, 
        message,
        amountType: typeof amount
      });
      
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor('#0066cc')
            .setDescription('⏳ Processing your tip...')
        ],
        components: []
      });

      // Ensure amount is a clean string
      const cleanAmount = amount.toString().replace(/[^0-9.]/g, '');
      console.log('Cleaned amount:', cleanAmount);
      
      // Ensure message is properly formatted
      const cleanMessage = message ? message.replace(/_/g, ' ') : '';
      console.log('Cleaned message:', cleanMessage);

      // Send the tip
      const result = await sendTip(
        interaction.user.id,
        recipientAddress,
        cleanAmount, // Pass as string
        cleanMessage
      );

      console.log('Tip result:', result);

      if (!result.success) {
        return interaction.editReply({ 
          content: `❌ ${result.message}`, 
          embeds: [], 
          components: [] 
        });
      }

      // Get the recipient display name
      const recipientDisplay = await getDisplayNameForAddress(recipientAddress);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💰 Tip Sent!')
        .setDescription(`🎉 <@${interaction.user.id}> sent **${cleanAmount} RLUSD** to ${recipientDisplay}!`)
        .addFields(
          { name: 'Amount', value: `${cleanAmount} RLUSD`, inline: true },
          { name: 'Recipient', value: recipientDisplay, inline: true },
          { name: 'Fee', value: `${result.fee.toFixed(2)} RLUSD (${result.feePercentage}%)`, inline: true },
          { name: 'Amount After Fee', value: `${result.amountAfterFee.toFixed(2)} RLUSD`, inline: true },
          { name: 'Transaction', value: `[View on Etherscan](${result.transactionUrl})` }
        );

      if (cleanMessage && cleanMessage.trim() !== '') {
        embed.addFields({ name: 'Message', value: cleanMessage });
      }

      // Create buttons for the success message
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setURL(result.transactionUrl)
            .setLabel('View Transaction')
            .setStyle(ButtonStyle.Link),
          new ButtonBuilder()
            .setCustomId(`tip_again_${recipientAddress}_${cleanAmount}_`)
            .setLabel('Tip Again')
            .setStyle(ButtonStyle.Primary)
        );

      // Send the success message
      await interaction.editReply({ embeds: [embed], components: [row] });

      // Also send a public message about the tip
      const publicEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💰 New Tip!')
        .setDescription(`🎉 <@${interaction.user.id}> sent **${result.amountAfterFee.toFixed(2)} RLUSD** to ${recipientDisplay}!`)
        .addFields(
          { name: 'Amount', value: `${result.amountAfterFee.toFixed(2)} RLUSD`, inline: true },
          { name: 'Fee', value: `${result.fee.toFixed(2)} RLUSD (${result.feePercentage}%)`, inline: true }
        );

      if (cleanMessage && cleanMessage.trim() !== '') {
        publicEmbed.addFields({ name: 'Message', value: cleanMessage });
      }

      await interaction.channel.send({ embeds: [publicEmbed] });
    } catch (error) {
      console.error('Error handling tip confirmation:', error);
      await interaction.editReply({ 
        content: '❌ An error occurred while processing your tip.', 
        embeds: [], 
        components: [] 
      });
    }
  }
}; 