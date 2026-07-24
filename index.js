const express = require('express');
const cors = require('cors');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const admin = require("firebase-admin");

const port = 3000

// firebase admin
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.use(cors())
app.use(express.json())

// const logger = (req, res, next)
// middleware
const verifyFirebaseToken = async (req, res, next) => {
    console.log('in verify', req.headers.authorization)
    const authorization = (req.headers.authorization)
    if (!authorization) {
        return res.status(401).send({ message: 'unauthorization token' })
    }
    const token = authorization.split(' ')[ 1 ];
    if (!token) {
        return res.status(401).send({ message: 'unauthorization user' })
    }
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.patient_email = decoded.email;
        next();
    }
    catch (error) {
        console.log('invalid token', error)
        return res.status(401).send({message: "unsuthorized token"})
    }
}

// hospital
// emC0HD8UkfZubpSx
// const uri = "mongodb+srv://hospital:emC0HD8UkfZubpSx@cluster0.i4vs1nh.mongodb.net/?appName=Cluster0";
const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-tnfghrx-shard-00-00.i4vs1nh.mongodb.net:27017,ac-tnfghrx-shard-00-01.i4vs1nh.mongodb.net:27017,ac-tnfghrx-shard-00-02.i4vs1nh.mongodb.net:27017/?ssl=true&replicaSet=atlas-pgcyip-shard-0&authSource=admin&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.get('/', (req, res) => {
    res.send('hospital project')
})

async function run() {
    try {
        await client.connect();
        const db = client.db('hospital');
        const ourServicesCollection = db.collection('ourServices');
        const doctorsCollection = db.collection('doctors');
        const categoriesCollection = db.collection('categories');
        const servicessCollection = db.collection('services');
        const newsCollection = db.collection('news');
        const appoinmentCollection = db.collection('appoinments');
        const usersCollection = db.collection('users');



        // get doctors
        app.get("/doctors", async (req, res) => {
            const result = await doctorsCollection.find().toArray();
            res.send(result)
        })

        // get a doctors
        app.get('/doctors/:id', async (req, res) => {
            const id = req.params.id;
            const quary = {
                _id: new ObjectId(id),
            }
            const result = await doctorsCollection.findOne(quary);
            res.send(result);
        })

        // get news
        app.get("/news", async (req, res) => {
            const result = await newsCollection.find().toArray();
            res.send(result)
        })

        // get services
        app.get("/services", async (req, res) => {
            const result = await servicessCollection.find().toArray();
            res.send(result)
        })

        // get categories
        app.get("/categories", async (req, res) => {
            const result = await categoriesCollection.find().toArray();
            res.send(result)
        })

        // post appoinment
        app.post('/appoinments', verifyFirebaseToken, async (req, res) => {
            const newAppoinment = (req.body);
            const result = await appoinmentCollection.insertOne(newAppoinment);
            res.send(result);
        })

        // post appoinment
        app.get('/appoinments', async (req, res) => {
            const result = await appoinmentCollection.find().toArray();
            res.send(result)
        })
        // get patient appoinment
        app.get('/appoinments/:email', verifyFirebaseToken, async (req, res) => {
            const email = req.params.email;
            const quary = { email: email }
            const result = await appoinmentCollection.find(quary).toArray();
            res.send(result);
        })

        // user post
        app.post('/users', verifyFirebaseToken, async (req, res) => {
            const result = await usersCollection.insertOne(req.body);
            res.send(result);
        })

        // user get
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        // a user get
        app.get('/users/:email', verifyFirebaseToken, async (req, res) => {
            console.log(req.headers)
            const email = req.params.email;
            const quary = { email: email }
            const result = await usersCollection.findOne(quary);
            res.send(result);
        })

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



// module.exports = app;
if (process.env.NODE_ENV !== "production") {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}


module.exports = app;