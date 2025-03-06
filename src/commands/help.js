const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display help and information about available commands')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Specific command you want help with')
        .setRequired(false)
        .addChoices(
          { name: 'balance', value: 'balance' },
          { name: 'connect', value: 'connect' },
          { name: 'create-wallet', value: 'create-wallet' },
          { name: 'disconnect', value: 'disconnect' },
          { name: 'history', value: 'history' },
          { name: 'leaderboard', value: 'leaderboard' },
          { name: 'map', value: 'map' },
          { name: 'relations', value: 'relations' },
          { name: 'tip', value: 'tip' },
          { name: 'unmap', value: 'unmap' },
          { name: 'fees', value: 'fees' },
          { name: 'buy-lottery-ticket', value: 'buy-lottery-ticket' },
          { name: 'draw-lottery', value: 'draw-lottery' }
        )),
  
  async execute(interaction) {
    try {
      // Reply immediately to avoid timeout errors
      await interaction.reply({ content: "Generating help...", ephemeral: true });
      
      // Get the specific command if specified
      const specificCommand = interaction.options.getString('command');
      
      // If a specific command is requested, display help for that command
      if (specificCommand) {
        await this.showCommandHelp(interaction, specificCommand);
      } else {
        // Otherwise, display general help
        await this.showGeneralHelp(interaction);
      }
      
    } catch (error) {
      console.error('Error displaying help:', error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: `An error occurred while displaying help: ${error.message}`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `An error occurred while displaying help: ${error.message}`,
          ephemeral: true
        });
      }
    }
  },
  
  // Function to display general help
  async showGeneralHelp(interaction) {
    // Create an embed for general help
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📚 RippleTip Bot Help')
      .setDescription('RippleTip is a bot that allows you to send and receive RLUSD (Ripple USD) on the Sepolia blockchain (Ethereum testnet).')
      .addFields(
        { name: '🔰 Basic Commands', value: 
          '`/create-wallet` - Create a new wallet\n' +
          '`/connect` - Connect an existing wallet\n' +
          '`/disconnect` - Disconnect your wallet\n' +
          '`/balance` - Check your RLUSD balance'
        },
        { name: '💸 Transactions', value: 
          '`/tip` - Send RLUSD to a user or address\n' +
          '`/history` - View your transaction history'
        },
        { name: '🔗 Relations', value: 
          '`/map` - Associate an Ethereum address with your Discord account\n' +
          '`/unmap` - Remove the association between your Discord account and an address\n' +
          '`/relations` - View the associations between addresses and users'
        },
        { name: '🎮 Lottery', value: 
          '`/buy-lottery-ticket` - Purchase a lottery ticket with RLUSD\n' +
          '`/draw-lottery` - Draw the lottery and select a winner'
        },
        { name: '📊 Statistics', value: 
          '`/leaderboard` - View the ranking of users by RLUSD balance'
        },
        { name: '❓ Help', value: 
          '`/help [command]` - Display general help or help for a specific command'
        }
      )
      .addFields({
        name: '📝 Important Note',
        value: 'This bot uses the Sepolia blockchain (Ethereum testnet). RLUSD tokens are test tokens and have no real value.'
      })
      .setTimestamp();
    
    // Create buttons for useful links
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setURL('https://sepolia.etherscan.io/token/0x1c7d4b196cb0c7b01d743fbc6116a902379c7238')
          .setLabel('RLUSD on Etherscan')
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setURL('https://tryrlusd.com/')
          .setLabel('RLUSD Faucet')
          .setStyle(ButtonStyle.Link)
      );
    
    // Send the embed to the user
    await interaction.editReply({
      content: null,
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  },
  
  // Function to display help for a specific command
  async showCommandHelp(interaction, commandName) {
    // Define help information for each command
    const commandHelp = {
      'balance': {
        title: '💰 Command: /balance',
        description: 'Check your RLUSD balance or that of another user.',
        usage: '`/balance [user]`',
        options: [
          { name: 'user', description: 'User whose balance you want to check (optional)' }
        ],
        examples: [
          '`/balance` - Check your own balance',
          '`/balance @user` - Check another user\'s balance'
        ]
      },
      'connect': {
        title: '🔌 Command: /connect',
        description: 'Connect an existing Ethereum wallet to your Discord account.',
        usage: '`/connect address private_key`',
        options: [
          { name: 'address', description: 'Ethereum address of your wallet' },
          { name: 'private_key', description: 'Private key of your wallet (visible only to you)' }
        ],
        examples: [
          '`/connect 0x1234...5678 0xabcd...ef01` - Connect an existing wallet'
        ],
        warning: '⚠️ Never share your private key with anyone. The `/connect` command is secure and your private key is only visible to you.'
      },
      'create-wallet': {
        title: '🔑 Command: /create-wallet',
        description: 'Create a new Ethereum wallet and connect it to your Discord account. This command automatically generates an Ethereum address and a secure private key, allowing you to send and receive RLUSD immediately. Ideal for new users who don\'t have an Ethereum wallet yet.',
        usage: '`/create-wallet`',
        options: [],
        examples: [
          '`/create-wallet` - Create a new wallet'
        ],
        warning: '⚠️ Make sure to save your private key in a safe place. If you lose it, you will no longer be able to access your funds.',
        note: 'After creating your wallet, you will need tokens to use it. You can get free RLUSD at https://tryrlusd.com/ and Sepolia ETH at https://www.sepoliafaucet.io/ to pay for transaction fees.'
      },
      'disconnect': {
        title: '🔓 Command: /disconnect',
        description: 'Disconnect your Ethereum wallet from your Discord account.',
        usage: '`/disconnect`',
        options: [],
        examples: [
          '`/disconnect` - Disconnect your wallet'
        ]
      },
      'history': {
        title: '📜 Command: /history',
        description: 'View your RLUSD transaction history.',
        usage: '`/history [page]`',
        options: [
          { name: 'page', description: 'Page number to display (optional)' }
        ],
        examples: [
          '`/history` - View the first page of your history',
          '`/history 2` - View the second page of your history'
        ]
      },
      'leaderboard': {
        title: '🏆 Command: /leaderboard',
        description: 'View the ranking of users by RLUSD balance.',
        usage: '`/leaderboard [page] [refresh]`',
        options: [
          { name: 'page', description: 'Page number to display (optional)' },
          { name: 'refresh', description: 'Refresh balances from the blockchain (optional)' }
        ],
        examples: [
          '`/leaderboard` - View the first page of the leaderboard',
          '`/leaderboard 2` - View the second page of the leaderboard',
          '`/leaderboard refresh:true` - View the leaderboard with refreshed balances'
        ]
      },
      'map': {
        title: '🔗 Command: /map',
        description: 'Associate an Ethereum address with your Discord account to receive tips.',
        usage: '`/map address`',
        options: [
          { name: 'address', description: 'Ethereum address to associate with your account' }
        ],
        examples: [
          '`/map 0x1234...5678` - Associate an address with your account'
        ],
        note: 'This command only allows you to receive tips. To send RLUSD, you must connect a wallet with a private key using `/connect` or create a new one with `/create-wallet`.'
      },
      'relations': {
        title: '📋 Command: /relations',
        description: 'View the associations between Ethereum addresses and Discord users.',
        usage: '`/relations [address] [user] [page]`',
        options: [
          { name: 'address', description: 'Ethereum address to search for (optional)' },
          { name: 'user', description: 'Discord user to search for (optional)' },
          { name: 'page', description: 'Page number to display (optional)' }
        ],
        examples: [
          '`/relations` - View all associations',
          '`/relations address:0x1234` - Search for a specific address',
          '`/relations user:@user` - Search for a specific user'
        ]
      },
      'tip': {
        title: '💸 Command: /tip',
        description: 'Send RLUSD to a recipient (Discord user or Ethereum address).',
        usage: '`/tip recipient amount [message]`',
        options: [
          { name: 'recipient', description: 'Ethereum address or @user' },
          { name: 'amount', description: 'Amount of RLUSD to send' },
          { name: 'message', description: 'Personal message with your tip (optional)' }
        ],
        examples: [
          '`/tip @user 100` - Send 100 RLUSD to a user',
          '`/tip 0x1234...5678 50 "Thanks for your help!"` - Send 50 RLUSD to an address with a message'
        ],
        warning: '⚠️ You must have a wallet connected with a private key to send tips.'
      },
      'unmap': {
        title: '🔗 Command: /unmap',
        description: 'Remove the association between your Discord account and an Ethereum address.',
        usage: '`/unmap address`',
        options: [
          { name: 'address', description: 'Ethereum address to remove from your account' }
        ],
        examples: [
          '`/unmap 0x1234...5678` - Remove the association with an address'
        ],
        note: 'This command can only be used if you have an associated address without a private key. If you have a wallet connected with a private key, use `/disconnect` instead.'
      },
      'fees': {
        title: '💰 RippleTip Fee Structure',
        description: 'RippleTip uses a PayMaster contract to process transactions with a fee structure based on the amount sent.',
        usage: '`/help fees`',
        options: [],
        examples: [
          '`/help fees` - View the fee structure'
        ],
        feeStructure: [
          { range: '1 - 4.99 RLUSD', fee: '10%' },
          { range: '5 - 9.99 RLUSD', fee: '8%' },
          { range: '10 - 24.99 RLUSD', fee: '6%' },
          { range: '25 - 49.99 RLUSD', fee: '4%' },
          { range: '50 - 99.99 RLUSD', fee: '2%' },
          { range: '100+ RLUSD', fee: '1%' }
        ],
        note: 'The minimum amount for a tip is 1 RLUSD. Fees are automatically calculated and deducted from the amount you send. The recipient receives the amount after fees.'
      },
      'buy-lottery-ticket': {
        title: '🎟️ Command: /buy-lottery-ticket',
        description: 'Purchase a lottery ticket with RLUSD for a chance to win the jackpot.',
        usage: '`/buy-lottery-ticket [amount]`',
        options: [
          { name: 'amount', description: 'Amount of RLUSD to spend on lottery tickets (optional, default: 1)' }
        ],
        examples: [
          '`/buy-lottery-ticket` - Buy a lottery ticket for 1 RLUSD',
          '`/buy-lottery-ticket 5` - Buy 5 lottery tickets (5 RLUSD)'
        ],
        note: 'Each ticket costs 1 RLUSD. The more tickets you buy, the higher your chances of winning. All ticket purchases go into the lottery pool, which will be awarded to the winner.'
      },
      'draw-lottery': {
        title: '🎰 Command: /draw-lottery',
        description: 'Draw the lottery and select a random winner from all participants. This command is restricted to administrators only.',
        usage: '`/draw-lottery`',
        options: [],
        examples: [
          '`/draw-lottery` - Draw the lottery and select a winner'
        ],
        note: 'When the lottery is drawn, a random ticket is selected from all purchased tickets. The owner of the winning ticket receives the entire lottery pool minus a small fee. After the draw, the lottery resets for a new round.'
      }
    };
    
    // Check if the command exists
    if (!commandHelp[commandName]) {
      await interaction.editReply({
        content: `Command \`/${commandName}\` not found. Use \`/help\` to see all available commands.`,
        ephemeral: true
      });
      return;
    }

    // Get the help information for the command
    const help = commandHelp[commandName];

    // Create an embed for the command help
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(help.title)
      .setDescription(help.description)
      .addFields({ name: 'Usage', value: help.usage });

    // Add options if there are any
    if (help.options && help.options.length > 0) {
      embed.addFields({
        name: 'Options',
        value: help.options.map(option => `\`${option.name}\` - ${option.description}`).join('\n')
      });
    }

    // Add examples if there are any
    if (help.examples && help.examples.length > 0) {
      embed.addFields({
        name: 'Examples',
        value: help.examples.join('\n')
      });
    }

    // Add warning if there is one
    if (help.warning) {
      embed.addFields({ name: '⚠️ Warning', value: help.warning });
    }

    // Add note if there is one
    if (help.note) {
      embed.addFields({ name: '📝 Note', value: help.note });
    }
    
    // Add fee structure if this is the fees command
    if (commandName === 'fees' && help.feeStructure) {
      const feeTable = help.feeStructure.map(tier => `${tier.range}: ${tier.fee}`).join('\n');
      embed.addFields({ name: 'Fee Structure', value: feeTable });
    }

    // Create a button to go back to the general help
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help_back')
          .setLabel('Back to General Help')
          .setStyle(ButtonStyle.Secondary)
      );

    // Send the embed to the user
    await interaction.editReply({
      content: null,
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  },
  
  // Handle button interactions for help command
  async handleHelpButton(interaction, buttonId) {
    if (buttonId === 'help_back') {
      await this.showGeneralHelp(interaction);
    } else if (buttonId.startsWith('help_')) {
      const commandName = buttonId.replace('help_', '');
      await this.showCommandHelp(interaction, commandName);
    }
  }
};
