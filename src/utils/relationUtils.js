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

    // Search for the relation
    const relation = await Mapping.findOne({ 
      $or: [
        { identifier: searchId, identifierType: 'user' },
        { identifier: searchId.toLowerCase(), identifierType: 'alias' }
      ]
    });

    return relation ? relation.address : null;
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

    // Find the relation for this address
    const relation = await Mapping.findOne({ address: address.toLowerCase() });

    if (relation) {
      if (relation.identifierType === 'user') {
        // Return the username if available, otherwise fall back to Discord mention
        if (relation.username) {
          return relation.username;
        }
        return `<@${relation.identifier}>`;
      } else {
        return relation.identifier; // Return the alias
      }
    }

    // If no relation found, return the formatted address
    return formatAddress(address);
  } catch (error) {
    console.error('Error getting display name for address:', error);
    return formatAddress(address);
  }
}

/**
 * Create or update a relation
 * @param {string} identifier - Discord user ID or alias
 * @param {string} identifierType - 'user' or 'alias'
 * @param {string} address - Ethereum address
 * @param {string} createdBy - Discord ID of the user creating the relation
 * @returns {Promise<Object>} - Result of the operation
 */
async function createOrUpdateRelation(identifier, identifierType, address, createdBy) {
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

    // Check if the relation already exists
    const existingRelation = await Mapping.findOne({ identifier: normalizedIdentifier, identifierType });

    if (existingRelation) {
      // Update the existing relation
      existingRelation.address = normalizedAddress;
      existingRelation.updatedAt = Date.now();
      
      // Update username if it's a user identifier
      if (identifierType === 'user' && username) {
        existingRelation.username = username;
      }
      
      await existingRelation.save();
      return { success: true, message: 'Relation updated successfully', isUpdate: true };
    } else {
      // Create a new relation
      const newRelation = new Mapping({
        identifier: normalizedIdentifier,
        identifierType,
        address: normalizedAddress,
        createdBy,
        username: username
      });
      await newRelation.save();
      return { success: true, message: 'Relation created successfully', isUpdate: false };
    }
  } catch (error) {
    console.error('Error creating/updating relation:', error);
    return { success: false, message: 'Error creating/updating relation' };
  }
}

/**
 * Remove a relation
 * @param {string} identifier - Discord user ID or alias
 * @param {string} identifierType - 'user' or 'alias'
 * @returns {Promise<Object>} - Result of the operation
 */
async function removeRelation(identifier, identifierType) {
  try {
    // Normalize the identifier
    const normalizedIdentifier = identifierType === 'alias' ? identifier.toLowerCase() : identifier;

    // Find and delete the relation
    const result = await Mapping.findOneAndDelete({ identifier: normalizedIdentifier, identifierType });

    if (result) {
      return { success: true, message: 'Relation removed successfully' };
    } else {
      return { success: false, message: 'Relation not found' };
    }
  } catch (error) {
    console.error('Error removing relation:', error);
    return { success: false, message: 'Error removing relation' };
  }
}

/**
 * Get all relations for a user
 * @param {string} userId - Discord user ID
 * @returns {Promise<Array>} - Array of relations
 */
async function getUserRelations(userId) {
  try {
    // Get user's own relation and any aliases they created
    const relations = await Mapping.find({
      $or: [
        { identifier: userId, identifierType: 'user' },
        { createdBy: userId }
      ]
    }).sort({ createdAt: -1 });

    return relations;
  } catch (error) {
    console.error('Error getting user relations:', error);
    return [];
  }
}

module.exports = {
  formatAddress,
  getAddressForIdentifier,
  getDisplayNameForAddress,
  createOrUpdateRelation,
  removeRelation,
  getUserRelations
}; 