const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ethers = require('ethers');
const User = require('../models/User');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy-lottery-ticket')
    .setDescription('Buy a ticket for the RLUSD lottery (costs 1 RLUSD)'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const user = await User.findOne({ discordId: interaction.user.id });
      if (!user || !user.privateKey) {
        return interaction.editReply({ content: '❌ Connect a wallet first using /connect-wallet.' });
      }

      const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_URL);
      const wallet = new ethers.Wallet(user.privateKey, provider);

      const rlusdAddress = '0xe101fb315a64cda9944e570a7bffafe60b994b1d';
      const lotteryAddress = '0x441D56a6024cfFF1514191b69810aad10B3c1340';

      const rlusdABI = ['function approve(address spender, uint256 amount) returns (bool)', 'function balanceOf(address account) view returns (uint256)'];
      const lotteryABI = ['function buyTicket()'];

      const rlusdContract = new ethers.Contract(rlusdAddress, rlusdABI, wallet);
      const lotteryContract = new ethers.Contract(lotteryAddress, lotteryABI, wallet);

      const balance = await rlusdContract.balanceOf(wallet.address);
      const requiredBalance = ethers.parseEther('1');
      if (BigInt(balance) < BigInt(requiredBalance)) {
          return interaction.editReply({ content: '❌ Insufficient RLUSD. Get some from a faucet.' });
      }

      const approveTx = await rlusdContract.approve(lotteryAddress, ethers.parseEther('1'));
      await approveTx.wait();

      const buyTx = await lotteryContract.buyTicket();
      await buyTx.wait();

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Ticket Purchased')
        .setDescription('You have successfully bought a lottery ticket.');
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Error buying ticket: ' + error.message });
    }
  },
};