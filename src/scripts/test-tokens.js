require('dotenv').config();
const { ethers } = require('ethers');
const RLUSD_ABI = require('../abis/RLUSD.json');

async function testTokenContract() {
  try {
    console.log('Testing connection to RLUSD contract...');
    
    // Check environment variables
    if (!process.env.ETHEREUM_PROVIDER_URL) {
      throw new Error('ETHEREUM_PROVIDER_URL not defined in .env file');
    }
    
    if (!process.env.RLUSD_CONTRACT_ADDRESS) {
      throw new Error('RLUSD_CONTRACT_ADDRESS not defined in .env file');
    }
    
    // Connect to Ethereum provider
    console.log(`Connecting to provider: ${process.env.ETHEREUM_PROVIDER_URL}`);
    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_URL);
    
    // Check network connection
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
    
    // Connect to RLUSD contract
    console.log(`Connecting to RLUSD contract: ${process.env.RLUSD_CONTRACT_ADDRESS}`);
    const rlusdContract = new ethers.Contract(
      process.env.RLUSD_CONTRACT_ADDRESS,
      RLUSD_ABI,
      provider
    );
    
    // Get contract information
    const name = await rlusdContract.name();
    const symbol = await rlusdContract.symbol();
    const decimals = await rlusdContract.decimals();
    const totalSupply = await rlusdContract.totalSupply();
    
    console.log('\nRLUSD contract information:');
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Total supply: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
    
    // Check admin balance if defined
    if (process.env.ADMIN_WALLET) {
      console.log(`\nChecking balance for address: ${process.env.ADMIN_WALLET}`);
      const balance = await rlusdContract.balanceOf(process.env.ADMIN_WALLET);
      console.log(`Balance: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
    }
    
    console.log('\n✅ Test successful! The connection to the RLUSD contract works correctly.');
  } catch (error) {
    console.error('\n❌ Error during RLUSD contract test:');
    console.error(error);
    process.exit(1);
  }
}

// Run test
testTokenContract(); 