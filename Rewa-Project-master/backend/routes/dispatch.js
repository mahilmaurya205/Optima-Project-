const express = require("express");
const router = express.Router();
const { auth, checkRole } = require("../middleware/auth");
const dispatchController = require("../controllers/dispatchController");
const upload = require("../config/multer");

router.use(auth);
router.use(checkRole("dispatch"));


router.get("/products", dispatchController.getProductsForSelection);
router.get("/products/:productId", dispatchController.getProductById);


// New routes for enhanced challan functionality
router.post("/orders/:orderId/generate-challan", dispatchController.generateChallanFromOrder);
router.patch("/challans/:challanId/reschedule", dispatchController.rescheduleChallan);
router.get("/orders/:orderId/challans", dispatchController.getChallansByOrder);


router.get("/current-orders", dispatchController.getCurrentOrders);

router.post("/generate-challan", dispatchController.generateStandaloneChallan);

router.get("/order-history", dispatchController.getOrderHistory);

router.get("/challans/:userCode", dispatchController.getChallansByUserCode);

router.get("/orders/processing", dispatchController.getProcessingOrders);
router.patch("/orders/:orderId/status", dispatchController.updateOrderStatus);

router.post(
  "/check-in",
  upload.single("checkInImage"),
  dispatchController.checkIn
);
router.post("/check-out", dispatchController.checkOut);
router.get("/daily-orders", dispatchController.getDailyDispatchOrders);

router.get("/challan/:challanId/download", dispatchController.downloadChallan);

router.patch(
  "/orders/:orderId/cod-payment-status",
  dispatchController.updateCODPaymentStatus
);

router.get("/pending-payments", dispatchController.getPendingPayments);
router.get(
  "/pending-payments/download",
  dispatchController.downloadPendingPaymentsExcel
);

module.exports = router;
