require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

const app = express()
const port = process.env.PORT || 5000

// Middleware
app.use(
  cors({
    origin: [
      // 'http://localhost:5173',
      'https://playtoy-1c00b.web.app',
      'https://playtoy-1c00b.firebaseapp.com'
    ],
    credentials: true
  })
)
app.use(express.json())
app.use(cookieParser())

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
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
    // await client.connect()
    // await client.db('admin').command({ ping: 1 })
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
      const email = req.user.email
      const query = { email: email }
      const user = await userCollection.findOne(query)

      if (!user) {
        return res.status(404).send({ error: true, message: 'User not found' })
      }

      if (user?.role !== 'admin') {
        res.status(403).send({ error: true, message: 'You are not an admin' })
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

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid user ID' })
      }

      const query = { _id: new ObjectId(id) }

      try {
        const result = await userCollection.updateOne(query, {
          $set: { role: 'admin' }
        })

        if (result.modifiedCount > 0) {
          res.status(200).json({
            message: 'User role updated to admin',
            modifiedCount: result.modifiedCount
          })
        } else {
          res.status(404).json({ message: 'User not found or no changes made' })
        }
      } catch (error) {
        console.error('Error updating user role:', error)
        res.status(500).json({ message: 'Internal Server Error', error })
      }
    })

    app.post('/users', async (req, res) => {
      try {
        const { displayName, email } = req.body
        const userInfo = {
          name: displayName,
          email: email,
          role: 'user'
        }
        const data = await userCollection.insertOne(userInfo)
        res.send(data)
      } catch (error) {
        console.error('Error adding user:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while adding the user.' })
      }
    })

    app.delete('/users/:id', async (req, res) => {
      try {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await userCollection.deleteOne(query)
        res.send(result)
      } catch (error) {
        console.error('Error adding user:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while delete the user.' })
      }
    })

    app.get(
      '/users/admin/:email',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email
        if (email !== req.user.email) {
          res.send({ admin: false })
        }
        const query = { email: email }
        const user = await userCollection.findOne(query)
        const result = { admin: user?.role === 'admin' }
        res.send(result)
      }
    )

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
    app.post('/products', async (req, res) => {
      try {
        const {
          name,
          image,
          price,
          reviews,
          stars,
          description,
          category,
          features
        } = req.body
        const newProduct = {
          name,
          image,
          price,
          reviews,
          stars,
          description,
          category,
          features
        }
        const result = await toysProductsCollection.insertOne(newProduct)
        res.status(201).send({
          message: 'Product added successfully',
          productId: result.insertedId
        })
      } catch (error) {
        console.error('Error adding product:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while adding the item.' })
      }
    })

    app.delete('/products/:id', async (req, res) => {
      try {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const data = await toysProductsCollection.deleteOne(query)
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

    app.post('/wishList', async (req, res) => {
      try {
        const { userId, toyId } = req.body
        if (!userId || !toyId) {
          return res
            .status(400)
            .send({ error: 'userId and toyId are required.' })
        }

        const existingItem = await toysWishListCollection.findOne({
          userId,
          toyId
        })
        if (existingItem) {
          return res.status(400).send({ error: 'Item already in wishlist.' })
        }

        const data = await toysWishListCollection.insertOne({ userId, toyId })
        res.send(data)
      } catch (error) {
        console.error('Error adding to wishlist:', error)
        res
          .status(500)
          .send({ error: 'An error occurred while adding to the wishlist.' })
      }
    })

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

    app.get('/cart/:email', async (req, res) => {
      try {
        const email = req.params.email
        console.log(email)
        const query = { userId: email }
        const data = await toysCartCollection.find(query).toArray()
        res.send(data)
      } catch (error) {
        console.error('Error fetching cart data:', error)
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
        // const existingItem = await toysCartCollection.findOne({
        //   userId,
        //   toyId
        // })

        // if (existingItem) {
        //   return res.status(400).send({ error: 'Item already in cart.' })
        // }
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

    app.get('/blog/:id', (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = toysBlogsCollection.find(query).toArray()
      res.send(result)
    })

    app.put('/blogs/:id', async (req, res) => {
      const { id } = req.params
      const newId = { _id: new ObjectId(id) }
      const { author, title, image, readTime, publishDate, content } = req.body
      try {
        const updatedBlog = await toysBlogsCollection.updateOne(newId, [
          {
            $set: {
              author,
              title,
              image,
              readTime,
              publishDate,
              content
            }
          },
          {
            $set: {
              updatedAt: new Date()
            }
          }
        ])
        if (updatedBlog.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: 'Blog not found or no changes made' })
        }
        res.status(200).send({ message: 'Blog updated successfully' })
      } catch (err) {
        console.error(err)
        res.status(500).send({ message: 'Failed to update blog' })
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
      try {
        const { email } = req.params
        const query = { email: email }
        const result = await toysPaymentCollection.find(query).toArray()
        if (result.length === 0) {
          return res
            .status(404)
            .json({ message: 'No payments found for this email.' })
        }
        res.json(result)
      } catch (error) {
        console.error('Error fetching payments:', error)
        res
          .status(500)
          .json({ message: 'Server error. Please try again later.' })
      }
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
  }
}
run().catch(console.dir)

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
