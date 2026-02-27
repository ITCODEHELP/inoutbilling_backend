const GSTR1ReportModel = require('../../models/Report-Model/GSTR1ReportModel');
const User = require('../../models/User-Model/User');

class GSTR1ReportController {
    static async searchGSTR1(req, res) {
        try {
            const { fromDate, toDate, section } = req.body;
            const userId = req.user._id;

            if (!fromDate || !toDate || !section) {
                return res.status(400).json({
                    success: false,
                    message: 'fromDate, toDate, and section are required'
                });
            }

            // Fetch user to get the 'state' for GSTR logic (B2CL vs B2CS)
            const user = await User.findById(userId).lean();
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            const userState = user.state || '';

            let data = [];

            switch (section) {
                case 'B2B':
                    data = await GSTR1ReportModel.getB2BData(userId, fromDate, toDate);
                    break;
                case 'B2CL':
                    data = await GSTR1ReportModel.getB2CLData(userId, fromDate, toDate, userState);
                    break;
                case 'B2CS':
                    data = await GSTR1ReportModel.getB2CSData(userId, fromDate, toDate, userState);
                    break;
                case 'EXP':
                    data = await GSTR1ReportModel.getEXPData(userId, fromDate, toDate);
                    break;
                case 'CDNR':
                    data = await GSTR1ReportModel.getCDNRData(userId, fromDate, toDate);
                    break;
                case 'CDNUR':
                    data = await GSTR1ReportModel.getCDNURData(userId, fromDate, toDate);
                    break;
                case 'HSN_B2B':
                case 'HSN_B2C':
                    // Usually GSTR-1 has a single HSN summary section.
                    data = await GSTR1ReportModel.getHSNData(userId, fromDate, toDate);
                    break;
                case 'DOCS':
                    data = await GSTR1ReportModel.getDOCSData(userId, fromDate, toDate);
                    break;
                case 'AT':
                case 'ATADJ':
                    // Returning empty placeholders for these if specific logic not yet mapped
                    data = [];
                    break;
                case 'EXEMP':
                    data = await GSTR1ReportModel.getEXEMPData(userId, fromDate, toDate, userState);
                    break;
                default:
                    return res.status(400).json({ success: false, message: 'Invalid section' });
            }

            res.status(200).json({
                success: true,
                section,
                count: data.length,
                data
            });

        } catch (error) {
            console.error('GSTR1ReportController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }
}

module.exports = GSTR1ReportController;
