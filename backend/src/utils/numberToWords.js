/**
 * Robust Number to Words conversion (Indian System)
 * Converts a numeric amount into Indian currency words.
 * Example: 11800 -> "Rupees Eleven Thousand Eight Hundred Only"
 */
const numberToWords = (num) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n) => {
        if ((n = n.toString()).length > 9) return 'overflow';
        let nArray = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!nArray) return '';
        let str = '';
        str += (Number(nArray[1]) !== 0) ? (a[Number(nArray[1])] || b[nArray[1][0]] + ' ' + a[nArray[1][1]]) + 'Crore ' : '';
        str += (Number(nArray[2]) !== 0) ? (a[Number(nArray[2])] || b[nArray[2][0]] + ' ' + a[nArray[2][1]]) + 'Lakh ' : '';
        str += (Number(nArray[3]) !== 0) ? (a[Number(nArray[3])] || b[nArray[3][0]] + ' ' + a[nArray[3][1]]) + 'Thousand ' : '';
        str += (Number(nArray[4]) !== 0) ? (a[Number(nArray[4])] || b[nArray[4][0]] + ' ' + a[nArray[4][1]]) + 'Hundred ' : '';
        str += (Number(nArray[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(nArray[5])] || b[nArray[5][0]] + ' ' + a[nArray[5][1]]) : '';
        return str.trim();
    };

    const amount = Math.floor(Math.abs(num));
    const words = inWords(amount);
    return words ? `Rupees ${words} Only` : 'Rupees Zero Only';
};

/**
 * Number to Words with Currency Support
 * Converts a numeric amount into currency words based on currency code
 * @param {number} num - The numeric amount
 * @param {string} currencyCode - Currency code (e.g., 'AED', 'USD', 'INR')
 * @returns {string} - Currency amount in words
 */
const numberToWordsWithCurrency = (num, currencyCode = 'INR') => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n) => {
        if ((n = n.toString()).length > 9) return 'overflow';
        let nArray = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!nArray) return '';
        let str = '';
        str += (Number(nArray[1]) !== 0) ? (a[Number(nArray[1])] || b[nArray[1][0]] + ' ' + a[nArray[1][1]]) + 'Crore ' : '';
        str += (Number(nArray[2]) !== 0) ? (a[Number(nArray[2])] || b[nArray[2][0]] + ' ' + a[nArray[2][1]]) + 'Lakh ' : '';
        str += (Number(nArray[3]) !== 0) ? (a[Number(nArray[3])] || b[nArray[3][0]] + ' ' + a[nArray[3][1]]) + 'Thousand ' : '';
        str += (Number(nArray[4]) !== 0) ? (a[Number(nArray[4])] || b[nArray[4][0]] + ' ' + a[nArray[4][1]]) + 'Hundred ' : '';
        str += (Number(nArray[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(nArray[5])] || b[nArray[5][0]] + ' ' + a[nArray[5][1]]) : '';
        return str.trim();
    };

    const currencyMap = {
        'INR': { singular: 'Rupee', plural: 'Rupees' },
        'AED': { singular: 'Dirham', plural: 'Dirhams' },
        'USD': { singular: 'Dollar', plural: 'Dollars' },
        'EUR': { singular: 'Euro', plural: 'Euros' },
        'GBP': { singular: 'Pound', plural: 'Pounds' },
        'SAR': { singular: 'Riyal', plural: 'Riyals' }
    };

    const currency = currencyMap[currencyCode.toUpperCase()] || currencyMap['INR'];
    const amount = Math.floor(Math.abs(num));
    const words = inWords(amount);
    const currencyWord = amount === 1 ? currency.singular : currency.plural;
    return words ? `${currencyWord} ${words} Only` : `${currencyWord} Zero Only`;
};

module.exports = numberToWords;
module.exports.numberToWordsWithCurrency = numberToWordsWithCurrency;
