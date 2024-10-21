import * as admin from "firebase-admin";
class Card{
    deckId: string;
    word: string;
    sentence: string;
    language: string;
    level: number;
    createdAt: admin.firestore.FieldValue;
    nextReviewAt: admin.firestore.FieldValue;
    lastReviewedAt: admin.firestore.FieldValue;
    constructor(deckId: string, word: string, language: string, sentence: string){
        const now = new Date();
        this.deckId = deckId;
        this.word = word;
        this.sentence = sentence;
        this.language = language;
        this.level = 1;
        this.createdAt = now;
        this.nextReviewAt = now.setDate(now.getDate() + 1);
        this.lastReviewedAt = NaN;
    }
}
export { Card };