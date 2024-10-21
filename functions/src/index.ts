import {onRequest} from "firebase-functions/v2/https";
import * as cors from "cors";
import * as admin from "firebase-admin";
import { Groq } from "groq-sdk";
import { Card } from "./Card";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "isrs-564a5",
});

const db = admin.firestore();
const corsHandler = cors({origin: true});

async function getSentence(language: string, word: string): Promise<string> {
  const client = new Groq({
    apiKey: "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",
  });

  const chatCompletion = await client.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `Please provide exactly one simple and concise sentence in '${language}' that includes the word '${word}'. Ensure the sentence is easy to understand and does not contain any extra explanations or examples.`,
      },
    ],
    model: "llama3-8b-8192",
  });
  return chatCompletion.choices[0].message.content ?? "";
}

export const addDocument = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const {deckName, cards, creationDate} = req.body;

      if (!deckName || !Array.isArray(cards) || !creationDate) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newDeck = {
        deckName: deckName,
        cards: cards,
        creationDate: new Date(creationDate),
      };

      console.log("Attempting to add document: ", newDeck);
      const docRef = await db.collection("Deck").add(newDeck);
      console.log("Document added successfully with ID: ", docRef.id);

      return res.status(200).send(`Document created with ID: ${docRef.id}`);
    } catch (error) {
      const typedError = error as Error;
      console.error("Error adding document: ", typedError.message);
      return res.status(500).send("Internal Server Error");
    }
  });
});

export const getDecks = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "GET") {
        return res.status(405).send("Method Not Allowed, use GET");
      }

      const deckId = req.query.deckId as string;

      if (deckId) {
        const docRef = db.collection("Deck").doc(deckId);
        const docSnapshot = await docRef.get();

        if (!docSnapshot.exists) {
          return res.status(404).send("Deck not found");
        }

        return res.status(200).json(docSnapshot.data());
      }

      const querySnapshot = await db.collection("Deck").get();
      const decks = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return res.status(200).json(decks);
    } catch (error) {
      console.error("Error retrieving decks: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

export const addDeck = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const {
        userId,
        name,
        description,
        tags,
        isShared,
        sharedWith,
        isAiGenerated,
      } = req.body;

      if (!userId || !name || !description || !Array.isArray(tags)) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newDeck = {
        userId,
        name,
        description,
        tags,
        isShared: isShared || false,
        sharedWith: sharedWith || [],
        isAiGenerated: isAiGenerated || false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("Deck").add(newDeck);
      return res.status(200).send(`Deck created with ID: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding deck: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

export const addCard = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const {
        userId,
        deckId,
        word,
        language,
      } = req.body;

      if (!deckId || !word || !language || !userId) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const sentence = await getSentence(language, word);
      const newCard = new Card(deckId, word, language, sentence);

      const docRef = await db.collection(userId).doc(deckId).collection(newCard.word).add({
        deckId: newCard.deckId,
        word: newCard.word,
        sentence: newCard.sentence,
        language: newCard.language,
        level: newCard.level,
        createdAt: newCard.createdAt,
        nextReviewAt: newCard.nextReviewAt,
        lastReviewedAt: newCard.lastReviewedAt,
      })
      return res.status(200).send(`Card created with ID: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding card: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});


export const addStudySession = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const {
        userId,
        deckId,
        startTime,
        endTime,
        cardsReviewed,
        totalCorrect,
        totalIncorrect,
      } = req.body;

      if (
        !userId ||
        !deckId ||
        !startTime ||
        !endTime ||
        !Array.isArray(cardsReviewed)
      ) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newSession = {
        userId,
        deckId,
        startTime: admin.firestore.Timestamp.fromDate(new Date(startTime)),
        endTime: admin.firestore.Timestamp.fromDate(new Date(endTime)),
        cardsReviewed,
        totalCorrect,
        totalIncorrect,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("study_sessions").add(newSession);
      return res.status(200).send(`Study session created: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding study session: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

export const getStudySessions = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const userId = req.query.userId as string;

      if (!userId) {
        return res.status(400).send("Bad Request: Missing userId.");
      }

      const querySnapshot = await db
        .collection("study_sessions")
        .where("userId", "==", userId)
        .get();
      const sessions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return res.status(200).json(sessions);
    } catch (error) {
      console.error("Error retrieving study sessions: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

export const addAIRequest = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const {userId, inputWord, generatedDeckId, status} = req.body;

      if (!userId || !inputWord || !generatedDeckId || !status) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newRequest = {
        userId,
        inputWord,
        generatedDeckId,
        status,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("ai_requests").add(newRequest);
      return res.status(200).send(`AI request created with ID: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding AI request: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

export const addNotification = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const {userId, type, message, isRead, scheduledFor} = req.body;

      if (!userId || !type || !message) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newNotification = {
        userId,
        type,
        message,
        isRead: isRead || false,
        scheduledFor: scheduledFor ?
          admin.firestore.Timestamp.fromDate(new Date(scheduledFor)) :
          null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("notifications").add(newNotification);
      return res.status(200).send(`Notification created with ID: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding notification: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

export const addAnalytics = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const {userId, data} = req.body;

      if (!userId || !Array.isArray(data)) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newAnalytics = {
        userId,
        data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("analytics").add(newAnalytics);
      return res.status(200).send(`Analytics data created: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding analytics data: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

export const addSharedDeck = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const {
        deckId,
        sharedByUserId,
        sharedToUserIds,
        accessLevel,
      } = req.body;

      if (
        !deckId ||
        !sharedByUserId ||
        !Array.isArray(sharedToUserIds) ||
        !accessLevel
      ) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newSharedDeck = {
        deckId,
        sharedByUserId,
        sharedToUserIds,
        accessLevel,
        sharedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("shared_decks").add(newSharedDeck);
      return res.status(200).send(`Shared deck created with ID: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding shared deck: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});
