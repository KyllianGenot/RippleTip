const { ethers } = require('ethers');
const crypto = require('crypto');
const rlusdABI = require('../contracts/rlusdABI.json');

// Ethereum provider initialization
const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_URL);

// RLUSD contract address
const RLUSD_CONTRACT_ADDRESS = process.env.RLUSD_CONTRACT_ADDRESS;

// PayMaster contract address
const PAYMASTER_CONTRACT_ADDRESS = '0xf77De6d2AD0E954AF262bb5798002Dd5582376Cd';

// RLUSD contract initialization
const rlusdContract = new ethers.Contract(RLUSD_CONTRACT_ADDRESS, rlusdABI, provider);

/**
 * Generates a random nonce for signature verification
 * @returns {string} Random nonce
 */
function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Checks if an Ethereum address is valid
 * @param {string} address - Ethereum address to check
 * @returns {boolean} True if the address is valid, false otherwise
 */
function isValidEthereumAddress(address) {
  return ethers.isAddress(address);
}

/**
 * Gets the RLUSD balance of an address
 * @param {string} address - Ethereum address
 * @returns {Promise<string>} Formatted balance
 */
async function getBalance(address) {
  try {
    const balance = await rlusdContract.balanceOf(address);
    const decimals = await rlusdContract.decimals();
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    console.error('Error retrieving balance:', error);
    throw error;
  }
}

/**
 * Verifies a signature to authenticate a user
 * @param {string} message - Signed message (usually the nonce)
 * @param {string} signature - Message signature
 * @param {string} address - Ethereum address supposed to have signed the message
 * @returns {boolean} True if the signature is valid, false otherwise
 */
function verifySignature(message, signature, address) {
  try {
    const signerAddress = ethers.verifyMessage(message, signature);
    return signerAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Creates a message to sign for wallet verification
 * @param {string} discordId - User's Discord ID
 * @param {string} nonce - Random nonce
 * @returns {string} Message to sign
 */
function createSignatureMessage(discordId, nonce) {
  return `Verification of your Ethereum wallet for Discord\n\nDiscord ID: ${discordId}\nNonce: ${nonce}\n\nBy signing this message, you confirm that you are the owner of this wallet.`;
}

module.exports = {
  provider,
  rlusdContract,
  generateNonce,
  isValidEthereumAddress,
  getBalance,
  verifySignature,
  createSignatureMessage,
  PAYMASTER_CONTRACT_ADDRESS
}; 