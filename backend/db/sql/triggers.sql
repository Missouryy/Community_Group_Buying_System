-- Triggers for Community Group Buying System (Django table names)
DELIMITER $$

-- Safety drops
DROP TRIGGER IF EXISTS before_groupbuy_status_autoset $$
DROP TRIGGER IF EXISTS after_groupbuy_success_update_orders $$
DROP TRIGGER IF EXISTS after_product_stock_update $$
DROP TRIGGER IF EXISTS after_order_completion_commission $$

-- Trigger 1A: BEFORE UPDATE on GroupBuys to set status to 'successful'
CREATE TRIGGER before_groupbuy_status_autoset
BEFORE UPDATE ON api_groupbuy
FOR EACH ROW
BEGIN
    IF NEW.current_participants >= NEW.target_participants AND OLD.status != 'successful' THEN
        SET NEW.status = 'successful';
    END IF;
END $$

-- Trigger 1B: AFTER UPDATE on GroupBuys to update related Orders when groupbuy becomes successful
CREATE TRIGGER after_groupbuy_success_update_orders
AFTER UPDATE ON api_groupbuy
FOR EACH ROW
BEGIN
    IF NEW.status = 'successful' AND OLD.status != 'successful' THEN
        UPDATE api_order
        SET status = 'successful'
        WHERE group_buy_id = NEW.id AND status = 'awaiting_group_success';
    END IF;
END $$

-- Trigger 2: AFTER UPDATE on Products for low stock alert
CREATE TRIGGER after_product_stock_update
AFTER UPDATE ON api_product
FOR EACH ROW
BEGIN
    IF NEW.stock_quantity < NEW.warning_threshold AND NEW.stock_quantity < OLD.stock_quantity THEN
        INSERT INTO api_alert (product_id, message)
        VALUES (NEW.id, CONCAT('商品 "', NEW.name, '" 库存不足 (', NEW.stock_quantity, '), 请及时补货!'));
    END IF;
END $$

-- Trigger 3: AFTER UPDATE on Orders for leader commission when completed
CREATE TRIGGER after_order_completion_commission
AFTER UPDATE ON api_order
FOR EACH ROW
BEGIN
    DECLARE v_leader_id INT;
    DECLARE v_commission_amount DECIMAL(10, 2);
    DECLARE v_commission_rate DECIMAL(5, 2);
    DECLARE v_product_id INT;

    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        SELECT gb.leader_id, gb.product_id INTO v_leader_id, v_product_id
        FROM api_groupbuy gb
        WHERE gb.id = NEW.group_buy_id;

        SELECT p.commission_rate INTO v_commission_rate
        FROM api_product p
        WHERE p.id = v_product_id;

        SET v_commission_amount = NEW.total_price * v_commission_rate;

        UPDATE api_user
        SET total_commission = total_commission + v_commission_amount
        WHERE id = v_leader_id;
    END IF;
END $$

DELIMITER ;


