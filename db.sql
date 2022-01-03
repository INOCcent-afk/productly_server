CREATE DATABASE productly_db;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users(
    user_id UUID DEFAULT uuid_generate_v4(),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    cover_photo TEXT,
    display_picture TEXT,
    PRIMARY KEY(user_id)
);

CREATE TABLE products(
    product_id BIGSERIAL NOT NULL,
    user_id UUID NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    product_description TEXT NOT NULL,
    product_image VARCHAR(250) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(product_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE reviews(
    review_id BIGSERIAL NOT NULL,
    user_id UUID NOT NULL,
    reviews_product_id BIGINT NOT NULL,
    review_message TEXT,
    rating INT NOT NULL check(rating >= 1 and rating <=5 ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(review_id),
    FOREIGN KEY (reviews_product_id) REFERENCES products(product_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

INSERT INTO users(first_name, last_name, email, password) values('dave', 'Inoc', 'daveinoc@gmail.com', 'passwordinoc');

INSERT INTO products(user_id, product_name, product_description, product_image) values('166e0efb-ee3f-47ab-b8c9-5c9b74187ec4', 'Nescafe', '100% pure soluble instant coffee. With NESCAFE Classic, you prepare every cup with real coffee flavor. Made with only high quality beans, every cup is a guarantee that youll get great coffee taste and superb aroma no matter how you mix it.', '');

INSERT INTO products(user_id, product_name, product_description, product_image) values('166e0efb-ee3f-47ab-b8c9-5c9b74187ec4', 'Zibra', 'Best Burger Refreshing!', 'https://images.pexels.com/photos/341523/pexels-photo-341523.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940');

INSERT INTO reviews(reviews_product_id, user_id, review_message, rating) values('2', '166e0efb-ee3f-47ab-b8c9-5c9b74187ec4', 'quite sweet it probably helps the flavor', 5);
INSERT INTO reviews(reviews_product_id, user_id, review_message, rating) values('2', '166e0efb-ee3f-47ab-b8c9-5c9b74187ec4', 'Very refreshing indeed', 5);

"166e0efb-ee3f-47ab-b8c9-5c9b74187ec4"

SELECT 
    users.user_id,
    display_name, 
    email, 
    cover_photo, 
    display_picture,
    product_id, 
    product_name,
    product_description
FROM 
    users 
    LEFT JOIN products ON users.user_id = products.user_id; 

SELECT count(rating) FROM reviews WHERE user_id = '166e0efb-ee3f-47ab-b8c9-5c9b74187ec4';
SELECT count(review_message) FROM reviews WHERE user_id = '166e0efb-ee3f-47ab-b8c9-5c9b74187ec4';

SELECT TRUNC(AVG(rating),2) AS average_rating FROM reviews WHERE product_id = 2;
SELECT TRUNC(AVG(rating),2) AS average_rating FROM reviews GROUP BY product_id;

SELECT * FROM products LEFT JOIN (SELECT reviews_product_id, COUNT(*), TRUNC(AVG(rating),1) AS average_rating FROM reviews GROUP BY reviews_product_id) reviews on products.product_id = reviews.reviews_product_id;

-- Multipage Pagination 
SELECT 
    (SELECT COUNT(*) FROM users) as count, 
    (SELECT json_agg(t.*) FROM (
        SELECT * FROM users
        LIMIT 2 OFFSET (1 - 1) * 2
    ) AS t) AS rows;

-- start of next prev pagination

-- Create Index
CREATE UNIQUE INDEX index_id ON users USING btree(user_id ASC);

-- 1st Page
SELECT * FROM users ORDER BY user_id ASC LIMIT 2;

-- 2nd Page
SELECT * FROM users WHERE user_id > '7f82dd81-0b9f-4011-ad80-0a4824a3cf3d' ORDER BY user_id ASC LIMIT 2;

-- end of next prev pagination

select * from users where lower(first_name) || ' ' || lower(last_name)  'D';

UPDATE users SET 
          first_name = COALESCE('', first_name), 
          last_name = COALESCE('', last_name), 
          bio_description = COALESCE('', bio_description), 
          display_picture = COALESCE(null, display_picture), 
          cover_photo = COALESCE(null, cover_photo) 
        
        WHERE user_id = '7f82dd81-0b9f-4011-ad80-0a4824a3cf3d'
        AND ( coalesce('', '') = '' AND '' IS DISTINCT FROM first_name OR 
              coalesce('', '') = '' AND '' IS DISTINCT FROM last_name OR 
              coalesce('', '') = '' AND '' IS DISTINCT FROM bio_description OR 
              coalesce(null, '') = '' AND null IS DISTINCT FROM display_picture OR 
              coalesce(null, '') = '' AND null IS DISTINCT FROM cover_photo ) returning *;
              
select count(reviews_product_id) from reviews where reviews_product_id = '2' and review_message <> '';

SELECT product_name, product_description, product_image, count, average_rating, latest_review_date, product_id, user_id
    FROM products INNER JOIN 
    (SELECT reviews_product_id, MAX(created_at) AS latest_review_date, COUNT(*), TRUNC(AVG(rating),1) AS average_rating FROM reviews WHERE reviews.user_id = '339d1daa-2f66-46b7-b7bd-bdd980039185' GROUP BY reviews_product_id) 
        reviews 
        on products.product_id = reviews.reviews_product_id;

'339d1daa-2f66-46b7-b7bd-bdd980039185'

UPDATE users SET 
        first_name = COALESCE('maytmar', first_name), 
        last_name = COALESCE('inoc', last_name), 
        bio_description = COALESCE('nice', bio_description), 
        display_picture = COALESCE(null, display_picture), 
        cover_photo = COALESCE(null, cover_photo) 

        WHERE user_id = 'ef087746-f7b8-48c1-9610-b136acfb6cb3'
        AND ( ('maytmar'::VARCHAR(255) <> '') IS NOT TRUE AND 'maytmar' IS DISTINCT FROM first_name OR 
                ('inoc'::VARCHAR(255) <> '') IS NOT TRUE AND 'inoc' IS DISTINCT FROM last_name OR 
                ('nice'::TEXT <> '') IS NOT TRUE AND 'nice' IS DISTINCT FROM bio_description OR 
                (''::TEXT <> '') IS NOT TRUE AND '' IS DISTINCT FROM display_picture OR 
                (''::TEXT <> '') IS NOT TRUE AND '' IS DISTINCT FROM cover_photo ) returning *;

    UPDATE users SET 
        first_name = COALESCE('maytmar', first_name), 
        last_name = COALESCE('inoc', last_name), 
        bio_description = COALESCE(null, bio_description), 
        display_picture = COALESCE(null, display_picture), 
        cover_photo = COALESCE(null, cover_photo) 

        WHERE user_id = 'ef087746-f7b8-48c1-9610-b136acfb6cb3';

        SELECT * FROM products
            LEFT JOIN 
                ( SELECT reviews_product_id, COUNT(*), TRUNC(AVG(rating),1) AS average_rating FROM reviews GROUP BY reviews_product_id ) 
                    reviews 
                on products.product_id = reviews.reviews_product_id
                WHERE LOWER(product_name) ~* 'z';
