const Payment = require("../models/Payment");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const UserActivity = require("../models/UserActivity");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

const isAhmedabadOrGandhinagar = (pinCode) => {
  const pin = Number(pinCode);
  return (pin >= 380001 && pin <= 382481) || (pin >= 382010 && pin <= 382855);
};

const calculateDeliveryCharge = (boxes, deliveryChoice, pinCode) => {
  if (
    deliveryChoice === "companyPickup" ||
    !isAhmedabadOrGandhinagar(pinCode)
  ) {
    return 0;
  }
  return boxes >= 230 && boxes <= 299 ? boxes * 2 : boxes * 3;
};

const paymentController = {
  createOrder: async (req, res) => {
    try {
      const userId = req.user._id;
      const { paymentMethod, shippingAddress, deliveryChoice } = req.body;

      if (req.isReceptionAccess) {
        console.log(
          `Order created by reception ${req.receptionUser._id} for user ${userId}`
        );
      }

      const validPaymentMethods = ["UPI", "netBanking", "COD"];
      if (!validPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({
          error: "Invalid payment method",
          validMethods: validPaymentMethods,
        });
      }

      if (
        !shippingAddress ||
        !shippingAddress.address ||
        !shippingAddress.city ||
        !shippingAddress.state ||
        !shippingAddress.pinCode
      ) {
        return res.status(400).json({
          error: "Complete shipping address with pin code is required",
        });
      }

      if (!/^\d{6}$/.test(shippingAddress.pinCode)) {
        return res.status(400).json({
          error: "Pin code must be 6 digits",
        });
      }

      if (!["homeDelivery", "companyPickup"].includes(deliveryChoice)) {
        return res.status(400).json({
          error: "Invalid delivery choice",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      if (!user.isActive) {
        const userActivity = await UserActivity.findOne({ user: userId });
        if (userActivity) {
          const lastPeriod =
            userActivity.activityPeriods[
              userActivity.activityPeriods.length - 1
            ];
          if (lastPeriod && lastPeriod.status === "inactive") {
            const inactiveDays = Math.ceil(
              (new Date() - lastPeriod.startDate) / (1000 * 60 * 60 * 24)
            );
            if (inactiveDays >= 30) {
              lastPeriod.endDate = new Date();
              userActivity.activityPeriods.push({
                startDate: new Date(),
                status: "active",
              });
              await userActivity.save();
              user.isActive = true;
              await user.save();
              console.log(
                `User ${userId} reactivated after ${inactiveDays} days of inactivity due to new order`
              );
            }
          }
        }
      }

      const cart = await Cart.findOne({ user: userId }).populate(
        "products.product"
      );
      if (!cart || !cart.products.length) {
        return res.status(400).json({ error: "Cart is empty" });
      }

      // const orderProducts = [];
      // let totalAmount = 0;
      // const productTypes = new Set();
      // const now = new Date();

      // for (const item of cart.products) {
      //   const product = await Product.findById(item.product._id);
      //   if (!product || !product.isActive) {
      //     return res.status(400).json({
      //       error: `Product not found or inactive: ${item.product.name}`,
      //     });
      //   }

      //   if (product.originalPrice == null || isNaN(product.originalPrice)) {
      //     return res.status(400).json({
      //       error: `Invalid originalPrice for product: ${product.name}`,
      //     });
      //   }

      //   const isOfferValid =
      //     product.discountedPrice &&
      //     product.validFrom &&
      //     product.validTo &&
      //     now >= product.validFrom &&
      //     now <= product.validTo;

      //   const price = isOfferValid
      //     ? product.discountedPrice
      //     : product.originalPrice;

      //   if (price == null || isNaN(price)) {
      //     return res.status(400).json({
      //       error: `Invalid price for product: ${product.name}`,
      //     });
      //   }

      //   if (item.boxes < 230) {
      //     return res.status(400).json({
      //       error: `Minimum 230 boxes required for ${product.name}`,
      //       minimumRequired: 230,
      //       requestedBoxes: item.boxes,
      //     });
      //   }

      //   totalAmount += price * item.boxes;
      //   orderProducts.push({
      //     product: product._id,
      //     boxes: item.boxes,
      //     price: price,
      //     originalPrice: product.originalPrice,
      //   });
      //   productTypes.add(product.type);
      // }

      const orderProducts = [];
      let totalAmount = 0;
      const productTypes = new Set();
      const now = new Date();

      const totalBoxes = cart.products.reduce(
        (sum, item) => sum + item.boxes,
        0
      );

      if (totalBoxes < 200) {
        return res.status(400).json({
          error: "Minimum 200 boxes required across all products",
          minimumRequired: 200,
          currentTotal: totalBoxes,
        });
      }

      // === TO HERE ===
      for (const item of cart.products) {
        const product = await Product.findById(item.product._id);
        if (!product || !product.isActive) {
          return res.status(400).json({
            error: `Product not found or inactive: ${item.product.name}`,
          });
        }

        const isOfferValid =
          product.discountedPrice &&
          product.validFrom &&
          product.validTo &&
          now >= product.validFrom &&
          now <= product.validTo;

        const price = isOfferValid
          ? product.discountedPrice
          : product.originalPrice;

        totalAmount += price * item.boxes;
        orderProducts.push({
          product: product._id,
          boxes: item.boxes,
          price,
          originalPrice: product.originalPrice,
        });
        productTypes.add(product.type);
      }

      const deliveryCharge = calculateDeliveryCharge(
        orderProducts.reduce((sum, item) => sum + item.boxes, 0),
        deliveryChoice,
        shippingAddress.pinCode
      );

      const order = new Order({
        user: userId,
        products: orderProducts,
        totalAmount,
        deliveryCharge,
        totalAmountWithDelivery: totalAmount + deliveryCharge,
        paymentMethod,
        type: [...productTypes][0],
        shippingAddress,
        deliveryChoice,
        firmName: user.customerDetails.firmName,
        gstNumber: user.customerDetails.gstNumber,
        paymentStatus: paymentMethod === "COD" ? "pending" : "pending",
        orderStatus: "pending",
        userStatus: user.isActive ? "active" : "inactive",
      });

      await order.save();

      const payment = new Payment({
        user: userId,
        amount: totalAmount + deliveryCharge,
        status: paymentMethod === "COD" ? "pending" : "pending",
        userActivityStatus: user.isActive ? "active" : "inactive",
        orderDetails: order._id,
      });
      await payment.save();

      for (const item of orderProducts) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { boxes: -item.boxes },
        });
      }
      await Cart.findByIdAndDelete(cart._id);

      res.status(201).json({
        success: true,
        message:
          paymentMethod === "COD"
            ? "COD order placed successfully"
            : "Order placed, please complete payment via QR code",
        order,
        paymentId: payment._id,
        amount: totalAmount + deliveryCharge,
        userDetails: {
          name: user.name,
          email: user.email,
          phone: user.phoneNumber,
          status: user.isActive ? "active" : "inactive",
        },
      });
    } catch (error) {
      console.error("Order creation error:", error);
      res.status(500).json({
        error: "Error creating order",
        details: error.message,
      });
    }
  },



  // controllers/paymentController.js
// createOrder: async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const { paymentMethod, shippingAddress, deliveryChoice } = req.body;

//     // ────── Basic validation ──────
//     const validPaymentMethods = ["UPI", "netBanking", "COD"];
//     if (!validPaymentMethods.includes(paymentMethod)) {
//       return res.status(400).json({
//         error: "Invalid payment method",
//         validMethods: validPaymentMethods,
//       });
//     }

//     if (
//       !shippingAddress?.address ||
//       !shippingAddress?.city ||
//       !shippingAddress?.state ||
//       !shippingAddress?.pinCode
//     ) {
//       return res.status(400).json({
//         error: "Complete shipping address with pin code is required",
//       });
//     }

//     if (!/^\d{6}$/.test(shippingAddress.pinCode)) {
//       return res.status(400).json({ error: "Pin code must be 6 digits" });
//     }

//     if (!["homeDelivery", "companyPickup"].includes(deliveryChoice)) {
//       return res.status(400).json({ error: "Invalid delivery choice" });
//     }

//     // ────── User & activity reactivation (unchanged) ──────
//     const user = await User.findById(userId);
//     if (!user) return res.status(404).json({ error: "User not found" });

//     // … (your reactivation logic) …

//     // ────── Load cart with populated products ──────
//     const cart = await Cart.findOne({ user: userId }).populate(
//       "products.product"
//     );
//     if (!cart || !cart.products?.length) {
//       return res.status(400).json({ error: "Cart is empty" });
//     }

//     // ────── TOTAL BOXES VALIDATION (200 boxes across all items) ──────
//     const totalBoxes = cart.products.reduce(
//       (sum, item) => sum + (item.boxes ?? 0),
//       0
//     );
//     if (totalBoxes < 200) {
//       return res.status(400).json({
//         error: "Minimum 200 boxes required across all products",
//         minimumRequired: 200,
//         currentTotal: totalBoxes,
//       });
//     }

//     // ────── Build orderProducts safely ──────
//     const orderProducts = [];
//     let totalAmount = 0;
//     const productTypes = new Set();
//     const now = new Date();

//     for (const item of cart.products) {
//       // item.product may be null if populate failed
//       if (!item.product) {
//         return res.status(400).json({
//           error: "One of the cart items references a missing product",
//           item,
//         });
//       }

//       const product = item.product; // already populated

//       if (!product.isActive) {
//         return res.status(400).json({
//           error: `Product is inactive: ${product.name}`,
//         });
//       }

//       // Offer logic
//       const isOfferValid =
//         product.discountedPrice &&
//         product.validFrom &&
//         product.validTo &&
//         now >= new Date(product.validFrom) &&
//         now <= new Date(product.validTo);

//       const price = isOfferValid
//         ? product.discountedPrice
//         : product.originalPrice;

//       totalAmount += price * item.boxes;
//       orderProducts.push({
//         product: product._id,
//         boxes: item.boxes,
//         price,
//         originalPrice: product.originalPrice,
//       });
//       productTypes.add(product.type);
//     }

//     // ────── Delivery charge ──────
//     const deliveryCharge = calculateDeliveryCharge(
//       totalBoxes,
//       deliveryChoice,
//       shippingAddress.pinCode
//     );

//     // ────── Save Order & Payment ──────
//     const order = new Order({
//       user: userId,
//       products: orderProducts,
//       totalAmount,
//       deliveryCharge,
//       totalAmountWithDelivery: totalAmount + deliveryCharge,
//       paymentMethod,
//       type: [...productTypes][0],
//       shippingAddress,
//       deliveryChoice,
//       firmName: user.customerDetails?.firmName,
//       gstNumber: user.customerDetails?.gstNumber,
//       paymentStatus: paymentMethod === "COD" ? "pending" : "pending",
//       orderStatus: "pending",
//       userStatus: user.isActive ? "active" : "inactive",
//     });
//     await order.save();

//     const payment = new Payment({
//       user: userId,
//       amount: totalAmount + deliveryCharge,
//       status: paymentMethod === "COD" ? "pending" : "pending",
//       userActivityStatus: user.isActive ? "active" : "inactive",
//       orderDetails: order._id,
//     });
//     await payment.save();

//     // ────── Deduct stock & clear cart ──────
//     for (const p of orderProducts) {
//       await Product.findByIdAndUpdate(p.product, {
//         $inc: { boxes: -p.boxes },
//       });
//     }
//     await Cart.findByIdAndDelete(cart._id);

//     // ────── Success response ──────
//     res.status(201).json({
//       success: true,
//       message:
//         paymentMethod === "COD"
//           ? "COD order placed successfully"
//           : "Order placed, please complete payment via QR code",
//       order,
//       paymentId: payment._id,
//       amount: totalAmount + deliveryCharge,
//       userDetails: {
//         name: user.name,
//         email: user.email,
//         phone: user.phoneNumber,
//         status: user.isActive ? "active" : "inactive",
//       },
//     });
//   } catch (error) {
//     console.error("Order creation error:", error);
//     res.status(500).json({
//       error: "Error creating order",
//       details: error.message,
//     });
//   }
// },

  submitPaymentDetails: async (req, res) => {
    try {
      const { paymentId, referenceId, submittedAmount } = req.body;
      if (!paymentId || !referenceId || !submittedAmount || !req.file) {
        return res.status(400).json({
          error:
            "Payment ID, reference ID, submitted amount, and screenshot are required",
        });
      }

      const numericSubmittedAmount = Number(submittedAmount);
      if (isNaN(numericSubmittedAmount) || numericSubmittedAmount <= 0) {
        return res.status(400).json({ error: "Invalid submitted amount" });
      }

      const payment = await Payment.findById(paymentId);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      if (payment.status === "completed") {
        return res.status(400).json({ error: "Payment already completed" });
      }

      if (numericSubmittedAmount > payment.remainingAmount) {
        return res.status(400).json({
          error: `Submitted amount (${numericSubmittedAmount}) exceeds remaining amount (${payment.remainingAmount})`,
        });
      }

      const uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "payment-screenshots", resource_type: "image" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
      });

      const cloudinaryResponse = await uploadPromise;

      payment.paymentHistory.push({
        referenceId,
        screenshotUrl: cloudinaryResponse.secure_url,
        submittedAmount: numericSubmittedAmount,
        status: "submitted",
      });

      if (payment.status !== "completed") {
        payment.status = "submitted";
      }

      await payment.save();

      res.status(200).json({
        success: true,
        message:
          "Payment details submitted successfully, awaiting verification",
        payment: {
          ...payment.toObject(),
          remainingAmount: payment.remainingAmount,
        },
      });
    } catch (error) {
      console.error("Payment submission error:", error);
      res.status(500).json({
        error: "Error submitting payment details",
        details: error.message,
      });
    }
  },

  verifyPaymentByReception: async (req, res) => {
    try {
      const { paymentId, referenceId, verifiedAmount, verificationNotes } =
        req.body;
      if (!paymentId || !referenceId || verifiedAmount === undefined) {
        return res.status(400).json({
          error: "Payment ID, reference ID, and verified amount are required",
        });
      }

      const numericVerifiedAmount = Number(verifiedAmount);
      if (isNaN(numericVerifiedAmount) || numericVerifiedAmount < 0) {
        return res.status(400).json({ error: "Invalid verified amount" });
      }

      const payment = await Payment.findById(paymentId).populate(
        "orderDetails"
      );
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const paymentEntry = payment.paymentHistory.find(
        (entry) =>
          entry.referenceId === referenceId && entry.status === "submitted"
      );
      if (!paymentEntry) {
        return res.status(404).json({
          error: "Payment entry not found or already processed",
        });
      }

      if (numericVerifiedAmount > paymentEntry.submittedAmount) {
        return res.status(400).json({
          error: `Verified amount (${numericVerifiedAmount}) exceeds submitted amount (${paymentEntry.submittedAmount})`,
        });
      }

      const potentialPaidAmount = payment.paidAmount + numericVerifiedAmount;
      if (potentialPaidAmount > payment.amount) {
        return res.status(400).json({
          error: `Total paid amount (${potentialPaidAmount}) would exceed order amount (${payment.amount})`,
        });
      }

      paymentEntry.status = "verified";
      paymentEntry.verifiedAmount = numericVerifiedAmount;
      paymentEntry.verifiedBy = req.user._id;
      paymentEntry.verificationNotes = verificationNotes || "";
      paymentEntry.verificationDate = new Date();

      payment.paidAmount += numericVerifiedAmount;

      if (payment.paidAmount >= payment.amount) {
        payment.status = "completed";
        payment.orderDetails.paymentStatus = "completed";
        payment.orderDetails.orderStatus = "processing";
      } else {
        payment.status = "pending";
        payment.orderDetails.paymentStatus = "pending";
      }

      await payment.save();
      await payment.orderDetails.save();

      res.status(200).json({
        success: true,
        message: `Payment ${
          payment.status === "completed" ? "fully" : "partially"
        } verified`,
        payment: {
          ...payment.toObject(),
          amount: Number(payment.amount),
          paidAmount: Number(payment.paidAmount),
          remainingAmount: Number(payment.remainingAmount),
        },
        order: {
          ...payment.orderDetails.toObject(),
          totalAmountWithDelivery: Number(
            payment.orderDetails.totalAmountWithDelivery
          ),
        },
      });
    } catch (error) {
      console.error("Payment verification error:", error);
      res.status(500).json({
        error: "Error verifying payment",
        details: error.message,
      });
    }
  },

  getPaymentDetails: async (req, res) => {
    try {
      const paymentId = req.params.paymentId;
      const userId = req.user._id;

      const payment = await Payment.findById(paymentId)
        .populate("user", "name email phoneNumber")
        .populate("orderDetails");

      if (!payment) {
        return res.status(404).json({
          error: "Payment not found",
        });
      }

      if (payment.user._id.toString() !== userId.toString()) {
        return res.status(403).json({
          error: "Unauthorized access to payment details",
        });
      }

      res.status(200).json({
        success: true,
        payment: {
          _id: payment._id,
          user: payment.user,
          amount: payment.amount,
          paidAmount: payment.paidAmount,
          remainingAmount: payment.remainingAmount,
          status: payment.status,
          paymentHistory: payment.paymentHistory,
          orderDetails: payment.orderDetails,
          createdAt: payment.createdAt,
        },
      });
    } catch (error) {
      console.error("Payment details error:", error);
      res.status(500).json({
        error: "Error fetching payment details",
        details: error.message,
      });
    }
  },
};

module.exports = paymentController;
