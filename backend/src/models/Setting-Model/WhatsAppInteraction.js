const mongoose = require('mongoose');

const whatsappInteractionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    sourcePage: {
        type: String,
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'whatsapp_interactions'
});

module.exports = mongoose.model('WhatsAppInteraction', whatsappInteractionSchema);
