const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ethers } = require('ethers');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  data: new SlashCommandBuilder()
    .setName('draw-lottery')
    .setDescription('Draw the lottery winner (participants or owner only)'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userId = interaction.user.id;
      const user = await User.findOne({ discordId: userId });
      if (!user || !user.privateKey) {
        return interaction.editReply({ content: '❌ You need to connect a wallet first using /connect.' });
      }

      const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_URL);
      const lotteryAddress = process.env.LOTTERY_ADDRESS;
      if (!lotteryAddress) {
        throw new Error('LOTTERY_ADDRESS is not defined in the environment variables.');
      }

      // Updated ABI to include the prizePool function
      const lotteryABI = [
        'function isLotteryActive() view returns (bool)',
        'function getParticipantCount() view returns (uint256)',
        'function lastDrawTime() view returns (uint256)',
        'function ticketCount(address) view returns (uint256)',
        'function getTotalTicketCount() view returns (uint256)',
        'function rlusdToken() view returns (address)',
        'function prizePool() view returns (uint256)' // New function added
      ];
      const lotteryContract = new ethers.Contract(lotteryAddress, lotteryABI, provider);

      const isActive = await lotteryContract.isLotteryActive();
      const participantCount = Number(await lotteryContract.getParticipantCount());
      const userAddress = user.walletAddress; // Using walletAddress from the User model
      if (!userAddress) {
        throw new Error('User wallet address is not defined.');
      }
      const userTickets = Number(await lotteryContract.ticketCount(userAddress));
      const totalTickets = Number(await lotteryContract.getTotalTicketCount());

      // Directly retrieve the prize pool from the contract
      const prizePoolWei = await lotteryContract.prizePool();
      const prizePool = ethers.formatEther(prizePoolWei);

      if (!isActive) {
        return interaction.editReply({ content: '❌ Lottery is not active.' });
      }
      if (participantCount < 1) {
        return interaction.editReply({ content: `❌ At least 1 participant is required (current: ${participantCount}).` });
      }

      // Updated embed to highlight the prize pool
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚠️ Confirm Lottery Draw')
        .setDescription(`🎉 **Win: ${prizePool} RLUSD!** 🎉\nTry your luck to win this jackpot!\n\n**Your tickets:** ${userTickets}\n**Total tickets:** ${totalTickets}\n**Unique participants:** ${participantCount}\n\nAre you sure you want to proceed with the draw?`)
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
      console.error('Error in execute:', error);
      await interaction.editReply({ content: '❌ Error initiating lottery draw: ' + error.message });
    }
  },

  async handleButton(interaction, customId) {
    if (customId === 'confirm_draw') {
      await interaction.deferUpdate();

      const loadingEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⏳ Drawing Lottery...')
        .setDescription('Please wait while the lottery winner is being drawn.')
        .setTimestamp();

      const disabledRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_draw')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('cancel_draw')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      await interaction.editReply({ embeds: [loadingEmbed], components: [disabledRow] });

      try {
        const userId = interaction.user.id;
        const user = await User.findOne({ discordId: userId });
        if (!user || !user.privateKey) {
          return await interaction.editReply({
            content: '❌ You need to connect a wallet first using /connect.',
            embeds: [],
            components: []
          });
        }

        const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_URL);
        const userWallet = new ethers.Wallet(user.privateKey, provider);

        const lotteryAddress = process.env.LOTTERY_ADDRESS;
        if (!lotteryAddress) {
          throw new Error('LOTTERY_ADDRESS is not defined in the environment variables.');
        }

        const lotteryABI = [
          'function drawWinner()',
          'function winner() view returns (address)'
        ];
        const lotteryContract = new ethers.Contract(lotteryAddress, lotteryABI, userWallet);

        const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timed out')), ms));

        const tx = await lotteryContract.drawWinner();
        console.log('Draw transaction sent:', tx.hash);
        const txReceipt = await Promise.race([tx.wait(), timeout(60000)]);
        const transactionHash = tx.hash;
        const transactionUrl = `https://sepolia.etherscan.io/tx/${transactionHash}`; // Adjust for your network

        const winner = await lotteryContract.winner();
        const announcementEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🎉 Lottery Winner')
          .setDescription(`The winner is: \`${winner}\``);

        await interaction.channel.send({ embeds: [announcementEmbed] });

        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Lottery Drawn Successfully')
          .setDescription('The lottery draw has been completed.')
          .addFields(
            { name: 'Transaction', value: `[View on Etherscan](${transactionUrl})`, inline: true }
          )
          .setTimestamp();

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setURL(transactionUrl)
              .setLabel('View Transaction')
              .setStyle(ButtonStyle.Link)
          );

        await interaction.editReply({
          content: '',
          embeds: [successEmbed],
          components: [row]
        });
      } catch (error) {
        console.error('Error in draw-lottery:', error);
        await interaction.editReply({
          content: `❌ Error drawing lottery: ${error.message || 'Unknown error'}`,
          embeds: [],
          components: []
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