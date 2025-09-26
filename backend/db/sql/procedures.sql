-- Data generation stored procedure for realistic dataset
DELIMITER $$

DROP PROCEDURE IF EXISTS generate_realistic_data $$

CREATE PROCEDURE generate_realistic_data(IN p_num_users INT, IN p_num_products INT, IN p_orders_per_user INT)
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE j INT DEFAULT 0;
    DECLARE k INT DEFAULT 0;
    DECLARE v_role_pick INT;
    DECLARE v_user_id INT;
    DECLARE v_leader_id INT;
    DECLARE v_category_id INT;
    DECLARE v_product_id INT;
    DECLARE v_groupbuy_id INT;
    DECLARE v_price DECIMAL(10,2);
    DECLARE v_qty INT;
    DECLARE v_total DECIMAL(10,2);
    DECLARE v_discount DECIMAL(5,2);
    DECLARE v_now TIMESTAMP;

    SET v_now = NOW();

    -- Seed tiers
    IF (SELECT COUNT(1) FROM api_membershiptier) = 0 THEN
        INSERT INTO api_membershiptier(tier_name, discount_percentage, points_required)
        VALUES ('Bronze', 0.00, 0),
               ('Silver', 2.50, 2000),
               ('Gold', 5.00, 5000),
               ('Platinum', 8.00, 10000);
    END IF;

    -- Seed categories (~10) only when table is empty
    IF (SELECT COUNT(1) FROM api_category) = 0 THEN
        SET i = 1;
        WHILE i <= 10 DO
            INSERT INTO api_category(name, parent_id) VALUES (CONCAT('分类', i), NULL);
            SET i = i + 1;
        END WHILE;
    END IF;

    -- Admin user (ensure flags)
    IF (SELECT COUNT(1) FROM api_user WHERE role='admin') = 0 THEN
        INSERT INTO api_user(
            username, password, role, email,
            first_name, last_name,
            is_staff, is_superuser, is_active,
            date_joined, total_commission, loyalty_points
        ) VALUES (
            'admin', '$2b$12$abcdefghijklmnopqrstuv', 'admin', 'admin@example.com',
            '', '',
            1, 1, 1,
            v_now, 0.00, 0
        );
    END IF;

    -- Users and leaders (10% leaders)
    SET i = 1;
    WHILE i <= p_num_users DO
        SET v_role_pick = IF(RAND() < 0.10, 1, 0);
        INSERT INTO api_user(
            username, password, role, email,
            first_name, last_name,
            leader_status, real_name, id_card,
            membership_tier_id, loyalty_points,
            is_active, is_staff, is_superuser,
            date_joined, total_commission
        )
        VALUES (
            CONCAT('user', i),
            '$2b$12$abcdefghijklmnopqrstuv',
            IF(v_role_pick=1, 'leader', 'user'),
            CONCAT('user', i, '@example.com'),
            '', '',
            IF(v_role_pick=1, 'approved', NULL),
            CONCAT('姓名', i),
            LPAD(FLOOR(RAND()*999999999999999999), 18, '0'),
            (SELECT id FROM api_membershiptier ORDER BY RAND() LIMIT 1),
            FLOOR(RAND()*5000),
            1, 0, 0,
            v_now, 0.00
        );
        SET i = i + 1;
    END WHILE;

    -- Products
    SET i = 1;
    WHILE i <= p_num_products DO
        SET v_category_id = (SELECT id FROM api_category ORDER BY RAND() LIMIT 1);
        INSERT INTO api_product(name, description, price, stock_quantity, warning_threshold, category_id, commission_rate, created_at)
        VALUES (
            CONCAT('商品', i),
            CONCAT('这是商品', i, ' 的描述'),
            ROUND(5 + RAND()*195, 2),
            FLOOR(100 + RAND()*400),
            20,
            v_category_id,
            ROUND(0.03 + RAND()*0.07, 2),
            v_now
        );
        SET i = i + 1;
    END WHILE;

    -- GroupBuys by leaders: each leader starts 3 active groupbuys
    SET i = 0;
    -- iterate leaders
    SET i = 0;
    WHILE i < (SELECT COUNT(1) FROM api_user WHERE role='leader' AND leader_status='approved') DO
        SET v_leader_id = (SELECT id FROM api_user WHERE role='leader' AND leader_status='approved' ORDER BY id LIMIT 1 OFFSET i);
        SET j = 1;
        WHILE j <= 3 DO
            SET v_product_id = (SELECT id FROM api_product ORDER BY RAND() LIMIT 1);
            INSERT INTO api_groupbuy(product_id, leader_id, target_participants, current_participants, start_time, end_time, status, created_at)
            VALUES (
                v_product_id,
                v_leader_id,
                FLOOR(10 + RAND()*20),
                0,
                DATE_SUB(v_now, INTERVAL FLOOR(RAND()*2) DAY),
                DATE_ADD(v_now, INTERVAL FLOOR(1 + RAND()*3) DAY),
                'active',
                v_now
            );
            SET j = j + 1;
        END WHILE;
        SET i = i + 1;
    END WHILE;

    -- Orders: for each normal user, create p_orders_per_user orders joining random active groupbuys
    SET i = 0;
    WHILE i < (SELECT COUNT(1) FROM api_user WHERE role='user') DO
        SET v_user_id = (SELECT id FROM api_user WHERE role='user' ORDER BY id LIMIT 1 OFFSET i);
        SET j = 1;
        WHILE j <= p_orders_per_user DO
            -- pick an active groupbuy; if none, break inner loop by advancing j
            IF (SELECT COUNT(1) FROM api_groupbuy WHERE status='active' AND end_time > v_now) = 0 THEN
                SET j = p_orders_per_user + 1;
            ELSE

                SET v_groupbuy_id = (SELECT id FROM api_groupbuy WHERE status='active' AND end_time > v_now ORDER BY RAND() LIMIT 1);
                SET v_product_id = (SELECT product_id FROM api_groupbuy WHERE id = v_groupbuy_id);
                SET v_price = (SELECT price FROM api_product WHERE id = v_product_id);
                SET v_qty = 1 + FLOOR(RAND()*3);

                -- Discount by membership tier
                SET v_discount = COALESCE((
                    SELECT discount_percentage FROM api_membershiptier mt
                    JOIN api_user u ON u.membership_tier_id = mt.id
                    WHERE u.id = v_user_id
                ), 0.00);

                SET v_total = ROUND((v_price * v_qty) * (1.00 - v_discount/100.0), 2);

                -- Ensure stock
                IF (SELECT stock_quantity FROM api_product WHERE id = v_product_id) >= v_qty THEN
                    -- create order
                INSERT INTO api_order(user_id, group_buy_id, total_price, status, created_at, updated_at)
                VALUES (v_user_id, v_groupbuy_id, v_total, 'awaiting_group_success', v_now, v_now);
                    SET @new_order_id = LAST_INSERT_ID();

                    INSERT INTO api_orderitem(order_id, product_id, quantity, price_per_unit)
                    VALUES (@new_order_id, v_product_id, v_qty, v_price);

                    -- decrement stock
                    UPDATE api_product SET stock_quantity = stock_quantity - v_qty WHERE id = v_product_id;

                    -- increment participants
                    UPDATE api_groupbuy SET current_participants = current_participants + 1 WHERE id = v_groupbuy_id;
                END IF;

                SET j = j + 1;
            END IF;
        END WHILE;
        SET i = i + 1;
    END WHILE;

END $$

DELIMITER ;


