const Mapping = require('../models/Mapping');
const { isValidEthereumAddress } = require('./ethereumUtils');

/**
 * Format an Ethereum address for display
 * @param {string} address - The Ethereum address to format
 * @returns {string} - The formatted address
 */
function formatAddress(address) {
  if (!address) return 'Unknown';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Get the Ethereum address for a given identifier
 * @param {string} identifier - Discord user ID or alias
 * @returns {Promise<string|null>} - The Ethereum address or null if not found
 */
async function getAddressForIdentifier(identifier) {
  try {
    // If the identifier is already an Ethereum address, return it
    if (isValidEthereumAddress(identifier)) {
      return identifier;
    }

    // Check if it's a Discord user mention
    let searchId = identifier;
    if (identifier.startsWith('<@') && identifier.endsWith('>')) {
      searchId = identifier.replace(/[<@!>]/g, '');
    }

    // Search for the mapping
    const mapping = await Mapping.findOne({ 
      $or: [
        { identifier: searchId, identifierType: 'user' },
        { identifier: searchId.toLowerCase(), identifierType: 'alias' }
      ]
    });

    return mapping ? mapping.address : null;
  } catch (error) {
    console.error('Error getting address for identifier:', error);
    return null;
  }
}

/**
 * Get the display name for an Ethereum address
 * @param {string} address - The Ethereum address
 * @returns {Promise<string>} - The display name (Discord username, alias, or formatted address)
 */
async function getDisplayNameForAddress(address) {
  try {
    if (!address) return 'Unknown';

    // Find the mapping for this address
    const mapping = await Mapping.findOne({ address: address.toLowerCase() });

    if (mapping) {
      if (mapping.identifierType === 'user') {
        // Return the username if available, otherwise fall back to Discord mention
        if (mapping.username) {
          return mapping.username;
        }
        return `<@${mapping.identifier}>`;
      } else {
        return mapping.identifier; // Return the alias
      }
    }

    // If no mapping found, return the formatted address
    return formatAddress(address);
  } catch (error) {
    console.error('Error getting display name for address:', error);
    return formatAddress(address);
  }
}

/**
 * Create or update a mapping
 * @param {string} identifier - Discord user ID or alias
 * @param {string} identifierType - 'user' or 'alias'
 * @param {string} address - Ethereum address
 * @param {string} createdBy - Discord ID of the user creating the mapping
 * @returns {Promise<Object>} - Result of the operation
 */
async function createOrUpdateMapping(identifier, identifierType, address, createdBy) {
  try {
    // Validate the address
    if (!isValidEthereumAddress(address)) {
      return { success: false, message: 'Invalid Ethereum address' };
    }

    // Normalize the identifier and address
    const normalizedIdentifier = identifierType === 'alias' ? identifier.toLowerCase() : identifier;
    const normalizedAddress = address.toLowerCase();

    // Get username if it's a user identifier
    let username = '';
    if (identifierType === 'user') {
      const User = require('../models/User');
      const user = await User.findOne({ discordId: normalizedIdentifier });
      if (user) {
        username = user.username;
      }
    }

    // Check if the mapping already exists
    const existingMapping = await Mapping.findOne({ identifier: normalizedIdentifier, identifierType });

    if (existingMapping) {
      // Update the existing mapping
      existingMapping.address = normalizedAddress;
      existingMapping.updatedAt = Date.now();
      
      // Update username if it's a user identifier
      if (identifierType === 'user' && username) {
        existingMapping.username = username;
      }
      
      await existingMapping.save();
      return { success: true, message: 'Mapping updated successfully', isUpdate: true };
    } else {
      // Create a new mapping
      const newMapping = new Mapping({
        identifier: normalizedIdentifier,
        identifierType,
        address: normalizedAddress,
        createdBy,
        username: username
      });
      await newMapping.save();
      return { success: true, message: 'Mapping created successfully', isUpdate: false };
    }
  } catch (error) {
    console.error('Error creating/updating mapping:', error);
    return { success: false, message: 'Error creating/updating mapping' };
  }
}

/**
 * Remove a mapping
 * @param {string} identifier - Discord user ID or alias
 * @param {string} identifierType - 'user' or 'alias'
 * @returns {Promise<Object>} - Result of the operation
 */
async function removeMapping(identifier, identifierType) {
  try {
    // Normalize the identifier
    const normalizedIdentifier = identifierType === 'alias' ? identifier.toLowerCase() : identifier;

    // Find and delete the mapping
    const result = await Mapping.findOneAndDelete({ identifier: normalizedIdentifier, identifierType });

    if (result) {
      return { success: true, message: 'Mapping removed successfully' };
    } else {
      return { success: false, message: 'Mapping not found' };
    }
  } catch (error) {
    console.error('Error removing mapping:', error);
    return { success: false, message: 'Error removing mapping' };
  }
}

/**
 * Get all mappings for a user
 * @param {string} userId - Discord user ID
 * @returns {Promise<Array>} - Array of mappings
 */
async function getUserMappings(userId) {
  try {
    // Get user's own mapping and any aliases they created
    const mappings = await Mapping.find({
      $or: [
        { identifier: userId, identifierType: 'user' },
        { createdBy: userId }
      ]
    }).sort({ createdAt: -1 });

    return mappings;
  } catch (error) {
    console.error('Error getting user mappings:', error);
    return [];
  }
}

module.exports = {
  formatAddress,
  getAddressForIdentifier,
  getDisplayNameForAddress,
  createOrUpdateMapping,
  removeMapping,
  getUserMappings
}; 