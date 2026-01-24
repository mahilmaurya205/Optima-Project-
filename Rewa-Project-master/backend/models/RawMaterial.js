// const mongoose = require("mongoose");

// const rawMaterialSchema = new mongoose.Schema({
//   itemName: { type: String, required: true },
//   itemCode: { type: String, required: true, unique: true },
//   remarks: { type: String },
//   isActive: { type: Boolean, default: true },
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("RawMaterial", rawMaterialSchema);




const mongoose = require("mongoose");

const rawMaterialSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  itemCode: { type: String, required: true, unique: true },
  subcategory: { type: String },
  unit: { type: String, enum: ["Kg", "Gm", "Nos"], default: "Kg" },
  supplier: { type: String },
  minStockLevel: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
  remarks: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("RawMaterial", rawMaterialSchema);