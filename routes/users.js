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

// POST /events — adicionar 1 ou vários eventos
router.post("/", async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : [req.body];

    // prepara docs: limpa _id e gera id sequencial
    const docs = [];
    for (const item of payload) {
      const ev = { ...item };
      delete ev._id;              // deixa o Mongo criar o _id
      ev.id = await gerarNovoId(); // <-- usa a TUA função de incremento
      docs.push(ev);
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
    console.error("Erro ao inserir evento(s):", err);
    return res.status(500).json({ success: false, message: "Erro ao inserir evento(s)" });
  }
});



// PUT /users/:id
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
