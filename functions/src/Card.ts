/**
 * Represents a card in a deck.
 * @class
 * @property {string} deckId - The ID of the deck the card belongs to.
 * @property {string} word - The word on the card.
 * @property {string} sentence - The sentence containing the word.
 * @property {string} language - The language of the sentence.
 * @property {number} level - The level of the card.
 * @property {Date} createdAt - The date the card was created.
 * @property {Date} nextReviewAt - The date the card should be reviewed next.
 * @property {Date} lastReviewedAt - The date the card was last reviewed.
 */
class Card {
  deckId: string;
  word: string;
  sentence: string;
  language: string;
  level: number;
  createdAt: Date;
  nextReviewAt: Date;
  lastReviewedAt: Date;
  /**
 * Retrieves a sentence containing the specified word in the given.
 * @param {string} deckId - The language of the sentence.
 * @param {string} word - The word to include in the sentence.
 * @param {string} language - The language of the sentence.
 * @param {string} sentence - The sentence to include the word in.
 */
  constructor(deckId: string, word: string, language: string,
    sentence: string) {
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
export {Card};
