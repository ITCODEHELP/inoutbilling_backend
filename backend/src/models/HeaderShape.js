const mongoose = require('mongoose');

const headerShapeSchema = new mongoose.Schema({
    shape_id: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        default: 'Basic' // e.g., Basic, Icons, Logos
    },
    type: {
        type: String, // e.g., 'shapes', 'small-shapes'
        default: 'shapes'
    },
    thumbnail_url: {
        type: String,
        required: true
    },
    svg_url: {
        type: String,
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('HeaderShape', headerShapeSchema);
