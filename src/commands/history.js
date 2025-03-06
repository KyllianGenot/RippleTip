const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getUserTipHistory } = require('../utils/tipUtils');
const { formatAddress } = require('../utils/relationUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View your recent tip history')
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Number of recent tips to show (default: 5)')
        .setRequired(false)),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const userId = interaction.user.id;
      const count = interaction.options.getInteger('count') || 5;
      const page = 1;

      // Get the tip history
      const history = await getUserTipHistory(userId, page, count);

      // Create the embed
      const embed = new EmbedBuilder()
        .setColor('#0066cc')
        .setTitle('📜 Your Tip History')
        .setDescription(`Here are your recent tips:`);

      // Add sent tips
      let sentTipsValue = 'No tips sent.';
      if (history.sent.tips.length > 0) {
        sentTipsValue = history.sent.tips.map(tip => {
          const date = new Date(tip.timestamp).toLocaleDateString();
          return `${date}: ${tip.amount} RLUSD to ${tip.recipientDisplay}`;
        }).join('\n');
      }
      embed.addFields({ name: '📤 Sent', value: sentTipsValue });

      // Add received tips
      let receivedTipsValue = 'No tips received.';
      if (history.received.tips.length > 0) {
        receivedTipsValue = history.received.tips.map(tip => {
          const date = new Date(tip.timestamp).toLocaleDateString();
          return `${date}: ${tip.amount} RLUSD from ${tip.senderDisplay}`;
        }).join('\n');
      }
      embed.addFields({ name: '📥 Received', value: receivedTipsValue });

      // Add pagination buttons if needed
      const components = [];
      if (history.sent.totalPages > 1 || history.received.totalPages > 1) {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`history_prev_${page}`)
              .setLabel('Previous')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page <= 1),
            new ButtonBuilder()
              .setCustomId(`history_next_${page}`)
              .setLabel('Next')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page >= Math.max(history.sent.totalPages, history.received.totalPages))
          );
        components.push(row);
      }

      await interaction.editReply({ 
        embeds: [embed], 
        components: components 
      });
    } catch (error) {
      console.error('Error in history command:', error);
      await interaction.editReply({ content: '❌ An error occurred while processing your request.' });
    }
  },

  // Handle navigation buttons
  async handleNavigation(interaction, action, currentPage) {
    try {
      let newPage = currentPage;
      
      if (action === 'next') {
        newPage += 1;
      } else if (action === 'prev') {
        newPage -= 1;
      }
      
      const count = 5; // Default count per page
      const userId = interaction.user.id;
      
      // Get the tip history for the new page
      const history = await getUserTipHistory(userId, newPage, count);
      
      // Create the embed
      const embed = new EmbedBuilder()
        .setColor('#0066cc')
        .setTitle('📜 Your Tip History')
        .setDescription(`Page ${newPage}`);
      
      // Add sent tips
      let sentTipsValue = 'No tips sent.';
      if (history.sent.tips.length > 0) {
        sentTipsValue = history.sent.tips.map(tip => {
          const date = new Date(tip.timestamp).toLocaleDateString();
          return `${date}: ${tip.amount} RLUSD to ${tip.recipientDisplay}`;
        }).join('\n');
      }
      embed.addFields({ name: '📤 Sent', value: sentTipsValue });
      
      // Add received tips
      let receivedTipsValue = 'No tips received.';
      if (history.received.tips.length > 0) {
        receivedTipsValue = history.received.tips.map(tip => {
          const date = new Date(tip.timestamp).toLocaleDateString();
          return `${date}: ${tip.amount} RLUSD from ${tip.senderDisplay}`;
        }).join('\n');
      }
      embed.addFields({ name: '📥 Received', value: receivedTipsValue });
      
      // Create navigation buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`history_prev_${newPage}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newPage <= 1),
          new ButtonBuilder()
            .setCustomId(`history_next_${newPage}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newPage >= Math.max(history.sent.totalPages, history.received.totalPages))
        );
      
      await interaction.update({ 
        embeds: [embed], 
        components: [row] 
      });
    } catch (error) {
      console.error('Error handling history navigation:', error);
      await interaction.update({ 
        content: '❌ An error occurred while navigating history.', 
        components: [] 
      });
    }
  }
}; 