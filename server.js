require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./db");
const validInfo = require("./middlewares/validInfo");
const authorize = require("./middlewares/authorize");
const jwtGenerator = require("./utils/jwtGenerator");
const bcrypt = require("bcrypt");
const { cloudinary } = require("./utils/cloudinary.js");

const app = express();

app.use(express.static("public"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

app.get("/", async (req, res) => {
  res.send("<h1>Hello World</h1>");
});

// Get all users
app.get("/api/v1/productly/users", async (req, res) => {
  try {
    const users = await db.query("SELECT * FROM users");

    res.status(200).json({
      status: "success",
      results: users.rows.length,
      data: {
        users: users.rows,
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// Get single user
app.get("/api/v1/productly/user/:id", async (req, res) => {
  try {
    const user = await db.query("SELECT * FROM users WHERE user_id = $1;", [
      req.params.id,
    ]);

    const userReviewsCount = await db.query(
      "select count(user_id) from reviews where user_id = $1 and review_message <> '';",
      [req.params.id]
    );

    const userRatingsCount = await db.query(
      "SELECT count(rating) FROM reviews WHERE user_id = $1;",
      [req.params.id]
    );

    const activity = await db.query(
      `SELECT product_name, product_description, product_image, count, average_rating, latest_review_date, product_id, user_id
      FROM products INNER JOIN 
      (SELECT reviews_product_id, MAX(created_at) AS latest_review_date, COUNT(*), TRUNC(AVG(rating),1) AS average_rating FROM reviews WHERE reviews.user_id = $1 GROUP BY reviews_product_id) 
          reviews 
          on products.product_id = reviews.reviews_product_id;`,
      [req.params.id]
    );

    res.status(200).json({
      status: "success",
      user_results: user.rows.length,
      data: {
        user: user.rows[0],
        user_activity: {
          activity: activity.rows,
        },
        userReviewsCount: userReviewsCount.rows[0],
        userRatingsCount: userRatingsCount.rows[0],
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// Search single user
app.get("/api/v1/productly/user/search/:name", async (req, res) => {
  try {
    const users = await db.query(
      "SELECT user_id, first_name, last_name, display_picture FROM users WHERE LOWER(first_name) || ' ' || LOWER(last_name) ~* $1",
      [`^${req.params.name}.*`]
    );

    res.status(200).json({
      status: "success",
      user_results: users.rows.length,
      data: {
        users: users.rows,
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// Sign up
app.post("/api/v1/productly/signup", validInfo, async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    password,
    cover_photo,
    display_picture,
  } = req.body;

  try {
    const user = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (user.rows.length > 0) {
      return res.status(401).json("User already exist!");
    }

    const salt = await bcrypt.genSalt(10);
    const bcryptPassword = await bcrypt.hash(password, salt);

    let newUser = await db.query(
      "INSERT INTO users (first_name, last_name, email, password, cover_photo, display_picture) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [
        first_name,
        last_name,
        email,
        bcryptPassword,
        cover_photo,
        display_picture,
      ]
    );

    const jwtToken = jwtGenerator(newUser.rows[0].user_id);

    return res.json({ jwtToken });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Log in
app.post("/api/v1/productly/login", validInfo, async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (user.rows.length === 0) {
      return res.status(401).json("User Doesn't exists!");
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password);

    if (!validPassword) {
      return res.status(401).json("Wrong Email or Password");
    }
    const jwtToken = jwtGenerator(user.rows[0].user_id);
    return res.json({ jwtToken, user: user.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Verify
app.post("/verify", authorize, (req, res) => {
  try {
    res.json(true);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// update user info
app.put(
  "/api/v1/productly/user/:id/edit-profile",
  authorize,
  async (req, res) => {
    const {
      first_name,
      last_name,
      bio_description,
      display_picture,
      cover_photo,
    } = req.body;

    const query = `UPDATE users SET 
                      first_name = COALESCE($1, first_name),
                      last_name = COALESCE($2, last_name),
                      bio_description = COALESCE($3, bio_description),
                      display_picture = COALESCE($4, display_picture),
                      cover_photo = COALESCE($5, cover_photo)

                    WHERE user_id = $6 returning *;`;

    try {
      const avatarFile = display_picture;

      if (res.locals.user.id !== req.params.id) {
        return res.status(403).json({ msg: "authorization denied" });
      }

      if (avatarFile !== null) {
        const uploadedRespone = await cloudinary.uploader.upload(avatarFile, {
          upload_preset: "productly_images",
        });

        const results = await db.query(query, [
          first_name,
          last_name,
          bio_description,
          uploadedRespone.url,
          cover_photo,
          req.params.id,
        ]);

        res.status(200).json({
          status: "success",
          data: {
            user: results.rows[0],
          },
        });
      } else {
        const results = await db.query(query, [
          first_name,
          last_name,
          bio_description,
          display_picture,
          cover_photo,
          req.params.id,
        ]);

        res.status(200).json({
          status: "success",
          data: {
            user: results.rows[0],
          },
        });
      }
    } catch (error) {
      res.status(500).send(error.message);
    }
  }
);

// Get all Products
app.get("/api/v1/productly/products", async (req, res) => {
  try {
    const products = await db.query(
      "SELECT * FROM products LEFT JOIN (SELECT reviews_product_id, COUNT(*), TRUNC(AVG(rating),1) AS average_rating FROM reviews GROUP BY reviews_product_id) reviews on products.product_id = reviews.reviews_product_id;"
    );

    res.status(200).json({
      status: "success",
      results: products.rows.length,
      data: {
        products: products.rows,
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// Get Popular Rated Products
app.get("/api/v1/productly/products/top-rated", async (req, res) => {
  try {
    const products = await db.query(
      `SELECT * FROM products
      LEFT JOIN 
          ( SELECT reviews_product_id, COUNT(*), TRUNC(AVG(rating),1) AS average_rating FROM reviews GROUP BY reviews_product_id ) 
              reviews 
          on products.product_id = reviews.reviews_product_id
          ORDER BY average_rating DESC NULLS LAST;`
    );

    res.status(200).json({
      status: "success",
      results: products.rows.length,
      data: {
        products: products.rows,
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// Get all Products created by fe1e8579-4ff7-4a61-bdb6-128342257308
app.get("/api/v1/productly/products/:id", async (req, res) => {
  try {
    const products = await db.query(
      "SELECT * FROM products WHERE user_id = $1",
      [req.params.id]
    );

    res.status(200).json({
      status: "success",
      results: products.rows.length,
      data: {
        products: products.rows,
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// Get single product
app.get("/api/v1/productly/product/:id", async (req, res) => {
  try {
    const product = await db.query(
      "SELECT * FROM products LEFT JOIN (SELECT reviews_product_id, COUNT(*), TRUNC(AVG(rating),1) AS average_rating FROM reviews GROUP BY reviews_product_id) reviews on products.product_id = reviews.reviews_product_id WHERE products.product_id = $1",
      [req.params.id]
    );

    const productReviews = await db.query(
      "SELECT * FROM reviews WHERE reviews_product_id = $1",
      [req.params.id]
    );

    const productReviewCount = await db.query(
      "select count(reviews_product_id) from reviews where reviews_product_id = $1 and review_message <> '';",
      [req.params.id]
    );

    if (product.rows.length) {
      res.status(200).json({
        status: "success",
        results: product.rows.length,
        data: {
          product: product.rows[0],
          productReviews: productReviews.rows,
          productReviewCount: productReviewCount.rows[0],
        },
      });
    } else {
      res.status(404).json({ message: "no data found" });
    }
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// Search product
app.get("/api/v1/productly/products/search/:name", async (req, res) => {
  try {
    const products = await db.query(
      `SELECT * FROM products
      LEFT JOIN 
          ( SELECT reviews_product_id, COUNT(*), TRUNC(AVG(rating),1) AS average_rating FROM reviews GROUP BY reviews_product_id ) 
              reviews 
          on products.product_id = reviews.reviews_product_id
          WHERE LOWER(product_name) ~* $1;`,
      [`^${req.params.name}.*`]
    );

    res.status(200).json({
      status: "success",
      products_results: products.rows.length,
      data: {
        products: products.rows,
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// Get reviews of a single product
app.get("/api/v1/productly/product/:id/reviews", async (req, res) => {
  try {
    const reviews = await db.query(
      "SELECT * FROM reviews WHERE reviews_product_id = $1",
      [req.params.id]
    );

    const averageRating = await db.query(
      "SELECT TRUNC(AVG(rating),2) AS average_rating FROM reviews WHERE reviews_product_id = $1;",
      [req.params.id]
    );

    res.status(200).json({
      status: "success",
      results: reviews.rows.length,
      data: {
        reviews: reviews.rows,
        avgRating: averageRating.rows,
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// Create a review
app.post(
  "/api/v1/productly/product/:user_id/:product_id/addReview",
  async (req, res) => {
    const { review_message, rating } = req.body;

    try {
      const review = await db.query(
        "INSERT INTO reviews(reviews_product_id, user_id, review_message, rating) values($1, $2, $3, $4) returning *;",
        [req.params.product_id, req.params.user_id, review_message, rating]
      );

      res.status(200).json({
        status: "success",
        results: review.rows.length,
        data: {
          review: review.rows,
        },
      });
    } catch (error) {
      res.status(400).json({ message: { error } });
    }
  }
);

// Update a review
app.put("/api/v1/productly/product/:id/updateReview", async (req, res) => {
  const { review_message, rating } = req.body;
  try {
    const results = await db.query(
      "UPDATE reviews SET review_message = $1, rating = $2 WHERE review_id = $3 returning *;",
      [review_message, rating, req.params.id]
    );

    res.status(200).json({
      status: "success",
      data: {
        review: results.rows[0],
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// delete a review
app.delete("/api/v1/productly/product/:id/deleteReview", async (req, res) => {
  try {
    const removedReview = await db.query(
      "DELETE FROM reviews WHERE review_id = $1 returning *;",
      [req.params.id]
    );

    res.status(201).json({
      status: "success",
      data: {
        removedReview: removedReview.rows[0],
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// Create product
app.post("/api/v1/productly/product/:id/addProduct", async (req, res) => {
  const { product_name, product_description } = req.body;

  try {
    const newProduct = await db.query(
      "INSERT INTO products(user_id, product_name, product_description) values($1, $2, $3) returning *;",
      [req.params.id, product_name, product_description]
    );

    res.status(201).json({
      status: "success",
      data: {
        newProduct: newProduct.rows[0],
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// delete product
app.delete("/api/v1/productly/product/:id/deleteProduct", async (req, res) => {
  try {
    const removedProduct = await db.query(
      "DELETE FROM products WHERE product_id = $1 returning *",
      [req.params.id]
    );

    res.status(201).json({
      status: "success",
      data: {
        removedProduct: removedProduct.rows[0],
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

// Update product
app.put("/api/v1/productly/product/:id/updateProduct", async (req, res) => {
  const { product_name, product_description } = req.body;
  try {
    const results = await db.query(
      "UPDATE products SET product_name = $1, product_description = $2 WHERE product_id = $3 returning *",
      [product_name, product_description, req.params.id]
    );

    res.status(200).json({
      status: "success",
      data: {
        restaurant: results.rows[0],
      },
    });
  } catch (error) {
    res.status(400).json({ message: { error } });
  }
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server is up and listening in PORT ${PORT}`);
});
