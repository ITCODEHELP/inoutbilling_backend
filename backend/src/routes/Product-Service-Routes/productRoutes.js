const express = require('express');
const router = express.Router();
const {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getProductStats,
    getManageStock
} = require('../../controllers/Product-Service-Controller/productController');
const { exportProductLog } = require('../../controllers/Product-Service-Controller/productLogExportController');
const { protect } = require('../../middlewares/authMiddleware');
const upload = require('../../middlewares/uploadMiddleware'); // for bulk import
const productImageUpload = require('../../middlewares/productImageUploadMiddleware');
const {
    importBulkEdit,
    getBulkEditLogs,
    getBulkEditLogDetails,
    exportBulkEdit
} = require('../../controllers/Product-Service-Controller/bulkEditController');
const { getProductSearchCounts } = require('../../controllers/Product-Service-Controller/productSearchController');

// Stats and Manage Stock Routes
router.get('/stats', protect, getProductStats);
router.get('/manage-stock', protect, getManageStock);
router.get('/export-log', protect, exportProductLog);
router.get('/search-counts', protect, getProductSearchCounts);

// Bulk Edit Routes
router.post('/bulk-edit/import', protect, upload.single('file'), importBulkEdit);
router.get('/bulk-edit/export', protect, exportBulkEdit);
router.get('/bulk-edit/logs', protect, getBulkEditLogs);
router.get('/bulk-edit/logs/:id/details', protect, getBulkEditLogDetails);

// CRUD Routes
router.post('/', protect, productImageUpload.array('images', 5), createProduct);
router.get('/', protect, getProducts);
router.get('/:id', protect, getProductById);
router.put('/:id', protect, productImageUpload.array('images', 5), updateProduct);
router.delete('/:id', protect, deleteProduct);

module.exports = router;
