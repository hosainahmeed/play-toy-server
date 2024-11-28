require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

const app = express()
const port = process.env.PORT || 5000

// Middleware
app.use(express.json())
app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true
  })
)

const authenticateUser = (req, res, next) => {
  const token =
    req.headers.authorization && req.headers.authorization.split(' ')[1]

  if (!token) {
    return res.status(401).send({ message: 'Unauthorized: No token provided' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized: Invalid token' })
    }

    req.user = decoded
    next()
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.adkk5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
})

async function run () {
  try {
    await client.connect()
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
    const toysReviewsCollection = client.db('Toys').collection('reviews')
    const toysProductsCollection = client.db('Toys').collection('products')
    const toysWishListCollection = client.db('Toys').collection('wishList')
    const toysCartCollection = client.db('Toys').collection('cart')
    const toysBlogsCollection = client.db('Toys').collection('blogs')
    const toysPaymentCollection = client.db('Toys').collection('payment')
    const userCollection = client.db('Toys').collection('users')

    app.post('/jwt', async (req, res) => {
      try {
        const user = req.body
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: '3d'
        })
        const cookieOptions = {
          httpOnly: true,
          secure: false
        }
        res
          .cookie('token', token, cookieOptions)
          .status(200)
          .send({ success: true, message: 'JWT token issued' })
      } catch (error) {
        console.error('Error generating JWT:', error)
        res
          .status(500)
          .send({ success: false, message: 'Failed to issue JWT token' })
      }
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      if (user?.role !== 'admin') {
        return res
          .status(403)
          .send({ error: true, message: 'forbidden message' })
      }
      next()
    }

    app.get('/', (req, res) => {
      res.send('welcome')
    })

    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query)
      let admin = false
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin })
    })

    app.get('/reviews', async (req, res) => {
      try {
        const data = await toysReviewsCollection.find().toArray()
        res.send(data)
      } catch (error) {
        console.error('Error fetching reviews:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while fetching reviews.' })
      }
    })

    app.get('/products', async (req, res) => {
      try {
        const data = await toysProductsCollection.find().toArray()
        res.send(data)
      } catch (error) {
        console.error('Error fetching reviews:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while fetching reviews.' })
      }
    })
    app.get('/toysDetails/:id', async (req, res) => {
      try {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const data = await toysProductsCollection.findOne(query)
        res.send(data)
      } catch (error) {
        console.error('Error fetching reviews:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while fetching reviews.' })
      }
    })

    app.get('/wishList', async (req, res) => {
      try {
        const { userId } = req.query
        const query = userId ? { userId } : {}
        const data = await toysWishListCollection.find(query).toArray()
        res.send(data)
      } catch (error) {
        console.error('Error fetching wishlist:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while fetching the wishlist.' })
      }
    })

    // Add item to wish list
    app.post('/wishList', async (req, res) => {
      try {
        const { userId, toyId } = req.body // Expect userId and toyId in the request body
        if (!userId || !toyId) {
          return res
            .status(400)
            .send({ error: 'userId and toyId are required.' })
        }

        // Check if the item is already in the wishlist
        const existingItem = await toysWishListCollection.findOne({
          userId,
          toyId
        })
        if (existingItem) {
          return res.status(400).send({ error: 'Item already in wishlist.' })
        }

        // Add the item to the wishlist
        const data = await toysWishListCollection.insertOne({ userId, toyId })
        res.send(data)
      } catch (error) {
        console.error('Error adding to wishlist:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while adding to the wishlist.' })
      }
    })

    // Delete item from wish list by userId and toyId
    app.delete('/wishList', async (req, res) => {
      try {
        const { userId, toyId } = req.query // Expect userId and toyId as query parameters
        if (!userId || !toyId) {
          return res
            .status(400)
            .send({ error: 'userId and toyId are required.' })
        }

        const query = { userId, toyId }
        const result = await toysWishListCollection.deleteOne(query)

        if (result.deletedCount > 0) {
          res
            .status(200)
            .send({ message: 'Item successfully removed from wishlist' })
        } else {
          res.status(404).send({ error: 'Item not found in wishlist' })
        }
      } catch (error) {
        console.error('Error deleting item from wishlist:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while deleting the item' })
      }
    })

    app.get('/cart', async (req, res) => {
      try {
        const { userId } = req.query
        const query = userId ? { userId } : {}
        const data = await toysCartCollection.find(query).toArray()
        res.send(data)
      } catch (error) {
        console.error('Error fetching wishlist:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while fetching the wishlist.' })
      }
    })
    app.post('/cart', async (req, res) => {
      try {
        const { userId, toyId, name, image, price, category, quantity } =
          req.body

        if (!userId || !toyId || !name || !image || !price || !quantity) {
          return res.status(400).send({ error: 'All fields are required.' })
        }
        const existingItem = await toysCartCollection.findOne({
          userId,
          toyId
        })

        if (existingItem) {
          return res.status(400).send({ error: 'Item already in cart.' })
        }
        const cartItem = {
          userId,
          toyId,
          name,
          image,
          price,
          category,
          quantity
        }

        const data = await toysCartCollection.insertOne(cartItem)
        res.send({ success: true, message: 'Item added to cart.', data })
      } catch (error) {
        console.error('Error adding to cart:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while adding to the cart.' })
      }
    })
    app.delete('/cart/:id', async (req, res) => {
      try {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await toysCartCollection.deleteOne(query)
        res.send(result)
      } catch (error) {
        console.error('Error adding to cart:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while adding to the cart.' })
      }
    })

    app.get('/blogs', async (req, res) => {
      try {
        const data = await toysBlogsCollection.find().toArray()
        res.send(data)
      } catch (error) {
        console.error('Error fetching reviews:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while fetching reviews.' })
      }
    })

    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body
      const amount = Math.round(price * 100)

      if (amount < 50) {
        return res.status(400).send({
          error: 'The amount must be at least $0.50'
        })
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        })

        res.send({
          clientSecret: paymentIntent.client_secret
        })
      } catch (error) {
        console.error('Error creating payment intent:', error)
        res.status(500).send({
          error: 'Failed to create payment intent'
        })
      }
    })

    app.get('/payments/:email', async (req, res) => {
      const query = { email: req.params.email }
      const result = await toysPaymentCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body
      const paymentResult = await toysPaymentCollection.insertOne(payment)
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      }
      const deleteResult = await toysCartCollection.deleteMany(query)
      res.send({ paymentResult, deleteResult })
    })
  } finally {
    // await client.close();
  }
}
run().catch(console.dir)

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
