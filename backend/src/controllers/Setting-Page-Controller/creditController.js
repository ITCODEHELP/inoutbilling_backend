const CreditPack = require('../../models/Setting-Model/CreditPack');
const UserCredit = require('../../models/Setting-Model/UserCredit');
const CreditUsageMaster = require('../../models/Setting-Model/CreditUsageMaster');
const CreditUsageLog = require('../../models/Setting-Model/CreditUsageLog');
const CreditPayment = require('../../models/Setting-Model/CreditPayment');

/**
 * @desc    Get current user credit balance
 * @route   GET /api/setting-credit/balance
 */
const getCreditBalance = async (req, res) => {
    try {
        let balance = await UserCredit.findOne({ userId: req.user._id });

        if (!balance) {
            // New user: grant Free Trial (10 credits)
            balance = await UserCredit.create({
                userId: req.user._id,
                totalCredits: 10,
                usedCredits: 0,
                packName: 'Free Trial'
            });
        }

        res.status(200).json({ success: true, data: balance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get available credit packs
 * @route   GET /api/setting-credit/packs
 */
const getAvailablePacks = async (req, res) => {
    try {
        const packs = await CreditPack.find({ status: 'ACTIVE' });
        res.status(200).json({ success: true, data: packs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Purchase credit pack
 * @route   POST /api/setting-credit/purchase
 */
const purchaseCredits = async (req, res) => {
    try {
        const { packId, transactionId, paymentType } = req.body;
        const pack = await CreditPack.findById(packId);

        if (!pack) {
            return res.status(404).json({ success: false, message: "Pack not found" });
        }

        // 1. Log Payment
        const payment = await CreditPayment.create({
            userId: req.user._id,
            packId: pack._id,
            packName: pack.name,
            amount: pack.price + (pack.price * pack.gstPercentage / 100),
            transactionId,
            paymentType,
            status: 'SUCCESS'
        });

        // 2. Update User Balance
        let userCredit = await UserCredit.findOne({ userId: req.user._id });
        if (!userCredit) {
            userCredit = new UserCredit({ userId: req.user._id });
        }
        userCredit.totalCredits += pack.credits;
        userCredit.packName = pack.name;
        await userCredit.save();

        // 3. Log Usage (as a credit)
        await CreditUsageLog.create({
            userId: req.user._id,
            type: 'CREDIT',
            action: 'Purchase',
            description: `Purchased ${pack.name}`,
            credits: pack.credits,
            balanceAfter: userCredit.remainingCredits
        });

        res.status(201).json({ success: true, message: "Credits purchased successfully", data: userCredit });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Credit Usage Log
 * @route   GET /api/setting-credit/logs
 */
const getUsageLog = async (req, res) => {
    try {
        const logs = await CreditUsageLog.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Payment History
 * @route   GET /api/setting-credit/payments
 */
const getPaymentHistory = async (req, res) => {
    try {
        const payments = await CreditPayment.find({ userId: req.user._id }).sort({ paymentDate: -1 });
        res.status(200).json({ success: true, data: payments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Internal Helper: Deduct Credits
 * This would be called by other controllers (e.g., E-Way Bill)
 */
const deductCredits = async (userId, actionName) => {
    const rule = await CreditUsageMaster.findOne({ actionName });
    if (!rule || rule.creditCost === 0) return true;

    const userCredit = await UserCredit.findOne({ userId });
    if (!userCredit || userCredit.remainingCredits < rule.creditCost) {
        throw new Error('Insufficient credits');
    }

    userCredit.usedCredits += rule.creditCost;
    await userCredit.save();

    await CreditUsageLog.create({
        userId,
        type: 'DEBIT',
        action: actionName,
        description: `Used for ${actionName}`,
        credits: rule.creditCost,
        balanceAfter: userCredit.remainingCredits
    });

    return true;
};

/**
 * @desc    Internal: Seed Data (Packs & Rules)
 */
const seedCreditData = async (req, res) => {
    try {
        const packs = [
            { name: 'Trial Pack', credits: 10, price: 0, packType: 'FREE' },
            { name: '100 Credits', credits: 100, price: 500, packType: 'PAID' },
            { name: '500 Credits', credits: 500, price: 2000, packType: 'PAID' }
        ];

        const rules = [
            { actionName: 'E-Way Bill Generate', creditCost: 1 },
            { actionName: 'E-Way Bill Cancel', creditCost: 0 },
            { actionName: 'E-Invoice Generate', creditCost: 1 },
            { actionName: 'E-Invoice Cancel', creditCost: 0 },
            { actionName: 'SMS Reminder', creditCost: 0.5 },
            { actionName: 'Purchase Upload Generate', creditCost: 1 }
        ];

        await CreditPack.deleteMany({});
        await CreditPack.insertMany(packs);

        await CreditUsageMaster.deleteMany({});
        await CreditUsageMaster.insertMany(rules);

        res.status(201).json({ success: true, message: "Credit packs and rules seeded" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getCreditBalance,
    getAvailablePacks,
    purchaseCredits,
    getUsageLog,
    getPaymentHistory,
    deductCredits,
    seedCreditData
};
