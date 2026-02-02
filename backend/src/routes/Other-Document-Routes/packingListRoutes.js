const express = require('express');
const router = express.Router();
const {
    createPackingList,
    getPackingLists,
    getPackingListById,
    updatePackingList,
    deletePackingList,
    downloadPackingList,
    getDuplicatePackingListData,
    printPackingList,
    downloadPackingListPDF,
    sharePackingListEmail,
    sharePackingListWhatsApp,
    generatePackingListPublicLink,
    viewPackingListPublic
} = require('../../controllers/Other-Document-Controller/packingListController');
const { protect } = require('../../middlewares/authMiddleware');

router.get('/view-public/:id/:token', viewPackingListPublic); // Public route

router.use(protect);

router.route('/')
    .get(getPackingLists)
    .post(createPackingList);

router.route('/:id')
    .get(getPackingListById)
    .put(updatePackingList)
    .delete(deletePackingList);

router.get('/:id/download', downloadPackingList);
router.get('/:id/duplicate', getDuplicatePackingListData);
router.get('/:id/print', printPackingList);
router.get('/:id/download-pdf', downloadPackingListPDF);
router.post('/:id/share-email', sharePackingListEmail);
router.post('/:id/share-whatsapp', sharePackingListWhatsApp);
router.get('/:id/public-link', generatePackingListPublicLink);

module.exports = router;
