const Order = require("../models/Order");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const cloudinary = require("../config/cloudinary");
const Challan = require("../models/Challan");
const generateChallanPDF = require("../utils/pdfgen");
const streamifier = require("streamifier");
const ExcelJS = require("exceljs");
const Payment = require("../models/Payment");
const {
  isAhmedabadOrGandhinagar,
  
} = require("./receptionController"); 
const Product = require("../models/Product");

const calculateDeliveryCharge = (boxes, deliveryChoice, pinCode) => {
  const isAhmedabadOrGandhinagar = (pinCode) => {
    // Add your pincode logic here
    const ahmedabadPincodes = ["380001", "380002", "380003"];
    const gandhinagarPincodes = ["382001", "382002", "382003"];
    return ahmedabadPincodes.includes(pinCode) || gandhinagarPincodes.includes(pinCode);
  };

  if (
    deliveryChoice === "companyPickup" ||
    !isAhmedabadOrGandhinagar(pinCode)
  ) {
    return 0;
  }
  return boxes >= 230 && boxes <= 299 ? boxes * 2 : boxes * 3;
};


const generateInvoiceNumber = async () => {
  const date = new Date();
  const currentYear = date.getFullYear();

  const latestChallan = await Challan.findOne().sort({ invoiceNo: -1 });

  let sequence = 122234192;
  if (latestChallan && latestChallan.invoiceNo) {
    sequence = parseInt(latestChallan.invoiceNo) + 1;
  }

  return sequence.toString();
};



// exports.generateChallanFromOrder = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const { 
//       splitInfo, 
//       extraItems, 
//       scheduledDates,
//       deliveryChoice,
//       shippingAddress,
//       vehicleNo,
//       driverName,
//       mobileNo,
//       receiverName 
//     } = req.body;

//     // Get the original order
//     const order = await Order.findById(orderId)
//       .populate("user", "customerDetails.userCode")
//       .populate("products.product");

//     if (!order) {
//       return res.status(404).json({ error: "Order not found" });
//     }

//     // Validate split information
//     if (splitInfo && splitInfo.numberOfChallans > 1) {
//       const totalSplitQuantity = splitInfo.quantities.reduce((sum, qty) => sum + qty, 0);
//       const originalQuantity = order.products.reduce((sum, product) => sum + product.boxes, 0);
      
//       if (totalSplitQuantity !== originalQuantity) {
//         return res.status(400).json({ 
//           error: "Split quantities must match total order quantity",
//           totalOrderQuantity: originalQuantity,
//           totalSplitQuantity: totalSplitQuantity
//         });
//       }
//     }

//     const generatedChallans = [];
//     const numberOfChallans = splitInfo?.numberOfChallans || 1;
//     const quantities = splitInfo?.quantities || [order.products.reduce((sum, product) => sum + product.boxes, 0)];

//     for (let i = 0; i < numberOfChallans; i++) {
//       const invoiceNo = await generateInvoiceNumber();
      
//       // Calculate items for this challan
//       const challanItems = [];
//       let remainingQuantity = quantities[i];
      
//       // Add original order items (proportional split)
//       for (const orderProduct of order.products) {
//         if (remainingQuantity <= 0) break;
        
//         const productQuantity = Math.min(orderProduct.boxes, remainingQuantity);
//         const rate = orderProduct.price || orderProduct.originalPrice;
        
//         challanItems.push({
//           description: orderProduct.product.name,
//           boxes: productQuantity,
//           rate: rate,
//           amount: productQuantity * rate,
//           isExtraItem: false
//         });
        
//         remainingQuantity -= productQuantity;
//       }

//       // Add extra items if any (now with product references)
//       if (extraItems && extraItems.length > 0) {
//         for (const extraItem of extraItems) {
//           // If extra item has productId, fetch product details
//           if (extraItem.productId) {
//             const product = await Product.findById(extraItem.productId);
//             if (!product) {
//               return res.status(400).json({ 
//                 error: `Product not found: ${extraItem.productId}` 
//               });
//             }

//             // Calculate current price
//             const now = new Date();
//             const isValidOffer = 
//               product.discountedPrice &&
//               product.validFrom &&
//               product.validTo &&
//               now >= product.validFrom &&
//               now <= product.validTo;

//             const currentPrice = isValidOffer ? product.discountedPrice : product.originalPrice;
//             const rate = extraItem.rate || currentPrice;

//             challanItems.push({
//               description: product.name,
//               boxes: extraItem.quantity,
//               rate: rate,
//               amount: extraItem.quantity * rate,
//               isExtraItem: true,
//               productId: extraItem.productId // Store reference to product
//             });
//           } else {
//             // Fallback for manually entered items (backward compatibility)
//             challanItems.push({
//               description: extraItem.productName,
//               boxes: extraItem.quantity,
//               rate: extraItem.rate,
//               amount: extraItem.quantity * extraItem.rate,
//               isExtraItem: true
//             });
//           }
//         }
//       }

//       // Calculate totals
//       const totalAmount = challanItems.reduce((sum, item) => sum + item.amount, 0);
      
//       let deliveryCharge = 0;
//       if (deliveryChoice && shippingAddress) {
//         const totalBoxes = challanItems.reduce((sum, item) => sum + item.boxes, 0);
//         deliveryCharge = calculateDeliveryCharge(
//           totalBoxes,
//           deliveryChoice,
//           shippingAddress.pinCode
//         );
//       }

//       const totalAmountWithDelivery = totalAmount + deliveryCharge;

//       const challan = new Challan({
//         userCode: order.user.customerDetails.userCode,
//         invoiceNo,
//         dcNo: invoiceNo,
//         date: new Date(),
//         scheduledDate: scheduledDates && scheduledDates[i] ? new Date(scheduledDates[i]) : new Date(),
//         originalOrder: orderId,
//         splitInfo: {
//           isSplit: numberOfChallans > 1,
//           splitIndex: i,
//           totalSplits: numberOfChallans,
//           originalQuantity: quantities[i]
//         },
//         vehicleNo,
//         driverName,
//         mobileNo,
//         items: challanItems,
//         totalAmount,
//         deliveryCharge,
//         totalAmountWithDelivery,
//         receiverName,
//         shippingAddress: shippingAddress || order.shippingAddress,
//         deliveryChoice: deliveryChoice || order.deliveryChoice,
//         status: "scheduled"
//       });

//       const savedChallan = await challan.save();
//       generatedChallans.push(savedChallan);
//     }

//     // Update order status if all items are processed
//     if (numberOfChallans === 1 && !splitInfo) {
//       order.orderStatus = "confirmed";
//       await order.save();
//     }

//     res.json({
//       message: "Challans generated successfully",
//       challans: generatedChallans,
//       count: generatedChallans.length
//     });

//   } catch (error) {
//     console.error("Challan generation error:", error);
//     res.status(500).json({
//       error: "Error generating challans",
//       details: error.message,
//     });
//   }
// };




exports.generateChallanFromOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { 
      splitInfo, 
      extraItems, 
      scheduledDates,
      deliveryChoice,
      shippingAddress,
      vehicleDetails, // Changed from individual fields to array of vehicle details
      receiverName 
    } = req.body;

    // Get the original order
    const order = await Order.findById(orderId)
      .populate("user", "customerDetails.userCode")
      .populate("products.product");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Validate split information
    if (splitInfo && splitInfo.numberOfChallans > 1) {
      const totalSplitQuantity = splitInfo.quantities.reduce((sum, qty) => sum + qty, 0);
      const originalQuantity = order.products.reduce((sum, product) => sum + product.boxes, 0);
      
      if (totalSplitQuantity !== originalQuantity) {
        return res.status(400).json({ 
          error: "Split quantities must match total order quantity",
          totalOrderQuantity: originalQuantity,
          totalSplitQuantity: totalSplitQuantity
        });
      }

      // Validate vehicle details match number of challans
      if (vehicleDetails && vehicleDetails.length !== splitInfo.numberOfChallans) {
        return res.status(400).json({ 
          error: "Vehicle details must be provided for each challan",
          expected: splitInfo.numberOfChallans,
          provided: vehicleDetails ? vehicleDetails.length : 0
        });
      }
    }

    const generatedChallans = [];
    const numberOfChallans = splitInfo?.numberOfChallans || 1;
    const quantities = splitInfo?.quantities || [order.products.reduce((sum, product) => sum + product.boxes, 0)];

    for (let i = 0; i < numberOfChallans; i++) {
      const invoiceNo = await generateInvoiceNumber();
      
      // Get vehicle details for this challan
      const vehicleInfo = vehicleDetails && vehicleDetails[i] ? vehicleDetails[i] : {};
      
      // Calculate items for this challan
      const challanItems = [];
      let remainingQuantity = quantities[i];
      
      // Add original order items (proportional split)
      for (const orderProduct of order.products) {
        if (remainingQuantity <= 0) break;
        
        const productQuantity = Math.min(orderProduct.boxes, remainingQuantity);
        const rate = orderProduct.price || orderProduct.originalPrice;
        
        challanItems.push({
          description: orderProduct.product.name,
          boxes: productQuantity,
          rate: rate,
          amount: productQuantity * rate,
          isExtraItem: false
        });
        
        remainingQuantity -= productQuantity;
      }

      // Add extra items if any
      if (extraItems && extraItems.length > 0) {
        for (const extraItem of extraItems) {
          if (extraItem.productId) {
            const product = await Product.findById(extraItem.productId);
            if (!product) {
              return res.status(400).json({ 
                error: `Product not found: ${extraItem.productId}` 
              });
            }

            const now = new Date();
            const isValidOffer = 
              product.discountedPrice &&
              product.validFrom &&
              product.validTo &&
              now >= product.validFrom &&
              now <= product.validTo;

            const currentPrice = isValidOffer ? product.discountedPrice : product.originalPrice;
            const rate = extraItem.rate || currentPrice;

            challanItems.push({
              description: product.name,
              boxes: extraItem.quantity,
              rate: rate,
              amount: extraItem.quantity * rate,
              isExtraItem: true,
              productId: extraItem.productId
            });
          } else {
            challanItems.push({
              description: extraItem.productName,
              boxes: extraItem.quantity,
              rate: extraItem.rate,
              amount: extraItem.quantity * extraItem.rate,
              isExtraItem: true
            });
          }
        }
      }

      // Calculate totals
      const totalAmount = challanItems.reduce((sum, item) => sum + item.amount, 0);
      
      let deliveryCharge = 0;
      if (deliveryChoice && shippingAddress) {
        const totalBoxes = challanItems.reduce((sum, item) => sum + item.boxes, 0);
        deliveryCharge = calculateDeliveryCharge(
          totalBoxes,
          deliveryChoice,
          shippingAddress.pinCode
        );
      }

      const totalAmountWithDelivery = totalAmount + deliveryCharge;

      const challan = new Challan({
        userCode: order.user.customerDetails.userCode,
        invoiceNo,
        dcNo: invoiceNo,
        date: new Date(),
        scheduledDate: scheduledDates && scheduledDates[i] ? new Date(scheduledDates[i]) : new Date(),
        originalOrder: orderId,
        splitInfo: {
          isSplit: numberOfChallans > 1,
          splitIndex: i,
          totalSplits: numberOfChallans,
          originalQuantity: quantities[i]
        },
        vehicleNo: vehicleInfo.vehicleNo,
        driverName: vehicleInfo.driverName,
        mobileNo: vehicleInfo.mobileNo,
        items: challanItems,
        totalAmount,
        deliveryCharge,
        totalAmountWithDelivery,
        receiverName,
        shippingAddress: shippingAddress || order.shippingAddress,
        deliveryChoice: deliveryChoice || order.deliveryChoice,
        status: "scheduled"
      });

      const savedChallan = await challan.save();
      generatedChallans.push(savedChallan);
    }

    // Update order status if all items are processed
    if (numberOfChallans === 1 && !splitInfo) {
      order.orderStatus = "confirmed";
      await order.save();
    }

    res.json({
      message: "Challans generated successfully",
      challans: generatedChallans,
      count: generatedChallans.length
    });

  } catch (error) {
    console.error("Challan generation error:", error);
    res.status(500).json({
      error: "Error generating challans",
      details: error.message,
    });
  }
};



exports.getProductsForSelection = async (req, res) => {
  try {
    const { type, search } = req.query;
    
    let filter = { isActive: true };
    
    if (type) {
      filter.type = type;
    }
    
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const products = await Product.find(filter)
      .select('name type category originalPrice discountedPrice boxes bottlesPerBox')
      .sort({ name: 1 });

    const formattedProducts = products.map(product => {
      const productObj = product.toObject();
      
      // Calculate current price (considering discounts)
      const now = new Date();
      const isValidOffer = 
        productObj.discountedPrice &&
        productObj.validFrom &&
        productObj.validTo &&
        now >= productObj.validFrom &&
        now <= productObj.validTo;

      const currentPrice = isValidOffer ? productObj.discountedPrice : productObj.originalPrice;

      return {
        _id: productObj._id,
        name: productObj.name,
        type: productObj.type,
        category: productObj.category,
        price: currentPrice,
        boxes: productObj.boxes,
        bottlesPerBox: productObj.bottlesPerBox,
        hasDiscount: isValidOffer,
        originalPrice: productObj.originalPrice,
        discountedPrice: isValidOffer ? productObj.discountedPrice : null
      };
    });

    res.json({
      success: true,
      products: formattedProducts
    });

  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      error: "Error fetching products",
      details: error.message,
    });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const productObj = product.toObject();
    
    // Calculate current price
    const now = new Date();
    const isValidOffer = 
      productObj.discountedPrice &&
      productObj.validFrom &&
      productObj.validTo &&
      now >= productObj.validFrom &&
      now <= productObj.validTo;

    const currentPrice = isValidOffer ? productObj.discountedPrice : productObj.originalPrice;

    const response = {
      _id: productObj._id,
      name: productObj.name,
      type: productObj.type,
      category: productObj.category,
      price: currentPrice,
      boxes: productObj.boxes,
      bottlesPerBox: productObj.bottlesPerBox,
      hasDiscount: isValidOffer,
      originalPrice: productObj.originalPrice,
      discountedPrice: isValidOffer ? productObj.discountedPrice : null
    };

    res.json({
      success: true,
      product: response
    });

  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      error: "Error fetching product",
      details: error.message,
    });
  }
};

// Function to reschedule challan date
exports.rescheduleChallan = async (req, res) => {
  try {
    const { challanId } = req.params;
    const { newDate, reason } = req.body;

    if (!newDate) {
      return res.status(400).json({ error: "New date is required" });
    }

    const challan = await Challan.findById(challanId);
    if (!challan) {
      return res.status(404).json({ error: "Challan not found" });
    }

    if (challan.status === "dispatched") {
      return res.status(400).json({ error: "Cannot reschedule dispatched challan" });
    }

    const oldDate = challan.scheduledDate;
    challan.scheduledDate = new Date(newDate);
    
    // Add to reschedule history
    challan.rescheduleHistory.push({
      oldDate: oldDate,
      newDate: new Date(newDate),
      reason: reason || "No reason provided",
      rescheduledBy: req.user._id
    });

    await challan.save();

    res.json({
      message: "Challan rescheduled successfully",
      challan: {
        _id: challan._id,
        dcNo: challan.dcNo,
        oldDate: oldDate,
        newDate: challan.scheduledDate,
        reason: reason
      }
    });

  } catch (error) {
    console.error("Reschedule error:", error);
    res.status(500).json({
      error: "Error rescheduling challan",
      details: error.message,
    });
  }
};

// Function to get challans by order (for split view)
exports.getChallansByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const challans = await Challan.find({ originalOrder: orderId })
      .sort({ "splitInfo.splitIndex": 1 });

    res.json({
      count: challans.length,
      challans: challans
    });
  } catch (error) {
    console.error("Error fetching order challans:", error);
    res.status(500).json({
      error: "Error fetching order challans",
      details: error.message,
    });
  }
};


exports.getCurrentOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      orderStatus: { $in: ["pending", "processing"] }, // Corrected 'status' to 'orderStatus'
    })
      .populate(
        "user",
        "name customerDetails.firmName customerDetails.userCode"
      )
      .populate("products.product", "name type")
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map((order) => ({
      ...order.toObject(),
      totalAmount: Number(order.totalAmount),
      deliveryCharge: Number(order.deliveryCharge || 0),
      totalAmountWithDelivery: Number(order.totalAmountWithDelivery),
      orderId: order.orderId, // Virtual field from Order model
    }));

    res.json({ orders: formattedOrders });
  } catch (error) {
    console.error("Error fetching current orders:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};


exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ["confirmed", "shipped", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status for dispatch" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(400).json({ error: "Order not found" });
    }

    order._updatedBy = req.user._id;
    order.orderStatus = status;
    await order.save();

    if (status === "shipped" && order.paymentMethod === "COD") {
      order.paymentStatus = "pending";
    }

    await order.save();

    res.json({ message: "Order status updated successfully", order });
  } catch (error) {
    res.status(500).json({ error: "Error updating order status" });
  }
};

exports.getProcessingOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      orderStatus: { $in: ["processing", "confirmed"] },
    })
      .populate(
        "user",
        "name phoneNumber email customerDetails.firmName customerDetails.userCode"
      )
      .populate("products.product")
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map((order) => ({
      ...order.toObject(),
      totalAmount: Number(order.totalAmount),
      deliveryCharge: Number(order.deliveryCharge || 0),
      totalAmountWithDelivery: Number(order.totalAmountWithDelivery),
    }));

    res.json({ orders: formattedOrders });
  } catch (error) {
    res.status(500).json({ error: "Error fetching processing orders" });
  }
};




exports.downloadChallan = async (req, res) => {
  try {
    const { challanId } = req.params;

    const challan = await Challan.findById(challanId);
    if (!challan) {
      return res.status(404).json({ error: "Challan not found" });
    }

    const pdfBuffer = await generateChallanPDF(challan);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=challan-${challan.dcNo}.pdf`
    );

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error downloading challan:", error);
    res.status(500).json({
      error: "Error downloading challan",
      details: error.message,
    });
  }
};

// exports.generateChallan = async (req, res) => {
//   try {
//     const {
//       userCode,
//       vehicleNo,
//       driverName,
//       mobileNo,
//       items,
//       receiverName,
//       deliveryChoice,
//       shippingAddress,
//       deliveryCharge: manualDeliveryCharge,
//     } = req.body;

//     if (!userCode) {
//       return res.status(400).json({ error: "User code is required" });
//     }

//     if (!Array.isArray(items) || items.length === 0) {
//       return res.status(400).json({ error: "Invalid or empty items list" });
//     }

//     if (
//       shippingAddress &&
//       (!shippingAddress.address ||
//         !shippingAddress.city ||
//         !shippingAddress.state ||
//         !shippingAddress.pinCode)
//     ) {
//       return res
//         .status(400)
//         .json({ error: "Complete shipping address with pin code is required" });
//     }

//     if (shippingAddress && !/^\d{6}$/.test(shippingAddress.pinCode)) {
//       return res.status(400).json({ error: "Pin code must be 6 digits" });
//     }

//     if (
//       deliveryChoice &&
//       !["homeDelivery", "companyPickup"].includes(deliveryChoice)
//     ) {
//       return res.status(400).json({ error: "Invalid delivery choice" });
//     }

//     const invoiceNo = await generateInvoiceNumber();

//     let totalAmount = 0;
//     const formattedItems = items.map((item) => {
//       const boxes = Number(item.boxes) || 0;
//       const rate = Number(item.rate) || 0;
//       if (boxes < 230) {
//         throw new Error(
//           `Minimum 230 boxes required for item: ${
//             item.productName || item.description
//           }`
//         );
//       }
//       const amount = boxes * rate;
//       totalAmount += amount;
//       return {
//         description: item.productName || item.description || "Unnamed Item",
//         boxes: boxes,
//         rate: rate,
//         amount: amount,
//       };
//     });

//     let deliveryCharge = 0;
//     if (manualDeliveryCharge !== undefined) {
//       deliveryCharge = Number(manualDeliveryCharge);
//       if (isNaN(deliveryCharge) || deliveryCharge < 0) {
//         return res.status(400).json({ error: "Invalid delivery charge" });
//       }
//     } else if (deliveryChoice && shippingAddress) {
//       const totalBoxes = formattedItems.reduce(
//         (sum, item) => sum + item.boxes,
//         0
//       );
//       deliveryCharge = calculateDeliveryCharge(
//         totalBoxes,
//         deliveryChoice,
//         shippingAddress.pinCode
//       );
//     }

//     const totalAmountWithDelivery = totalAmount + deliveryCharge;

//     const challan = new Challan({
//       userCode,
//       invoiceNo,
//       date: new Date(),
//       vehicleNo,
//       driverName,
//       mobileNo,
//       items: formattedItems,
//       totalAmount,
//       deliveryCharge,
//       totalAmountWithDelivery,
//       receiverName,
//       dcNo: invoiceNo,
//       shippingAddress: shippingAddress || undefined,
//       deliveryChoice: deliveryChoice || undefined,
//     });

//     const savedChallan = await challan.save();

//     res.json({
//       message: "Challan generated successfully",
//       challan: savedChallan,
//       downloadUrl: `/api/dispatch/challan/${savedChallan._id}/download`,
//     });
//   } catch (error) {
//     console.error("Challan generation error:", error);
//     if (error.code === 11000) {
//       return res.status(400).json({
//         error: "Duplicate challan generated",
//         details: "A challan with this number already exists",
//       });
//     }
//     res.status(500).json({
//       error: "Error generating challan",
//       details: error.message,
//     });
//   }
// };


exports.generateStandaloneChallan = async (req, res) => {
  try {
    const {
      userCode,
      vehicleNo,
      driverName,
      mobileNo,
      items,
      receiverName,
      deliveryChoice,
      shippingAddress,
      deliveryCharge: manualDeliveryCharge,
      scheduledDate
    } = req.body;

    if (!userCode) {
      return res.status(400).json({ error: "User code is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid or empty items list" });
    }

    if (!scheduledDate) {
      return res.status(400).json({ error: "Scheduled date is required" });
    }

    if (
      shippingAddress &&
      (!shippingAddress.address ||
        !shippingAddress.city ||
        !shippingAddress.state ||
        !shippingAddress.pinCode)
    ) {
      return res
        .status(400)
        .json({ error: "Complete shipping address with pin code is required" });
    }

    if (shippingAddress && !/^\d{6}$/.test(shippingAddress.pinCode)) {
      return res.status(400).json({ error: "Pin code must be 6 digits" });
    }

    if (
      deliveryChoice &&
      !["homeDelivery", "companyPickup"].includes(deliveryChoice)
    ) {
      return res.status(400).json({ error: "Invalid delivery choice" });
    }

    const invoiceNo = await generateInvoiceNumber();

    let totalAmount = 0;
    const formattedItems = items.map((item) => {
      const boxes = Number(item.boxes) || 0;
      const rate = Number(item.rate) || 0;
      if (boxes < 230) {
        throw new Error(
          `Minimum 230 boxes required for item: ${
            item.productName || item.description
          }`
        );
      }
      const amount = boxes * rate;
      totalAmount += amount;
      return {
        description: item.productName || item.description || "Unnamed Item",
        boxes: boxes,
        rate: rate,
        amount: amount,
        isExtraItem: item.isExtraItem || false
      };
    });

    let deliveryCharge = 0;
    if (manualDeliveryCharge !== undefined) {
      deliveryCharge = Number(manualDeliveryCharge);
      if (isNaN(deliveryCharge) || deliveryCharge < 0) {
        return res.status(400).json({ error: "Invalid delivery charge" });
      }
    } else if (deliveryChoice && shippingAddress) {
      const totalBoxes = formattedItems.reduce(
        (sum, item) => sum + item.boxes,
        0
      );
      deliveryCharge = calculateDeliveryCharge(
        totalBoxes,
        deliveryChoice,
        shippingAddress.pinCode
      );
    }

    const totalAmountWithDelivery = totalAmount + deliveryCharge;

    const challan = new Challan({
      userCode,
      invoiceNo,
      date: new Date(),
      scheduledDate: new Date(scheduledDate),
      vehicleNo,
      driverName,
      mobileNo,
      items: formattedItems,
      totalAmount,
      deliveryCharge,
      totalAmountWithDelivery,
      receiverName,
      dcNo: invoiceNo,
      shippingAddress: shippingAddress || undefined,
      deliveryChoice: deliveryChoice || undefined,
      status: "scheduled"
    });

    const savedChallan = await challan.save();

    res.json({
      message: "Challan generated successfully",
      challan: savedChallan,
      downloadUrl: `/api/dispatch/challan/${savedChallan._id}/download`,
    });
  } catch (error) {
    console.error("Challan generation error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        error: "Duplicate challan generated",
        details: "A challan with this number already exists",
      });
    }
    res.status(500).json({
      error: "Error generating challan",
      details: error.message,
    });
  }
};


exports.getChallansByUserCode = async (req, res) => {
  try {
    const { userCode } = req.params;

    if (!userCode) {
      return res.status(400).json({ error: "User code is required" });
    }

    const challans = await Challan.find({ userCode }).sort({ createdAt: -1 });

    if (!challans || challans.length === 0) {
      return res
        .status(404)
        .json({ error: "No challans found for this user code" });
    }

    res.json({
      count: challans.length,
      challans,
    });
  } catch (error) {
    console.error("Error fetching challans:", error);
    res.status(500).json({
      error: "Error fetching challans",
      details: error.message,
    });
  }
};




exports.getOrderHistory = async (req, res) => {
  try {
    const thirtyFiveDaysAgo = new Date();
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);

    const orders = await Order.find({
      createdAt: { $gte: thirtyFiveDaysAgo },
    })
      .select(
        "orderId firmName gstNumber shippingAddress paymentStatus paymentMethod orderStatus createdAt type totalAmount products isMiscellaneous"
      )
      .populate(
        "user",
        "name phoneNumber email role customerDetails.firmName customerDetails.userCode"
      )
      .populate("products.product", "name type quantity")
      .populate("createdByReception", "name")
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map((order) => {
      if (!order.user) {
        console.warn(`Order ${order.orderId} has no associated user. Order ID: ${order._id}`);
        return {
          ...order.toObject(),
          totalAmount: Number(order.totalAmount),
          deliveryCharge: Number(order.deliveryCharge || 0),
          totalAmountWithDelivery: Number(order.totalAmountWithDelivery || order.totalAmount + (order.deliveryCharge || 0)),
          orderId: order.orderId,
          orderSource: `Unknown user (Order ID: ${order.orderId})`,
        };
      }

      return {
        ...order.toObject(),
        totalAmount: Number(order.totalAmount),
        deliveryCharge: Number(order.deliveryCharge || 0),
        totalAmountWithDelivery: Number(order.totalAmountWithDelivery || order.totalAmount + (order.deliveryCharge || 0)),
        orderId: order.orderId,
        orderSource: order.createdByReception
          ? order.user.role === "miscellaneous"
            ? `Created by ${order.createdByReception.name} for ${order.user.name} (Miscellaneous)`
            : `Created by ${order.createdByReception.name} for ${
                order.user.customerDetails?.firmName || order.user.name
              }`
          : `Direct order by ${
              order.user.customerDetails?.firmName || order.user.name
            }`,
      };
    });

    res.json({ orders: formattedOrders });
  } catch (error) {
    console.error("Error fetching order history:", error);
    res.status(500).json({ error: "Error fetching order history", details: error.message });
  }
};



exports.checkIn = async (req, res) => {
  try {
    const { selectedDate } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Please upload a check-in image" });
    }

    if (!selectedDate) {
      return res
        .status(400)
        .json({ error: "Please select a date for check-in" });
    }

    const checkInDate = new Date(selectedDate);
    checkInDate.setHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.findOne({
      user: req.user._id,
      panel: "dispatch",
      selectedDate: checkInDate,
      $or: [{ status: "checked-in" }, { status: "present" }],
    });

    if (existingAttendance) {
      return res
        .status(400)
        .json({ error: "Already checked in for this date" });
    }

    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "check-in-photos",
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
    });

    const cloudinaryResponse = await uploadPromise;

    const attendance = new Attendance({
      user: req.user._id,
      panel: "dispatch",
      checkInTime: new Date(),
      selectedDate: checkInDate,
      status: "present",
      checkInImage: cloudinaryResponse.secure_url,
    });

    await attendance.save();

    res.json({ message: "Check-in successful", attendance });
  } catch (error) {
    console.error("Check-in error:", error);
    res
      .status(500)
      .json({ error: "Error during check-in", details: error.message });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const { selectedDate } = req.body;

    if (!selectedDate) {
      return res.status(400).json({
        error: "Please select a date for check-out",
      });
    }

    const checkOutDate = new Date(selectedDate);
    checkOutDate.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      user: req.user._id,
      panel: "dispatch",
      selectedDate: checkOutDate,
      status: "present",
    });

    if (!attendance) {
      return res.status(400).json({
        error: "No active check-in found for selected date",
      });
    }

    attendance.checkOutTime = new Date();
    attendance.status = "checked-out";
    await attendance.save();

    res.json({
      message: "Check-out successful",
      attendance,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error during check-out",
      details: error.message,
    });
  }
};

exports.getDailyDispatchOrders = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dispatchOrders = await Order.find({
      createdAt: { $gte: today },
      orderStatus: { $in: ["processing", "shipped"] },
    }).populate("user", "name customerDetails.firmName");

    res.json({
      dailyDispatchOrders: dispatchOrders,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error fetching daily dispatch orders",
      details: error.message,
    });
  }
};

exports.updateCODPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus, notes } = req.body;

    const validCODStatuses = [
      "pending",
      "payment_received_by_driver",
      "cash_paid_offline",
    ];

    if (!validCODStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        error: "Invalid payment status for COD order",
      });
    }

    const order = await Order.findById(orderId).populate(
      "user",
      "name customerDetails.userCode"
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.paymentMethod !== "COD") {
      return res.status(400).json({
        error: "This action is only allowed for COD orders",
      });
    }

    if (req.user.role !== "dispatch") {
      return res.status(403).json({
        error: "Only dispatch personnel can update COD payment status",
      });
    }

    if (["completed", "failed"].includes(order.paymentStatus)) {
      return res.status(400).json({
        error: "Cannot modify payment status after completion or failure",
      });
    }

    order._updatedBy = req.user._id;
    order.paymentStatus = paymentStatus;

    order.paymentStatusHistory.push({
      status: paymentStatus,
      updatedBy: req.user._id,
      notes: notes || `Updated by ${req.user.name}`,
    });

    await order.save();

    res.json({
      message: "COD payment status updated successfully",
      order: {
        orderId: order._id,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        updatedBy: req.user.name,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error updating COD payment status:", error);
    res.status(500).json({
      error: "Error updating COD payment status",
      details: error.message,
    });
  }
};

exports.getPendingPayments = async (req, res) => {
  try {
    const pendingPayments = await Payment.find({ status: "pending" })
      .populate(
        "user",
        "name phoneNumber email customerDetails.firmName customerDetails.userCode"
      )
      .populate({
        path: "orderDetails",
        populate: {
          path: "products.product",
          select: "name type",
        },
      })
      .sort({ createdAt: -1 });

    const formattedPayments = pendingPayments.map((payment) => {
      if (!payment.orderDetails) {
        console.warn(`Payment ${payment._id} has no valid orderDetails`);
        return {
          paymentId: payment._id,
          orderId: "N/A",
          user: {
            name: payment.user?.name || "N/A",
            firmName: payment.user?.customerDetails?.firmName || "N/A",
            userCode: payment.user?.customerDetails?.userCode || "N/A",
            phoneNumber: payment.user?.phoneNumber || "N/A",
            email: payment.user?.email || "N/A",
          },
          products: [],
          totalAmount: Number(payment.amount) || 0,
          paidAmount: Number(payment.paidAmount) || 0,
          remainingAmount: Number(payment.remainingAmount) || 0,
          paymentHistory: payment.paymentHistory.map((entry) => ({
            ...entry.toObject(),
            submittedAmount: Number(entry.submittedAmount),
            verifiedAmount: Number(entry.verifiedAmount),
          })),
          deliveryCharge: 0,
          totalAmountWithDelivery: Number(payment.amount) || 0,
          paymentMethod: "N/A",
          paymentStatus: payment.status,
          orderStatus: "N/A",
          shippingAddress: {},
          firmName: payment.user?.customerDetails?.firmName || "N/A",
          gstNumber: "N/A",
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        };
      }

      return {
        paymentId: payment._id,
        orderId: payment.orderDetails._id,
        user: {
          name: payment.user?.name || "N/A",
          firmName: payment.user?.customerDetails?.firmName || "N/A",
          userCode: payment.user?.customerDetails?.userCode || "N/A",
          phoneNumber: payment.user?.phoneNumber || "N/A",
          email: payment.user?.email || "N/A",
        },
        products: payment.orderDetails.products.map((p) => ({
          productName: p.product?.name || "N/A",
          productType: p.product?.type || "N/A",
          boxes: Number(p.boxes) || 0,
          price: Number(p.price) || 0,
        })),
        totalAmount: Number(payment.amount) || 0,
        paidAmount: Number(payment.paidAmount) || 0,
        remainingAmount: Number(payment.remainingAmount) || 0,
        paymentHistory: payment.paymentHistory.map((entry) => ({
          ...entry.toObject(),
          submittedAmount: Number(entry.submittedAmount),
          verifiedAmount: Number(entry.verifiedAmount),
        })),
        deliveryCharge: Number(payment.orderDetails.deliveryCharge || 0),
        totalAmountWithDelivery:
          Number(payment.orderDetails.totalAmountWithDelivery) || 0,
        paymentMethod: payment.orderDetails.paymentMethod,
        paymentStatus: payment.orderDetails.paymentStatus,
        orderStatus: payment.orderDetails.orderStatus,
        shippingAddress: payment.orderDetails.shippingAddress,
        firmName: payment.orderDetails.firmName,
        gstNumber: payment.orderDetails.gstNumber || "N/A",
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      };
    });

    res.json({
      count: formattedPayments.length,
      pendingPayments: formattedPayments,
    });
  } catch (error) {
    console.error("Error fetching pending payments:", error);
    res.status(500).json({
      error: "Error fetching pending payments",
      details: error.message,
    });
  }
};

exports.downloadPendingPaymentsExcel = async (req, res) => {
  try {
    const pendingPayments = await Payment.find({ status: "pending" })
      .populate(
        "user",
        "name phoneNumber email customerDetails.firmName customerDetails.userCode"
      )
      .populate({
        path: "orderDetails",
        populate: {
          path: "products.product",
          select: "name type",
        },
      })
      .sort({ createdAt: -1 });

    const formattedPayments = pendingPayments.map((payment) => {
      if (!payment.orderDetails) {
        console.warn(`Payment ${payment._id} has no valid orderDetails`);
        return {
          paymentId: payment._id,
          orderId: "N/A",
          user: {
            name: payment.user?.name || "N/A",
            firmName: payment.user?.customerDetails?.firmName || "N/A",
            userCode: payment.user?.customerDetails?.userCode || "N/A",
            phoneNumber: payment.user?.phoneNumber || "N/A",
            email: payment.user?.email || "N/A",
          },
          products: [],
          totalAmount: Number(payment.amount) || 0,
          paidAmount: Number(payment.paidAmount) || 0,
          remainingAmount: Number(payment.remainingAmount) || 0,
          paymentHistory: payment.paymentHistory.map((entry) => ({
            ...entry.toObject(),
            submittedAmount: Number(entry.submittedAmount),
            verifiedAmount: Number(entry.verifiedAmount),
          })),
          deliveryCharge: 0,
          totalAmountWithDelivery: Number(payment.amount) || 0,
          paymentMethod: "N/A",
          paymentStatus: payment.status,
          orderStatus: "N/A",
          shippingAddress: {},
          firmName: payment.user?.customerDetails?.firmName || "N/A",
          gstNumber: "N/A",
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        };
      }

      return {
        paymentId: payment._id,
        orderId: payment.orderDetails._id,
        user: {
          name: payment.user?.name || "N/A",
          firmName: payment.user?.customerDetails?.firmName || "N/A",
          userCode: payment.user?.customerDetails?.userCode || "N/A",
          phoneNumber: payment.user?.phoneNumber || "N/A",
          email: payment.user?.email || "N/A",
        },
        products: payment.orderDetails.products.map((p) => ({
          productName: p.product?.name || "N/A",
          productType: p.product?.type || "N/A",
          boxes: Number(p.boxes) || 0,
          price: Number(p.price) || 0,
        })),
        totalAmount: Number(payment.amount) || 0,
        paidAmount: Number(payment.paidAmount) || 0,
        remainingAmount: Number(payment.remainingAmount) || 0,
        paymentHistory: payment.paymentHistory.map((entry) => ({
          ...entry.toObject(),
          submittedAmount: Number(entry.submittedAmount),
          verifiedAmount: Number(entry.verifiedAmount),
        })),
        deliveryCharge: Number(payment.orderDetails.deliveryCharge || 0),
        totalAmountWithDelivery:
          Number(payment.orderDetails.totalAmountWithDelivery) || 0,
        paymentMethod: payment.orderDetails.paymentMethod,
        paymentStatus: payment.orderDetails.paymentStatus,
        orderStatus: payment.orderDetails.orderStatus,
        shippingAddress: payment.orderDetails.shippingAddress,
        firmName: payment.orderDetails.firmName,
        gstNumber: payment.orderDetails.gstNumber || "N/A",
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      };
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Pending Payments");

    worksheet.columns = [
      { header: "Payment ID", key: "paymentId", width: 15 },
      { header: "Order ID", key: "orderId", width: 15 },
      { header: "Customer Name", key: "customerName", width: 20 },
      { header: "Firm Name", key: "firmName", width: 20 },
      { header: "User Code", key: "userCode", width: 15 },
      { header: "Phone Number", key: "phoneNumber", width: 15 },
      { header: "Email", key: "email", width: 25 },
      { header: "Products", key: "products", width: 30 },
      { header: "Total Amount", key: "totalAmount", width: 15 },
      { header: "Paid Amount", key: "paidAmount", width: 15 },
      { header: "Remaining Amount", key: "remainingAmount", width: 15 },
      { header: "Payment History", key: "paymentHistory", width: 50 },
      { header: "Delivery Charge", key: "deliveryCharge", width: 15 },
      {
        header: "Total with Delivery",
        key: "totalAmountWithDelivery",
        width: 20,
      },
      { header: "Payment Method", key: "paymentMethod", width: 15 },
      { header: "Payment Status", key: "paymentStatus", width: 15 },
      { header: "Order Status", key: "orderStatus", width: 15 },
      { header: "Shipping Address", key: "shippingAddress", width: 30 },
      { header: "GST Number", key: "gstNumber", width: 15 },
      { header: "Created At", key: "createdAt", width: 20 },
      { header: "Updated At", key: "updatedAt", width: 20 },
    ];

    formattedPayments.forEach((payment) => {
      worksheet.addRow({
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        customerName: payment.user.name,
        firmName: payment.user.firmName,
        userCode: payment.user.userCode,
        phoneNumber: payment.user.phoneNumber,
        email: payment.user.email,
        products: payment.products
          .map((p) => `${p.productName} (${p.boxes})`)
          .join(", "),
        totalAmount: payment.totalAmount,
        paidAmount: payment.paidAmount,
        remainingAmount: payment.remainingAmount,
        paymentHistory: JSON.stringify(
          payment.paymentHistory.map((entry) => ({
            referenceId: entry.referenceId,
            submittedAmount: entry.submittedAmount,
            status: entry.status,
            verifiedAmount: entry.verifiedAmount,
            submissionDate: entry.submissionDate,
            verificationDate: entry.verificationDate,
          }))
        ),
        deliveryCharge: payment.deliveryCharge,
        totalAmountWithDelivery: payment.totalAmountWithDelivery,
        paymentMethod: payment.paymentMethod,
        paymentStatus: payment.paymentStatus,
        orderStatus: payment.orderStatus,
        shippingAddress: JSON.stringify(payment.shippingAddress),
        gstNumber: payment.gstNumber,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "D3D3D3" },
    };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=pending_payments.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating Excel file:", error);
    res.status(500).json({
      error: "Error generating Excel file",
      details: error.message,
    });
  }
};
