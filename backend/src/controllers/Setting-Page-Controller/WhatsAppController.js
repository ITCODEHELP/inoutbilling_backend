const WhatsAppInteraction = require('../../models/Setting-Model/WhatsAppInteraction');
const User = require('../../models/User-Model/User');

/**
 * @desc    Get WhatsApp configuration and personalized deep link
 * @route   GET /api/whatsapp/config
 * @access  Private
 */
const getWhatsAppConfig = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('fullName companyName');
        const userName = user.fullName || user.companyName || 'valued customer';

        const businessNumber = '9725306146';
        const workingHours = 'Monday - Friday: 09:00 AM - 06:00 PM (GMT+5:30)';

        // Construct Personalized Message
        const greeting = `Hi, I'm ${userName}. `;
        const intro = `I'm interested in learning more about Inout Billing and how it can help stream-line my invoicing process. `;
        const cta = `Could you please provide more information on the available features?`;

        const fullMessage = `${greeting}${intro}${cta}`;
        const encodedMessage = encodeURIComponent(fullMessage);

        const deepLink = `https://wa.me/${businessNumber}?text=${encodedMessage}`;

        res.status(200).json({
            success: true,
            data: {
                businessNumber,
                workingHours,
                messageTemplate: fullMessage,
                deepLink
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    Track WhatsApp interaction (click)
 * @route   POST /api/whatsapp/track
 * @access  Private
 */
const trackInteraction = async (req, res) => {
    try {
        const { sourcePage } = req.body;

        if (!sourcePage) {
            return res.status(400).json({ success: false, message: 'Source page is required' });
        }

        const interaction = await WhatsAppInteraction.create({
            userId: req.user._id,
            sourcePage
        });

        res.status(201).json({
            success: true,
            message: 'Interaction logged successfully',
            data: {
                id: interaction._id,
                timestamp: interaction.timestamp
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    getWhatsAppConfig,
    trackInteraction
};
