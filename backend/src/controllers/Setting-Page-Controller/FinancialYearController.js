const FinancialYear = require('../../models/Setting-Model/FinancialYear');
const UserFinancialYear = require('../../models/Setting-Model/UserFinancialYear');

/**
 * @desc    Get all available Financial Years
 * @route   GET /api/financial-years
 * @access  Private
 */
const getAllFinancialYears = async (req, res) => {
    try {
        // Optimized for read scalability
        const financialYears = await FinancialYear.find({ status: 'ACTIVE' })
            .sort({ startDate: -1 })
            .lean();

        // Seed if empty (for initial deployment)
        if (financialYears.length === 0) {
            const currentYear = new Date().getFullYear();
            const defaults = [
                { label: `F.Y. ${currentYear}-${currentYear + 1}`, startDate: new Date(`${currentYear}-04-01`), endDate: new Date(`${currentYear + 1}-03-31`), isDefault: true },
                { label: `F.Y. ${currentYear - 1}-${currentYear}`, startDate: new Date(`${currentYear - 1}-04-01`), endDate: new Date(`${currentYear}-03-31`), isDefault: false }
            ];
            const seeded = await FinancialYear.insertMany(defaults);
            return res.status(200).json({ success: true, data: seeded });
        }

        res.status(200).json({ success: true, data: financialYears });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    Get currently active Financial Year for the user
 * @route   GET /api/financial-year
 * @access  Private
 */
const getActiveFinancialYear = async (req, res) => {
    try {
        const userId = req.user._id;
        const companyId = req.headers['x-company-id'] || req.user.companyId || userId; // Fallback to userId if companyId not in context

        let activeYear = await UserFinancialYear.findOne({ userId, companyId })
            .populate('activeFinancialYearId')
            .lean();

        // If no selection, return the default FY
        if (!activeYear) {
            const defaultFY = await FinancialYear.findOne({ isDefault: true }).lean();
            return res.status(200).json({
                success: true,
                data: defaultFY,
                isInheritedFromDefault: true
            });
        }

        res.status(200).json({ success: true, data: activeYear.activeFinancialYearId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    Set/Update active Financial Year for the user
 * @route   PATCH /api/financial-year
 * @access  Private
 */
const setActiveFinancialYear = async (req, res) => {
    try {
        const { financialYearId } = req.body;
        const userId = req.user._id;
        const companyId = req.headers['x-company-id'] || req.user.companyId || userId;

        if (!financialYearId) {
            return res.status(400).json({ success: false, message: 'Financial Year ID is required' });
        }

        // Validate existence
        const fy = await FinancialYear.findById(financialYearId);
        if (!fy) {
            return res.status(404).json({ success: false, message: 'Financial Year not found' });
        }

        // Update or Create preference for this user/company context
        const preference = await UserFinancialYear.findOneAndUpdate(
            { userId, companyId },
            { activeFinancialYearId: financialYearId },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Invalidate cache (Redis placeholder logic)
        if (global.cacheManager) {
            global.cacheManager.invalidatePattern(`user:${userId}:fy:*`);
        }

        res.status(200).json({
            success: true,
            message: `Financial Year switched to ${fy.label}`,
            data: {
                activeFinancialYearId: fy._id,
                label: fy.label,
                startDate: fy.startDate,
                endDate: fy.endDate
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    getAllFinancialYears,
    getActiveFinancialYear,
    setActiveFinancialYear
};
