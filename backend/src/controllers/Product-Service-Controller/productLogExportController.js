const Product = require('../../models/Product-Service-Model/Product');
const ExcelJS = require('exceljs');

/**
 * @desc    Export Product Log to Excel with Filters
 * @route   GET /api/products/export-log
 * @access  Private
 */
const exportProductLog = async (req, res) => {
    try {
        const {
            search,
            productGroup,
            itemType,
            stockStatus,
            fromDate,
            toDate,
            inventoryType
        } = req.query;

        // Build Query
        let query = { userId: req.user._id };

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        if (productGroup) {
            query.productGroup = { $regex: productGroup, $options: 'i' };
        }

        if (itemType) {
            query.itemType = itemType;
        }

        if (inventoryType) {
            query.inventoryType = inventoryType;
        }

        // Stock Status Logic
        if (stockStatus) {
            if (stockStatus === 'Negative Stock') {
                query.availableQuantity = { $lt: 0 };
            } else if (stockStatus === 'Out of Stock') {
                query.availableQuantity = { $eq: 0 };
            } else if (stockStatus === 'In Stock') {
                query.availableQuantity = { $gt: 0 };
            } else if (stockStatus === 'Low Stock') {
                query.$and = query.$and || [];
                query.$and.push(
                    { availableQuantity: { $gt: 0 } },
                    { $expr: { $lte: ["$availableQuantity", "$lowStockAlert"] } }
                );
            }
        }

        // Date Range (based on createdAt)
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }

        const products = await Product.find(query).sort({ createdAt: -1 });

        // Generate Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Product Log');

        // Define Columns
        worksheet.columns = [
            { header: 'Item Name', key: 'name', width: 30 },
            { header: 'Item Type', key: 'itemType', width: 15 },
            { header: 'Inventory Type', key: 'inventoryType', width: 15 },
            { header: 'Barcode', key: 'barcodeNumber', width: 20 },
            { header: 'HSN/SAC', key: 'hsnSac', width: 15 },
            { header: 'Unit', key: 'unitOfMeasurement', width: 10 },
            { header: 'Tax %', key: 'taxSelection', width: 10 },
            { header: 'Cess %', key: 'cessPercent', width: 10 },
            { header: 'Cess Amount', key: 'cessAmount', width: 12 },
            { header: 'Fixed/No ITC', key: 'fixedNoItcFlag', width: 15 },
            { header: 'Available Qty', key: 'availableQuantity', width: 15 },
            { header: 'Low Stock Alert', key: 'lowStockAlert', width: 15 },
            { header: 'Sell Price', key: 'sellPrice', width: 15 },
            { header: 'Purchase Price', key: 'purchasePrice', width: 15 },
            { header: 'Product Group', key: 'productGroup', width: 20 },
            { header: 'Created Date', key: 'createdAt', width: 20 }
        ];

        // Style header
        worksheet.getRow(1).font = { bold: true };

        // Add Data
        const rows = products.map(p => ({
            name: p.name,
            itemType: p.itemType,
            inventoryType: p.inventoryType || 'Normal',
            barcodeNumber: p.barcodeNumber || '-',
            hsnSac: p.hsnSac || '-',
            unitOfMeasurement: p.unitOfMeasurement || '-',
            taxSelection: p.taxSelection,
            cessPercent: p.cessPercent,
            cessAmount: p.cessAmount,
            fixedNoItcFlag: p.fixedNoItcFlag ? 'Yes' : 'No',
            availableQuantity: p.availableQuantity,
            lowStockAlert: p.lowStockAlert,
            sellPrice: p.sellPrice,
            purchasePrice: p.purchasePrice,
            productGroup: p.productGroup || '-',
            createdAt: p.createdAt ? p.createdAt.toISOString().split('T')[0] : '-'
        }));

        worksheet.addRows(rows);

        // Send response
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=Product_Log.xlsx'
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export Product Log Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = { exportProductLog };
