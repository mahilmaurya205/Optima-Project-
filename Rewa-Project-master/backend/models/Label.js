const mongoose = require("mongoose");

const labelSchema = new mongoose.Schema({
  bottleCategory: { 
    type: String, 
    required: true 
  }, // e.g., "200ml", "500ml", "1L"
  bottleName: { 
    type: String, 
    required: true 
  }, // e.g., "Reva", "Aqua"
  quantityAvailable: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  remarks: { type: String },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Ensure unique combination of bottleCategory and bottleName
labelSchema.index({ bottleCategory: 1, bottleName: 1 }, { unique: true });

// Update timestamp on save
labelSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Label", labelSchema);