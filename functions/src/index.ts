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

