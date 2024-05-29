const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zexvqii.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // collection
    const userCollection = client.db(`nextNatureNursery`).collection("users");
    const productCollection = client
      .db(`nextNatureNursery`)
      .collection("products");

    // -------------------------user api---------------------------------
    // Route to get all users
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Route to get a user by email
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // Route to add a user
    app.post("/addUser", async (req, res) => {
      const user = req.body;
      // Check if body is empty
      if (!user || Object.keys(user).length === 0) {
        return res
          .status(400)
          .send({ message: "Request body cannot be empty" });
      }
      // Check for required fields (name, email, photo, and role)
      const { name, email, photo, role } = user;

      if (!name) {
        return res.status(400).send({ message: "Name is required" });
      }
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      if (!photo) {
        return res.status(400).send({ message: "Photo URL is required" });
      }
      if (!role) {
        return res.status(400).send({ message: "Role is required" });
      }
      try {
        const query = { email: user.email };
        const userExist = await userCollection.findOne(query);
        if (userExist) {
          return res.send({ message: "User already exists" });
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Route to delete a user by email
    app.delete("/deleteUser/:email", async (req, res) => {
      const email = req.params.email;
      // Validate the email parameter
      if (!email) {
        return res.status(400).send({ message: "Email parameter is required" });
      }
      try {
        const query = { email: email };
        const result = await userCollection.deleteOne(query);
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }
        res.send({ message: "User deleted successfully", result });
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // -------------------------product api---------------------------------
    // Route to get all products
    app.get("/products", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    // Route to get a product by ID
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      // Validate ObjectID
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid product ID" });
      }
      const query = { _id: new ObjectId(id) };
      try {
        const result = await productCollection.findOne(query);
        if (!result) {
          return res.status(404).send({ message: "Product not found" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Route to get all products uploaded by a specific email
    app.get("/products/uploadedBy/:email", async (req, res) => {
      const email = req.params.email;

      try {
        const query = { uploadByEmail: email };
        const products = await productCollection.find(query).toArray();
        res.send(products);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Route to add a product
    app.post("/addProduct", async (req, res) => {
      const product = req.body;

      // Check if body is empty
      if (!product || Object.keys(product).length === 0) {
        return res
          .status(400)
          .send({ message: "Request body cannot be empty" });
      }

      // Check for required fields
      const {
        name,
        price,
        photos,
        category,
        quantity,
        rating,
        previousPrice,
        description,
      } = product;

      if (!name) {
        return res.status(400).send({ message: "Name is required" });
      }
      if (!price) {
        return res.status(400).send({ message: "Price is required" });
      }
      if (!photos) {
        return res.status(400).send({ message: "Photo URL is required" });
      }
      if (!category) {
        return res.status(400).send({ message: "Category is required" });
      }
      if (quantity == null) {
        return res.status(400).send({ message: "Quantity is required" });
      }
      if (rating == null) {
        return res.status(400).send({ message: "Rating is required" });
      }
      if (previousPrice == null) {
        return res.status(400).send({ message: "Previous Price is required" });
      }
      if (!description) {
        return res.status(400).send({ message: "Description is required" });
      }

      try {
        const query = { name: product.name };
        const productExist = await productCollection.findOne(query);
        if (productExist) {
          return res.send({ message: "Product already exists" });
        }
        const result = await productCollection.insertOne(product);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Route to partially update a product by ID
    app.patch("/updateProduct/:id", async (req, res) => {
      const id = req.params.id;
      const updateFields = req.body;

      // Validate ObjectID
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid product ID" });
      }

      // Check if body is empty
      if (!updateFields || Object.keys(updateFields).length === 0) {
        return res
          .status(400)
          .send({ message: "Request body cannot be empty" });
      }

      // Prepare the update document dynamically based on provided fields
      const update = { $set: {} };
      for (const field in updateFields) {
        if (updateFields.hasOwnProperty(field)) {
          update.$set[field] = updateFields[field];
        }
      }

      try {
        const query = { _id: new ObjectId(id) };
        const result = await productCollection.updateOne(query, update);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Product not found" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Route to delete a product by ID
    app.delete("/deleteProduct/:id", async (req, res) => {
      const id = req.params.id;
      // Validate ObjectID
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid product ID" });
      }
      try {
        const query = { _id: new ObjectId(id) };
        const result = await productCollection.deleteOne(query);
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Product not found" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });
    // ---------------------------product category api--------------------------------
    // Route to get product categories with total product count
    app.get("/products/groupedByCategory", async (req, res) => {
      try {
        const products = await productCollection
          .aggregate([
            {
              $group: {
                _id: "$category",
                totalProducts: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                category: "$_id",
                totalProducts: 1,
              },
            },
          ])
          .toArray();

        res.send(products);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Route to get products by category
    app.get("/products/category/:category", async (req, res) => {
      const category = req.params.category;

      try {
        const products = await productCollection.find({ category }).toArray();
        res.send(products);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // ---------------------------product search api--------------------------------
    // Route to search products by name
    app.get("/products/search/:name", async (req, res) => {
      const name = req.params.name;
      try {
        const query = { name: { $regex: name, $options: "i" } };
        const products = await productCollection
          .find(query)
          .sort({ name: 1 })
          .toArray();
        res.send(products);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Route to search products by name within a specific category
    app.get("/products/category/:category/search/:name", async (req, res) => {
      const category = req.params.category;
      const name = req.params.name;

      try {
        const query = {
          category: category,
          name: { $regex: name, $options: "i" }, // Case-insensitive search
        };
        const products = await productCollection.find(query).toArray();
        res.send(products);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Send a ping to confirm a successful connection---------------------------------------------------------
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Next nature Nursery server is running");
});

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
