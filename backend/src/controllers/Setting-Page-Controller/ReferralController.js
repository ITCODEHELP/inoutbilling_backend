const Referral = require('../../models/Setting-Model/ReferralModel');
const User = require('../../models/User-Model/User');
const UserMembership = require('../../models/Setting-Model/UserMembership');
const UserReferralCode = require('../../models/Setting-Model/UserReferralCode');

/**
 * @desc    Get referral stats and share links for the dashboard
 * @route   GET /api/referral/stats
 * @access  Private
 */
const getReferralStats = async (req, res) => {
    try {
        // Use secure referral code mapping
        const referralCode = await UserReferralCode.getOrCreateCode(req.user._id);

        // Generate Referral URL (Points to our backend resolver)
        const referralUrl = `${req.protocol}://${req.get('host')}/api/referral/go/${referralCode}`;

        // Platform-specific share links
        const message = encodeURIComponent('Join Inout Billing and simplify your invoicing! Use my link: ');
        const shareLinks = {
            whatsapp: `https://wa.me/?text=${message}${referralUrl}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${referralUrl}`,
            twitter: `https://twitter.com/intent/tweet?text=${message}&url=${referralUrl}`,
            email: `mailto:?subject=Join%20Inout%20Billing&body=${message}${referralUrl}`
        };

        // Fetch Counts
        const stats = await Referral.getStatsForUser(req.user._id);

        res.status(200).json({
            success: true,
            data: {
                referralCode,
                referralUrl,
                shareLinks,
                totalReferrals: stats.total,
                premiumReferrals: stats.premium
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    Resolve referral code and return referrer metadata
 * @route   GET /api/referral/go/:referralCode
 * @access  Public
 */
const resolveReferralCode = async (req, res) => {
    try {
        const { referralCode } = req.params;

        // Find the user associated with this code
        const mapping = await UserReferralCode.findOne({ referralCode }).populate({
            path: 'user',
            select: 'companyName phone countryCode'
        });

        if (!mapping || !mapping.user) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired referral code'
            });
        }

        const referrer = mapping.user;

        // Return deterministic data for the frontend to consume
        // Exposes all required data for the frontend to handle the rest of the flow
        res.status(200).json({
            success: true,
            data: {
                referralCode,
                referrer: {
                    companyName: referrer.companyName || 'Our Member',
                    countryCode: referrer.countryCode,
                    // Masked phone for privacy
                    phone: referrer.phone ? `${referrer.phone.substring(0, 2)}******${referrer.phone.substring(referrer.phone.length - 2)}` : null
                },
                // Hint for the frontend, not strictly required but useful
                suggestedRedirect: '/signup'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error resolving referral code', error: error.message });
    }
};

/**
 * @desc    Link a newly signed-up user to a referrer
 * @route   POST /api/referral/track
 * @access  Public (Internal/Frontend call after signup)
 */
const trackReferral = async (req, res) => {
    try {
        const { referralCode, referredId } = req.body;

        if (!referralCode || !referredId) {
            return res.status(400).json({ success: false, message: 'Referral Code and Referred ID are required' });
        }

        // 1. Validate Referrer Code
        const mapping = await UserReferralCode.findOne({ referralCode });
        if (!mapping) {
            return res.status(404).json({ success: false, message: 'Invalid Referral Code' });
        }
        const referrerId = mapping.user;

        // 2. Validate Referred User existence
        const referredUser = await User.findById(referredId);
        if (!referredUser) {
            return res.status(404).json({ success: false, message: 'Referred user not found' });
        }

        // 3. SELF-REFERRAL VALIDATION
        if (referrerId.toString() === referredId.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot refer yourself' });
        }

        // 4. DUPLICATE REFERRAL VALIDATION
        const existingReferral = await Referral.findOne({ referredUser: referredId });
        if (existingReferral) {
            return res.status(400).json({ success: false, message: 'This user has already been referred' });
        }

        // 5. Determine Membership Type (Accurate tracking after signup)
        const membership = await UserMembership.findOne({ userId: referredId });
        const accountType = membership && membership.membershipType === 'PREMIUM' ? 'PREMIUM' : 'FREE';

        // 6. Create referral record
        const newReferral = await Referral.create({
            referrer: referrerId,
            referredUser: referredId,
            accountType,
            signupDate: referredUser.createdAt // Link to actual user signup date
        });

        res.status(201).json({
            success: true,
            message: 'Referral tracked successfully',
            data: {
                id: newReferral._id,
                referrerId: referrerId,
                referredId: referredId,
                accountType
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    getReferralStats,
    redirectReferral: resolveReferralCode, // Keep export name for routes but rename internally for clarity
    trackReferral
};
