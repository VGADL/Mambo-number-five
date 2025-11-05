import express from "express";
import db from "../db/config.js";
import { ObjectId } from "mongodb";

const router = express.Router();

// return first 50 documents from movies collection
router.get("/", async (req, res) => {
  let results = await db.collection('events').find({})
    .limit(50)
    .toArray();
  res.send(results).status(200);
});

// GET /events/:id
router.get('/:id', async (req, res) => {
  try {
    const eventId = req.params.id;

    // converter para ObjectId
    const event = await db.collection('events').findOne({ _id: new ObjectId(eventId) });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Evento não encontrado' });
    }

    res.status(200).json({ success: true, data: event });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: 'ID inválido ou erro no servidor' });
  }
});

export default router;

