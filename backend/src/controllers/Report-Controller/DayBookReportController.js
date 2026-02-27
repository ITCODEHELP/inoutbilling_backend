const DayBookReportModel = require('../../models/Report-Model/DayBookReportModel');

class DayBookReportController {
    static async searchDayBook(req, res) {
        try {
            const {
                customerVendor,
                date, // Can be single date or handled via from/to
                fromDate,
                toDate,
                staffId,
                showAllDocuments,
                groupByCustomer,
                groupByVoucherType
            } = req.body;

            // Handle dual date vs single date
            // If 'date' provided, use it for both from/to or specific day
            let effectiveFrom = fromDate;
            let effectiveTo = toDate;
            if (date && date.trim() !== '') {
                effectiveFrom = date;
                effectiveTo = date;
            }

            const filters = {
                userId: req.user._id,
                customerVendor, // Pass raw (could be string or array)
                fromDate: effectiveFrom,
                toDate: effectiveTo,
                staffId,
                showAllDocuments
            };

            const result = await DayBookReportModel.getDayBookReport(filters);

            if (!result.success) {
                return res.status(500).json(result);
            }

            let data = result.data;
            let summary = {
                totalCredit: 0,
                totalDebit: 0,
                netBalance: 0
            };

            // Calculate global summary
            data.forEach(item => {
                if (item.type === 'Credit') summary.totalCredit += item.amount;
                if (item.type === 'Debit') summary.totalDebit += item.amount;
            });
            summary.netBalance = summary.totalCredit - summary.totalDebit;

            // Grouping Logic
            let finalData = data;

            if (groupByCustomer) {
                const groups = {};
                data.forEach(item => {
                    const key = item.partyName || 'Unknown';
                    if (!groups[key]) {
                        groups[key] = {
                            name: key,
                            totalAmount: 0,
                            records: []
                        };
                    }
                    groups[key].records.push(item);
                    groups[key].totalAmount += item.amount; // Just Summing amounts regardless of Dr/Cr for sorting/display? 
                    // Usually DayBook grouping shows balance per customer. keeping simplistic sum for now or just listing.
                });
                finalData = Object.values(groups);
            } else if (groupByVoucherType) {
                const groups = {};
                data.forEach(item => {
                    const key = item.voucherType;
                    if (!groups[key]) {
                        groups[key] = {
                            voucherType: key,
                            totalAmount: 0,
                            records: []
                        };
                    }
                    groups[key].records.push(item);
                    groups[key].totalAmount += item.amount;
                });
                finalData = Object.values(groups);
            }

            // Pagination could be applied here if needed, but grouping makes pagination tricky (usually pagination is on groups or infinite scroll).
            // For report, returning full dataset is often acceptable if filtered by date.

            res.status(200).json({
                success: true,
                data: finalData,
                summary: summary
            });

        } catch (error) {
            console.error('DayBookReportController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }
}

module.exports = DayBookReportController;
