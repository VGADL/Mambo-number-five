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

/*
Adicionar 1 ou vários eventos
*/
router.post("/", async (req, res) => {
  try {
    const data = req.body;

    // se receber um array -> insertMany, senão insertOne
    if (Array.isArray(data)) {
      const result = await db.collection("events").insertMany(data);
      res.status(201).json({
        success: true,
        insertedCount: result.insertedCount,
        message: `${result.insertedCount} eventos adicionados`
      });
    } else {
      const result = await db.collection("events").insertOne(data);
      res.status(201).json({
        success: true,
        insertedId: result.insertedId,
        message: "Evento adicionado com sucesso"
      });
    }

  } catch (err) {
    console.error("Erro ao adicionar evento(s):", err);
    res.status(500).json({ success: false, message: "Erro ao adicionar evento(s)" });
  }
});

export default router;
