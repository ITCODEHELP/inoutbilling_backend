const mongoose = require('mongoose');
require('dotenv').config();

const verifyFix = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const collection = mongoose.connection.db.collection('hsn_codes');

        // Test with known existing code "99 90"
        // Input: "9990" -> Regex: 9\s*9\s*9\s*0
        const code = "9990";
        const robustRegex = new RegExp(`(^|[^0-9])${code.split('').join('\\s*')}([^0-9]|$)`);

        console.log(`Searching for code: "${code}" with regex: ${robustRegex}`);

        const taxData = await collection.findOne({
            "Chapter / Heading /": { $regex: robustRegex }
        });

        if (taxData) {
            console.log("SUCCESS: Found Match for 9990!");
            console.log("Matched ID:", taxData._id);
            console.log("Chapter / Heading /:", taxData["Chapter / Heading /"]);
        } else {
            console.log("FAILURE: No Match for 9990 either.");
            // Dump the known doc to see why
            const known = await collection.findOne({ "Chapter / Heading /": { $regex: "99 90" } });
            if (known) console.log("BUT '99 90' exists:", known["Chapter / Heading /"]);
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
    }
};

verifyFix();
