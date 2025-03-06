const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getUserRelations, formatAddress } = require('../utils/relationUtils');
const { getAddressUrl } = require('../utils/tipUtils');
const User = require('../models/User');
const Mapping = require('../models/Mapping');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('relations')
    .setDescription('View your address relations'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const userId = interaction.user.id;
      const relations = await getUserRelations(userId);

      if (relations.length === 0) {
        return interaction.editReply({ 
          content: 'You have no relations. Use `/map` to create one.' 
        });
      }

      // Create the embed
      const embed = new EmbedBuilder()
        .setColor('#0066cc')
        .setTitle('🗺️ Your Relations')
        .setDescription('Here are your relations:');

      // Add fields for each relation
      for (const relation of relations) {
        let identifier;
        
        if (relation.identifierType === 'user') {
          // Find the username for the Discord ID
          const user = await User.findOne({ discordId: relation.identifier });
          identifier = user ? user.username : `<@${relation.identifier}>`;
        } else {
          identifier = relation.identifier;
        }
        
        embed.addFields({ 
          name: identifier, 
          value: `[${formatAddress(relation.address)}](${getAddressUrl(relation.address)})`, 
          inline: true 
        });
      }

      // Add navigation buttons if there are many relations
      const components = [];
      if (relations.length > 9) {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('relation_prev_1')
              .setLabel('Previous')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('relation_next_1')
              .setLabel('Next')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(false)
          );
        components.push(row);
      }

      // Add a button to create a new relation
      const actionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('help_general')
            .setLabel('Back to Help')
            .setStyle(ButtonStyle.Secondary)
        );
      components.push(actionRow);

      await interaction.editReply({ 
        embeds: [embed], 
        components: components
      });
    } catch (error) {
      console.error('Error in relations command:', error);
      await interaction.editReply({ content: '❌ An error occurred while processing your request.' });
    }
  },

  // Handle navigation buttons
  async handleNavigation(interaction, action, currentPage, searchAddress = '', searchUserId = '') {
    try {
      const userId = interaction.user.id;
      const limit = 9; // Number of relations per page
      const skip = (currentPage - 1) * limit;

      // Build the query
      let query = {
        $or: [
          { identifier: userId, identifierType: 'user' },
          { createdBy: userId }
        ]
      };

      // Add search filters if provided
      if (searchAddress) {
        query.address = { $regex: searchAddress, $options: 'i' };
      }
      if (searchUserId) {
        query.identifier = searchUserId;
      }

      // Get total count for pagination
      const totalRelations = await Mapping.countDocuments(query);
      const totalPages = Math.ceil(totalRelations / limit);

      // Get relations for the current page
      const relations = await Mapping.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      // Create the embed
      const embed = new EmbedBuilder()
        .setColor('#0066cc')
        .setTitle('🗺️ Your Relations')
        .setDescription(`Page ${currentPage} of ${totalPages}`);

      // Add fields for each relation
      for (const relation of relations) {
        let identifier;
        
        if (relation.identifierType === 'user') {
          // Find the username for the Discord ID
          const user = await User.findOne({ discordId: relation.identifier });
          identifier = user ? user.username : `<@${relation.identifier}>`;
        } else {
          identifier = relation.identifier;
        }
        
        embed.addFields({ 
          name: identifier, 
          value: `[${formatAddress(relation.address)}](${getAddressUrl(relation.address)})`, 
          inline: true 
        });
      }

      // Create navigation buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`relation_prev_${currentPage}_${searchAddress}_${searchUserId}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 1),
          new ButtonBuilder()
            .setCustomId(`relation_next_${currentPage}_${searchAddress}_${searchUserId}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages)
        );

      // Add a button to go back to help
      const actionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('help_general')
            .setLabel('Back to Help')
            .setStyle(ButtonStyle.Secondary)
        );

      // Update the message
      await interaction.update({ 
        embeds: [embed], 
        components: [row, actionRow] 
      });
    } catch (error) {
      console.error('Error handling relations navigation:', error);
      await interaction.update({ 
        content: '❌ An error occurred while navigating relations.', 
        components: [] 
      });
    }
  }
}; 