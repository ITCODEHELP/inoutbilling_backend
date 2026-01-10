const express = require('express');
const router = express.Router();
const {
    createPackingList,
    getPackingLists,
    getPackingListById,
    updatePackingList,
    deletePackingList,
    downloadPackingList
} = require('../../controllers/Other-Document-Controller/packingListController');
const { protect } = require('../../middlewares/authMiddleware');

router.use(protect);

router.route('/')
    .get(getPackingLists)
    .post(createPackingList);

router.route('/:id')
    .get(getPackingListById)
    .put(updatePackingList)
    .delete(deletePackingList);

router.get('/:id/download', downloadPackingList);

module.exports = router;
