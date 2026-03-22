"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.answerStudentQuestion = answerStudentQuestion;
exports.sahayakSummarizeChat = sahayakSummarizeChat;
exports.sahayakAnswerFromHistory = sahayakAnswerFromHistory;
/**
 * Student AI assistant — uses OpenAI when OPENAI_API_KEY is set, else returns a helpful Hinglish fallback.
 */
async function answerStudentQuestion(question, context) {
    const key = process.env.OPENAI_API_KEY;
    const sys = `You are a friendly study assistant for Indian college students. Reply in Hinglish (mix Hindi + English) when natural. Be concise. Help with DSA, coding, and placement tips. No harmful content.`;
    if (key) {
        try {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${key}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                    messages: [
                        { role: "system", content: sys },
                        ...(context ? [{ role: "user", content: `Channel context: ${context.slice(0, 500)}` }] : []),
                        { role: "user", content: question.slice(0, 4000) },
                    ],
                    max_tokens: 800,
                    temperature: 0.6,
                }),
            });
            if (!res.ok) {
                const err = await res.text();
                console.error("OpenAI error", res.status, err);
                return fallbackAnswer(question);
            }
            const data = (await res.json());
            const text = data.choices?.[0]?.message?.content?.trim();
            return text || fallbackAnswer(question);
        }
        catch (e) {
            console.error(e);
            return fallbackAnswer(question);
        }
    }
    return fallbackAnswer(question);
}
const SAHAYAK_SYSTEM = `You are **Sahayak AI**, a helpful assistant inside a Discord-style study server for Indian college students.
- Reply in **Hinglish** (natural mix of Hindi and English) unless the user asks otherwise.
- Be concise, friendly, and accurate. No harmful or exam-cheating content.
- When summarizing chat, use bullet points where helpful and mention key names/topics.`;
const MAX_TRANSCRIPT_CHARS = 48_000;
function clipTranscript(t) {
    if (t.length <= MAX_TRANSCRIPT_CHARS)
        return t;
    return `${t.slice(0, MAX_TRANSCRIPT_CHARS)}\n\n... (baaki history trim ho gayi — zyada lamba tha)`;
}
async function openaiChat(system, userContent) {
    const key = process.env.OPENAI_API_KEY;
    if (!key)
        return "";
    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: userContent.slice(0, 120_000) },
                ],
                max_tokens: 1200,
                temperature: 0.55,
            }),
        });
        const raw = await res.text();
        if (!res.ok) {
            console.error("OpenAI Sahayak error", res.status, raw);
            return "";
        }
        const data = JSON.parse(raw);
        return data.choices?.[0]?.message?.content?.trim() || "";
    }
    catch (e) {
        console.error("OpenAI Sahayak fetch failed", e);
        return "";
    }
}
/** Summarize last N messages (transcript already formatted). */
async function sahayakSummarizeChat(transcript) {
    const clipped = clipTranscript(transcript);
    const userBlock = `Here is the last part of the channel chat (newest at bottom). Summarize for busy students:\n\n${clipped}`;
    const key = process.env.OPENAI_API_KEY;
    if (key) {
        const text = await openaiChat(`${SAHAYAK_SYSTEM}\nYour task now: summarize the conversation clearly in Hinglish.`, userBlock);
        if (text)
            return text;
    }
    const lines = clipped.split("\n").filter(Boolean).slice(-8);
    return `**Quick summary (offline):** Recent baat-cheet mein ye points the:\n${lines.map((l) => `• ${l.slice(0, 160)}`).join("\n")}\n\nPoora AI summary ke liye \`OPENAI_API_KEY\` server .env mein lagao.`;
}
/** Answer using up to last 100 messages as transcript + user question. */
async function sahayakAnswerFromHistory(transcript, question) {
    const clipped = clipTranscript(transcript);
    const userBlock = `Chat history (oldest to newest):\n${clipped}\n\n---\nUser question:\n${question.slice(0, 8000)}`;
    const key = process.env.OPENAI_API_KEY;
    if (key) {
        const text = await openaiChat(`${SAHAYAK_SYSTEM}\nUse the chat history when relevant. If the answer is not in history, still help with general knowledge appropriate for students.`, userBlock);
        if (text)
            return text;
    }
    return `**Sahayak (demo):** History dekh li — "${question.slice(0, 100)}${question.length > 100 ? "…" : ""}"\n\nPoora jawab ke liye OpenAI key set karo. Filhaal: channel pe specific doubt likho, seniors help karenge.`;
}
function fallbackAnswer(q) {
    const lower = q.toLowerCase();
    if (/dsa|leetcode|tree|graph|array|complexity|o\(n\)/.test(lower)) {
        return `🤖 **Quick tip (offline mode):** DSA mein pehle problem ko clearly likho, brute force socho, phir time/space optimize karo. Agar specific question ho to example de kar poochho — ya \`OPENAI_API_KEY\` server .env mein lagao for full AI answers.`;
    }
    if (/placement|interview|resume|company/.test(lower)) {
        return `🤖 **Placement prep:** STAR format mein stories ready rakho, CS fundamentals revise karo, 2–3 good projects explain karne practice karo. Company-specific prep ke liye channel mein tag use karo (e.g. Amazon). Full AI: add OpenAI key to server.`;
    }
    if (/code|error|bug|syntax/.test(lower)) {
        return `🤖 **Code help:** Error message poora paste karo, expected vs actual batao. Stack trace se line number check karo. Server par AI enable karne ke liye \`OPENAI_API_KEY\` set karo.`;
    }
    return `🤖 Main abhi **demo mode** mein hoon — chhota sa jawab: padhai consistent rakho, doubts channel pe poochho, notes share karo. Detailed AI ke liye server .env mein \`OPENAI_API_KEY\` add karo. Tumhara sawaal: "${q.slice(0, 120)}${q.length > 120 ? "…" : ""}"`;
}
