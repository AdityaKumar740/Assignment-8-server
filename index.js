import express from "express";
import cors from "cors";
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const PORT = 5000;

const app = express();
app.use(cors());
app.use(express.json());
 
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

app.get("/create-event", (req, res) => {
  res.json({ message: "api working.." });
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
    const result = await db.collection("events").insertOne(req.body);

    res.status(201).json({
      acknowledged: result.acknowledged,
      insertedId: result.insertedId
    });
  } catch (error) {
    console.error("Failed to create event:", error);
    res.status(500).json({ message: "Failed to create event" });
  }
});

app.listen(PORT, () =>{
    console.log (`server is running on port ${PORT}`);
});
