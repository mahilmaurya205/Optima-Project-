const mongoose = require("mongoose");

const capSchema = new mongoose.Schema({
  neckType: { 
    type: String, 
    required: true,
    enum: ["narrow neck", "wide neck"]
  },
  size: { 
    type: String, 
    required: true 
  }, // e.g., "28mm", "30mm"
  color: { 
    type: String, 
    required: true,
    enum: ["White", "Blue", "Red", "Green", "Yellow", "Black", "Transparent", "Other"]
  },
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

// Ensure unique combination of neckType, size, and color
capSchema.index({ neckType: 1, size: 1, color: 1 }, { unique: true });

// Update timestamp on save
capSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Cap", capSchema);