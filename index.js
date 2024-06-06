const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
// jwt token middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    res.status(401).send({ error: true, message: "Unauthorized access" });
  }
  // bearer token
  const token = authorization?.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).send({ error: true, message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

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
    const cartCollection = client.db(`nextNatureNursery`).collection("cart");
    const purchaseCollection = client
      .db(`nextNatureNursery`)
      .collection("purchase");

    // -------------------------jwt token api---------------------------------

    app.post("/jwt", (req, res) => {
      const user = req.body;
      if (!user || Object.keys(user).length === 0) {
        return res
          .status(400)
          .send({ message: "Request body cannot be empty" });
      }
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "48h",
      });
      res.send({ token });
    });

    // -------------------------middleware verifyAdmin---------------------------
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      try {
        const query = { email: email };
        const user = await userCollection.findOne(query);
        if (user?.role !== "superAdmin" && user?.role !== "admin") {
          res.status(403).send({ error: true, message: "Forbidden access" });
        }
        next();
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    };

    // -------------------------user api---------------------------------
    // Route to get all users
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Route to get a user by email
    app.get("/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded?.email;
      if (decodedEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      try {
        const query = { email: email };
        const result = await userCollection.findOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
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
    // Route to update a user by email
    app.patch("/updateUser/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const updateFields = req.body;

      // Validate the email parameter
      if (!email) {
        return res.status(400).send({ message: "Email parameter is required" });
      }
      const decodedEmail = req.decoded?.email;
      if (decodedEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
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
        const query = { email: email };
        const result = await userCollection.updateOne(query, update);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Route to delete a user by email
    app.delete(
      "/deleteUser/:email",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        // Validate the email parameter
        if (!email) {
          return res
            .status(400)
            .send({ message: "Email parameter is required" });
        }
        const decodedEmail = req.decoded?.email;
        if (decodedEmail !== email) {
          return res.status(403).send({ message: "Forbidden access" });
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
      }
    );

    // -----------------check superAdmin,admin or user api----------------------
    // check superAdmin
    app.get("/users/superAdmin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (!email) {
        return res.status(400).send({ message: "Email parameter is required" });
      }
      const decodedEmail = req.decoded?.email;
      if (decodedEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const result = { superAdmin: user?.role === "superAdmin" };
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });
    // check admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (!email) {
        return res.status(400).send({ message: "Email parameter is required" });
      }
      const decodedEmail = req.decoded?.email;
      if (decodedEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const result = { admin: user?.role === "admin" };
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });
    // check user
    app.get("/users/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (!email) {
        return res.status(400).send({ message: "Email parameter is required" });
      }
      const decodedEmail = req.decoded?.email;
      if (decodedEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const result = { user: user?.role === "user" };
        res.send(result);
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
    app.get(
      "/products/uploadedBy/:email",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const decodedEmail = req.decoded?.email;
        if (decodedEmail !== email) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        try {
          const query = { uploadByEmail: email };
          const products = await productCollection.find(query).toArray();
          res.send(products);
        } catch (error) {
          res.status(500).send({ message: "An error occurred", error });
        }
      }
    );

    // Route to add a product
    app.post("/addProduct", verifyJWT, verifyAdmin, async (req, res) => {
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
    app.patch(
      "/updateProduct/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

    // Route to delete a product by ID
    app.delete(
      "/deleteProduct/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
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
      }
    );
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

    // ---------------------------User product cart  api--------------------------------
    // Route to get all products in the cart
    app.get("/cart", verifyJWT, async (req, res) => {
      const result = await cartCollection.find().toArray();
      res.send(result);
    });
    // Route to get a product in the cart by ID
    app.get("/cartItem/:id", async (req, res) => {
      const id = req.params.id;
      // Validate ObjectID
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid product ID" });
      }
      const query = { _id: new ObjectId(id) };
      try {
        const result = await cartCollection.findOne(query);
        if (!result) {
          return res.status(404).send({ message: "Product not found in cart" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });
    // Route to get all products in a user's cart
    app.get("/cart/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (!email) {
        return res.status(400).send({ message: "Email parameter is required" });
      }

      const decodedEmail = req.decoded?.email;
      if (decodedEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      try {
        const query = { userEmail: email };
        const result = await cartCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });
    // Route to post product in a user's cart
    app.post("/addCart", verifyJWT, async (req, res) => {
      const product = req.body;
      const totalAmount = product.quantity * product.price;
      product.totalAmount = totalAmount;

      // Check if body is empty
      if (!product || Object.keys(product).length === 0) {
        return res
          .status(400)
          .send({ message: "Request body cannot be empty" });
      }

      // Check for required fields
      const { name, quantity, userEmail, userName, photos, productId } =
        product;
      if (!name) {
        return res.status(400).send({ message: "Name is required" });
      }
      if (quantity == null) {
        return res.status(400).send({ message: "Quantity is required" });
      }
      if (!userEmail) {
        return res.status(400).send({ message: "User email is required" });
      }
      if (!userName) {
        return res.status(400).send({ message: "User name is required" });
      }
      if (!photos) {
        return res.status(400).send({ message: "Photo URL is required" });
      }
      if (!productId) {
        return res.status(400).send({ message: "ProductId is required" });
      }
      try {
        const query = { userEmail: userEmail, name: name };

        // Find the existing product in the cart
        const productToUpdate = await cartCollection.findOne(query);

        if (productToUpdate) {
          // Update quantity if product exists
          const updatedQuantity = productToUpdate.quantity + quantity;
          const updatedTotalAmount = updatedQuantity * product.price;
          const updateResult = await cartCollection.updateOne(query, {
            $set: {
              quantity: updatedQuantity,
              totalAmount: updatedTotalAmount,
            },
          });
          res.send(updateResult);
        } else {
          // Create a new product if it doesn't exist
          const result = await cartCollection.insertOne(product);
          res.send(result);
        }
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Route to update a product in a user's cart
    app.patch("/updateCartItem/:id", async (req, res) => {
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
        const result = await cartCollection.updateOne(query, update);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Product not found in cart" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Route to delete a product from a user's cart
    app.delete("/deleteCart/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      // Validate the id parameter
      if (!id) {
        return res.status(400).send({ message: "ID parameter is required" });
      }
      try {
        const query = { _id: new ObjectId(id) };
        const result = await cartCollection.deleteOne(query);
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Product not found in cart" });
        }
        res.send({ message: "Product deleted successfully", result });
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Route to delete all products from a user's cart
    app.delete("/deleteUserCartItems/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      // Validate the email parameter
      if (!email) {
        return res.status(400).send({ message: "Email parameter is required" });
      }
      const decodedEmail = req.decoded?.email;
      if (decodedEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      try {
        const query = { userEmail: email };
        const result = await cartCollection.deleteMany(query);
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Cart is empty" });
        }
        res.send({ message: "Cart deleted successfully", result });
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // -------------------------purchase and payment api---------------------------------
    // Route to get all purchase items
    app.get("/purchasesItems", verifyJWT, async (req, res) => {
      try {
        const purchases = await purchaseCollection.find().toArray();
        const items = purchases
          .filter((purchase) => Array.isArray(purchase.items)) // Ensure items is an array
          .flatMap((purchase) => purchase.items); // Flatten the arrays into a single array
        res.send(items);
      } catch (error) {
        console.error("Error fetching purchase items:", error);
        res.status(500).send("Internal Server Error");
      }
    });
    // Route to get all purchase items by user email
    app.get("/purchasesItems/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded?.email;
      if (decodedEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      try {
        const query = { userEmail: email };
        const purchases = await purchaseCollection.find(query).toArray();
        const items = purchases
          .filter((purchase) => Array.isArray(purchase.items)) // Ensure items is an array
          .flatMap((purchase) => purchase.items); // Flatten the arrays into a single array
        res.send(items);
      } catch (error) {
        console.error("Error fetching purchase items:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // Route to add a purchase

    app.post("/addPurchase", verifyJWT, async (req, res) => {
      const purchase = req.body;

      // Check if body is empty
      if (!purchase || Object.keys(purchase).length === 0) {
        return res
          .status(400)
          .send({ message: "Request body cannot be empty" });
      }

      // Check for required fields
      const {
        userEmail,
        paymentMethod,
        delivery,
        userPhone,
        userCity,
        userDistrict,
        userCountry,
        items, // Assuming 'items' is an array of objects with 'productId' and 'quantity'
      } = purchase;

      if (
        !userEmail ||
        !paymentMethod ||
        !delivery ||
        !userPhone ||
        !userCity ||
        !userDistrict ||
        !userCountry ||
        !items ||
        items.length === 0
      ) {
        return res.status(400).send({ message: "Required fields are missing" });
      }

      try {
        // Update product quantities
        for (const item of items) {
          const { productId, quantity } = item;
          const query = { _id: new ObjectId(productId) };
          const id = new ObjectId(productId);

          const product = await productCollection.findOne(query);

          if (!product) {
            return res
              .status(404)
              .send({ message: `Product with ID ${productId} not found` });
          }

          // Ensure product.quantity is a number
          let currentQuantity = parseInt(product.quantity, 10);
          if (isNaN(currentQuantity)) {
            return res.status(400).send({
              message: `Quantity for product ${productId} is not a number`,
            });
          }

          if (currentQuantity < quantity) {
            return res
              .status(400)
              .send({ message: `Not enough stock for product ${productId}` });
          }

          // Update product quantity
          const updateResult = await productCollection.updateOne(
            { _id: id },
            { $set: { quantity: currentQuantity - quantity } }, // Set new quantity explicitly
            { returnOriginal: false }
          );

          // Check if update was successful
          if (updateResult.modifiedCount !== 1) {
            throw new Error(
              `Failed to update product quantity for productId ${productId}`
            );
          }
        }

        // Insert purchase into the database
        const result = await purchaseCollection.insertOne(purchase);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "An error occurred", error: error.message });
      }
    });

    // Route to update a purchase by ID
    app.patch(
      "/updatePurchase/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { delivery, paymentStatus, paidAmount, totalDue } = req.body;

        // Validate ObjectID
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid purchase ID" });
        }

        // Check if necessary fields are present in the body
        if (!delivery && !paymentStatus) {
          return res.status(400).send({
            message: "Request body must contain 'delivery' or 'payment' fields",
          });
        }

        // Prepare the update document dynamically based on provided fields
        const update = { $set: {} };
        update.$set["paidAmount"] = paidAmount;
        update.$set["totalDue"] = totalDue;
        if (delivery) {
          update.$set["delivery"] = delivery;
          update.$set["items.$[elem].delivery"] = delivery;
        }
        if (paymentStatus) {
          update.$set["paymentStatus"] = paymentStatus;
          update.$set["items.$[elem].paymentStatus"] = paymentStatus;
        }

        try {
          const query = { _id: new ObjectId(id) };
          const options = {
            arrayFilters: [
              {
                "elem.delivery": { $exists: true },
                "elem.paymentStatus": { $exists: true },
              },
            ],
          };

          const result = await purchaseCollection.updateOne(
            query,
            update,
            options
          );
          if (result.matchedCount === 0) {
            return res.status(404).send({ message: "Purchase not found" });
          }
          res.send(result);
        } catch (error) {
          res.status(500).send({ message: "An error occurred", error });
        }
      }
    );

    // Route delete all purchase items
    app.delete("/deleteAllPurchaseItems", verifyJWT, async (req, res) => {
      try {
        const result = await purchaseCollection.deleteMany({});
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });
    // ----------------Route to get all payments----------------------------
    app.get("/paymentInfo", verifyJWT, async (req, res) => {
      const result = await purchaseCollection.find().toArray();
      res.send(result);
    });

    // Route to get all payments by user email
    app.get("/paymentInfo/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded?.email;
      if (decodedEmail !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { userEmail: email };
      const result = await purchaseCollection.find(query).toArray();
      res.send(result);
    });

    // Route to get all payments by id
    app.get("/singlePaymentInfo/:id", async (req, res) => {
      const id = req.params.id;
      // Validate ObjectID
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid purchase ID" });
      }
      const query = { _id: new ObjectId(id) };
      try {
        const result = await purchaseCollection.findOne(query);
        if (!result) {
          return res.status(404).send({ message: "Purchase not found" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });
    // ------------------------Stripe Payment Intent API--------------------------------

    // Route to create a payment intent
    app.post("/createPaymentIntent",verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100); // Convert the price to cents
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
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
