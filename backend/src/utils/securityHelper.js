const LoginHistory = require('../models/Login-Model/LoginHistory');

/**
 * Parses user-agent string to extract basic device, browser, and platform info.
 */
const parseUserAgent = (ua) => {
    let browser = "Unknown Browser";
    let platform = "Unknown Platform";
    let device = "Desktop";

    if (/chrome|crios/i.test(ua)) browser = "Chrome";
    else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
    else if (/safari/i.test(ua)) browser = "Safari";
    else if (/opr\//i.test(ua)) browser = "Opera";
    else if (/edg/i.test(ua)) browser = "Edge";

    if (/android/i.test(ua)) {
        platform = "Android";
        device = "Mobile";
    } else if (/iphone|ipad|ipod/i.test(ua)) {
        platform = "iOS";
        device = "Mobile";
    } else if (/windows/i.test(ua)) platform = "Windows";
    else if (/macintosh/i.test(ua)) platform = "macOS";
    else if (/linux/i.test(ua)) platform = "Linux";

    return { device, browser, platform };
};

/**
 * Records a login event.
 */
const recordLogin = async (req, user) => {
    try {
        const ua = req.headers['user-agent'] || '';
        const { device, browser, platform } = parseUserAgent(ua);
        const ip = req.ip || req.headers['x-forwarded-for'] || '0.0.0.0';

        let location = 'Location tracked off';
        if (user.trackLoginLocation) {
            // Mocking IP-based location resolution
            // In a real app, you'd use a service like ip-api.com or a library
            location = `India, Maharashtra, Mumbai (IP: ${ip})`;
        }

        await LoginHistory.create({
            userId: user._id,
            device,
            browser,
            platform,
            ip,
            location,
            loginTime: new Date(),
            lastLogin: new Date(),
            isActive: true
        });
    } catch (error) {
        console.error('Error recording login:', error);
    }
};

module.exports = { recordLogin };
