const SupportEmailSetting = require('../../models/Setting-Model/SupportEmailSetting');
const User = require('../../models/User-Model/User');

/**
 * @desc    Get support email configuration and personalized mailto link
 * @route   GET /api/support-email/config
 * @access  Private
 */
const getSupportEmailConfig = async (req, res) => {
    try {
        // 1. Fetch current settings from DB
        const settings = await SupportEmailSetting.getSettings();

        // 2. Fetch user context
        const user = await User.findById(req.user._id).select('fullName companyName email');
        const userName = user.fullName || user.companyName || 'valued customer';
        const userEmail = user.email || '';

        // 3. Populate Templates
        let subject = settings.subjectTemplate
            .replace('${userName}', userName)
            .replace('${email}', userEmail);

        let body = settings.bodyTemplate
            .replace('${userName}', userName)
            .replace('${email}', userEmail);

        // 4. Generate Mailto Link
        // Format: mailto:support@example.com?subject=...&body=...
        const mailtoLink = `mailto:${settings.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        res.status(200).json({
            success: true,
            data: {
                supportEmail: settings.supportEmail,
                expectedResponseTime: settings.expectedResponseTime,
                subject,
                body,
                mailtoLink
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    getSupportEmailConfig
};
