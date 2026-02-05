-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "sui_address" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trader_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_trades" INTEGER NOT NULL DEFAULT 0,
    "win_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_pnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_trade_size" DOUBLE PRECISION,
    "max_drawdown" DOUBLE PRECISION,
    "sharpe_ratio" DOUBLE PRECISION,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trader_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copy_relations" (
    "id" TEXT NOT NULL,
    "trader_id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "copy_ratio" DOUBLE PRECISION NOT NULL,
    "max_position_size" DOUBLE PRECISION,
    "stop_loss_percent" DOUBLE PRECISION,
    "take_profit_percent" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copy_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_pairs" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "base_asset" TEXT NOT NULL,
    "quote_asset" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "min_quantity" DOUBLE PRECISION NOT NULL,
    "max_leverage" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trading_pair_id" TEXT NOT NULL,
    "position_type" TEXT NOT NULL,
    "entry_price" DOUBLE PRECISION NOT NULL,
    "current_price" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION NOT NULL,
    "leverage" DOUBLE PRECISION NOT NULL,
    "margin" DOUBLE PRECISION NOT NULL,
    "unrealized_pnl" DOUBLE PRECISION,
    "realized_pnl" DOUBLE PRECISION,
    "stop_loss_price" DOUBLE PRECISION,
    "take_profit_price" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "is_copy_trade" BOOLEAN NOT NULL DEFAULT false,
    "original_position_id" TEXT,
    "copy_relation_id" TEXT,
    "on_chain_position_id" TEXT,
    "tx_hash" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trading_pair_id" TEXT NOT NULL,
    "trade_type" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,
    "pnl" DOUBLE PRECISION,
    "tx_hash" TEXT NOT NULL,
    "block_number" BIGINT,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_sui_address_key" ON "users"("sui_address");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_sui_address_idx" ON "users"("sui_address");

-- CreateIndex
CREATE UNIQUE INDEX "trader_profiles_user_id_key" ON "trader_profiles"("user_id");

-- CreateIndex
CREATE INDEX "trader_profiles_user_id_idx" ON "trader_profiles"("user_id");

-- CreateIndex
CREATE INDEX "trader_profiles_is_public_idx" ON "trader_profiles"("is_public");

-- CreateIndex
CREATE INDEX "copy_relations_trader_id_idx" ON "copy_relations"("trader_id");

-- CreateIndex
CREATE INDEX "copy_relations_follower_id_idx" ON "copy_relations"("follower_id");

-- CreateIndex
CREATE INDEX "copy_relations_is_active_idx" ON "copy_relations"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "copy_relations_trader_id_follower_id_key" ON "copy_relations"("trader_id", "follower_id");

-- CreateIndex
CREATE UNIQUE INDEX "trading_pairs_symbol_key" ON "trading_pairs"("symbol");

-- CreateIndex
CREATE INDEX "trading_pairs_symbol_idx" ON "trading_pairs"("symbol");

-- CreateIndex
CREATE INDEX "trading_pairs_is_active_idx" ON "trading_pairs"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "positions_on_chain_position_id_key" ON "positions"("on_chain_position_id");

-- CreateIndex
CREATE INDEX "positions_user_id_idx" ON "positions"("user_id");

-- CreateIndex
CREATE INDEX "positions_status_idx" ON "positions"("status");

-- CreateIndex
CREATE INDEX "positions_on_chain_position_id_idx" ON "positions"("on_chain_position_id");

-- CreateIndex
CREATE INDEX "positions_original_position_id_idx" ON "positions"("original_position_id");

-- CreateIndex
CREATE INDEX "trades_position_id_idx" ON "trades"("position_id");

-- CreateIndex
CREATE INDEX "trades_user_id_idx" ON "trades"("user_id");

-- CreateIndex
CREATE INDEX "trades_tx_hash_idx" ON "trades"("tx_hash");

-- CreateIndex
CREATE INDEX "trades_executed_at_idx" ON "trades"("executed_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- AddForeignKey
ALTER TABLE "trader_profiles" ADD CONSTRAINT "trader_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_relations" ADD CONSTRAINT "copy_relations_trader_id_fkey" FOREIGN KEY ("trader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_relations" ADD CONSTRAINT "copy_relations_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_trading_pair_id_fkey" FOREIGN KEY ("trading_pair_id") REFERENCES "trading_pairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_original_position_id_fkey" FOREIGN KEY ("original_position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_copy_relation_id_fkey" FOREIGN KEY ("copy_relation_id") REFERENCES "copy_relations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_trading_pair_id_fkey" FOREIGN KEY ("trading_pair_id") REFERENCES "trading_pairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
