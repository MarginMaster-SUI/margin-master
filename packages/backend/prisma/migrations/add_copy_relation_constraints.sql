-- Add CHECK constraints for CopyRelation model

-- Prevent self-copying: traderId must not equal followerId
ALTER TABLE copy_relations
ADD CONSTRAINT check_no_self_copy
CHECK (trader_id != follower_id);

-- Validate copy ratio range: 0 <= copyRatio <= 1
ALTER TABLE copy_relations
ADD CONSTRAINT check_copy_ratio_range
CHECK (copy_ratio >= 0 AND copy_ratio <= 1);
