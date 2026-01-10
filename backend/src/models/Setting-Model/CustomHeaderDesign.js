const mongoose = require('mongoose');

const customHeaderDesignSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    // Flexible structure for layout, variant, and layers
    layout_type: { type: String, default: 'default' },
    design_variant: { type: String, default: 'standard' },
    header_height: { type: Number, default: 100 }, // Default height

    // Options for standard elements
    options: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
        // Example: { show_pan: true, show_invoice_title: true, copy_label: "ORIGINAL" }
    },

    // Configurations map for separate document types
    configurations: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Array of layer objects
    layers: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },

    // Catch-all for other design properties if needed
    settings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }

}, {
    timestamps: true,
    minimize: false // Ensure empty arrays/objects are saved
});

module.exports = mongoose.model('CustomHeaderDesign', customHeaderDesignSchema);
