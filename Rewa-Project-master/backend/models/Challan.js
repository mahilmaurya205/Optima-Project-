// const mongoose = require("mongoose");

// const challanSchema = new mongoose.Schema({
//   userCode: {
//     type: String,
//     required: true,
//   },
//   invoiceNo: {
//     type: String,
//     required: true,
//     unique: true,
//   },
//   dcNo: {
//     type: String,
//     required: true,
//     unique: true,
//   },
//   date: {
//     type: Date,
//     default: Date.now,
//   },
//   vehicleNo: String,
//   driverName: String,
//   mobileNo: String,
//   items: [
//     {
//       description: String,
//       boxes: {
//         type: Number,
//         required: true,
//         min: 230,
//       },
//       rate: {
//         type: Number,
//         required: true,
//         min: 0,
//       },
//       amount: {
//         type: Number,
//         required: true,
//         min: 0,
//       },
//     },
//   ],
//   totalAmount: {
//     type: Number,
//     required: true,
//     min: 0,
//   },
//   deliveryCharge: {
//     type: Number,
//     default: 0,
//     min: 0,
//   },
//   totalAmountWithDelivery: {
//     type: Number,
//     required: true,
//     min: 0,
//   },
//   receiverName: String,
//   shippingAddress: {
//     address: String,
//     city: String,
//     state: String,
//     pinCode: String,
//   },
//   deliveryChoice: {
//     type: String,
//     enum: ["homeDelivery", "companyPickup"],
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// module.exports = mongoose.model("Challan", challanSchema);





const mongoose = require("mongoose");

const challanSchema = new mongoose.Schema({
  userCode: {
    type: String,
    required: true,
  },
  invoiceNo: {
    type: String,
    required: true,
    unique: true,
  },
  dcNo: {
    type: String,
    required: true,
    unique: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  scheduledDate: {
    type: Date,
    required: true,
  },
  originalOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  splitInfo: {
    isSplit: {
      type: Boolean,
      default: false
    },
    splitIndex: {
      type: Number,
      default: 0
    },
    totalSplits: {
      type: Number,
      default: 1
    },
    originalQuantity: {
      type: Number,
      default: 0
    }
  },
  vehicleNo: String,
  driverName: String,
  mobileNo: String,
  items: [
    {
      description: String,
      boxes: {
        type: Number,
        required: true,
        min: 1,
      },
      rate: {
        type: Number,
        required: true,
        min: 0,
      },
      amount: {
        type: Number,
        required: true,
        min: 0,
      },
      isExtraItem: {
        type: Boolean,
        default: false
      },
      productId: {  // Add this field
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    }
    },
    
  ],
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  deliveryCharge: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalAmountWithDelivery: {
    type: Number,
    required: true,
    min: 0,
  },
  receiverName: String,
  shippingAddress: {
    address: String,
    city: String,
    state: String,
    pinCode: String,
  },
  deliveryChoice: {
    type: String,
    enum: ["homeDelivery", "companyPickup"],
  },
  status: {
    type: String,
    enum: ["pending", "scheduled", "dispatched"],
    default: "pending"
  },
  rescheduleHistory: [{
    oldDate: Date,
    newDate: Date,
    reason: String,
    rescheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    rescheduledAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

challanSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Challan", challanSchema);
