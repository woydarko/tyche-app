#!/usr/bin/env node
// src/db/migrate.js — Database migration script
// Run: node src/db/migrate.js

import pg from 'pg';
import config from '../config.js';

const { Pool } = pg;

const pool = new Pool({ connectionString: config.databaseUrl });

const migrations = [
  {
    name: '001_create_wallets',
    sql: `
      CREATE TABLE IF NOT EXISTS wallets (
        address     TEXT PRIMARY KEY,
        ens_name    TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wallets_ens ON wallets(ens_name);
    `,
  },
  {
    name: '002_create_scores',
    sql: `
      CREATE TABLE IF NOT EXISTS scores (
        address             TEXT PRIMARY KEY REFERENCES wallets(address) ON DELETE CASCADE,
        accuracy_score      NUMERIC NOT NULL DEFAULT 0,
        alpha_score         NUMERIC NOT NULL DEFAULT 0,
        calibration_score   NUMERIC NOT NULL DEFAULT 0,
        consistency_score   NUMERIC NOT NULL DEFAULT 0,
        composite_score     NUMERIC NOT NULL DEFAULT 0,
        tier                SMALLINT NOT NULL DEFAULT 0,
        total_predictions   INTEGER NOT NULL DEFAULT 0,
        total_wins          INTEGER NOT NULL DEFAULT 0,
        total_pnl           NUMERIC NOT NULL DEFAULT 0,
        last_update_block   BIGINT NOT NULL DEFAULT 0,
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_scores_composite ON scores(composite_score DESC);
      CREATE INDEX IF NOT EXISTS idx_scores_tier ON scores(tier);
    `,
  },
  {
    name: '003_create_markets',
    sql: `
      CREATE TABLE IF NOT EXISTS markets (
        market_id    TEXT PRIMARY KEY,
        title        TEXT,
        category     TEXT,
        platform     TEXT NOT NULL DEFAULT 'mock',
        outcome      BOOLEAN,
        resolved     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at  TIMESTAMPTZ,
        block_number BIGINT NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category);
      CREATE INDEX IF NOT EXISTS idx_markets_resolved ON markets(resolved);
    `,
  },
  {
    name: '004_create_predictions',
    sql: `
      CREATE TABLE IF NOT EXISTS predictions (
        id           BIGSERIAL PRIMARY KEY,
        market_id    TEXT REFERENCES markets(market_id) ON DELETE SET NULL,
        wallet       TEXT NOT NULL,
        category     TEXT,
        platform     TEXT NOT NULL DEFAULT 'mock',
        position     BOOLEAN,
        entry_odds   NUMERIC,
        exit_odds    NUMERIC,
        amount       NUMERIC,
        result       TEXT CHECK (result IN ('WIN', 'LOSS', 'PENDING')) NOT NULL DEFAULT 'PENDING',
        pnl          NUMERIC,
        score_impact NUMERIC,
        block_number BIGINT NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        settled_at   TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_predictions_wallet ON predictions(wallet);
      CREATE INDEX IF NOT EXISTS idx_predictions_market ON predictions(market_id);
      CREATE INDEX IF NOT EXISTS idx_predictions_result ON predictions(result);
      CREATE INDEX IF NOT EXISTS idx_predictions_category ON predictions(category);
      CREATE INDEX IF NOT EXISTS idx_predictions_created ON predictions(created_at DESC);
    `,
  },
  {
    name: '005_create_category_scores',
    sql: `
      CREATE TABLE IF NOT EXISTS category_scores (
        wallet        TEXT NOT NULL,
        category      TEXT NOT NULL,
        wins          INTEGER NOT NULL DEFAULT 0,
        total         INTEGER NOT NULL DEFAULT 0,
        mastery_score NUMERIC NOT NULL DEFAULT 0,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (wallet, category)
      );
      CREATE INDEX IF NOT EXISTS idx_category_scores_wallet ON category_scores(wallet);
      CREATE INDEX IF NOT EXISTS idx_category_scores_mastery ON category_scores(mastery_score DESC);
    `,
  },
  {
    name: '006_create_seasons',
    sql: `
      CREATE TABLE IF NOT EXISTS seasons (
        id              BIGINT PRIMARY KEY,
        start_block     BIGINT NOT NULL,
        end_block       BIGINT NOT NULL,
        finalized       BOOLEAN NOT NULL DEFAULT FALSE,
        top_predictors  JSONB,
        top_scores      JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finalized_at    TIMESTAMPTZ
      );
    `,
  },
  {
    name: '007_create_badges',
    sql: `
      CREATE TABLE IF NOT EXISTS badges (
        id          BIGSERIAL PRIMARY KEY,
        wallet      TEXT NOT NULL,
        season_id   BIGINT REFERENCES seasons(id) ON DELETE SET NULL,
        badge_type  TEXT NOT NULL,
        metadata    JSONB,
        earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_badges_wallet ON badges(wallet);
      CREATE INDEX IF NOT EXISTS idx_badges_season ON badges(season_id);
    `,
  },
  {
    name: '008_create_social_follows',
    sql: `
      CREATE TABLE IF NOT EXISTS social_follows (
        follower     TEXT NOT NULL,
        target       TEXT NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        block_number BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (follower, target)
      );
      CREATE INDEX IF NOT EXISTS idx_follows_follower ON social_follows(follower);
      CREATE INDEX IF NOT EXISTS idx_follows_target ON social_follows(target);
    `,
  },
  {
    name: '009_create_feed_events',
    sql: `
      CREATE TABLE IF NOT EXISTS feed_events (
        id              BIGSERIAL PRIMARY KEY,
        event_type      TEXT NOT NULL,
        actor_wallet    TEXT NOT NULL,
        related_wallet  TEXT,
        market_id       TEXT,
        metadata        JSONB,
        block_number    BIGINT NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_feed_actor ON feed_events(actor_wallet);
      CREATE INDEX IF NOT EXISTS idx_feed_related ON feed_events(related_wallet);
      CREATE INDEX IF NOT EXISTS idx_feed_type ON feed_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_feed_block ON feed_events(block_number DESC);
      CREATE INDEX IF NOT EXISTS idx_feed_created ON feed_events(created_at DESC);
    `,
  },
  {
    name: '010_create_score_history',
    sql: `
      CREATE TABLE IF NOT EXISTS score_history (
        id              BIGSERIAL PRIMARY KEY,
        wallet          TEXT NOT NULL,
        composite_score NUMERIC NOT NULL,
        tier            SMALLINT NOT NULL,
        block_number    BIGINT NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_score_history_wallet ON score_history(wallet);
      CREATE INDEX IF NOT EXISTS idx_score_history_block ON score_history(block_number DESC);
    `,
  },
  {
    name: '011_create_migrations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Ensure migrations table exists first
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const migration of migrations) {
      const { rows } = await client.query(
        'SELECT name FROM schema_migrations WHERE name = $1',
        [migration.name]
      );

      if (rows.length > 0) {
        console.log(`[migrate] Skipping ${migration.name} (already applied)`);
        continue;
      }

      console.log(`[migrate] Applying ${migration.name}...`);
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [migration.name]
        );
        await client.query('COMMIT');
        console.log(`[migrate] ✓ ${migration.name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] ✗ ${migration.name}: ${err.message}`);
        throw err;
      }
    }

    console.log('[migrate] All migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('[migrate] Fatal:', err.message);
  process.exit(1);
});
