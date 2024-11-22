class Card{
    deckId: string;
    word: string;
    sentence: string;
    language: string;
    level: number;
    createdAt: Date;
    nextReviewAt: Date;
    lastReviewedAt: Date;
    constructor(deckId: string, word: string, language: string, sentence: string){
        const now = new Date();
        this.deckId = deckId;
        this.word = word;
        this.sentence = sentence;
        this.language = language;
        this.level = 1;
        this.createdAt = now;
        this.nextReviewAt = new Date(now.setDate(now.getDate() + 1));
        this.lastReviewedAt = now;
    }
}
export { Card };