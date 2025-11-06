import express from "express";
import db from "../db/config.js";
import { ObjectId } from "mongodb";

const router = express.Router();

/**
 * Lista de eventos com paginação (20 por página)
 */
router.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1;  // página atual
  const limit = 20;                            // nº fixo de eventos por página
  const skip = (page - 1) * limit;             // quantos documentos saltar

  try {
    // Obter total de eventos para calcular nº de páginas
    const total = await db.collection("events").countDocuments();

    // Buscar os eventos paginados
    const events = await db.collection("events")
      .find({})
      .skip(skip)
      .limit(limit)
      .toArray();

    // Resposta JSON com metadados de paginação
    res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: events
    });

  } catch (err) {
    console.error("Erro ao obter eventos:", err);
    res.status(500).json({
      success: false,
      message: "Erro ao obter eventos"
    });
  }
});

// GET /events/:id
router.get("/:id", async (req, res) => {
  try {
    const eventId = req.params.id;
    const event = await db.collection("events").findOne({ _id: new ObjectId(eventId) });

    if (!event) {
      return res.status(404).json({ success: false, message: "Evento não encontrado" });
    }

    // Procurar avaliações dos utilizadores que referem este evento
    const users = await db.collection("users").find({
      "movies.movieid": event.id  // relaciona id do evento com movieid dos users
    }).toArray();

    // Extrair todos os ratings deste evento
    let ratings = [];
    for (const user of users) {
      const matchedMovie = user.movies.find(m => m.movieid === event.id && m.rating != null);
      if (matchedMovie) {
        ratings.push(matchedMovie.rating);
      }
    }

    // Calcular média
    const averageRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)
      : null;

    res.status(200).json({
      success: true,
      data: {
        ...event,
        averageRating: averageRating ? Number(averageRating) : "Sem avaliações"
      }
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: "ID inválido ou erro no servidor" });
  }
});

// POST /events 
router.post("/", async (req, res) => {
  try {
    const data = req.body;
    const events = Array.isArray(data) ? data : [data];

    const collection = db.collection("events");
    const lastEvent = await collection.find({}).sort({ id: -1 }).limit(1).toArray();

    let nextId;
    if (lastEvent.length > 0) {
    nextId = lastEvent[0].id + 1;
    } else {
      nextId = 1;
      }

      const eventsWithIds = events.map((ev, i) => ({
      ...ev,
      id: nextId + i
    }));

    const inserted = await collection.insertMany(eventsWithIds);

    res.status(201).json({
      message: `${inserted.insertedCount} evento(s) adicionado(s) com sucesso.`,
      data: eventsWithIds
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao adicionar evento(s)." });
  }
});

export default router;
