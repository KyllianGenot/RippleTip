const mongoose = require('mongoose');

const mappingSchema = new mongoose.Schema({
  // Informations d'identification
  identifier: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  identifierType: {
    type: String,
    enum: ['user', 'alias'],
    required: true,
    index: true
  },
  username: {
    type: String,
    default: '',
    index: true
  },
  
  // Informations blockchain
  address: {
    type: String,
    required: true,
    index: true
  },
  
  // Métadonnées
  createdBy: {
    type: String,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware pour mettre à jour la date de modification
mappingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Ajouter des index composites pour les requêtes fréquentes
mappingSchema.index({ identifierType: 1, identifier: 1 });
mappingSchema.index({ address: 1, identifierType: 1 });

module.exports = mongoose.model('Mapping', mappingSchema); 