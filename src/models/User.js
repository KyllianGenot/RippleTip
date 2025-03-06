const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Informations d'identification Discord
  discordId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    index: true
  },
  
  // Informations blockchain
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  privateKey: {
    type: String,
    required: true
  },
  
  // Métadonnées
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Middleware pour mettre à jour la date de dernière activité
userSchema.pre('save', function(next) {
  this.lastActivity = Date.now();
  next();
});

// Ajouter des index composites pour les requêtes fréquentes
userSchema.index({ username: 1, discordId: 1 });

module.exports = mongoose.model('User', userSchema); 