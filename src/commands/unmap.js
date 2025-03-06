const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { removeRelation } = require('../utils/relationUtils');
const Mapping = require('../models/Mapping');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmap')
    .setDescription('Remove a mapping for a Discord user or alias')
    .addStringOption(option =>
      option.setName('identifier')
        .setDescription('Discord user (@user) or custom alias to unmap')
        .setRequired(true)),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const identifier = interaction.options.getString('identifier');

      // Determine if this is a user mention or an alias
      let identifierType, normalizedIdentifier;
      if (identifier.startsWith('<@') && identifier.endsWith('>')) {
        identifierType = 'user';
        normalizedIdentifier = identifier.replace(/[<@!>]/g, '');
        
        // Check if the user is trying to unmap someone else
        if (normalizedIdentifier !== interaction.user.id) {
          return interaction.editReply({ 
            content: '❌ You can only unmap your own Discord account.' 
          });
        }
      } else {
        identifierType = 'alias';
        normalizedIdentifier = identifier.toLowerCase();
        
        // Check if the user is trying to unmap an alias they don't own
        const mapping = await Mapping.findOne({ 
          identifier: normalizedIdentifier, 
          identifierType: 'alias' 
        });
        
        if (mapping && mapping.createdBy !== interaction.user.id) {
          return interaction.editReply({ 
            content: '❌ You can only unmap aliases that you created.' 
          });
        }
      }

      // Remove the mapping
      const result = await removeRelation(
        normalizedIdentifier,
        identifierType
      );

      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.message}` });
      }

      // Create a success embed
      const embed = new EmbedBuilder()
        .setColor('#0066cc')
        .setTitle('🗑️ Mapping Removed')
        .setDescription(`Mapping for "${identifier}" has been removed.`);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in unmap command:', error);
      await interaction.editReply({ content: '❌ An error occurred while processing your request.' });
    }
  }
}; 