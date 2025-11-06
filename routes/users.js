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

    if (Array.isArray(data)) {
      const result = await db.collection("users").insertMany(data);
      res.status(201).json({
        success: true,
        insertedCount: result.insertedCount,
        message: `${result.insertedCount} utilizadores adicionados`
      });
    } else {
      const result = await db.collection("users").insertOne(data);
      res.status(201).json({
        success: true,
        insertedId: result.insertedId,
        message: "Utilizador adicionado com sucesso"
      });
    }

  } catch (err) {
    console.error("Erro ao adicionar utilizador(es):", err);
    res.status(500).json({ success: false, message: "Erro ao adicionar utilizador(es)" });
  }
});

export default router;
