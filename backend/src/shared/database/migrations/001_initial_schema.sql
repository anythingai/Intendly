-- Initial database schema for Intent-Based Trading Aggregator
-- Creates tables for intents, bids, solvers, and fills

BEGIN;

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Intent status enum
CREATE TYPE intent_status AS ENUM (
  'NEW',
  'BROADCASTING',
  'BIDDING',
  'FILLED',
  'EXPIRED',
  'FAILED',
  'CANCELLED'
);

-- Bid status enum
CREATE TYPE bid_status AS ENUM (
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'WON',
  'LOST',
  'INVALID'
);

-- Intents table
CREATE TABLE intents (
  intent_hash VARCHAR(66) PRIMARY KEY, -- 0x + 64 chars
  payload JSONB NOT NULL,
  signature VARCHAR(132) NOT NULL, -- 0x + 130 chars for signature
  signer VARCHAR(42) NOT NULL, -- Ethereum address
  status intent_status NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  total_bids INTEGER DEFAULT 0,
  best_bid JSONB
);

-- Solvers table
CREATE TABLE solvers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solver_id VARCHAR(42) UNIQUE NOT NULL, -- Ethereum address
  public_key VARCHAR(132) NOT NULL, -- Public key for signature verification
  metadata JSONB,
  is_allowed BOOLEAN NOT NULL DEFAULT true,
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  total_bids INTEGER DEFAULT 0,
  won_bids INTEGER DEFAULT 0,
  win_rate DECIMAL(5,4) DEFAULT 0.0000, -- Percentage as decimal
  reputation_score DECIMAL(3,2) DEFAULT 0.00 -- 0-100 score
);

-- Bids table
CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_hash VARCHAR(66) NOT NULL REFERENCES intents(intent_hash) ON DELETE CASCADE,
  solver_id VARCHAR(42) NOT NULL REFERENCES solvers(solver_id),
  quote_out NUMERIC(78, 0) NOT NULL, -- Large number for token amounts
  solver_fee_bps INTEGER NOT NULL CHECK (solver_fee_bps >= 0 AND solver_fee_bps <= 10000),
  payload_uri TEXT, -- Optional URI for additional bid data
  solver_signature VARCHAR(132) NOT NULL,
  status bid_status NOT NULL DEFAULT 'PENDING',
  arrived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  rank INTEGER,
  score DECIMAL(10,6) -- Bid scoring value
);

-- Fills table (for tracking successful intent settlements)
CREATE TABLE fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_hash VARCHAR(66) NOT NULL REFERENCES intents(intent_hash),
  winning_bid_id UUID NOT NULL REFERENCES bids(id),
  tx_hash VARCHAR(66) NOT NULL,
  amount_out NUMERIC(78, 0) NOT NULL,
  solver_fee_paid NUMERIC(78, 0) NOT NULL,
  gas_used INTEGER,
  gas_price NUMERIC(78, 0),
  block_number BIGINT,
  filled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance

-- Intent indexes
CREATE INDEX idx_intents_signer ON intents(signer);
CREATE INDEX idx_intents_status ON intents(status);
CREATE INDEX idx_intents_created_at ON intents(created_at);
CREATE INDEX idx_intents_expires_at ON intents(expires_at);
CREATE INDEX idx_intents_status_expires ON intents(status, expires_at);

-- Solver indexes
CREATE INDEX idx_solvers_solver_id ON solvers(solver_id);
CREATE INDEX idx_solvers_is_allowed ON solvers(is_allowed);
CREATE INDEX idx_solvers_win_rate ON solvers(win_rate DESC);
CREATE INDEX idx_solvers_reputation ON solvers(reputation_score DESC);

-- Bid indexes
CREATE INDEX idx_bids_intent_hash ON bids(intent_hash);
CREATE INDEX idx_bids_solver_id ON bids(solver_id);
CREATE INDEX idx_bids_status ON bids(status);
CREATE INDEX idx_bids_arrived_at ON bids(arrived_at);
CREATE INDEX idx_bids_score ON bids(score DESC);
CREATE INDEX idx_bids_rank ON bids(rank);
CREATE INDEX idx_bids_intent_status ON bids(intent_hash, status);
CREATE INDEX idx_bids_intent_score ON bids(intent_hash, score DESC);

-- Fill indexes
CREATE INDEX idx_fills_intent_hash ON fills(intent_hash);
CREATE INDEX idx_fills_winning_bid ON fills(winning_bid_id);
CREATE INDEX idx_fills_tx_hash ON fills(tx_hash);
CREATE INDEX idx_fills_filled_at ON fills(filled_at);
CREATE INDEX idx_fills_block_number ON fills(block_number);

-- Create partial indexes for active records
CREATE INDEX idx_intents_active ON intents(created_at) 
  WHERE status IN ('NEW', 'BROADCASTING', 'BIDDING');

CREATE INDEX idx_bids_active ON bids(arrived_at) 
  WHERE status IN ('PENDING', 'ACCEPTED');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_intents_updated_at 
  BEFORE UPDATE ON intents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_solvers_updated_at 
  BEFORE UPDATE ON solvers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update solver statistics
CREATE OR REPLACE FUNCTION update_solver_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total_bids count
  UPDATE solvers 
  SET total_bids = (
    SELECT COUNT(*) FROM bids WHERE solver_id = NEW.solver_id
  )
  WHERE solver_id = NEW.solver_id;
  
  -- Update won_bids count and win_rate
  UPDATE solvers 
  SET 
    won_bids = (
      SELECT COUNT(*) FROM bids 
      WHERE solver_id = NEW.solver_id AND status = 'WON'
    ),
    win_rate = CASE 
      WHEN total_bids > 0 THEN 
        (SELECT COUNT(*) FROM bids WHERE solver_id = NEW.solver_id AND status = 'WON')::DECIMAL / total_bids
      ELSE 0.0
    END
  WHERE solver_id = NEW.solver_id;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update solver stats when bid status changes
CREATE TRIGGER update_solver_stats_on_bid_change
  AFTER INSERT OR UPDATE OF status ON bids
  FOR EACH ROW EXECUTE FUNCTION update_solver_stats();

-- Function to clean up expired intents
CREATE OR REPLACE FUNCTION cleanup_expired_intents()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Mark expired intents
  UPDATE intents 
  SET status = 'EXPIRED', updated_at = NOW()
  WHERE expires_at < NOW() 
    AND status NOT IN ('FILLED', 'EXPIRED', 'CANCELLED', 'FAILED');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Mark associated bids as expired
  UPDATE bids 
  SET status = 'EXPIRED'
  WHERE intent_hash IN (
    SELECT intent_hash FROM intents WHERE status = 'EXPIRED'
  ) AND status = 'PENDING';
  
  RETURN updated_count;
END;
$$ language 'plpgsql';

COMMIT;