const express = require('express');
const router = express.Router();
const {
    createJobWork,
    getJobWorks,
    getJobWorkById,
    updateJobWork,
    deleteJobWork,
    getJobWorkSummary,
    searchJobWorks
} = require('../controllers/jobWorkController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/summary', getJobWorkSummary);
router.get('/search', searchJobWorks);

router.route('/')
    .get(getJobWorks)
    .post(createJobWork);

router.route('/:id')
    .get(getJobWorkById)
    .put(updateJobWork)
    .delete(deleteJobWork);

module.exports = router;
