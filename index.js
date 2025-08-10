const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')

const port = 3000

//middleware
// app.use(cors());
// app.use(express.json());


app.use(cors({
  origin: ['https://aesthetic-cannoli-aa3f60.netlify.app','http://localhost:5173'],
  credentials: true,
}));
app.use(express.json())
app.use(cookieParser())


const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  console.log('Cookie in the middleware', token)

  if (!token) {
    return res.status(401).send({ message: 'Unauthorized Access' })
  }
  //verify token
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized Access' })
    }
    req.decoded = decoded;
    next()
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const uri = `mongodb+srv://course_management_system:UcEfVqgA1vG22AG8@cluster0.q12amc9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const uri = "mongodb+srv://course_management_system:ZEnLQIGn3mhZQnZ4@cluster0.q12amc9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const courseCollection = client.db("course_hub").collection("courses");
    const enrollCollection = client.db("course_hub").collection("enrollments")


    //  generate JWT for localstorage

    // app.post('/jwt',(req,res)=>{
    //   const user = {email: req.body.email}
    //   // console.log(user)
    //   const token = jwt.sign(user,process.env.JWT_ACCESS_SECRET, {expiresIn:'1d'})
    //   res.send({token,message:'JWT Created Successfully'})
    // })

    app.post('/jwt', async (req, res) => {
      const userData = req.body;
      const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, { expiresIn: '1d' })

      // set token in the cookies

      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: "none"
      })

      res.send({ success: true })
    })

    app.get('/all-courses', async (req, res) => {
      const sortField = ({ createdDate: -1 })
      const limitNum = 6
      const cursor = courseCollection.find().sort(sortField).limit(limitNum)
      const result = await cursor.toArray()
      res.send(result)
    })

  

    app.get('/courses', async (req, res) => {

       const query = { email: req.query.email };
      const result = await courseCollection.find(query).toArray();

      res.send(result);
    });

    app.get('/course/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await courseCollection.findOne(query)
      res.send(result)
    })

    app.post('/add-course',verifyToken, async (req, res) => {
      const userEmail = req.query.email;
      if(userEmail !== req.decoded.email){
        return res.status(403).send({message: 'Forbidden: Email is not match'})
      }

      const newCourse = req.body;
      const result = await courseCollection.insertOne(newCourse)
      res.send(result)
    })


    //check
    app.get('/enroll/check', async (req, res) => {
      const { courseId, email } = req.query;
      const result = await enrollCollection.findOne({ courseId, email });
      res.send(result);
    });

    //enroll
    app.post('/enroll-course', async (req, res) => {
      const { courseId, email } = req.body;
      const enrollment = {
        courseId, email
      }
      const result = await enrollCollection.insertOne(enrollment)
      res.send(result)
    })

    //unroll
    app.delete('/unenroll-course', async (req, res) => {
      const { courseId, email } = req.query;
      const result = await enrollCollection.deleteOne({ courseId, email });
      res.send(result);
    });


    app.put('/update-course/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedCourse = req.body

      const updateDoc = {
        $set: updatedCourse
      }
      const result = await courseCollection.updateOne(filter, updateDoc, options)
      res.send(result)
    })

    app.delete('/delete-course/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await courseCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/my-enrolled-courses', verifyToken, async (req, res) => {
      const userEmail = req.query.email;

      if (userEmail !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden: Email mismatch' });
      }

      const enrolled = await enrollCollection.find({ email: userEmail }).toArray();
      const courseIds = enrolled.map(item => new ObjectId(item.courseId));
      const courses = await courseCollection.find({ _id: { $in: courseIds } }).toArray();
      res.send(courses)
    });

    app.get('/popular-courses', async (req, res) => {
      const popular = await enrollCollection.aggregate([
        {
          $group: {
            _id: "$courseId",
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 6
        }

      ]).toArray()

      const courseIds = popular.map(item => new ObjectId(item._id));
      const courses = await courseCollection.find({ _id: { $in: courseIds } }).toArray()
      res.send(courses);

    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Course Management System!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})