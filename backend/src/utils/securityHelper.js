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
        // Your logging logic (e.g., audit log, analytics)
        console.log(`[Security] Login recorded for user ${user.userId} from IP ${req.ip}`);

        // Example: Save to DB (adapt to your AuditLog model)
        // await AuditLog.create({
        //     userId: user._id,
        //     action: 'login',
        //     ip: req.ip,
        //     userAgent: req.get('User-Agent')
        // });

        // No next()—just return
        return { success: true };
    } catch (err) {
        console.error('[recordLogin] Failed:', err);
        // Don't throw—logins shouldn't fail on audit
        return { success: false, error: err.message };
    }
};

module.exports = { recordLogin };
