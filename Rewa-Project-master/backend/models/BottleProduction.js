// // models/BottleProduction.js
// const mongoose = require("mongoose");

// const bottleProductionSchema = new mongoose.Schema({
//   preformType: { type: String, required: true },
//   boxesProduced: { type: Number, required: true, min: 0 },
//   bottlesPerBox: { type: Number, required: true, min: 0 },
//   bottleCategory: { type: String, required: true },
//   details: {
//     totalBottles: { type: Number, required: true },
//     shrinkRollUsed: { type: Number, default: 0 },
//     labelsUsed: { type: Number, default: 0 },
//     capsUsed: { type: Number, default: 0 },
//     preformUsed: { type: Number, default: 0 }, 
//     preformBatchUsage: [{
//       batchId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "PreformProduction"
//       },
//       quantityUsed: { type: Number },
//       productionDate: { type: Date }
//     }],
//     preformMaterial: { // NEW FIELD
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "RawMaterial"
//     }
//   },
//   remarks: { type: String },
//   productionDate: { type: Date, default: Date.now },
//   recordedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true,
//   },
// });

// module.exports = mongoose.model("BottleProduction", bottleProductionSchema);




const mongoose = require("mongoose");

const bottleProductionSchema = new mongoose.Schema({
  preformType: { type: String, required: true },
  boxesProduced: { type: Number, required: true, min: 0 },
  bottlesPerBox: { type: Number, required: true, min: 0 },
  bottleCategory: { type: String, required: true },
  labelUsed: {
    labelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Label",
      required: true
    },
    bottleName: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true }
  },
  capUsed: {
    capId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cap",
      required: true
    },
    neckType: { type: String, required: true },
    size: { type: String, required: true },
    color: { type: String, required: true },
    quantity: { type: Number, required: true }
  },
  details: {
    totalBottles: { type: Number, required: true },
    shrinkRollUsed: { type: Number, default: 0 },
    labelsUsed: { type: Number, default: 0 },
    capsUsed: { type: Number, default: 0 },
    preformUsed: { type: Number, default: 0 },
    preformBatchUsage: [{
      batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PreformProduction"
      },
      quantityUsed: { type: Number },
      productionDate: { type: Date }
    }]
  },
  remarks: { type: String },
  productionDate: { type: Date, default: Date.now },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("BottleProduction", bottleProductionSchema);