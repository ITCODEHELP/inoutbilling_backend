const mongoose = require('mongoose');

const additionalChargeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Additional Charge Name is required']
    },
    productNote: {
        type: String
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        default: 0
    },
    hsnSacCode: {
        type: String,
        required: [true, 'HSN/SAC Code is required']
    },
    noITC: {
        type: Boolean,
        default: false
    },
    tax: {
        type: Number,
        required: [true, 'Tax rate is required'],
        default: 0
    },
    isServiceItem: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Compound index for duplicate check: name + hsnSacCode per user
additionalChargeSchema.index({ userId: 1, name: 1, hsnSacCode: 1 });

module.exports = mongoose.model('AdditionalCharge', additionalChargeSchema);
