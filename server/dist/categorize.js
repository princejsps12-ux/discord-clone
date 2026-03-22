"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferMessageCategory = inferMessageCategory;
exports.extractCompanyTags = extractCompanyTags;
function inferMessageCategory(text) {
    const t = text.toLowerCase();
    if (/placement|interview|amazon|google|microsoft|meta|flipkart|razorpay|salary|offer|lpa|resume|hr round|oa\b|online assessment|leetcode premium|company/.test(t)) {
        return "PLACEMENT";
    }
    if (/dsa|leetcode|gfg|codeforces|assignment|exam|class|notes|study|tutorial|complexity|algorithm|tree|graph|dp\b/.test(t)) {
        return "STUDY";
    }
    if (/lol|😂|😭|match|cricket|movie|chai|party|hostel|mess|bunk/.test(t)) {
        return "CASUAL";
    }
    return "UNCATEGORIZED";
}
function extractCompanyTags(text) {
    const companies = [
        "Amazon",
        "Google",
        "Microsoft",
        "Meta",
        "Flipkart",
        "Adobe",
        "Oracle",
        "Uber",
        "Atlassian",
        "Goldman",
        "JPMC",
        "Samsung",
        "Infosys",
        "TCS",
        "Wipro",
    ];
    const found = new Set();
    const lower = text.toLowerCase();
    for (const c of companies) {
        if (lower.includes(c.toLowerCase()))
            found.add(c);
    }
    return [...found];
}
