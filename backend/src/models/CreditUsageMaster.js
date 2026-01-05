const mongoose = require('mongoose');

const creditUsageMasterSchema = new mongoose.Schema({
    actionName: { type: String, required: true, unique: true },
    creditCost: { type: Number, required: true },
    description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('CreditUsageMaster', creditUsageMasterSchema);
