import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { initialVocabulary } from "./src/data/initialVocabulary";

const db = new Database("vocab.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    meaning TEXT NOT NULL,
    synonym TEXT,
    antonym TEXT,
    day_number INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS progress (
    day_number INTEGER PRIMARY KEY,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exam_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_range TEXT,
    score INTEGER,
    total INTEGER,
    accuracy REAL,
    incorrect_words TEXT,
    taken_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed Database if empty
const vocabCount = db.prepare("SELECT COUNT(*) as count FROM vocabulary").get().count;
if (vocabCount === 0) {
  try {
    const insert = db.prepare("INSERT INTO vocabulary (word, meaning, synonym, antonym, day_number) VALUES (?, ?, ?, ?, ?)");
    const transaction = db.transaction((words) => {
      for (const word of words) {
        insert.run(word.word, word.meaning, word.synonym, word.antonym, word.day_number);
      }
    });
    transaction(initialVocabulary);
    console.log(`Successfully seeded database with ${initialVocabulary.length} words.`);
  } catch (error) {
    console.error("Failed to seed database:", error);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/vocabulary", (req, res) => {
    const words = db.prepare("SELECT * FROM vocabulary ORDER BY day_number, word").all();
    res.json(words);
  });

  app.get("/api/vocabulary/days", (req, res) => {
    const days = db.prepare("SELECT DISTINCT day_number FROM vocabulary ORDER BY day_number").all();
    res.json(days.map(d => d.day_number));
  });

  app.get("/api/vocabulary/day/:day", (req, res) => {
    const words = db.prepare("SELECT * FROM vocabulary WHERE day_number = ?").all(req.params.day);
    res.json(words);
  });

  app.post("/api/vocabulary/import", (req, res) => {
    const { words } = req.body;
    if (!Array.isArray(words)) return res.status(400).json({ error: "Invalid data" });

    const insert = db.prepare("INSERT INTO vocabulary (word, meaning, synonym, antonym, day_number) VALUES (?, ?, ?, ?, ?)");
    const transaction = db.transaction((words) => {
      for (const word of words) {
        insert.run(word.word, word.meaning, word.synonym, word.antonym, word.day_number);
      }
    });

    transaction(words);
    res.json({ success: true, count: words.length });
  });

  app.post("/api/vocabulary/seed", (req, res) => {
    try {
      const insert = db.prepare("INSERT INTO vocabulary (word, meaning, synonym, antonym, day_number) VALUES (?, ?, ?, ?, ?)");
      const transaction = db.transaction((words) => {
        for (const word of words) {
          const exists = db.prepare("SELECT id FROM vocabulary WHERE word = ?").get(word.word);
          if (!exists) {
            insert.run(word.word, word.meaning, word.synonym, word.antonym, word.day_number);
          }
        }
      });
      transaction(initialVocabulary);
      res.json({ success: true, count: initialVocabulary.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/progress", (req, res) => {
    const completedDays = db.prepare("SELECT day_number FROM progress").all();
    res.json(completedDays.map(d => d.day_number));
  });

  app.post("/api/progress/complete/:day", (req, res) => {
    db.prepare("INSERT OR REPLACE INTO progress (day_number) VALUES (?)").run(req.params.day);
    res.json({ success: true });
  });

  app.get("/api/stats", (req, res) => {
    const totalWords = db.prepare("SELECT COUNT(*) as count FROM vocabulary").get().count;
    const learnedWords = db.prepare("SELECT COUNT(*) as count FROM vocabulary WHERE day_number IN (SELECT day_number FROM progress)").get().count;
    const totalTests = db.prepare("SELECT COUNT(*) as count FROM exam_results").get().count;
    const avgAccuracy = db.prepare("SELECT AVG(accuracy) as avg FROM exam_results").get().avg || 0;
    
    // Streak calculation (simplified)
    const dates = db.prepare("SELECT DISTINCT date(completed_at) as date FROM progress ORDER BY date DESC").all();
    let streak = 0;
    if (dates.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      if (dates[0].date === today || dates[0].date === yesterday) {
        streak = 1;
        for (let i = 0; i < dates.length - 1; i++) {
          const d1 = new Date(dates[i].date);
          const d2 = new Date(dates[i+1].date);
          const diff = (d1.getTime() - d2.getTime()) / (1000 * 3600 * 24);
          if (diff === 1) streak++;
          else break;
        }
      }
    }

    const examResults = db.prepare("SELECT * FROM exam_results ORDER BY taken_at DESC").all();
    const weakWordsMap = new Map();
    examResults.forEach(result => {
      const incorrect = JSON.parse(result.incorrect_words || "[]");
      incorrect.forEach(word => {
        weakWordsMap.set(word, (weakWordsMap.get(word) || 0) + 1);
      });
    });
    const weakWords = Array.from(weakWordsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(e => e[0]);

    res.json({
      totalWords,
      learnedWords,
      totalTests,
      avgAccuracy: Math.round(avgAccuracy * 100) / 100,
      streak,
      weakWords
    });
  });

  app.post("/api/exams", (req, res) => {
    const { day_range, score, total, accuracy, incorrect_words } = req.body;
    db.prepare("INSERT INTO exam_results (day_range, score, total, accuracy, incorrect_words) VALUES (?, ?, ?, ?, ?)")
      .run(day_range, score, total, accuracy, JSON.stringify(incorrect_words));
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
