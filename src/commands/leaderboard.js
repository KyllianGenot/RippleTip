const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getLeaderboard } = require('../utils/tipUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show top tippers and receivers'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const page = 1;
      const leaderboard = await getLeaderboard(page, 5);

      // Create the embed
      const embed = new EmbedBuilder()
        .setColor('#0066cc')
        .setTitle('🏆 Leaderboard')
        .setDescription(`Top tippers and receivers in ${interaction.guild.name}`);

      // Add top senders
      let topSendersValue = 'No tips sent yet.';
      if (leaderboard.senders.data.length > 0) {
        topSendersValue = leaderboard.senders.data.map((sender, index) => {
          return `${index + 1}. <@${sender.discordId}>: ${sender.totalSent.toFixed(2)} RLUSD (${sender.count} tips)`;
        }).join('\n');
      }
      embed.addFields({ name: '💖 Top Tippers', value: topSendersValue });

      // Add top receivers
      let topReceiversValue = 'No tips received yet.';
      if (leaderboard.receivers.data.length > 0) {
        topReceiversValue = leaderboard.receivers.data.map((receiver, index) => {
          return `${index + 1}. ${receiver.displayName}: ${receiver.totalReceived.toFixed(2)} RLUSD (${receiver.count} tips)`;
        }).join('\n');
      }
      embed.addFields({ name: '🎁 Top Receivers', value: topReceiversValue });

      // Add pagination buttons if needed
      const components = [];
      if (leaderboard.senders.totalPages > 1 || leaderboard.receivers.totalPages > 1) {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`leaderboard_prev_${page}_false`)
              .setLabel('Previous')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page <= 1),
            new ButtonBuilder()
              .setCustomId(`leaderboard_next_${page}_false`)
              .setLabel('Next')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page >= Math.max(leaderboard.senders.totalPages, leaderboard.receivers.totalPages)),
            new ButtonBuilder()
              .setCustomId(`leaderboard_refresh_${page}_true`)
              .setLabel('Refresh')
              .setStyle(ButtonStyle.Primary)
          );
        components.push(row);
      }

      await interaction.editReply({ 
        embeds: [embed], 
        components: components 
      });
    } catch (error) {
      console.error('Error in leaderboard command:', error);
      await interaction.editReply({ content: '❌ An error occurred while processing your request.' });
    }
  },

  // Handle navigation buttons
  async handleNavigation(interaction, action, currentPage, shouldRefresh = false) {
    try {
      let newPage = currentPage;
      
      if (action === 'next' && !shouldRefresh) {
        newPage += 1;
      } else if (action === 'prev' && !shouldRefresh) {
        newPage -= 1;
      }
      
      const leaderboard = await getLeaderboard(newPage, 5);
      
      // Create the embed
      const embed = new EmbedBuilder()
        .setColor('#0066cc')
        .setTitle('🏆 Leaderboard')
        .setDescription(`Top tippers and receivers in ${interaction.guild.name} (Page ${newPage})`);
      
      // Add top senders
      let topSendersValue = 'No tips sent yet.';
      if (leaderboard.senders.data.length > 0) {
        topSendersValue = leaderboard.senders.data.map((sender, index) => {
          const realIndex = (newPage - 1) * 5 + index + 1;
          return `${realIndex}. <@${sender.discordId}>: ${sender.totalSent.toFixed(2)} RLUSD (${sender.count} tips)`;
        }).join('\n');
      }
      embed.addFields({ name: '💖 Top Tippers', value: topSendersValue });
      
      // Add top receivers
      let topReceiversValue = 'No tips received yet.';
      if (leaderboard.receivers.data.length > 0) {
        topReceiversValue = leaderboard.receivers.data.map((receiver, index) => {
          const realIndex = (newPage - 1) * 5 + index + 1;
          return `${realIndex}. ${receiver.displayName}: ${receiver.totalReceived.toFixed(2)} RLUSD (${receiver.count} tips)`;
        }).join('\n');
      }
      embed.addFields({ name: '🎁 Top Receivers', value: topReceiversValue });
      
      // Create navigation buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`leaderboard_prev_${newPage}_false`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newPage <= 1),
          new ButtonBuilder()
            .setCustomId(`leaderboard_next_${newPage}_false`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(newPage >= Math.max(leaderboard.senders.totalPages, leaderboard.receivers.totalPages)),
          new ButtonBuilder()
            .setCustomId(`leaderboard_refresh_${newPage}_true`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary)
        );
      
      await interaction.update({ 
        embeds: [embed], 
        components: [row] 
      });
    } catch (error) {
      console.error('Error handling leaderboard navigation:', error);
      await interaction.update({ 
        content: '❌ An error occurred while navigating the leaderboard.', 
        components: [] 
      });
    }
  }
}; 