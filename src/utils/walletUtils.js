const { ethers } = require('ethers');
const { rlusdContract, provider } = require('./ethereumUtils');

/**
 * Generates a random Ethereum wallet
 * @returns {Object} An object containing the wallet address and private key
 */
function generateRandomWallet() {
  // Create a random wallet
  const wallet = ethers.Wallet.createRandom();
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
}

/**
 * Checks the actual RLUSD balance of a wallet on the blockchain
 * @param {string} address - The wallet address to check
 * @returns {Promise<string>} - The formatted RLUSD balance
 */
async function checkRealBalance(address) {
  try {
    const balance = await rlusdContract.balanceOf(address);
    const decimals = await rlusdContract.decimals();
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    console.error('Error checking real balance:', error);
    throw error;
  }
}

/**
 * Checks the ETH balance of a wallet on the blockchain
 * @param {string} address - The wallet address to check
 * @returns {Promise<string>} - The formatted ETH balance
 */
async function checkEthBalance(address) {
  try {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error checking ETH balance:', error);
    throw error;
  }
}

/**
 * Performs an actual RLUSD transfer on the blockchain
 * @param {string} privateKey - The private key of the sender wallet
 * @param {string} toAddress - The address of the recipient wallet
 * @param {string|number} amount - The amount of RLUSD to send
 * @returns {Promise<Object>} - The transaction details
 */
async function transferRLUSD(privateKey, toAddress, amount) {
  try {
    console.log('transferRLUSD called with amount:', amount, 'type:', typeof amount);
    
    // Create a wallet with the private key
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log('Wallet address:', wallet.address);
    
    // Check ETH balance for transaction fees
    const ethBalance = await provider.getBalance(wallet.address);
    console.log('ETH balance:', ethers.formatEther(ethBalance));
    
    // Check if ETH balance is zero
    if (ethBalance.toString() === '0') {
      return {
        success: false,
        error: "You don't have Sepolia ETH to pay for transaction fees. Please get test ETH from https://www.sepoliafaucet.io/ before making a transfer.",
        code: "NO_ETH"
      };
    }
    
    // Connect the RLUSD contract with the wallet
    const rlusdWithSigner = rlusdContract.connect(wallet);
    
    // Get the token decimals
    const decimals = await rlusdContract.decimals();
    console.log('Token decimals:', decimals);
    
    // Clean and validate the amount
    let amountStr = amount.toString().trim();
    
    // Replace commas with dots (for European formats)
    amountStr = amountStr.replace(',', '.');
    
    // Check if the amount is a valid number
    if (isNaN(parseFloat(amountStr)) || !isFinite(parseFloat(amountStr))) {
      return {
        success: false,
        error: "The amount is not a valid number. Please use only digits and a decimal point (e.g., 10.5).",
        code: "INVALID_AMOUNT"
      };
    }
    
    console.log('Amount string for parseUnits:', amountStr);
    
    try {
      // Ensure the format is correct for parseUnits (no special characters)
      // Convert to number then to string to normalize the format
      const normalizedAmount = parseFloat(amountStr).toString();
      
      // Convert the amount to units with decimals
      const amountToSend = ethers.parseUnits(normalizedAmount, decimals);
      console.log('Amount to send (in wei):', amountToSend.toString());
      
      // Check RLUSD balance
      const balance = await rlusdContract.balanceOf(wallet.address);
      console.log('RLUSD balance:', ethers.formatUnits(balance, decimals));
      
      // Compare BigInt correctly
      if (balance < amountToSend) {
        return {
          success: false,
          error: "Insufficient RLUSD balance to make this transfer. Get test RLUSD from https://tryrlusd.com/",
          code: "INSUFFICIENT_RLUSD"
        };
      }
      
      // Estimate gas needed for the transaction
      console.log('Estimating gas...');
      const gasEstimate = await rlusdWithSigner.transfer.estimateGas(toAddress, amountToSend).catch(error => {
        console.error('Error estimating gas:', error);
        throw error;
      });
      console.log('Gas estimate:', gasEstimate.toString());
      
      // Calculate gas limit with a 20% margin
      // Convert to BigInt to avoid type mixing errors
      const gasLimit = BigInt(Math.ceil(Number(gasEstimate) * 1.2));
      console.log('Gas limit with 20% margin:', gasLimit.toString());
      
      // Send the transaction
      console.log('Sending transaction...');
      const tx = await rlusdWithSigner.transfer(toAddress, amountToSend, {
        gasLimit: gasLimit
      });
      console.log('Transaction sent:', tx.hash);
      
      // Wait for transaction confirmation
      console.log('Waiting for confirmation...');
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt.hash);
      
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        link: `https://sepolia.etherscan.io/tx/${receipt.hash}`
      };
    } catch (parseError) {
      console.error('Error parsing amount:', parseError);
      return {
        success: false,
        error: "Numeric conversion error. Make sure the amount is valid and uses only digits and a decimal point (e.g., 10.5).",
        code: "PARSE_ERROR",
        details: parseError.message
      };
    }
  } catch (error) {
    console.error('Error transferring RLUSD:', error);
    
    // Analyze the error to provide a more precise message
    let errorMessage = error.message || "Unknown error";
    let errorCode = "UNKNOWN_ERROR";
    
    if (errorMessage.includes("insufficient funds")) {
      errorCode = "INSUFFICIENT_FUNDS";
    } else if (errorMessage.includes("user rejected")) {
      errorCode = "USER_REJECTED";
    } else if (errorMessage.includes("gas required exceeds allowance")) {
      errorCode = "GAS_LIMIT_EXCEEDED";
    } else if (errorMessage.includes("nonce")) {
      errorCode = "NONCE_ERROR";
    } else if (errorMessage.includes("BigInt")) {
      errorCode = "BIGINT_ERROR";
      errorMessage = "Numeric conversion error. Make sure the amount is valid and uses only digits and a decimal point (e.g., 10.5).";
    }
    
    return {
      success: false,
      error: errorMessage,
      code: errorCode,
      originalError: error.toString()
    };
  }
}

/**
 * Generates a link to prefund a wallet
 * @param {string} address - The wallet address to prefund
 * @returns {string} - The link to prefund the wallet
 */
function generateFundingLink(address) {
  return `https://sepolia.etherscan.io/address/${address}`;
}

/**
 * Send ETH from admin wallet to a specified address
 * @param {string} toAddress - Recipient address
 * @param {string|number} amount - Amount of ETH to send
 * @returns {Promise<Object>} - Transaction details
 */
async function sendEthFromAdmin(toAddress, amount) {
  try {
    console.log('sendEthFromAdmin called with amount:', amount, 'type:', typeof amount);
    
    // Create a wallet with the admin private key
    const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
    console.log('Admin wallet address:', adminWallet.address);
    
    // Check admin's ETH balance
    const adminEthBalance = await provider.getBalance(adminWallet.address);
    console.log('Admin ETH balance:', ethers.formatEther(adminEthBalance));
    
    // Convert amount to ethers
    const amountInWei = ethers.parseEther(amount.toString());
    console.log('Amount to send (in wei):', amountInWei.toString());
    
    // Check if admin's ETH balance is sufficient
    if (adminEthBalance < amountInWei) {
      return {
        success: false,
        error: "Admin's ETH balance insufficient for this transfer.",
        code: "INSUFFICIENT_ADMIN_ETH"
      };
    }
    
    // Create transaction
    const tx = await adminWallet.sendTransaction({
      to: toAddress,
      value: amountInWei,
      gasLimit: 21000 // Standard gas limit for ETH transfer
    });
    
    console.log('Transaction sent:', tx.hash);
    
    // Wait for transaction confirmation
    console.log('Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.hash);
    
    return {
      success: true,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      link: `https://sepolia.etherscan.io/tx/${receipt.hash}`
    };
  } catch (error) {
    console.error('Error sending ETH from admin:', error);
    
    // Analyze error to provide a more precise message
    let errorMessage = error.message || "Unknown error";
    let errorCode = "UNKNOWN_ERROR";
    
    if (errorMessage.includes("insufficient funds")) {
      errorCode = "INSUFFICIENT_FUNDS";
    } else if (errorMessage.includes("user rejected")) {
      errorCode = "USER_REJECTED";
    } else if (errorMessage.includes("gas required exceeds allowance")) {
      errorCode = "GAS_LIMIT_EXCEEDED";
    } else if (errorMessage.includes("nonce")) {
      errorCode = "NONCE_ERROR";
    }
    
    return {
      success: false,
      error: errorMessage,
      code: errorCode,
      originalError: error.toString()
    };
  }
}

module.exports = {
  generateRandomWallet,
  generateFundingLink,
  checkRealBalance,
  checkEthBalance,
  transferRLUSD,
  sendEthFromAdmin
}; 