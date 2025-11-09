import express from "express";
import db from "../db/config.js";

import { ObjectId } from "mongodb";
const router = express.Router();
/**
 * Lista de utilizadores com paginação (20 por página)
 */
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

/*
Adicionar 1 ou vários utilizadores
*/
router.post("/", async (req, res) => {
  try {
    const data = req.body;

    //Obter o maior _id atual da coleção
    const lastUser = await db.collection("users")
      .find({})
      .sort({ _id: -1 })
      .limit(1)
      .toArray();

    // Definir o próximo _id
    const nextId = lastUser.length > 0 ? lastUser[0]._id + 1 : 1;

    // Se for vários utilizadores, atribuir IDs sequenciais
    if (Array.isArray(data)) {
      // Atribui _id sequenciais
      data.forEach((u, i) => {
        if (u._id === undefined) u._id = nextId + i;
      });

    const result = await db.collection("users").insertMany(data);
      return res.status(201).json({
        success: true,
        insertedCount: result.insertedCount,
        message: `${result.insertedCount} utilizadores adicionados`
      });
    }
    // Se for um único utilizador, atribuir o próximo ID
    if (data._id === undefined) {
      data._id = nextId;
    }
    const result = await db.collection("users").insertOne(data);

     res.status(201).json({
      success: true,
      insertedId: data._id,
      message: "Utilizador adicionado com sucesso"
    });

  } catch (err) {
    console.error("Erro ao adicionar utilizador(es):", err);
    res.status(500).json({
      success: false,
      message: "Erro ao adicionar utilizador(es)"
    });
  }
});

/*
6. GET /users/:id
*/
router.get("/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const user = await db.collection("users").findOne({ _id: userId });



    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilizador não encontrado"
      });
    }

    //  Ordenar os eventos do user por rating
    const sortedMovies = (user.movies || [])
      .sort((a, b) => b.rating - a.rating);

    if (sortedMovies.length === 0) {
      return res.status(200).json({
        success: true,
        data: { user, top_events: [] },
        message: "O utilizador não tem eventos avaliados"
      });
    }

    // Buscar detalhes dos eventos
    const eventIds = sortedMovies.map(m => m.movieid);
    const events = await db.collection("events")
      .find({ id: { $in: eventIds } })
      .toArray();

    // Combinar e filtrar só os eventos válidos (com nome)
    const validTopEvents = sortedMovies
      .map(movie => {
        const event = events.find(e => e.id === movie.movieid);
        if (!event || !event.title?.rendered) return null; // ignorar se não tiver nome
        return {
          event_id: movie.movieid,
          title: event.title.rendered,
          rating: movie.rating,
          date: movie.date,
          subject: event.subject || null,
          venue: event.venue ? Object.values(event.venue)[0]?.name : null,
          link: event.link || null,
          featured_image: event.featured_media_large || null
        };
      })
      .filter(e => e !== null) // remover os nulos
      .slice(0, 3); // só top 3 válidos

    // Mensagem adequada
    let message = "";
    if (validTopEvents.length === 0) {
      message = `${user.name} não tem eventos válidos com nome.`;
    } else if (validTopEvents.length < 3) {
      message = `${user.name} tem apenas ${validTopEvents.length} evento(s) válido(s) com nome.`;
    } else if (validTopEvents.length > 3) {
      message = `${user.name} tem ${validTopEvents.length} eventos válidos — a mostrar os 3 melhores.`;
    } else {
      message = `Top 3 eventos do utilizador ${user.name}.`;
    }

    // Resposta
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
/*
8. DELETE /users/:id
Remover user pelo _id
*/
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


// POST /users/:id/review/:event_id
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
    const event = await db.collection("events").findOne({ id: eventId });
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
      { id: eventId },
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
export default router;
