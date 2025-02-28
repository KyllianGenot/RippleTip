const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ethers } = require('ethers');
const User = require('../models/User'); // Assurez-vous que ce chemin correspond à votre modèle User
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('draw-lottery')
    .setDescription('Draw the lottery winner (participants or owner only)'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_URL);
      const lotteryAddress = '0x441D56a6024cfFF1514191b69810aad10B3c1340';
      const lotteryABI = [
        'function isLotteryActive() view returns (bool)',
        'function getParticipantCount() view returns (uint256)',
        'function lastDrawTime() view returns (uint256)'
      ];
      const lotteryContract = new ethers.Contract(lotteryAddress, lotteryABI, provider);

      const isActive = await lotteryContract.isLotteryActive();
      const participantCount = Number(await lotteryContract.getParticipantCount());
      const lastDraw = Number(await lotteryContract.lastDrawTime());
      const now = Math.floor(Date.now() / 1000);

      if (!isActive) {
        return interaction.editReply({ content: '❌ Lottery is not active.' });
      }
      if (participantCount < 1) {
        return interaction.editReply({ content: `❌ Need at least 1 participant (current: ${participantCount}).` });
      }

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚠️ Confirm Lottery Draw')
        .setDescription(`Are you sure you want to draw the lottery winner?\n\n**Participants:** ${participantCount}`)
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_draw')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('cancel_draw')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Error initiating lottery draw: ' + error.message });
    }
  },

  async handleButton(interaction, customId) {
    if (customId === 'confirm_draw') {
      try {
        const userId = interaction.user.id;
        const user = await User.findOne({ discordId: userId });
        if (!user || !user.privateKey) {
          return interaction.update({
            content: '❌ You need to connect a wallet first using /connect-wallet.',
            embeds: [],
            components: [],
            ephemeral: true
          });
        }

        const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_URL);
        const userWallet = new ethers.Wallet(user.privateKey, provider);

        const lotteryAddress = '0x441D56a6024cfFF1514191b69810aad10B3c1340'; // Remplacez par la nouvelle adresse après redeploiement
        const lotteryABI = [
          'function drawWinner()',
          'function winner() view returns (address)'
        ];
        const lotteryContract = new ethers.Contract(lotteryAddress, lotteryABI, userWallet);

        const tx = await lotteryContract.drawWinner();
        await tx.wait();

        const winner = await lotteryContract.winner();
        const announcementEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🎉 Lottery Winner')
          .setDescription(`The winner is: \`${winner}\``);

        await interaction.channel.send({ embeds: [announcementEmbed] });
        await interaction.update({
          content: '✅ Lottery drawn successfully!',
          embeds: [],
          components: [],
          ephemeral: true
        });
      } catch (error) {
        console.error(error);
        await interaction.update({
          content: '❌ Error drawing lottery: ' + error.message,
          embeds: [],
          components: [],
          ephemeral: true
        });
      }
    } else if (customId === 'cancel_draw') {
      await interaction.update({
        content: '❌ Lottery draw cancelled.',
        embeds: [],
        components: [],
        ephemeral: true
      });
    }
  }
};