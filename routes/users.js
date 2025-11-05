import express from "express";
import db from "../db/config.js";
import { ObjectId } from "mongodb";

const router = express.Router();

// return first 50 documents from movies collection
router.get("/", async (req, res) => {
    let results = await db.collection('users').find({})
        .limit(50)
        .toArray();
    res.send(results).status(200);
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

