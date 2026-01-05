const MembershipPlan = require('../models/MembershipPlan');
const UserMembership = require('../models/UserMembership');
const MembershipPayment = require('../models/MembershipPayment');
const mongoose = require('mongoose');

/**
 * @desc    Get current user's membership details
 * @route   GET /api/setting-membership/current
 */
const getCurrentMembership = async (req, res) => {
    try {
        let membership = await UserMembership.findOne({ userId: req.user._id }).populate('planId');

        if (!membership) {
            // New user: assign default FREE plan if it exists
            const freePlan = await MembershipPlan.findOne({ name: 'FREE' });
            if (freePlan) {
                membership = await UserMembership.create({
                    userId: req.user._id,
                    planId: freePlan._id,
                    membershipType: 'FREE'
                });
                membership = await membership.populate('planId');
            }
        }

        res.status(200).json({
            success: true,
            data: {
                membershipType: membership?.membershipType || 'FREE',
                expiryDate: membership?.expiryDate || 'Lifetime',
                lastPaymentDate: membership?.lastPaymentDate || 'N/A',
                lastPaymentAmount: membership?.lastPaymentAmount || 0,
                plan: membership?.planId || null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get available membership plans
 * @route   GET /api/setting-membership/plans
 */
const getAvailablePlans = async (req, res) => {
    try {
        const plans = await MembershipPlan.find({ status: 'ACTIVE' });
        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Handle Upgrade Now (Store intent)
 * @route   POST /api/setting-membership/upgrade
 */
const initiateUpgrade = async (req, res) => {
    try {
        const { planId } = req.body;
        const plan = await MembershipPlan.findById(planId);

        if (!plan) {
            return res.status(404).json({ success: false, message: "Plan not found" });
        }

        // Return plan details for payment flow
        res.status(200).json({
            success: true,
            message: "Upgrade initiated",
            plan: {
                id: plan._id,
                name: plan.name,
                durationYears: plan.durationYears,
                totalAmount: plan.price + (plan.price * plan.gstPercentage / 100),
                gst: plan.gstPercentage
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get payment history
 * @route   GET /api/setting-membership/payments
 */
const getPaymentHistory = async (req, res) => {
    try {
        const payments = await MembershipPayment.find({ userId: req.user._id }).sort({ paymentDate: -1 });
        res.status(200).json({ success: true, data: payments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Internal: Seed default plans
 */
const seedMembershipPlans = async (req, res) => {
    try {
        const plans = [
            {
                name: 'FREE',
                durationYears: 0,
                price: 0,
                gstPercentage: 0,
                features: ['Basic GST Invoicing', '100 Documents/Year', '1 Staff Account'],
                limits: { docsPerYear: 100, itemsPerDoc: 10, staffAccounts: 1 }
            },
            {
                name: 'PREMIUM',
                durationYears: 1,
                price: 4999,
                gstPercentage: 18,
                features: ['Unlimited Invoicing', 'Multiple Staff Accounts', 'Priority Support'],
                limits: { docsPerYear: -1, itemsPerDoc: -1, staffAccounts: 5 }
            },
            {
                name: 'PREMIUM',
                durationYears: 3,
                price: 11999,
                gstPercentage: 18,
                features: ['Everything in 1-Year', 'Custom Barcode Printing', 'Legacy Data Import'],
                limits: { docsPerYear: -1, itemsPerDoc: -1, staffAccounts: 10 }
            }
        ];

        await MembershipPlan.deleteMany({});
        const createdPlans = await MembershipPlan.insertMany(plans);
        res.status(201).json({ success: true, data: createdPlans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getCurrentMembership,
    getAvailablePlans,
    initiateUpgrade,
    getPaymentHistory,
    seedMembershipPlans
};
