import express from "express";
import db from "../db/config.js";
import { ObjectId } from "mongodb";

const router = express.Router();

// 1. GET /events Lista de eventos com paginação (20 por página) 
router.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1;  // página atual
  const limit = 20;                            // nº fixo de eventos por página
  const skip = (page - 1) * limit;             // quantos documentos saltar

  try {
    // Contar o total de eventos
    const total = await db.collection("events").countDocuments();

    // Obter eventos com paginação
    const events = await db.collection("events")
      .find({})
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Responder com dados paginados
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

// 3. POST /events Adicionar 1 ou vários eventos
router.post("/", async (req, res) => {
  try {
    const data = req.body;

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Nenhum evento fornecido no corpo da requisição."
      });
    }

    // Obter o maior _id atual para atribuição automática
    const lastEvent = await db.collection("events")
      .find({})
      .sort({ _id: -1 })
      .limit(1)
      .toArray();

    let lastId = (lastEvent.length > 0 && !isNaN(Number(lastEvent[0]._id))) ? Number(lastEvent[0]._id) : 0;

    // Função de validação de evento
    const validarEvento = (event, index = 0) => {
      if (!event || typeof event !== "object") {
        throw new Error(`Evento #${index + 1} inválido — deve ser um objeto JSON.`);
      }

      // Campos obrigatórios
      const requiredFields = [
        "type", "title", "subject", "string_dates",
        "string_times", "venue", "categories_name_list",
        "tags_name_list", "link", "occurences",
        "StartDate", "LastDate"
      ];
      for (const field of requiredFields) {
        if (!event[field]) {
          throw new Error(`Campo obrigatório "${field}" em falta no evento #${index + 1}.`);
        }
      }

      if (event.type !== "event") {
        throw new Error(`Campo "type" deve ser igual a "event" no evento #${index + 1}.`);
      }
      if (!event.title?.rendered || typeof event.title.rendered !== "string") {
        throw new Error(`Campo "title.rendered" inválido no evento #${index + 1}.`);
      }
      if (!Array.isArray(event.occurences)) {
        throw new Error(`O campo "occurences" deve ser um array no evento #${index + 1}.`);
      }
      if (isNaN(Date.parse(event.StartDate)) || isNaN(Date.parse(event.LastDate))) {
        throw new Error(`Datas inválidas ("StartDate" ou "LastDate") no evento #${index + 1}.`);
      }

      // Atribuição de _id automático
      if (event._id === undefined || isNaN(Number(event._id))) {
        event._id = lastId + index + 1;
      } else {
        event._id = Number(event._id);
      }

      // Garantir arrays para campos específicos
      const arrayFields = ["subtitle", "description", "price_cat", "price_val", "target_audience", "accessibility", "reviews"];
      arrayFields.forEach(f => {
        if (!Array.isArray(event[f])) event[f] = [];
      });

      // Validações adicionais
      if (!event.link.startsWith("http")) {
        throw new Error(`Campo "link" deve ser um URL válido no evento #${index + 1}.`);
      }
      if (event.featured_media_large && !event.featured_media_large.startsWith("http")) {
        throw new Error(`Campo "featured_media_large" deve ser um URL válido no evento #${index + 1}.`);
      }

      return event;
    };

    // Inserção de múltiplos eventos
    if (Array.isArray(data)) {
      const eventos = data.map((e, i) => validarEvento(e, i));

      // Verifica duplicados
      const ids = eventos.map(ev => ev._id);
      const existing = await db.collection("events").find({ _id: { $in: ids } }).toArray();
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Já existem eventos com os seguintes _id(s): ${existing.map(e => e._id).join(", ")}`
        });
      }

      const result = await db.collection("events").insertMany(eventos);
      return res.status(201).json({
        success: true,
        insertedCount: result.insertedCount,
        message: `${result.insertedCount} evento(s) adicionados com sucesso.`,
        data: eventos
      });
    }

    // Inserção de um único evento
    const evento = validarEvento(data);

    // Verifica duplicado
    const exists = await db.collection("events").findOne({ _id: evento._id });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Já existe um evento com o _id: ${evento._id}`
      });
    }

    await db.collection("events").insertOne(evento);
    res.status(201).json({
      success: true,
      message: "Evento adicionado com sucesso.",
      data: evento
    });

  } catch (err) {
    console.error("Erro ao adicionar evento(s):", err.message);
    res.status(400).json({
      success: false,
      message: err.message || "Erro ao adicionar evento(s)."
    });
  }
});

//FUNÇÃO Comparar 2 eventos
router.get("/compare/:id1/:id2", async (req, res) => {
  try {
    const id1 = parseInt(req.params.id1);
    const id2 = parseInt(req.params.id2);

    if (isNaN(id1) || isNaN(id2)) {
      return res.status(400).json({ success: false, message: "Os IDs devem ser numéricos." });
    }

    const users = await db.collection("users").find({}).toArray();
    const events = await db.collection("events").find({ id: { $in: [id1, id2] } }).toArray();

    const stats = { [id1]: { total: 0, sum: 0, five: 0 }, [id2]: { total: 0, sum: 0, five: 0 } };

    users.forEach(u => {
      (u.movies || []).forEach(m => {
        if ([id1, id2].includes(m.movieid)) {
          stats[m.movieid].total++;
          stats[m.movieid].sum += m.rating;
          if (m.rating === 5) stats[m.movieid].five++;
        }
      });
    });

    const comparison = [id1, id2].map(id => {
      const e = events.find(ev => ev.id === id);
      const s = stats[id];
      return {
        event: e ? e.name : `Evento ${id}`,
        avgRating: s.total ? (s.sum / s.total).toFixed(2) : null,
        totalReviews: s.total,
        fiveStarsPercent: s.total ? `${((s.five / s.total) * 100).toFixed(1)}%` : "0%"
      };
    });

    res.status(200).json({
      success: true,
      message: "Comparação entre eventos concluída.",
      comparison
    });
  } catch (err) {
    console.error("Erro ao comparar eventos:", err);
    res.status(500).json({ success: false, message: "Erro ao comparar eventos." });
  }
});

// 13. GET /events/star Lista de eventos com mais 5 estrelas.
router.get("/star", async (req, res) => {
  try {
    // Buscar todos os utilizadores
    const users = await db.collection("users").find({}).toArray();

    // Contar quantas vezes cada evento recebeu 5 estrelas
    const ratingCount = {}; 
    users.forEach(user => {
      (user.movies || []).forEach(m => {
        if (m.rating === 5) {
          ratingCount[m.movieid] = (ratingCount[m.movieid] || 0) + 1;
        }
      });
    });

    // Caso nenhum evento tenha rating 5
    if (Object.keys(ratingCount).length === 0) {
      return res.status(200).json({
        success: true,
        message: "Nenhum evento com 5 estrelas encontrado.",
        data: []
      });
    }

    //Detalhes dos eventos com 5 estrelas
    const eventIds = Object.keys(ratingCount).map(id => Number(id));
    const events = await db.collection("events")
      .find({ _id: { $in: eventIds } })
      .toArray();

    // Adicionar contagem de 5 estrelas aos eventos
    const eventsWithStars = events.map(event => ({
      ...event,
      fiveStarCount: ratingCount[event._id] || 0
    }));

    // Ordenar pelos com mais 5 estrelas
    const sorted = eventsWithStars.sort((a, b) => b.fiveStarCount - a.fiveStarCount);

    res.status(200).json({
      success: true,
      message: "Lista de eventos com mais avaliações de 5 estrelas.",
      total: sorted.length,
      data: sorted
    });

  } catch (err) {
    console.error("Erro ao obter eventos com 5 estrelas:", err);
    res.status(500).json({
      success: false,
      message: "Erro ao obter eventos com 5 estrelas"
    });
  }
});

//11. GET /events/top/:limit
router.get("/top/:limit", async (req, res) => {
  try {
    // Validar limite
    const limit = parseInt(req.params.limit);
    if (isNaN(limit) || limit <= 0) {
      return res.status(400).json({ success: false, message: "O parâmetro 'limit' deve ser um número positivo." });
    }

    const eventsCollection = db.collection("events");
    const usersCollection = db.collection("users");

    // Procurar todos os eventos e utilizadores
    const events = await eventsCollection.find({}).toArray();
    const users = await usersCollection.find({}).toArray();

    // Calcular média de avaliações por evento
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

    //  Ordenar por média e limitar resultados
    const sortedEvents = eventsWithRatings.sort((a, b) => b.averageRating - a.averageRating);
    const limitedEvents = sortedEvents.slice(0, limit);

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

//12 .GET /events/reviews/:order
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

    //Todos os eventos e utilizadores
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

// GET /events/active?date=YYYY-MM-DD novo endpoint
router.get("/active", async (req, res) => {
  try {
    // Validar data ou usar data atual
    const date =
      (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date))
        ? req.query.date
        : new Date().toISOString().split("T")[0];

    const filter = {
      $or: [
        { $and: [{ StartDate: { $lte: date } }, { LastDate: { $gte: date } }] },
        { occurences: date }
      ]
    };
 // Obter eventos ativos na data
    const events = await db.collection("events").find(filter).toArray();

    res.status(200).json({
      success: true,
      date,
      total: events.length,
      data: events
    });
  } catch (err) {
    console.error("Erro em /events/active:", err);
    res.status(500).json({ success: false, message: "Erro ao obter eventos ativos" });
  }
});

// 14. GET /events/year/:year
router.get("/year/:year", async (req, res) => {
  try {
    const year = parseInt(req.params.year);
// Validar ano
    if (isNaN(year)) {
      return res.status(400).json({
        success: false,
        message: "O parâmetro 'year' deve ser um número."
      });
    }

    const eventsCollection = db.collection("events");
    const usersCollection = db.collection("users");

    // utilizadores e eventos
    const users = await usersCollection.find({}).toArray();
    const events = await eventsCollection.find({}).toArray();

  
    const reviewedEventIds = new Set();

    // Identificar eventos avaliados no ano especificado
    users.forEach(user => {
      (user.movies || []).forEach(movie => {
        const reviewYear = new Date(movie.date).getFullYear();
        if (reviewYear === year) {
          reviewedEventIds.add(movie.movieid); // movieid refere-se ao _id numérico do evento
        }
      });
    });

    // Filtrar eventos que foram avaliados no ano
    const filteredEvents = events.filter(ev => reviewedEventIds.has(ev._id));

    res.status(200).json({
      success: true,
      year: year,
      total: filteredEvents.length,
      data: filteredEvents
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Erro ao listar eventos avaliados no ano indicado."
    });
  }
});

// GET /events/id/:id
router.get("/id/:id", async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) {
      return res.status(400).json({ success: false, message: "O parâmetro 'id' deve ser um número." });
    }
    // Procurar evento pelo ID
    const event = await db.collection("events").findOne({ _id: eventId });
    if (!event) {
      return res.status(404).json({ success: false, message: "Evento não encontrado" });
    }

    // Procurar avaliações
    const users = await db.collection("users").find({
      "movies.movieid": event._id
    }).toArray();

    const ratings = [];
    for (const user of users) {
      const matchedMovie = user.movies.find(m => m.movieid === event._id && m.rating != null);
      if (matchedMovie) ratings.push(matchedMovie.rating);
    }
  // Calcular média de avaliações
    const averageRating = ratings.length > 0
      ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
      : "Sem avaliações";

    res.status(200).json({ success: true, data: { ...event, averageRating } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erro ao obter evento" });
  }
});

//9.PUT /events/:id
router.put("/:id", async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) return res.status(400).json({ success: false, message: "ID inválido" });

    const updatedData = { ...req.body };

    // não permite alterar id's
    delete updatedData._id;
    delete updatedData.id;

    if (!updatedData || Object.keys(updatedData).length === 0) {
      return res.status(400).json({ success: false, message: "Nenhum dado fornecido para atualização" });
    }

    const result = await db.collection("events").updateOne(
      { _id: eventId },
      { $set: updatedData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Evento não encontrado" });
    }

    res.status(200).json({ success: true, message: "Evento atualizado com sucesso" });
  } catch (err) {
    console.error("Erro ao atualizar evento:", err);
    res.status(500).json({ success: false, message: "Erro ao atualizar evento" });
  }
});

//7. DELETE /events/:id Remove um evento pelo seu ID interno do MongoDB
router.delete("/:id", async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    
    const result = await db.collection("events").deleteOne({ _id: eventId });
// Verificar se o evento foi encontrado e removido
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Evento não encontrado" });
    }

    res.status(200).json({ success: true, message: "Evento removido com sucesso" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, message: "ID inválido ou erro no servidor" });
  }
});

export default router;