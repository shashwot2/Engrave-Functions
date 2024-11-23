import {CallableRequest, onRequest} from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import * as cors from "cors";
import * as admin from "firebase-admin";
import {Groq} from "groq-sdk";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "isrs-564a5",
});

interface UserPreferences {
  motivation?: string;
  proficiencyLevel?: string;
  learningStyle?: string;
  studyPattern?: string;
  notifications?: boolean;
}
interface SavePreferencesData {
  preferences: UserPreferences;
}


const db = admin.firestore();
const corsHandler = cors({origin: true});


/**
 * Retrieves a random word from the Words API.
 * @param {string} language - The language of the word to retrieve.
 * @param {string} word - The word to include in the sentence.
 * @return {Promise<string>} A promise that resolves to a random word.
 * */
async function getSentence(language: string, word: string): Promise<string> {
  const client = new Groq({
    apiKey: "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",
  });

  const chatCompletion = await client.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `Please provide exactly one simple and concise sentence in 
        '${language}' that includes the word '${word}'. Ensure the sentence 
        is easy to understand and does not contain any extra explanations or examples.`,
      },
    ],
    model: "llama3-8b-8192",
  });
  return chatCompletion.choices[0].message.content ?? "";
}

/**
 * Translates the given text from the source language to the target language.
 * @param {string} text - The text to translate.
 * @param {string} source - The source language of the text.
 * @param {string} target - The target language to translate the text to.
 *  @return {Promise<string>} A promise that resolves to the translated text.
 * */
async function translateText(text: string, source: string, target: string):
Promise<string> {
  const client = new Groq({
    apiKey: "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",
  });
  const chatCompletion = await client.chat.completions.create({
    messages: [
      {
        role: "user",
        content: `You are a translator, translate ${text} from ${source} 
        to ${target}, pleasejust translate the text, do not 
        add any extra information.`,
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


export const initDeck = functions.https.onCall(
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The user must be authenticated to initialize a deck."
      );
    }

    const userId = request.auth.uid;

    try {
      console.log(`Initializing deck for user: ${userId}`);

      // Initialize an empty deck for the user
      const deckRef = db.collection("Deck").doc(); // Auto-generate document ID
      await deckRef.set({
        userId,
        deckName: "",
        description: "Default Description",
        tags: ["default"],
        isShared: false,
        sharedWith: [],
        isAiGenerated: false,
        cards: [], // Empty array for cards
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Deck initialized with ID: ${deckRef.id}`);
      return {success: true, deckId: deckRef.id};
    } catch (error) {
      console.error("Error initializing deck:", error);
      throw new functions.https.HttpsError("internal", "Failed to initialize deck.");
    }
  }
);
export const getDecks = functions.https.onCall(
  async (request: functions.https.CallableRequest) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The user must be authenticated to access this function."
      );
    }

    const userId = request.auth.uid;

    const deckId = request.data?.deckId; // Safely access deckId
    console.log("deckId:", deckId);

    try {
      if (deckId) {
        console.log("Fetching specific deck:", deckId);
        const docRef = db.collection("Deck").doc(deckId);
        const docSnapshot = await docRef.get();

        if (!docSnapshot.exists) {
          throw new functions.https.HttpsError("not-found", "Deck not found");
        }

        const deckData = docSnapshot.data();
        if (deckData?.userId !== userId) {
          throw new functions.https.HttpsError("permission-denied", "Forbidden");
        }

        return deckData;
      }

      console.log("Fetching all decks for user:", userId);

      const querySnapshot = await db.collection("Deck")
        .where("userId", "==", userId).get();

      const decks = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return decks;
    } catch (error) {
      console.error("Error retrieving decks:", error);
      throw new functions.https.HttpsError("internal", "Error retrieving decks");
    }
  }
);

export const saveDeckProgress = functions.https.onCall(
  async (
    request: CallableRequest<{ deckId: string; cardId: string; correct: boolean }>,
  ) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The user must be authenticated to save progress."
      );
    }

    const {deckId, cardId, correct} = request.data;

    if (!deckId || !cardId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Deck ID and Card ID are required."
      );
    }

    const userId = request.auth.uid;
    const progressRef = db.collection("UserProgress").doc(`${userId}_${deckId}`);

    try {
      // Check if the progress document exists
      const docSnapshot = await progressRef.get();

      if (docSnapshot.exists) {
        // Update existing progress document
        await progressRef.update({
          results: admin.firestore.FieldValue.arrayUnion({
            cardId,
            correct,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          }),
        });
      } else {
        // Create a new progress document
        await progressRef.set({
          userId,
          deckId,
          results: [
            {
              cardId,
              correct,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            },
          ],
        });
      }

      return {success: true, message: "Progress saved successfully."};
    } catch (error) {
      console.error("Error saving user progress:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to save user progress."
      );
    }
  }
);

export const getDeckProgress = functions.https.onCall(
  async (
    request: CallableRequest<{ deckId: string }>,
  ) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The user must be authenticated to retrieve progress."
      );
    }

    const {deckId} = request.data;

    if (!deckId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Deck ID is required."
      );
    }

    const userId = request?.auth?.uid;
    const progressRef = db.collection("UserProgress").doc(`${userId}_${deckId}`);

    try {
      const docSnapshot = await progressRef.get();

      if (!docSnapshot.exists) {
        return {success: false, message: "No progress found for this deck."};
      }

      const progressData = docSnapshot.data();
      return {success: true, progress: progressData};
    } catch (error) {
      console.error("Error retrieving user progress:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to retrieve user progress."
      );
    }
  }
);

export const saveOrUpdateUserPreferences = functions.https.onCall(
  async (request: CallableRequest<SavePreferencesData>) => {
    const data = request.data;

    // Check if the request is authenticated
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated",
        "The request does not have valid authentication.");
    }

    const uid = request.auth.uid;
    const preferences = data.preferences;

    try {
      // Reference to the user's preferences document
      const userPrefDocRef = db.collection("userPreferences").doc(uid);

      // Merge new data with existing data, creating or updating as needed
      await userPrefDocRef.set(preferences, {merge: true});

      return {message: "Preferences saved or updated successfully."};
    } catch (error) {
      console.error("Error saving or updating preferences:",
        error);
      throw new functions.https.HttpsError("internal",
        "Error saving or updating preferences.");
    }
  }
);
export const checkUserPreferences = functions.https.onCall(
  async (request: CallableRequest<void>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated",
        "The request does not have valid authentication.");
    }

    const uid = request.auth.uid;

    try {
      const userPrefDocRef = db.collection("userPreferences").doc(uid);
      const docSnapshot = await userPrefDocRef.get();

      if (docSnapshot.exists) {
        // Preferences exist
        return {preferences: docSnapshot.data(), exists: true};
      } else {
        // Preferences do not exist
        return {message: "No preferences set.", exists: false};
      }
    } catch (error) {
      console.error("Error checking preferences:", error);
      throw new functions.https.HttpsError("internal",
        "Error checking preferences.");
    }
  }
);

export const addDeck = functions.https.onCall(
  async (request: functions.https.CallableRequest) => {
    // Verify user is authenticated
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The user must be authenticated to access this function."
      );
    }

    const userId = request.auth.uid;

    // Extract required fields from the request
    const {
      deckName,
      description,
      tags,
      isShared = false,
      sharedWith = [],
      isAiGenerated = false,
      cards = [],
    } = request.data;

    // Validate required fields
    if (!deckName || !description || !Array.isArray(tags)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing or invalid required fields: 'name', 'description', or 'tags'."
      );
    }

    // Construct the new deck object
    const newDeck = {
      userId,
      deckName,
      description,
      tags,
      isShared,
      sharedWith,
      isAiGenerated,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      cards,
    };

    try {
      // Add the new deck to the database
      const docRef = await db.collection("Deck").add(newDeck);
      console.log("Deck created with ID:", docRef.id);

      // Return the newly created deck ID to the client
      return {id: docRef.id};
    } catch (error) {
      console.error("Error adding deck:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while adding the deck."
      );
    }
  }
);

export const getCards = functions.https.onCall(
  async (request: functions.https.CallableRequest) => {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const userId = request.auth.uid;
    const deckId = request.data?.deckId;

    try {
      // Fetch deck and check if user has access
      const deckRef = db.collection("Deck").doc(deckId);
      const docSnapshot = await deckRef.get();

      if (!docSnapshot.exists) {
        throw new functions.https.HttpsError("not-found", "Deck not found.");
      }

      const deckData = docSnapshot.data();
      if (deckData?.userId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "No permission");
      }
      // Return the cards from the deck
      return {cards: deckData?.cards || []};
    } catch (error) {
      console.error("Error fetching cards:", error);
      throw new functions.https.HttpsError("internal", "Failed to retrieve cards.");
    }
  }
);


export const addCard = functions.https.onCall(
  async (request: functions.https.CallableRequest) => {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "invalid-argument", "User must be authenticated.");
    }
    const userId = request.data?.userId;
    const deckId = request.data?.deckId;
    const answerWord = request.data?.answerWord;
    const language = request.data?.language;

    // Validate the card data
    if (!deckId || !answerWord || !language) {
      throw new functions.https.HttpsError("invalid-argument", "Missing required field.");
    }

    // Perform translations and sentence generation
    let targetWord;
    let targetSentence;
    let answerSentence;
    try {
      targetWord = await translateText(
        answerWord, "English", language);
      targetSentence = await getSentence(
        language, targetWord);
      answerSentence = await translateText(
        targetSentence, language, "English");
    } catch (error) {
      console.error(
        "Error during translation or sentence generation:", error);
      throw new functions.https.HttpsError("internal", "Translation failed.");
    }

    try {
      // Fetch deck and check if user has access
      const deckRef = db.collection("Deck").doc(deckId);
      const docSnapshot = await deckRef.get();

      if (!docSnapshot.exists) {
        throw new functions.https.HttpsError("not-found", "Deck not found.");
      }

      const deckData = docSnapshot.data();
      if (deckData?.userId !== userId) {
        throw new functions.https.HttpsError("permission-denied", "No permission");
      }

      // Ensure cards field is valid
      if (!Array.isArray(deckData?.cards)) {
        throw new functions.https.HttpsError(
          "failed-precondition", "Deck cards field is not an array.");
      }

      // Add the card to the deck
      const newCard = {
        answerSentence: answerSentence,
        answerWord: answerWord,
        targetSentence: targetSentence,
        targetWord: targetWord,
      };

      await deckRef.update({
        cards: admin.firestore.FieldValue.arrayUnion(newCard),
      });

      return {message: "Card added successfully.", card: newCard};
    } catch (error) {
      console.error("Error adding card:", error);
      throw new functions.https.HttpsError(
        "internal", "Failed to add card." + targetSentence + answerSentence+ targetWord);
    }
  }
);

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
        return res.status(405).send(
          "Method Not Allowed, use POST");
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
