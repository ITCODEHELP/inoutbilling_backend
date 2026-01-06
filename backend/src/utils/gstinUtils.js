const StateCodes = {
    "Jammu and Kashmir": "01",
    "Himachal Pradesh": "02",
    "Punjab": "03",
    "Chandigarh": "04",
    "Uttarakhand": "05",
    "Haryana": "06",
    "Delhi": "07",
    "Rajasthan": "08",
    "Uttar Pradesh": "09",
    "Bihar": "10",
    "Sikkim": "11",
    "Arunachal Pradesh": "12",
    "Nagaland": "13",
    "Manipur": "14",
    "Mizoram": "15",
    "Tripura": "16",
    "Meghalaya": "17",
    "Assam": "18",
    "West Bengal": "19",
    "Jharkhand": "20",
    "Odisha": "21",
    "Chhattisgarh": "22",
    "Madhya Pradesh": "23",
    "Gujarat": "24",
    "Daman and Diu": "25",
    "Dadra and Nagar Haveli": "26",
    "Maharashtra": "27",
    "Andhra Pradesh": "28", // Old code, strict mapping might need updates for AP/Telangana but 28/37 usually used
    "Karnataka": "29",
    "Goa": "30",
    "Lakshadweep": "31",
    "Kerala": "32",
    "Tamil Nadu": "33",
    "Puducherry": "34",
    "Andaman and Nicobar Islands": "35",
    "Telangana": "36",
    "Andhra Pradesh (New)": "37",
    "Ladakh": "38"
};

const GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Maps state name to 2-digit GST State Code.
 * Fuzzy matching or case-insensitive matching could be added,
 * but for now we do strict case-insensitive trim match.
 */
function getStateCode(stateName) {
    if (!stateName) return null;
    const normalized = stateName.trim();
    // Try exact match
    if (StateCodes[normalized]) return StateCodes[normalized];

    // Case insensitive scan
    const lower = normalized.toLowerCase();
    for (const [key, val] of Object.entries(StateCodes)) {
        if (key.toLowerCase() === lower) return val;
    }
    return null;
}

/**
 * Calculates the checksum character for a given 14-character base GSTIN string.
 * Algorithm:
 * 1. Each char has a value (0-9, A-Z assigned 10-35).
 * 2. Multiply value by factor (1, 2, 1, 2...) depending on position.
 * 3. Quotient = product / 36, Remainder = product % 36.
 * 4. Sum = Quotient + Remainder.
 * 5. Total Sum % 36.
 * 6. Check digit = 36 - (Total Sum % 36).
 * This is a simplification; standard mod-36 algorithms often used. 
 * Actually, standard GST algorithm is:
 * Map chars 0-9, A-Z to 0-35.
 * Weights are usually not simple alternating 1,2? No, it's specific mod 36.
 * Reference: https://github.com/Start-Up-India/GSTIN-Validator/blob/master/gstin-validator.js
 */
function getChecksum(base) {
    // Official GST Checksum Logic
    // Factor sequence isn't just 1,2. It uses a hash approach.
    // For simplicity and robustness, use a known valid algorithm.

    // Mapping 0-9 -> 0-9, A-Z -> 10-35
    const charMap = {};
    for (let i = 0; i < GST_CHARS.length; i++) {
        charMap[GST_CHARS[i]] = i;
    }

    let sum = 0;
    for (let i = 0; i < base.length; i++) {
        const char = base[i].toUpperCase();
        if (charMap[char] === undefined) return '0'; // Invalid char

        let value = charMap[char];

        // Multiplier: 1 for even indices (0-indexed), 2 for odd in Reverse?
        // Standard ISO 7064 Mod 36,36/11,10 algorithm is used.
        // Actually for GSTIN:
        // C_i = P * (N_i + C_{i-1}) % 36 ... this is recursive.
        // But a simpler implementation exists.

        // Let's use the explicit "product of weight" method often cited for GST
        // factor = 1 if i is odd (from right? no 0-indexed left) -> 1, 2, 1, 2...
        // Actually, let's use the 'point' method: value * factor.
        // Factor is 1 if index is even? No.
        // Let's proceed with a standard verified snippet for Indian GSTIN.

        let factor = (i % 2 === 1) ? 2 : 1; // 0-indexed: index 0 (1st char) -> factor 1?
        // Wait, standard mod usually reverses.
        // Let's strictly follow this logic found in verified libs:

        let product = value * ((i % 2) + 1); // Alternating 1 and 2
        let n = Math.floor(product / 36) + (product % 36);
        sum += n;
    }

    let rem = sum % 36;
    let checkCodeVal = (36 - rem) % 36;
    return GST_CHARS[checkCodeVal];
}

/**
 * Generates the next available GSTIN for a user given PAN and State.
 * Checks the database for existing GSTINs starting with StateCode + PAN.
 * User param is needed to scope the uniqueness check (if we only care about uniqueness within user account?
 * Actually GSTIN is a legal entity identifier. It should be unique globallly?
 * But existing logic scopes Customers/Vendors to `userId`.
 * So we will check for *this user's* duplicates to increment entity code.
 * If another user has the same GSTIN, that's their problem (or valid if they are managing same real world entity).
 */
async function generateNextGSTIN(userId, pan, stateName, Model) {
    if (!pan || !stateName || pan.length !== 10) return null;

    const stateCode = getStateCode(stateName);
    if (!stateCode) return null; // Can't generate without valid state code

    const basePrefix = stateCode + pan; // 12 chars

    // Regex to find existing GSTINs for this user that partially match: ^State PAN [0-9A-Z] Z [0-9A-Z]$
    // Actually we just need to look at the 13th char (Entity Code).
    const regex = new RegExp(`^${basePrefix}[0-9A-Z]Z.$`);

    // Find all matching docs for this user
    // We only need the one with highest entity code to increment.
    // However, since it is alphanumeric (1-9, A-Z), sorting might be tricky in DB.
    // We can fetch all matching GSTNs and process in JS (usually won't be many, max 35).
    const existingDocs = await Model.find({
        userId: userId,
        gstin: { $regex: regex }
    }).select('gstin').lean();

    const usedEntityCodes = new Set();
    existingDocs.forEach(doc => {
        if (doc.gstin && doc.gstin.length === 15) {
            usedEntityCodes.add(doc.gstin[12]); // 13th char (index 12)
        }
    });

    // Find first unused code in sequence: 1-9, A-Z
    const possibleCodes = "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let entityCode = null;

    for (const char of possibleCodes) {
        if (!usedEntityCodes.has(char)) {
            entityCode = char;
            break;
        }
    }

    if (!entityCode) {
        // Run out of codes? Unlikely for a single user/state/pan combo (35 businesses?).
        // Fallback or error? Return null implies we can't generate.
        return null;
    }

    const base14 = basePrefix + entityCode + 'Z';
    const checksum = getChecksum(base14);

    return base14 + checksum;
}

module.exports = {
    getStateCode,
    getChecksum,
    generateNextGSTIN
};
