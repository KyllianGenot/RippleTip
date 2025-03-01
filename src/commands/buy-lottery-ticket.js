const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ethers = require('ethers');
const User = require('../models/User');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy-lottery-ticket')
    .setDescription('Buy tickets for the RLUSD lottery (1 RLUSD per ticket)')
    .addIntegerOption(option =>
      option
        .setName('ticket-amount')
        .setDescription('Number of tickets to buy')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const user = await User.findOne({ discordId: interaction.user.id });
      if (!user || !user.privateKey) {
        return interaction.editReply({ content: '❌ Connect a wallet first using /connect-wallet.' });
      }

      const ticketAmount = interaction.options.getInteger('ticket-amount');
      const totalCost = ticketAmount; // In RLUSD (1 RLUSD per ticket)

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚠️ Confirm Ticket Purchase')
        .setDescription(`Are you sure you want to buy ${ticketAmount} lottery ticket${ticketAmount > 1 ? 's' : ''} for ${totalCost} RLUSD?`)
        .setTimestamp()
        .setFooter({ text: `Ticket Amount: ${ticketAmount}` });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_buy_ticket_${ticketAmount}`) // Include ticketAmount in customId
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('cancel_buy_ticket')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    } catch (error) {
      console.error('Error in execute:', error);
      await interaction.editReply({ content: '❌ Error initiating ticket purchase: ' + error.message });
    }
  },

  async handleButton(interaction, customId) {
    if (customId.startsWith('confirm_buy_ticket_')) {
      await interaction.deferUpdate();

      const ticketAmount = parseInt(customId.split('_')[3], 10);
      const totalCost = ethers.parseEther(ticketAmount.toString());

      const loadingEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⏳ Processing Purchase...')
        .setDescription(`Please wait while your ${ticketAmount} ticket${ticketAmount > 1 ? 's are' : ' is'} being purchased.`)
        .setTimestamp();

      const disabledRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_buy_ticket_${ticketAmount}`)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('cancel_buy_ticket')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      await interaction.editReply({ embeds: [loadingEmbed], components: [disabledRow] });

      try {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user || !user.privateKey) {
          return interaction.editReply({
            content: '❌ You need to connect a wallet first using /connect-wallet.',
            embeds: [],
            components: []
          });
        }

        const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_URL);
        const wallet = new ethers.Wallet(user.privateKey, provider);

        const rlusdAddress = '0xe101fb315a64cda9944e570a7bffafe60b994b1d';
        const lotteryAddress = process.env.LOTTERY_ADDRESS;

        const rlusdABI = [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function balanceOf(address account) view returns (uint256)'
        ];
        const lotteryABI = [
          'function buyTicket(uint256 ticketAmount)'
        ];

        const rlusdContract = new ethers.Contract(rlusdAddress, rlusdABI, wallet);
        const lotteryContract = new ethers.Contract(lotteryAddress, lotteryABI, wallet);

        const balance = await rlusdContract.balanceOf(wallet.address);
        if (BigInt(balance) < BigInt(totalCost)) {
          return interaction.editReply({
            content: `❌ Insufficient RLUSD. You need ${ticketAmount} RLUSD.`,
            embeds: [],
            components: []
          });
        }

        const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timed out')), ms));

        const approveTx = await rlusdContract.approve(lotteryAddress, totalCost);
        console.log('Approve transaction sent:', approveTx.hash);
        await Promise.race([approveTx.wait(), timeout(60000)]);

        const buyTx = await lotteryContract.buyTicket(ticketAmount);
        console.log('Buy transaction sent:', buyTx.hash);
        await Promise.race([buyTx.wait(), timeout(60000)]);

        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Tickets Purchased')
          .setDescription(`You have successfully bought ${ticketAmount} lottery ticket${ticketAmount > 1 ? 's' : ''}.`)
          .setTimestamp();

        await interaction.editReply({
          content: '',
          embeds: [embed],
          components: []
        });
      } catch (error) {
        console.error('Error in buy-lottery-ticket:', error);
        await interaction.editReply({
          content: `❌ Error buying tickets: ${error.message || 'Unknown error'}`,
          embeds: [],
          components: []
        });
      }
    } else if (customId === 'cancel_buy_ticket') {
      await interaction.update({
        content: '❌ Ticket purchase cancelled.',
        embeds: [],
        components: [],
        ephemeral: true
      });
    }
  }
};