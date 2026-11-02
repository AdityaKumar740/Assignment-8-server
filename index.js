import express from "express";
import cors from "cors";
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const PORT = 5000;

const app = express();
app.use(cors({
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use((request, response, next) => {
  console.log("Authorization:", request.headers.authorization);
  next();
});



const client = new MongoClient(process.env.MONGO_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const connectclient = await connectToMongoDB();
const db = connectclient.db("assignment-8");

app.get("/",(req, res) =>{
    res.send("Hello ph");
});

app.get("/test" , (req, res) =>{
    res.json({message : "test api"});
});

//http://localhost:5000/create-event

app.get("/events", async (req, res) => {
  try {
    const events = await db.collection("events").find({}).sort({ date: 1 }).toArray();
    res.json(events);
  } catch (error) {
    console.error("Failed to fetch events:", error);
    res.status(500).json({ message: "Failed to fetch events" });
  }
});

app.get("/events/:id", async (req, res) => {
  try {
    const { ObjectId } = await import("mongodb");
    const event = await db.collection("events").findOne({ _id: new ObjectId(req.params.id) });
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (error) {
    console.error("Failed to fetch event:", error);
    res.status(500).json({ message: "Failed to fetch event" });
  }
});

app.post("/create-event", async (req, res) => {
  try {
    const { title, description, category, image, location, date, attendees, createdByEmail, organizer } = req.body;
    if (!title || !description || !category || !image || !location || !date || !createdByEmail) {
      return res.status(400).json({ message: "All event fields and creator email are required" });
    }
    const eventDate = new Date(date);
    if (Number.isNaN(eventDate.getTime()) || eventDate <= new Date()) {
      return res.status(400).json({ message: "Event date must be in the future" });
    }
    const result = await db.collection("events").insertOne({
      title, description, category, image, location, date, attendees: Number(attendees ?? 0),
      createdByEmail: String(createdByEmail).toLowerCase(),
      organizer: organizer || null,
      joinedByEmails: [],
      createdAt: new Date(),
    });

    res.status(201).json({
      acknowledged: result.acknowledged,
      insertedId: result.insertedId
    });
  } catch (error) {
    console.error("Failed to create event:", error);
    res.status(500).json({ message: "Failed to create event" });
  }
});

app.delete("/events/:id", async (req, res) => {
  try {
    const { ObjectId } = await import("mongodb");
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const creatorEmail = String(req.query.email || req.body?.email || "").toLowerCase();
    const event = await db.collection("events").findOne({ _id: new ObjectId(req.params.id) });
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (!creatorEmail || String(event.createdByEmail || "").toLowerCase() !== creatorEmail) {
      return res.status(403).json({ message: "You can only delete events you created" });
    }
    const result = await db.collection("events").deleteOne({
      _id: new ObjectId(req.params.id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json({ acknowledged: result.acknowledged, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Failed to delete event:", error);
    res.status(500).json({ message: "Failed to delete event" });
  }
});

app.patch("/events/:id", async (req, res) => {
  try {
    const { ObjectId } = await import("mongodb");
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid event ID" });
    const email = String(req.body.email || "").toLowerCase();
    const event = await db.collection("events").findOne({ _id: new ObjectId(req.params.id) });
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (!email || String(event.createdByEmail || "").toLowerCase() !== email) {
      return res.status(403).json({ message: "You can only update events you created" });
    }
    const allowed = ["title", "description", "category", "image", "location", "date", "attendees"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = key === "attendees" ? Number(req.body[key]) : req.body[key];
    }
    if (updates.date !== undefined) {
      const eventDate = new Date(updates.date);
      if (Number.isNaN(eventDate.getTime()) || eventDate <= new Date()) {
        return res.status(400).json({ message: "Event date must be in the future" });
      }
    }
    const result = await db.collection("events").updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates });
    res.json({ acknowledged: result.acknowledged, updatedCount: result.modifiedCount });
  } catch (error) {
    console.error("Failed to update event:", error);
    res.status(500).json({ message: "Failed to update event" });
  }
});

app.use("/events/:id/:action", (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!authorization.slice(7).trim()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  console.log("Authorization Bearer token received");
  next();
});

app.post("/events/:id/join", async (req, res) => {
  try {
    const { ObjectId } = await import("mongodb");
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid event ID" });
    const email = String(req.body.email || "").toLowerCase();
    if (!email) return res.status(400).json({ message: "User email is required" });
    await db.collection("events").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $addToSet: { joinedByEmails: email } }
    );
    res.json({ joined: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to join event" });
  }
});

app.post("/events/:id/leave", async (req, res) => {
  try {
    const { ObjectId } = await import("mongodb");
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid event ID" });
    const email = String(req.body.email || "").toLowerCase();
    if (!email) return res.status(400).json({ message: "User email is required" });
    await db.collection("events").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $pull: { joinedByEmails: email } }
    );
    res.json({ joined: false });
  } catch (error) {
    res.status(500).json({ message: "Failed to leave event" });
  }
});

app.listen(PORT, () =>{
    console.log (`server is running on port ${PORT}`);
});
