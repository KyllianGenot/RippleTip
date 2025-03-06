const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { isValidEthereumAddress } = require('../utils/ethereumUtils');
const { createOrUpdateRelation, formatAddress } = require('../utils/relationUtils');
const { getAddressUrl } = require('../utils/tipUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('map')
    .setDescription('Map a Discord user or alias to an Ethereum address')
    .addStringOption(option =>
      option.setName('identifier')
        .setDescription('Discord user (@user) or custom alias')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('address')
        .setDescription('Ethereum address to map')
        .setRequired(true)),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const identifier = interaction.options.getString('identifier');
      const address = interaction.options.getString('address');

      // Validate the address
      if (!isValidEthereumAddress(address)) {
        return interaction.editReply({ content: '❌ Invalid Ethereum address.' });
      }

      // Determine if this is a user mention or an alias
      let identifierType, normalizedIdentifier;
      if (identifier.startsWith('<@') && identifier.endsWith('>')) {
        identifierType = 'user';
        normalizedIdentifier = identifier.replace(/[<@!>]/g, '');
        
        // Check if the user is trying to map someone else
        if (normalizedIdentifier !== interaction.user.id) {
          return interaction.editReply({ 
            content: '❌ You can only map your own Discord account. To map another user, they must use the command themselves.' 
          });
        }
      } else {
        identifierType = 'alias';
        normalizedIdentifier = identifier.toLowerCase();
      }

      // Create or update the relation
      const result = await createOrUpdateRelation(
        normalizedIdentifier,
        identifierType,
        address,
        interaction.user.id
      );

      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.message}` });
      }

      // Create a success embed
      const embed = new EmbedBuilder()
        .setColor('#0066cc')
        .setTitle(result.isUpdate ? '✅ Mapping Updated' : '✅ Mapping Created')
        .setDescription(`"${identifier}" mapped to **${formatAddress(address)}**`)
        .addFields({ name: 'Address', value: `[${address}](${getAddressUrl(address)})` });

      // Add a button to view on Etherscan
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setURL(getAddressUrl(address))
            .setLabel('View on Etherscan')
            .setStyle(ButtonStyle.Link)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('Error in map command:', error);
      await interaction.editReply({ content: '❌ An error occurred while processing your request.' });
    }
  }
}; 