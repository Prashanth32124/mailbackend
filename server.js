// ==== server.js (Node.js Backend) ====
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");

dotenv.config();
const app = express();
const PORT = 5000;
const mongoURL = process.env.MONGO_URL;

if (!mongoURL) {
  console.log("❌ MONGO_URL is missing");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

MongoClient.connect(mongoURL)
  .then((client) => {
    console.log("✅ Database connected");
    const db = client.db("iBox");

    app.get("/", (req, res) => {
      res.send("Hello Prashu! API is running.");
    });

    app.post("/inbox", async (req, res) => {
      const { username } = req.body;
      try {
        const messages = await db.collection("Messages")
          .find({ to: username })
          .sort({ timestamp: -1 })
          .toArray();

        // Update all unseen messages to seen
        const unseenIds = messages.filter(m => !m.seen).map(m => m._id);
        if (unseenIds.length > 0) {
          await db.collection("Messages").updateMany(
            { _id: { $in: unseenIds } },
            { $set: { seen: true } }
          );
        }

        res.json({ messages });
      } catch (err) {
        res.status(500).json({ message: "❌ Failed to load inbox", error: err.message });
      }
    });

   app.post("/check-email", async (req, res) => {
  const { email } = req.body;
  const users = db.collection("Mailusers");

  try {
    const user = await users.findOne({
      username: { $regex: `^${email}$`, $options: "i" } // case-insensitive exact match
    });

    if (user) {
      res.json({ found: true, message: "✅ Valid recipient" });
    } else {
      res.status(404).json({ found: false, message: "❌ No such user" });
    }
  } catch (err) {
    res.status(500).json({ message: "❌ Server error", error: err.message });
  }
});


   app.post("/send-mail", async (req, res) => {
  const { from, to, subject, body } = req.body;
  const users = db.collection("Mailusers");

  try {
    const recipient = await users.findOne({
      username: { $regex: `^${to}$`, $options: "i" }
    });

    if (!recipient) {
      return res.status(404).json({ message: "❌ Recipient not found" });
    }

    const messages = db.collection("Messages");
    const result = await messages.insertOne({
      from, to, subject, body, seen: false, timestamp: new Date()
    });

    res.json({ message: "✅ Mail sent", id: result.insertedId });
  } catch (err) {
    res.status(500).json({ message: "❌ Failed to send mail", error: err.message });
  }
});


    app.post("/mark-seen", async (req, res) => {
      const { messageId } = req.body;
      try {
        await db.collection("Messages").updateOne(
          { _id: new ObjectId(messageId) },
          { $set: { seen: true } }
        );
        res.json({ message: "✅ Message marked as seen" });
      } catch (err) {
        res.status(500).json({ message: "❌ Failed to mark as seen", error: err.message });
      }
    });

    app.post("/signup", async (req, res) => {
      const { username, password12 } = req.body;
      const users = db.collection("Mailusers");
      const exists = await users.findOne({ username });

      if (exists) {
        return res.status(400).json({ message: "❌ Username taken" });
      }

      await users.insertOne({ username, password12 });
      res.json({ message: "✅ Signup successful" });
    });

    app.post("/login", async (req, res) => {
  const { username, password12 } = req.body;
  const users = db.collection("Mailusers");

  try {
    const user = await users.findOne({
      username: { $regex: `^${username}$`, $options: "i" }, // case-insensitive
      password12
    });

    if (user) {
      res.json({ message: "✅ Login successful" });
    } else {
      res.status(401).json({ message: "❌ Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ message: "❌ Server error", error: err.message });
  }
});


    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => console.error("❌ DB connection failed:", err));
