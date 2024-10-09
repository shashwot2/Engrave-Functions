import {onRequest} from "firebase-functions/v2/https";
import * as cors from "cors";
import * as admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "isrs-564a5",
});

const db = admin.firestore();
const corsHandler = cors({origin: true});

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

      // If a specific deck ID is provided in the query, return that document
      const deckId = req.query.deckId as string;

      if (deckId) {
        const docRef = db.collection("Deck").doc(deckId);
        const docSnapshot = await docRef.get();

        if (!docSnapshot.exists) {
          return res.status(404).send("Deck not found");
        }

        return res.status(200).json(docSnapshot.data());
      }

      // If no deck ID is provided, return all decks
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

      const { user_id, name, description, tags, is_shared, shared_with, is_ai_generated } = req.body;

      if (!user_id || !name || !description || !Array.isArray(tags)) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newDeck = {
        user_id,
        name,
        description,
        tags,
        is_shared: is_shared || false,
        shared_with: shared_with || [],
        is_ai_generated: is_ai_generated || false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("Deck").add(newDeck);
      return res.status(200).send(`Deck created with ID: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding deck: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

// New function to add a card to a specific deck
export const addCard = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const { deck_id, front_content, back_content, last_reviewed_at, next_review_at, review_count, ease_factor, interval } = req.body;

      if (!deck_id || !front_content || !back_content) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newCard = {
        deck_id,
        front_content,
        back_content,
        last_reviewed_at: last_reviewed_at || admin.firestore.FieldValue.serverTimestamp(),
        next_review_at: next_review_at || admin.firestore.FieldValue.serverTimestamp(),
        review_count: review_count || 0,
        ease_factor: ease_factor || 2.5,
        interval: interval || 1,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("Cards").add(newCard);
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

      const { user_id, deck_id, start_time, end_time, cards_reviewed, total_correct, total_incorrect } = req.body;

      if (!user_id || !deck_id || !start_time || !end_time || !Array.isArray(cards_reviewed)) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newSession = {
        user_id,
        deck_id,
        start_time: admin.firestore.Timestamp.fromDate(new Date(start_time)),
        end_time: admin.firestore.Timestamp.fromDate(new Date(end_time)),
        cards_reviewed,
        total_correct,
        total_incorrect,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("study_sessions").add(newSession);
      return res.status(200).send(`Study session created with ID: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding study session: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

// Function to get study sessions for a user
export const getStudySessions = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const user_id = req.query.user_id as string;

      if (!user_id) {
        return res.status(400).send("Bad Request: Missing user_id.");
      }

      const querySnapshot = await db.collection("study_sessions").where("user_id", "==", user_id).get();
      const sessions = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      return res.status(200).json(sessions);
    } catch (error) {
      console.error("Error retrieving study sessions: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

// Function to add an AI request
export const addAIRequest = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const { user_id, input_word, generated_deck_id, status } = req.body;

      if (!user_id || !input_word || !generated_deck_id || !status) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newRequest = {
        user_id,
        input_word,
        generated_deck_id,
        status,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("ai_requests").add(newRequest);
      return res.status(200).send(`AI request created with ID: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding AI request: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

// Function to add a notification
export const addNotification = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const { user_id, type, message, is_read, scheduled_for } = req.body;

      if (!user_id || !type || !message) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newNotification = {
        user_id,
        type,
        message,
        is_read: is_read || false,
        scheduled_for: scheduled_for ? admin.firestore.Timestamp.fromDate(new Date(scheduled_for)) : null,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("notifications").add(newNotification);
      return res.status(200).send(`Notification created with ID: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding notification: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

// Function to add analytics data
export const addAnalytics = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const { user_id, data } = req.body;

      if (!user_id || !Array.isArray(data)) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newAnalytics = {
        user_id,
        data,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("analytics").add(newAnalytics);
      return res.status(200).send(`Analytics data created with ID: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding analytics data: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

// Function to add a shared deck
export const addSharedDeck = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed, use POST");
      }

      const { deck_id, shared_by_user_id, shared_to_user_ids, access_level } = req.body;

      if (!deck_id || !shared_by_user_id || !Array.isArray(shared_to_user_ids) || !access_level) {
        return res.status(400).send("Bad Request: Missing required fields.");
      }

      const newSharedDeck = {
        deck_id,
        shared_by_user_id,
        shared_to_user_ids,
        access_level,
        shared_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("shared_decks").add(newSharedDeck);
      return res.status(200).send(`Shared deck created with ID: ${docRef.id}`);
    } catch (error) {
      console.error("Error adding shared deck: ", error);
      return res.status(500).send("Internal Server Error");
    }
  });
});

