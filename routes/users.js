import express from "express";
import db from "../db/config.js";

import { ObjectId } from "mongodb";
const router = express.Router();

// 2. GET /users Lista de utilizadores com paginação (20 por página) 
router.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1;  // página atual
  const limit = 20;                            // nº fixo de utilizadores por página
  const skip = (page - 1) * limit;             // quantos documentos saltar

  try {
    // Obter total de utilizadores para calcular nº de páginas
    const total = await db.collection("users").countDocuments();

    // Buscar os utilizadores paginados
    const users = await db.collection("users")
      .find({})
      .sort({ _id: -1 })
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
      data: users
    });

  } catch (err) {
    console.error("Erro ao obter utilizadores:", err);
    res.status(500).json({
      success: false,
      message: "Erro ao obter utilizadores"
    });
  }
});

// 4. POST /users Adicionar 1 ou vários utilizadores
router.post("/", async (req, res) => {
  try {
    const data = req.body;

    // Obter o maior _id atual da coleção
    const lastUser = await db.collection("users")
      .find({})
      .sort({ _id: -1 })
      .limit(1)
      .toArray();

    const nextId = lastUser.length > 0 ? lastUser[0]._id + 1 : 1;

    // Função para validar e preparar cada utilizador
    const validarUser = (user, index = 0) => {
      const requiredFields = ["name", "gender", "age", "occupation"];
      for (const field of requiredFields) {
        if (!user[field]) {
          throw new Error(`Campo obrigatório "${field}" em falta no utilizador #${index + 1}`);
        }
      }

      // Validação do género
      const validGenders = ["M", "F"];
      if (!validGenders.includes(user.gender.toUpperCase())) {
        throw new Error(`Género inválido no utilizador #${index + 1}. Use apenas M ou F.`);
      }

      // Validação da idade
      if (isNaN(user.age)) {
        throw new Error(`O campo "age" deve ser numérico no utilizador #${index + 1}`);
      }

      // Atribui _id sequencial se não existir
      if (user._id === undefined) user._id = nextId + index;

      // Cria arrays vazios se não existirem
      if (!Array.isArray(user.movies)) user.movies = [];
      if (!Array.isArray(user.favorites)) user.favorites = [];

      // Retorna o user formatado
      return {
        _id: user._id,
        name: user.name,
        gender: user.gender.toUpperCase(), // força maiúsculo
        age: user.age,
        occupation: user.occupation,
        movies: user.movies,
        favorites: user.favorites
      };
    };

    // Se for vários utilizadores
    if (Array.isArray(data)) {
      const users = data.map((u, i) => validarUser(u, i));

      const result = await db.collection("users").insertMany(users);
      return res.status(201).json({
        success: true,
        insertedCount: result.insertedCount,
        message: `${result.insertedCount} utilizadores adicionados com sucesso`
      });
    }

    // Se for apenas um utilizador
    const user = validarUser(data);
    const result = await db.collection("users").insertOne(user);

    res.status(201).json({
      success: true,
      insertedId: user._id,
      message: "Utilizador adicionado com sucesso",
      data: user
    });

  } catch (err) {
    console.error("Erro ao adicionar utilizador(es):", err.message);
    res.status(400).json({
      success: false,
      message: err.message || "Erro ao adicionar utilizador(es)"
    });
  }
});

//16 GET /users/top-reviewers Lista os utilizadores com mais avaliações (top 5)
router.get("/top-reviewers", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Agregação no MongoDB para contar o tamanho do array "movies" de cada user
    const topReviewers = await db.collection("users").aggregate([
      {
        $project: {
          _id: 1,
          name: 1,
          gender: 1,
          age: 1,
          occupation: 1,
          total_reviews: { $size: { $ifNull: ["$movies", []] } } // conta reviews
        }
      },
      { $sort: { total_reviews: -1 } }, // ordenar descendente
      { $limit: limit }                 // limitar resultados
    ]).toArray();

    if (topReviewers.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Nenhum utilizador com reviews encontrado.",
        data: []
      });
    }

    res.status(200).json({
      success: true,
      total: topReviewers.length,
      message: `Top ${topReviewers.length} utilizadores com mais avaliações.`,
      data: topReviewers
    });

  } catch (err) {
    console.error("Erro ao obter top reviewers:", err);
    res.status(500).json({
      success: false,
      message: "Erro ao listar utilizadores com mais reviews."
    });
  }
});

// POST /users/:id/favorites
router.post("/:id/favorites", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { movieid } = req.body;

    if (!movieid) {
      return res.status(400).json({ success: false, message: "É necessário fornecer movieid" });
    }

    const user = await db.collection("users").findOne({ _id: userId });
    if (!user) return res.status(404).json({ success: false, message: "Utilizador não encontrado" });

    // Adiciona apenas se ainda não existir
    const exists = (user.favorites || []).some(fav => fav.movieid === movieid);
    if (exists) {
      return res.status(400).json({ success: false, message: "Filme já está nos favoritos" });
    }

    const result = await db.collection("users").updateOne(
      { _id: userId },
      { $push: { favorites: { movieid } } }
    );

    res.status(201).json({ success: true, message: "Filme adicionado aos favoritos" });

  } catch (err) {
    console.error("Erro ao adicionar favorito:", err);
    res.status(500).json({ success: false, message: "Erro ao adicionar favorito" });
  }
});

// GET /users/:id/favorites
router.get("/:id/favorites", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const user = await db.collection("users").findOne({ _id: userId }, { projection: { favorites: 1 } });
    if (!user) return res.status(404).json({ success: false, message: "Utilizador não encontrado" });

    res.status(200).json({
      success: true,
      total: (user.favorites || []).length,
      data: user.favorites || []
    });

  } catch (err) {
    console.error("Erro ao obter favoritos:", err);
    res.status(500).json({ success: false, message: "Erro ao listar favoritos" });
  }
});

// DELETE /users/:id/favorites/:movieid
router.delete("/:id/favorites/:movieid", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const movieid = parseInt(req.params.movieid);

    const result = await db.collection("users").updateOne(
      { _id: userId },
      { $pull: { favorites: { movieid } } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: "Filme não encontrado nos favoritos" });
    }

    res.status(200).json({ success: true, message: "Filme removido dos favoritos" });

  } catch (err) {
    console.error("Erro ao remover favorito:", err);
    res.status(500).json({ success: false, message: "Erro ao remover favorito" });
  }
});

// 15. POST /users/:id/review/:event_id
router.post("/:id/review/:event_id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const eventId = parseInt(req.params.event_id);
    const { rating, comment = "" } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating deve ser entre 1 e 5" });
    }

    // pega user
    const user = await db.collection("users").findOne({ _id: userId });
    if (!user) return res.status(404).json({ success: false, message: "Utilizador não encontrado" });

    // pega evento
    const event = await db.collection("events").findOne({ _id: eventId });
    if (!event) return res.status(404).json({ success: false, message: "Evento não encontrado" });

    // criar review
    const review = {
      user_id: userId,
      rating,
      comment,
      date: new Date().toLocaleDateString("pt-PT"),
    };

    // adicionar review ao evento
    const result = await db.collection("events").updateOne(
      { _id: eventId },
      { $push: { reviews: review } }
    );

    if (result.modifiedCount === 0)
      return res.status(500).json({ success: false, message: "Erro ao adicionar review" });

    res.status(201).json({ success: true, message: "Review adicionada com sucesso", review });
  } catch (err) {
    console.error("Erro ao adicionar review:", err);
    res.status(500).json({ success: false, message: "Erro ao adicionar review" });
  }
});

// 6. GET /users/:id
router.get("/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "O parâmetro 'id' deve ser um número válido."
      });
    }

    const user = await db.collection("users").findOne({ _id: userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilizador não encontrado"
      });
    }

    const eventsArray = Array.isArray(user.movies) ? user.movies : [];

    // Filtra apenas avaliações válidas e ordena por rating
    const sortedEvents = eventsArray
      .filter(m => m && typeof m.movieid === "number" && typeof m.rating === "number")
      .sort((a, b) => b.rating - a.rating);

    if (sortedEvents.length === 0) {
      return res.status(200).json({
        success: true,
        data: { user, top_events: [] },
        message: "O utilizador não tem eventos avaliados"
      });
    }

    const eventIds = sortedEvents.map(m => m.movieid);

    // Buscar eventos correspondentes
    const events = await db.collection("events")
      .find({ _id: { $in: eventIds } })
      .toArray();

    // Combina avaliações com eventos, apenas eventos existentes
    const validTopEvents = sortedEvents
      .map(movie => {
        const event = events.find(e => e._id === movie.movieid);
        if (!event) return null;
        return {
          event_id: movie.movieid,
          title: event.title?.rendered || "Sem título",
          rating: movie.rating,
          date: movie.date || null,
          subject: event.subject || null,
          venue: event.venue ? Object.values(event.venue)[0]?.name : null,
          link: event.link || null,
          featured_image: event.featured_media_large || null
        };
      })
      .filter(e => e !== null)
      .slice(0, 3); // só top 3

    const message = validTopEvents.length === 0
      ? `${user.name} não tem eventos válidos com nome.`
      : `Top ${validTopEvents.length} eventos do utilizador ${user.name}.`;

    res.status(200).json({
      success: true,
      message,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          gender: user.gender,
          age: user.age,
          occupation: user.occupation
        },
        top_events: validTopEvents
      }
    });

  } catch (err) {
    console.error("Erro ao obter utilizador:", err);
    res.status(500).json({
      success: false,
      message: "Erro ao obter utilizador"
    });
  }
});

// 10. PUT /users/:id
router.put("/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const updateData = { ...req.body };

    // não deixar alterar o id
    delete updateData._id;

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "Nenhum dado fornecido para atualização" }); }

    const result = await db.collection("users").updateOne({ _id: userId }, { $set: updateData });

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Utilizador não encontrado" }); }

    res.status(200).json({ success: true, message: "Utilizador atualizado com sucesso"});
  } catch (err) {
    console.error("Erro ao atualizar utilizador:", err);
    res.status(500).json({ success: false, message: "Erro ao atualizar utilizador"});
  }
});

//8. DELETE /users/:id
router.delete("/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    // verifica se o user existe
    const user = await db.collection("users").findOne({ _id: userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilizador não encontrado"
      });
    }

    // apaga o user
    const result = await db.collection("users").deleteOne({ _id: userId });

    if (result.deletedCount === 1) {
      res.status(200).json({
        success: true,
        message: `Utilizador com ID ${userId} removido com sucesso`
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Erro ao remover utilizador"
      });
    }

    // insere
    if (docs.length === 1) {
      const r = await db.collection("events").insertOne(docs[0]);
      return res.status(201).json({
        success: true,
        message: "Evento inserido com sucesso",
        data: { ...docs[0], _id: r.insertedId }
      });
    } else {
      const r = await db.collection("events").insertMany(docs);
      // anexa os _ids gerados pelo Mongo à resposta
      const ids = Object.values(r.insertedIds);
      const data = docs.map((d, i) => ({ ...d, _id: ids[i] }));
      return res.status(201).json({
        success: true,
        message: "Eventos inseridos com sucesso",
        insertedCount: r.insertedCount,
        data
      });
    }
  } catch (err) {
    console.error("Erro ao remover utilizador:", err);
    res.status(500).json({
      success: false,
      message: "Erro ao remover utilizador"
    });
  }
});

export default router;