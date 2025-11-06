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

// GET /users/:id
router.get('/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        // converter para ObjectId
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilizador não encontrado' });
        }

        res.status(200).json({ success: true, data: user });
    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false, message: 'ID inválido ou erro no servidor' });
    }
});

export default router;

