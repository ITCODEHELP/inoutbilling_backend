const express = require('express');
const router = express.Router();
const {
    createManufacture,
    getManufactures,
    getManufactureById,
    updateManufacture,
    searchManufactures
} = require('../../controllers/Other-Document-Controller/manufactureController');
const { protect } = require('../../middlewares/authMiddleware');

router.use(protect);

router.get('/search', searchManufactures);

router.route('/')
    .get(getManufactures)
    .post(createManufacture);

router.route('/:id')
    .get(getManufactureById)
    .put(updateManufacture);

module.exports = router;
