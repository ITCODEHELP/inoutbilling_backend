/**
 * @desc    Get Available Header Shapes
 * @route   GET /api/header-shapes
 * @access  Private (or Public)
 */
const HeaderShape = require('../models/HeaderShape');

/**
 * @desc    Get Available Header Shapes
 * @route   GET /api/header-shapes
 * @access  Private (or Public)
 */
const getHeaderShapes = async (req, res) => {
    try {
        // 1. Seed if empty (Transition from static to dynamic)
        const count = await HeaderShape.countDocuments();
        if (count === 0) {
            const initialShapes = [
                {
                    shape_id: "shape_rect_1",
                    name: "Rectangle",
                    category: "Basic",
                    type: "shapes",
                    thumbnail_url: "https://placehold.co/40x40?text=Rect",
                    svg_url: "https://placehold.co/100x100?text=Rect"
                },
                {
                    shape_id: "shape_circle_1",
                    name: "Circle",
                    category: "Basic",
                    type: "shapes",
                    thumbnail_url: "https://placehold.co/40x40?text=Circ",
                    svg_url: "https://placehold.co/100x100?text=Circ"
                },
                {
                    shape_id: "icon_phone",
                    name: "Phone Icon",
                    category: "Icons",
                    type: "shapes",
                    thumbnail_url: "https://placehold.co/40x40?text=Phone",
                    svg_url: "https://placehold.co/100x100?text=Phone"
                },
                {
                    shape_id: "icon_email",
                    name: "Email Icon",
                    category: "Icons", // Case-sensitive or handle consistent casing
                    type: "shapes",
                    thumbnail_url: "https://placehold.co/40x40?text=Email",
                    svg_url: "https://placehold.co/100x100?text=Email"
                }
            ];
            await HeaderShape.insertMany(initialShapes);
        }

        // 2. Build Query
        const { search, category, type, limit, offset } = req.query;
        let query = { is_active: true };

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        if (category) {
            query.category = category;
        }
        if (type) {
            query.type = type;
        }

        // 3. Execute Query with Pagination
        const pageSize = parseInt(limit) || 20;
        const pageOffset = parseInt(offset) || 0;

        const shapes = await HeaderShape.find(query)
            .skip(pageOffset)
            .limit(pageSize)
            .select('shape_id name category thumbnail_url svg_url -_id'); // Exclude _id, include specific fields

        // Get total filtered count (not just page size)
        const totalCount = await HeaderShape.countDocuments(query);

        res.status(200).json({
            success: true,
            count: totalCount,
            data: shapes
        });

    } catch (error) {
        console.error("Error fetching header shapes:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

module.exports = {
    getHeaderShapes
};
