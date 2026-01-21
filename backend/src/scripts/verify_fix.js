const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

// We can't easily run axios against the running server without auth token.
// Instead, we will mock the controller logic directly in a standalone script 
// that connects to DB, to verify the Regex portion.
// This is faster and avoids auth/server dependency issues.

const verifyFix = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const collection = mongoose.connection.db.collection('hsn_codes');
        const code = "9954";
        const robustRegex = new RegExp(`(^|[^0-9])${code.split('').join('\\s*')}([^0-9]|$)`);

        console.log(`Searching for code: "${code}" with regex: ${robustRegex}`);

        const taxData = await collection.findOne({
            "Chapter / Heading /": { $regex: robustRegex }
        });

        if (taxData) {
            console.log("SUCCESS: Found Match!");
            console.log("Matched ID:", taxData._id);
            console.log("Chapter / Heading /:", taxData["Chapter / Heading /"]);

            const cgst = Number(taxData["CGST Rate (%)"] || 0) * 100;
            const igst = Number(taxData["IGST Rate (%)"] || 0) * 100;
            console.log(`Resolved Tax: CGST=${cgst}%, IGST=${igst}%`);
        } else {
            console.log("FAILURE: No Match Found.");
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
    }
};

verifyFix();
