const mongoose = require('mongoose');

const creditPackSchema = new mongoose.Schema({
    name: { type: String, required: true },
    credits: { type: Number, required: true },
    price: { type: Number, required: true },
    gstPercentage: { type: Number, default: 18 },
    packType: { type: String, enum: ['FREE', 'PAID'], default: 'PAID' },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
}, { timestamps: true });

module.exports = mongoose.model('CreditPack', creditPackSchema);
