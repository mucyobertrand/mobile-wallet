import express from 'express';
import dotenv from 'dotenv';
import { sql } from './config/db.js';
import job from './config/cron.js';


dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') job.start();

app.use(express.json());
async function initDB(){
    try {
        await sql`CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        category VARCHAR(50) NOT NULL,
        create_at DATE NOT NULL DEFAULT CURRENT_DATE
    )`;
        console.log("Database initialized successfully.");
    } catch (error) {
        console.error("Error initializing database:", error);
        process.exit(1);
    }
    
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK' });
});

app.get('/api/transactions/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const transactions = await sql`SELECT * FROM transactions WHERE user_id = ${userId} ORDER BY created_at DESC`;
        res.json(transactions);
    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});
app.get('/api/transactions', async (req, res) => {
    try {
        const transactions = await sql`SELECT * FROM transactions ORDER BY created_at DESC`;
        res.json(transactions);
    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/api/transactions', async (req, res) => {
    try {
    const { user_id, title, amount=undefined, category } = req.body;
    if (!user_id || !title || !amount || !category) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    await sql`INSERT INTO transactions (user_id, title, amount, category) VALUES (${user_id}, ${title}, ${amount}, ${category}) RETURNING *`;

    res.status(201).json({ message: 'Transaction created successfully.' });

    } catch (error) {
        console.error("Error processing transaction:", error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.delete('/api/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if(isNaN(parseInt(id))){
            return res.status(400).json({ error: 'Invalid transaction ID.' });
        }
        const result=await sql`DELETE FROM transactions WHERE id = ${id} RETURNING *`;

        if(result.length===0){
            return  res.status(404).json({ error: 'Transaction not found.' });
        }

        res.json({ message: 'Transaction deleted successfully.' });
    } catch (error) {
        console.error("Error deleting transaction:", error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.get('/api/transactions/summary/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const balanceResult = await sql`
          SELECT COALESCE(SUM(amount), 0) AS balance FROM transactions WHERE user_id = ${userId}
        `;
        const incomeResult = await sql`
          SELECT COALESCE(SUM(amount), 0) AS income FROM transactions WHERE user_id = ${userId} AND amount > 0
        `;
        const expensesResult = await sql`
          SELECT COALESCE(SUM(amount), 0) AS expense FROM transactions WHERE user_id = ${userId} AND amount < 0
        `;

        res.json({
            balance: balanceResult[0].balance,
            income: incomeResult[0].income,
            expense: expensesResult[0].expense
        });
    } catch (error) {
        console.error("Error fetching summary:", error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});        
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
