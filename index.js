require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

const app = express()
const port = process.env.PORT || 5000

// Middleware
app.use(express.json())
app.use(cors())

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

    app.get('/', (req, res) => {
      res.send('welcome')
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
  } finally {
    // await client.close();
  }
}
run().catch(console.dir)

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
