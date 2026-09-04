const express = require('express');
const cors = require('cors');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const admin = require("firebase-admin");

const port = process.env.PORT || 3000;

// Firebase Admin Initialization
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Middleware
app.use(cors());
app.use(express.json());

// Verify Firebase Token Middleware
const verifyFirebaseToken = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'Unauthorized access: No token provided' });
    }
    const token = authorization.split(' ')[1];
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access: Invalid token format' });
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.patient_email = decodedToken.email;
        next();
    } catch (error) {
        console.error('Invalid Token:', error);
        return res.status(401).send({ message: "Unauthorized access: Invalid token" });
    }
};

// MongoDB Connection String
const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-tnfghrx-shard-00-00.i4vs1nh.mongodb.net:27017,ac-tnfghrx-shard-00-01.i4vs1nh.mongodb.net:27017,ac-tnfghrx-shard-00-02.i4vs1nh.mongodb.net:27017/?ssl=true&replicaSet=atlas-pgcyip-shard-0&authSource=admin&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.get('/', (req, res) => {
    res.send('Hospital Management Server Running');
});

async function run() {
    try {
        await client.connect();
        const db = client.db('hospital');

        const doctorsCollection = db.collection('doctors');
        const categoriesCollection = db.collection('categories');
        const servicesCollection = db.collection('services');
        const newsCollection = db.collection('news');
        const appointmentCollection = db.collection('appoinments');
        const usersCollection = db.collection('users');
        const messagesCollection = db.collection('message');
        const doctorSignupRequestCollection = db.collection('doctorSignupRequest');

        // ================= DOCTOR SIGNUP REQUEST APIS ================= //

        // Get all doctor signup requests
        app.get('/doctorSignupRequest', verifyFirebaseToken, async (req, res) => {
            const result = await doctorSignupRequestCollection.find().toArray();
            res.send(result);
        });

        // get single doctor signup request by id
        app.get('/doctorSignupRequest/:id', verifyFirebaseToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await doctorSignupRequestCollection.findOne(query);
            res.send(result);
        });

        // Submit doctor signup request
        app.post('/doctorSignupRequest', async (req, res) => {
            const doctorData = req.body;
            const result = await doctorSignupRequestCollection.insertOne(doctorData);
            res.send(result);
        });

        // APPROVE Doctor Request: Move doctor to 'doctors' & 'users' collection, then delete request
        app.post('/doctorSignupRequest/approve/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const requestData = await doctorSignupRequestCollection.findOne(query);
            if (!requestData) {
                return res.status(404).send({ message: "Request not found" });
            }

            // Remove Mongo default ID to re-insert cleanly
            const { _id, ...doctorInfo } = requestData;
            doctorInfo.status = "active";

            // Add to doctors & users collection
            const doctorResult = await doctorsCollection.insertOne(doctorInfo);
            await usersCollection.insertOne(doctorInfo);

            // Delete from pending requests
            await doctorSignupRequestCollection.deleteOne(query);

            res.send({ message: "Doctor Approved Successfully", result: doctorResult });
        });

        // REJECT Doctor Request: Delete from pending collection
        app.delete('/doctorSignupRequest/reject/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await doctorSignupRequestCollection.deleteOne(query);
            res.send(result);
        });

        // ================= DOCTOR APIS ================= //

        app.get("/doctors", async (req, res) => {
            const result = await doctorsCollection.find().toArray();
            res.send(result);
        });

        app.get('/doctors/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await doctorsCollection.findOne(query);
            res.send(result);
        });

        // ================= OTHER APIS ================= //

        app.get("/news", async (req, res) => {
            const result = await newsCollection.find().toArray();
            res.send(result);
        });

        app.get("/services", async (req, res) => {
            const result = await servicesCollection.find().toArray();
            res.send(result);
        });

        app.get("/categories", async (req, res) => {
            const result = await categoriesCollection.find().toArray();
            res.send(result);
        });

        // Appointment APIs
        app.post('/appoinments', async (req, res) => {
            const result = await appointmentCollection.insertOne(req.body);
            res.send(result);
        });

        app.get('/appoinments', verifyFirebaseToken, async (req, res) => {
            const result = await appointmentCollection.find().toArray();
            res.send(result);
        });

        app.get('/appoinments/:email', verifyFirebaseToken, async (req, res) => {
            const email = req.params.email;
            console.log(req.headers.token)
            const result = await appointmentCollection.find({ email }).toArray();
            res.send(result);
        });

        app.get('/recentAppoinments', verifyFirebaseToken, async (req, res) => {
            const result = await appointmentCollection.find().limit(5).sort({ date: -1 }).toArray();
            res.send(result);
        });

        // User APIs
        app.post('/users', async (req, res) => {
            const result = await usersCollection.insertOne(req.body);
            res.send(result);
        });

        app.get('/users', verifyFirebaseToken, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({ email });
            res.send(result);
        });

        // Messages APIs
        app.get('/messages', verifyFirebaseToken, async (req, res) => {
            const result = await messagesCollection.find().toArray();
            res.send(result);
        });

        app.post("/messages", verifyFirebaseToken, async (req, res) => {
            const result = await messagesCollection.insertOne(req.body);
            res.send(result);
        });

        console.log("Successfully connected to MongoDB!");
    } catch (err) {
        console.error("MongoDB Connection Error:", err);
    }
}
run().catch(console.dir);

if (process.env.NODE_ENV !== "production") {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

module.exports = app;