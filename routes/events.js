import express from "express";
import db from "../db/config.js";
import { ObjectId } from "mongodb";

const router = express.Router();
/**
 *1 Lista de eventos com paginação (20 por página) 
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

/*
3. Adicionar 1 ou vários eventos
*/

// POST /events
/*router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    const events = Array.isArray(payload) ? payload : [payload];
    const inserted = [];

    for (const event of events) {
      // Gera id incremental usando o contador

      const result = await db.collection("events").insertOne(event);
      inserted.push({ ...event, _id: result.insertedId });
    }

    return res.status(201).json({
      success: true,
      message: "Evento(s) criado(s) com sucesso!",
      insertedCount: inserted.length,
      data: inserted,
    });
  } catch (err) {
    console.error("Erro ao criar evento(s):", err);
    return res.status(500).json({
      success: false,
      message: "Erro ao criar evento(s)",
      error: err.message,
    });
  }
});*/




//5. GET /events/:id
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


//7. Remove um evento pelo seu ID interno do MongoDB
router.delete("/:id", async (req, res) => {
  try {
    const eventId = req.params.id;
    const objectId = new ObjectId(eventId);

    const result = await db.collection("events").deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Evento não encontrado" });
    }

    res.status(200).json({ success: true, message: "Evento removido com sucesso" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, message: "ID inválido ou erro no servidor" });
  }
});

//9.PUT /events/:id
router.put("/:id", async (req, res) => {
  try {
    const eventId = req.params.id;
    const updatedData = { ...req.body };

    // não permite alterar id's
    delete updatedData._id;
    delete updatedData.id;  

    if(!updatedData || Object.keys(updatedData).length === 0) {
      return res.status(400).json({ success: false, message: "Nenhum dado fornecido para atualização" });
    }

    const result = await db.collection("events").updateOne(
      { _id: new ObjectId(eventId) },
      { $set: updatedData }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: "Evento não encontrado" });
    }

    res.status(200).json({ success: true, message: "Evento atualizado com sucesso" });
  } catch (err) {
    console.error("Erro ao atualizar evento:", err);
    res.status(500).json({ success: false, message: "Erro ao atualizar evento" });
  }
});

//11. 
router.get("/top/:limit", async (req, res) => {
  try {
    // Lê o limite da rota
    const limit = parseInt(req.params.limit);
    if (isNaN(limit) || limit <= 0) {
      return res.status(400).json({ success: false, message: "O parâmetro 'limit' deve ser um número positivo." });
    }

    const eventsCollection = db.collection("events");
    const usersCollection = db.collection("users");

    // Buscar todos os eventos e utilizadores
    const events = await eventsCollection.find({}).toArray();
    const users = await usersCollection.find({}).toArray();

    // Calcular média das classificações
    const eventsWithRatings = events.map(event => {
      const ratings = users
        .flatMap(user =>
          user.movies
            .filter(m => m.movieid === event.id && m.rating != null)
            .map(m => m.rating)
        );

      const averageRating =
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      return {
        ...event,
        averageRating: Number(averageRating.toFixed(2))
      };
    });

    // Ordenar e limitar
    const sortedEvents = eventsWithRatings.sort((a, b) => b.averageRating - a.averageRating);
    const limitedEvents = sortedEvents.slice(0, limit);

    // Responder
    res.status(200).json({
      success: true,
      total: limitedEvents.length,
      data: limitedEvents
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erro ao listar eventos por score." });
  }
});

//12
router.get("/reviews/:order", async (req, res) => {
  try {
    const order = req.params.order.toLowerCase();

    if (order !== "asc" && order !== "desc") {
      return res.status(400).json({
        success: false,
        message: "O parâmetro 'order' deve ser 'asc' ou 'desc'."
      });
    }

    const eventsCollection = db.collection("events");
    const usersCollection = db.collection("users");

    // Buscar todos os eventos e utilizadores
    const events = await eventsCollection.find({}).toArray();
    const users = await usersCollection.find({}).toArray();

    // Contar número de reviews por evento
    const eventsWithReviewCount = events.map(event => {
      const reviewCount = users.reduce((count, user) => {
        const hasReview = user.movies.some(m => m.movieid === event.id && m.rating != null);
        return hasReview ? count + 1 : count;
      }, 0);

      return {
        ...event,
        totalReviews: reviewCount
      };
    });

    // Ordenar por número de reviews
    const sortedEvents = eventsWithReviewCount.sort((a, b) => {
      return order === "asc" ? a.totalReviews - b.totalReviews : b.totalReviews - a.totalReviews;
    });

    res.status(200).json({
      success: true,
      order,
      total: sortedEvents.length,
      data: sortedEvents
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Erro ao listar eventos por número de reviews."
    });
  }
});
export default router;


